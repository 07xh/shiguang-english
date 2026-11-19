package com.shiguang.english.nativeapp.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.coroutineContext

/**
 * Persistent, private, verified downloads. Never exposes a user-supplied URL.
 *
 * Files are written to .part then renamed after validation. An incomplete
 * download must never be advertised as installed.
 */
class OnDemandStore(context: Context) {
    private val root = File(context.applicationContext.filesDir, "authorized_content_v1")
    private val safeName = Regex("[A-Za-z0-9_-]{1,96}")
    private val allowedHosts = setOf("bilibilitoyassets.top")

    fun local(section: String, id: String, filename: String): File {
        require(section in setOf("university", "vocabulary"))
        require(safeName.matches(id))
        require(filename.matches(Regex("[a-z0-9_-]+\\.(json|mp3)")))
        return File(File(File(root, section), id), filename)
    }

    /**
     * Download with best-effort resumability. A .part file is never exposed to
     * the reader; it is kept after an interrupted network connection. HTTP 206
     * must prove that its byte range starts precisely at the saved boundary.
     * HTTP 200 while Range was requested means restart from byte zero.
     */
    suspend fun download(
        url: String,
        dest: File,
        limitBytes: Long,
        validate: (File) -> Boolean,
        progress: (Long, Long) -> Unit = { _, _ -> }
    ): File = withContext(Dispatchers.IO) {
        val target = URL(url)
        require(target.protocol == "https" && target.host in allowedHosts) {
            "下载地址不在已授权资源域名内"
        }
        require(dest.canonicalPath.startsWith(root.canonicalPath + File.separator)) {
            "无效缓存位置"
        }
        dest.parentFile?.mkdirs()
        val partial = File(dest.parentFile, dest.name + ".part")
        val origin = File(dest.parentFile, dest.name + ".part.url")
        if (!origin.isFile || runCatching { origin.readText() }.getOrNull() != url) {
            partial.delete()
        }
        origin.writeText(url)
        val prior = partial.length().takeIf { it in 1 until limitBytes } ?: 0L
        if (prior == 0L && partial.exists()) partial.delete()

        val connection = (target.openConnection() as HttpURLConnection).apply {
            connectTimeout = 12000
            readTimeout = 25000
            instanceFollowRedirects = false
            setRequestProperty("Accept", "*/*")
            setRequestProperty("Accept-Encoding", "identity")
            setRequestProperty("User-Agent", "ShiguangEnglish-AuthorizedNative/1.1")
            if (prior > 0) setRequestProperty("Range", "bytes=" + prior + "-")
        }
        try {
            val code = connection.responseCode
            val resume = code == HttpURLConnection.HTTP_PARTIAL
            if (resume && (prior == 0L || !OnDemandRange.valid(
                    connection.getHeaderField("Content-Range"), prior, limitBytes))) {
                partial.delete()
                origin.delete()
                throw IOException("服务器返回了无效的断点范围，请重试")
            }
            if (code == 416) {
                partial.delete()
                origin.delete()
                throw IOException("服务器上的音频已变化，已清理旧断点，请重试")
            }
            if (code != HttpURLConnection.HTTP_OK && !resume)
                throw IOException("资源服务器返回 HTTP " + code)
            val startAt = if (resume) prior else 0L
            val remaining = connection.contentLengthLong
            if (remaining > 0 && remaining + startAt > limitBytes) {
                partial.delete()
                origin.delete()
                throw IOException("资源超过下载大小限制")
            }
            val total = if (remaining >= 0) startAt + remaining else 0L
            var done = startAt
            progress(done, total)
            connection.inputStream.use { input ->
                FileOutputStream(partial, resume).buffered(32768).use { output ->
                    val buffer = ByteArray(32768)
                    while (true) {
                        coroutineContext.ensureActive()
                        val n = input.read(buffer)
                        if (n == -1) break
                        done += n
                        if (done > limitBytes) {
                            partial.delete()
                            origin.delete()
                            throw IOException("资源超过下载大小限制")
                        }
                        output.write(buffer, 0, n)
                        progress(done, total)
                    }
                }
            }
            if (total > 0 && done != total)
                throw IOException("网络中断，已保留 " + done + " 字节以便断点续传")
            if (done < 128 || !validate(partial)) {
                partial.delete()
                origin.delete()
                throw IOException("下载内容不是完整、有效的 JSON 或 MP3")
            }
            if (dest.exists() && !dest.delete())
                throw IOException("无法替换旧缓存")
            if (!partial.renameTo(dest)) throw IOException("无法保存下载文件")
            origin.delete()
            dest
        } finally {
            connection.disconnect()
        }
    }

    fun validMp3(file: File): Boolean {
        if (!file.isFile || file.length() < 1024) return false
        return file.inputStream().use { stream ->
            val header = ByteArray(4)
            if (stream.read(header) < 4) false
            else header[0] == 'I'.code.toByte() &&
                header[1] == 'D'.code.toByte() && header[2] == '3'.code.toByte() ||
                ((header[0].toInt() and 255) == 255 &&
                    (header[1].toInt() and 224) == 224)
        }
    }

    data class CacheStats(
        val examBytes: Long,
        val vocabBytes: Long,
        val unfinishedBytes: Long,
        val examFiles: Int,
        val vocabFiles: Int
    ) {
        val completedBytes: Long get() = examBytes + vocabBytes
    }

    suspend fun stats(): CacheStats = withContext(Dispatchers.IO) {
        fun count(section: String): Pair<Long, Int> {
            val dir = File(root, section)
            if (!dir.exists()) return 0L to 0
            val files = dir.walkTopDown().filter {
                it.isFile && !it.name.contains(".part")
            }.toList()
            return files.sumOf { it.length() } to files.size
        }
        val (examBytes, examFiles) = count("university")
        val (vocabBytes, vocabFiles) = count("vocabulary")
        val incomplete = if (!root.exists()) 0L else root.walkTopDown()
            .filter { it.isFile && it.name.endsWith(".part") }.sumOf { it.length() }
        CacheStats(examBytes, vocabBytes, incomplete, examFiles, vocabFiles)
    }

    /** Remove downloaded files only; do not touch the app's SQLite/DataStore records. */
    suspend fun clearCategory(section: String): Long = withContext(Dispatchers.IO) {
        require(section == "university" || section == "vocabulary")
        val directory = File(root, section)
        if (!directory.exists()) return@withContext 0L
        var removed = 0L
        directory.walkBottomUp().forEach { file ->
            if (file.isFile && !file.name.endsWith(".part")) {
                val bytes = file.length()
                if (file.delete()) removed += bytes
            } else if (file.isDirectory && file.listFiles()?.isEmpty() == true) {
                file.delete()
            }
        }
        removed
    }

    fun totalBytes(): Long = root.walkTopDown()
        .filter { it.isFile && !it.name.endsWith(".part") }.sumOf { it.length() }
}


/** Pure range check, also tested by JVM unit tests (no Android emulator needed). */
internal object OnDemandRange {
    private val pattern = Regex("""bytes (\d+)-(\d+)/(\d+)""")
    fun valid(header: String?, savedBytes: Long, limitBytes: Long): Boolean {
        val match = pattern.matchEntire(header.orEmpty()) ?: return false
        val start = match.groupValues[1].toLongOrNull() ?: return false
        val end = match.groupValues[2].toLongOrNull() ?: return false
        val total = match.groupValues[3].toLongOrNull() ?: return false
        return start == savedBytes && end >= start && end + 1 == total && total <= limitBytes
    }
}
