package com.shiguang.english.nativeapp.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
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
        dest.parentFile?.mkdirs()
        val partial = File(dest.parentFile, dest.name + ".part")
        val connection = (target.openConnection() as HttpURLConnection).apply {
            connectTimeout = 12000
            readTimeout = 25000
            instanceFollowRedirects = false
            setRequestProperty("Accept", "*/*")
            setRequestProperty("User-Agent", "ShiguangEnglish-AuthorizedNative/1.0")
        }
        try {
            val code = connection.responseCode
            if (code !in 200..299) throw IOException("资源服务器返回 HTTP $code")
            val length = connection.contentLengthLong
            if (length > limitBytes) throw IOException("资源超过下载大小限制")
            var done = 0L
            connection.inputStream.use { input ->
                partial.outputStream().buffered(32 * 1024).use { output ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        coroutineContext.ensureActive()
                        val n = input.read(buffer)
                        if (n == -1) break
                        done += n
                        if (done > limitBytes) throw IOException("资源超过下载大小限制")
                        output.write(buffer, 0, n)
                        progress(done, length.coerceAtLeast(0))
                    }
                }
            }
            if (done < 128 || !validate(partial)) {
                throw IOException("下载内容不完整或文件格式有误")
            }
            if (dest.exists()) dest.delete()
            if (!partial.renameTo(dest)) throw IOException("无法保存下载文件")
            dest
        } finally {
            connection.disconnect()
            if (partial.exists()) partial.delete()
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

    fun totalBytes(): Long = root.walkTopDown()
        .filter { it.isFile && !it.name.endsWith(".part") }.sumOf { it.length() }
}
