package com.shiguang.english.nativeapp.data

import android.content.Context
import android.net.Uri
import android.media.MediaMetadataRetriever
import com.shiguang.english.nativeapp.model.AudioCoverage
import java.io.File
import java.io.IOException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

data class UniversityExam(
    val level: String, val id: String, val title: String, val year: Int,
    val listeningCount: Int, val dictationCount: Int, val isWrittenOnly: Boolean
) {
    val modules: List<String> get() = when (level) {
        "kaoyan" -> listOf("written")
        "ielts" -> listOf("dictation")
        else -> buildList {
            if (listeningCount > 0) add("listening")
            if (dictationCount > 0) add("dictation")
            add("written")
        }
    }
}

data class UniversityQuestion(
    val id: String, val type: String, val prompt: String, val passage: String,
    val choices: List<Pair<String, String>>, val answer: String, val analysis: String,
    val section: String = "", val modelTranslation: String = ""
)

data class UniversitySentence(
    val text: String, val chinese: String, val section: String,
    val startSeconds: Double?, val endSeconds: Double?
)

sealed interface ExamAudioSource {
    data class Asset(val path: String) : ExamAudioSource
    data class Downloaded(val file: File) : ExamAudioSource
}

class UniversityRepository(private val context: Context) {
    private val store = OnDemandStore(context)
    private val downloadMutex = Mutex()
    private val origin = "https://bilibilitoyassets.top/"
    private val allowedLevels = setOf("cet4", "cet6", "ielts", "kaoyan")

    val exams: List<UniversityExam> by lazy {
        val rows = JSONObject(read("university/catalog.json")).getJSONArray("exams")
        buildList {
            for (i in 0 until rows.length()) {
                val x = rows.getJSONObject(i)
                val level = x.getString("level")
                val id = x.getString("id")
                if (level !in allowedLevels || !id.matches(Regex("[A-Za-z0-9_-]+"))) continue
                add(UniversityExam(level, id, x.getString("title"), x.optInt("year"),
                    x.optInt("listeningCount"), x.optInt("dictationCount"),
                    x.optBoolean("isWrittenOnly")))
            }
        }
    }

    private val contentIndex by lazy {
        try { JSONObject(read("university/content-index.json")) } catch (_: Exception) { null }
    }

    private fun record(exam: UniversityExam): JSONObject? {
        val rows = contentIndex?.optJSONArray("entries") ?: return null
        for (i in 0 until rows.length()) {
            val x = rows.optJSONObject(i) ?: continue
            if (x.optString("id") == exam.id && x.optString("level") == exam.level)
                return x.takeIf { it.optBoolean("complete") }
        }
        return null
    }

    private fun cachedModule(exam: UniversityExam, name: String): File =
        store.local("university", exam.level + "_" + exam.id, name + ".json")

    private fun cachedAudio(exam: UniversityExam): File =
        store.local("university", exam.level + "_" + exam.id, "audio.mp3")

    // A downloaded file existing on disk does not mean its JSON is usable.
    // Cache validation results by file identity so scrolling the exam catalog
    // does not repeatedly parse the same large paper files on the UI thread.
    private data class ModuleCheck(val bytes: Long, val modifiedAt: Long, val valid: Boolean)
    private val moduleChecks =
        java.util.concurrent.ConcurrentHashMap<String, ModuleCheck>()

    private fun cachedModuleIsValid(exam: UniversityExam, name: String): Boolean {
        val file = cachedModule(exam, name)
        if (!file.isFile) {
            moduleChecks.remove(file.absolutePath)
            return false
        }
        val bytes = file.length()
        val modifiedAt = file.lastModified()
        val previous = moduleChecks[file.absolutePath]
        if (previous != null && previous.bytes == bytes && previous.modifiedAt == modifiedAt) {
            return previous.valid
        }
        val valid = validModule(file, name)
        moduleChecks[file.absolutePath] = ModuleCheck(bytes, modifiedAt, valid)
        return valid
    }

    fun installedModules(exam: UniversityExam): Set<String> {
        val embedded = record(exam)?.optJSONObject("modules")
        return exam.modules.filter { module ->
            (embedded?.has(module) == true) || cachedModuleIsValid(exam, module)
        }.toSet()
    }

    private fun validModule(file: File, module: String): Boolean = runCatching {
        val text = file.readText(Charsets.UTF_8).trimStart('\uFEFF', '\n', '\r', ' ')
        val value: Any = if (text.startsWith("[")) JSONArray(text) else JSONObject(text)
        val selected = if (value is JSONObject) value.opt(module) ?: value else value
        when (module) {
            "dictation", "listening" ->
                selected is JSONArray && selected.length() > 0 ||
                    selected is JSONObject && selected.length() > 0
            "written" ->
                selected is JSONObject && listOf(
                    "questions", "reading", "writing", "translation",
                    "language_use", "paper_stem"
                ).any { selected.has(it) } || selected is JSONArray && selected.length() > 0
            else -> false
        }
    }.getOrDefault(false)

    /** Downloads ONLY the paper's requested module, once the user opens it. */
    suspend fun ensureModule(
        exam: UniversityExam, name: String,
        progress: (Long, Long) -> Unit = { _, _ -> }
    ) {
        require(name in exam.modules)
        if (name in installedModules(exam)) return
        downloadMutex.withLock {
            if (name in installedModules(exam)) return@withLock
            val file = cachedModule(exam, name)
            val prefix = exam.level + "/jsons/" + exam.id
            var last: Throwable? = null
            for (suffix in listOf("/" + name + ".json", ".json")) {
                try {
                    store.download(origin + prefix + suffix, file, 16L * 1024 * 1024,
                        validate = { validModule(it, name) }, progress = progress)
                    // A validated replacement supersedes the previous cache verdict.
                    moduleChecks.remove(file.absolutePath)
                    return@withLock
                } catch (error: IOException) {
                    last = error
                }
            }
            throw IOException("未找到该试卷的 " + name + " 题目文件：" +
                (last?.message ?: "资源不可用"))
        }
    }

    /**
     * A download can have a correct MP3 magic header and still be only the
     * beginning of a recording. Metadata duration is mandatory for cached audio;
     * known dictation timestamps provide an additional completeness floor.
     */
    fun expectedAudioEndMs(exam: UniversityExam): Long? {
        if ("dictation" !in installedModules(exam)) return null
        return runCatching {
            sentences(exam).mapNotNull { sentence ->
                sentence.endSeconds?.takeIf { it.isFinite() && it > 0 }
            }.maxOrNull()?.times(1000.0)?.toLong()
        }.getOrNull()
    }

    private fun decodedDurationMs(file: File): Long? {
        if (!store.validMp3(file)) return null
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull()
        } catch (_: Exception) {
            null
        } finally {
            retriever.release()
        }
    }

    private fun validAudio(exam: UniversityExam, file: File): Boolean {
        val duration = decodedDurationMs(file) ?: return false
        return AudioCoverage.isPlausibleRecording(duration, expectedAudioEndMs(exam))
    }

    fun audioSource(exam: UniversityExam): ExamAudioSource? {
        val bundled = record(exam)?.optString("audio")
        if (bundled != null && bundled.startsWith("audio/") && bundled.endsWith(".mp3"))
            return ExamAudioSource.Asset("university/" + bundled)
        val file = cachedAudio(exam)
        return if (validAudio(exam, file)) ExamAudioSource.Downloaded(file) else null
    }

    private fun audioNames(exam: UniversityExam): List<String> {
        val title = exam.title
        if (exam.level == "ielts")
            return listOf(exam.id, title, title.replace(" ", "").replace("Test", "test"))
                .distinct()
        val stripped = title.replace("四级", "").replace("六级", "")
        val set = Regex("""\s*[（(]第[一二三123]套\s*[）)]""")
        val choices = mutableListOf(
            title, title.replace(set, ""), stripped, stripped.replace(set, ""), exam.id
        )
        if (exam.level == "cet6") {
            choices += stripped.replace("听力", "真题")
            choices += stripped.replace("真题", "听力")
        }
        return choices.filter { it.isNotBlank() }.distinct()
    }

    /**
     * Audio is downloaded only when Play is tapped. Some source exams have no
     * accessible MP3; fail visibly instead of claiming all 231 have audio.
     */
    suspend fun ensureAudio(
        exam: UniversityExam,
        progress: (Long, Long) -> Unit = { _, _ -> }
    ): ExamAudioSource {
        audioSource(exam)?.let { return it }
        downloadMutex.withLock {
            audioSource(exam)?.let { return@withLock it }
            val target = cachedAudio(exam)
            var last: Throwable? = null
            for (name in audioNames(exam)) {
                try {
                    store.download(
                        origin + exam.level + "/audios/" + Uri.encode(name) + ".mp3",
                        target, 85L * 1024 * 1024,
                        validate = { validAudio(exam, it) }, progress = progress
                    )
                    return@withLock ExamAudioSource.Downloaded(target)
                } catch (error: IOException) {
                    last = error
                }
            }
            throw IOException("未找到时长校验通过的原声 MP3（可能缺失或不完整）：" +
                (last?.message ?: "资源缺失"))
        }
        return audioSource(exam)
            ?: throw IOException("音频缓存校验未通过")
    }

    /** Cache files and previously verified bundled assets are both supported. */
    fun module(exam: UniversityExam, name: String): Any {
        require(name in exam.modules && name in installedModules(exam)) {
            "该试卷尚未下载：" + exam.id + "/" + name
        }
        val local = cachedModule(exam, name)
        // A damaged downloaded copy must not take precedence over a verified
        // bundled module in builds that include offline exam assets.
        val raw = if (cachedModuleIsValid(exam, name)) local.readText(Charsets.UTF_8)
            else read("university/exams/" + exam.level + "/" + exam.id + "/" + name + ".json")
        val text = raw.trimStart('\uFEFF', '\n', '\r', ' ')
        return if (text.startsWith("[")) JSONArray(text) else JSONObject(text)
    }

    fun read(path: String): String =
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }

    fun cachedBytes(): Long = store.totalBytes()

    fun questions(exam: UniversityExam, module: String): List<UniversityQuestion> {
        val payload = this.module(exam, module)
        val root: Any = if (payload is JSONObject) {
            when (module) {
                "listening" -> payload.opt("listening") ?: payload
                "written" -> payload.opt("written") ?: payload
                else -> payload
            }
        } else payload
        val results = mutableListOf<UniversityQuestion>()
        val seen = hashSetOf<String>()
        fun walk(node: Any?, inheritedPassage: String, depth: Int) {
            if (depth > 16 || results.size >= 5000) return
            when (node) {
                is JSONArray -> for (i in 0 until node.length()) walk(node.opt(i), inheritedPassage, depth + 1)
                is JSONObject -> {
                    val passage = node.getFirst("passage", "passage_text", "article", "source_en")
                        .ifBlank { inheritedPassage }
                    val kind = node.getFirst("type", "question_type")
                    val prompt = node.getFirst("question", "question_text", "stem",
                        "statement", "prompt", "question_zh", "question_text_zh", "prompt_zh", "directions")
                    val choices = parseChoices(node.opt("options") ?: node.opt("choices"))
                    val hasAnswer = node.has("answer") || node.has("correct_answer") || node.has("word")
                    val subjective = kind in setOf("writing", "translation", "translation_en_zh",
                        "proofread", "fill_in", "matching", "banked_cloze", "cloze",
                        "tfng", "true_false_not_given", "yes_no_not_given", "sentence_insertion")
                    // Original CET listening papers may contain only A-D choices:
                    // the spoken stem is in the audio, so no text question exists.
                    // These are still real answerable questions, not empty records.
                    val listeningChoices = ListeningQuestionPolicy.isAnswerableWithoutStem(
                        module, choices.size
                    )
                    if ((prompt.isNotBlank() || listeningChoices ||
                            kind in setOf("writing", "translation", "translation_en_zh")) &&
                        (choices.isNotEmpty() || hasAnswer || subjective)) {
                        val id = node.getFirst("id", "question_id").ifBlank { results.size.toString() }
                        val key = kind + "|" + id + "|" + prompt
                        if (seen.add(key)) results.add(UniversityQuestion(id, kind, prompt, passage,
                            choices, UniversityReferenceMapping.answer(kind) { node.getFirst(it) },
                            node.getFirst("analysis", "explanation"),
                            node.getFirst("section", "group"),
                            UniversityReferenceMapping.modelTranslation(kind) { node.getFirst(it) }))
                        node.opt("questions")?.let { walk(it, passage, depth + 1) }
                    } else {
                        val keys = node.keys()
                        while (keys.hasNext()) {
                            val k = keys.next()
                            if (k in setOf("options", "choices", "synonym_pairs", "metadata", "audio")) continue
                            walk(node.opt(k), passage, depth + 1)
                        }
                    }
                }
            }
        }
        walk(root, "", 0)
        return results
    }

    fun sentences(exam: UniversityExam): List<UniversitySentence> {
        val raw = module(exam, "dictation")
        val rows = if (raw is JSONObject) raw.optJSONArray("dictation") else raw as? JSONArray
        if (rows == null) return emptyList()
        return buildList {
            for (i in 0 until rows.length()) {
                val x = rows.optJSONObject(i) ?: continue
                val text = x.getFirst("text", "sentence", "english")
                if (text.isBlank()) continue
                add(UniversitySentence(text, x.getFirst("zh", "chinese", "translation"),
                    x.getFirst("sec", "group", "section"),
                    x.getNumber("start", "startTime", "start_sec"),
                    x.getNumber("end", "endTime", "end_sec")))
            }
        }
    }
}

private fun JSONObject.getFirst(vararg keys: String): String {
    for (key in keys) {
        val raw = opt(key)
        if (raw != null && raw != JSONObject.NULL) {
            val value = raw.toString().trim()
            if (value.isNotBlank() && value != "null") return value
        }
    }
    return ""
}

private fun JSONObject.getNumber(vararg keys: String): Double? {
    for (key in keys) {
        val number = opt(key)?.toString()?.toDoubleOrNull()
        if (number != null && number.isFinite()) return number
    }
    return null
}

private fun parseChoices(raw: Any?): List<Pair<String, String>> = when (raw) {
    is JSONArray -> buildList {
        for (i in 0 until raw.length()) {
            val item = raw.opt(i)
            val name = ('A' + i).toString()
            add(name to if (item is JSONObject) item.getFirst("text", "content", "label")
                else item?.toString().orEmpty())
        }
    }
    is JSONObject -> buildList {
        val keys = raw.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val v = raw.opt(key)
            if (v != null && v != JSONObject.NULL) add(key to v.toString())
        }
    }
    else -> emptyList()
}
