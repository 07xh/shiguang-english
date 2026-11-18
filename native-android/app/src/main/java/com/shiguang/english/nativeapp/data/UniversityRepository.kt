package com.shiguang.english.nativeapp.data

import android.content.Context
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
    val choices: List<Pair<String, String>>, val answer: String, val analysis: String
)

data class UniversitySentence(
    val text: String, val chinese: String, val section: String,
    val startSeconds: Double?, val endSeconds: Double?
)

class UniversityRepository(private val context: Context) {
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

    fun installedModules(exam: UniversityExam): Set<String> {
        val modules = record(exam)?.optJSONObject("modules") ?: return emptySet()
        return exam.modules.filter { modules.has(it) }.toSet()
    }

    fun audioAsset(exam: UniversityExam): String? {
        val relative = record(exam)?.optString("audio") ?: return null
        return if (relative.startsWith("audio/") && relative.endsWith(".mp3"))
            "university/" + relative else null
    }

    fun module(exam: UniversityExam, name: String): Any {
        require(name in exam.modules && name in installedModules(exam)) {
            "试卷内容没有通过离线打包验证：" + exam.id + "/" + name
        }
        val path = "university/exams/" + exam.level + "/" + exam.id + "/" + name + ".json"
        val raw = read(path).trimStart('\uFEFF', '\n', '\r', ' ')
        return if (raw.startsWith("[")) JSONArray(raw) else JSONObject(raw)
    }

    fun read(path: String): String =
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }

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
                        "statement", "prompt", "question_zh")
                    val choices = parseChoices(node.opt("options") ?: node.opt("choices"))
                    val hasAnswer = node.has("answer") || node.has("correct_answer") || node.has("word")
                    val subjective = kind in setOf("writing", "translation", "translation_en_zh",
                        "proofread", "fill_in", "matching", "banked_cloze", "cloze",
                        "tfng", "true_false_not_given", "yes_no_not_given", "sentence_insertion")
                    if ((prompt.isNotBlank() || kind in setOf("writing", "translation")) &&
                        (choices.isNotEmpty() || hasAnswer || subjective)) {
                        val id = node.getFirst("id", "question_id").ifBlank { results.size.toString() }
                        val key = kind + "|" + id + "|" + prompt
                        if (seen.add(key)) results.add(UniversityQuestion(id, kind, prompt, passage,
                            choices, node.getFirst("answer", "correct_answer", "word"),
                            node.getFirst("analysis", "explanation")))
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
