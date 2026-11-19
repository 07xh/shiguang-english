package com.shiguang.english.nativeapp.data

import android.content.Context
import org.json.JSONObject

/** Local-only drafts. Keys include both the exam and the training module. */
data class PaperDraft(
    val index: Int = 0,
    val answersJson: String = "{}",
    val practiceMode: Boolean = true,
    val submitted: Boolean = false
)

data class DictationDraft(
    val index: Int = 0,
    val answersJson: String = "{}",
    val advanced: Boolean = false
)

/**
 * Small, persistent exercise drafts. Never interprets a cached catalog entry as a
 * finished exercise, and never uploads student answers to the content host.
 *
 * The content fingerprint prevents reusing positional answers after a paper
 * changes its question/segment ordering.
 */
class UniversityAttemptStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        "university_attempts_v1", Context.MODE_PRIVATE
    )

    private fun draftKey(kind: String, exam: UniversityExam, module: String): String =
        "draft/$kind/${exam.level}/${exam.id}/$module"

    private fun read(key: String, fingerprint: String): JSONObject? {
        val text = preferences.getString(key, null) ?: return null
        return runCatching { JSONObject(text) }.getOrNull()
            ?.takeIf { it.optString("fingerprint") == fingerprint }
    }

    private fun validAnswers(value: String): String =
        value.takeIf { runCatching { JSONObject(it) }.isSuccess } ?: "{}"

    fun loadPaper(exam: UniversityExam, module: String, fingerprint: String): PaperDraft {
        val obj = read(draftKey("paper", exam, module), fingerprint) ?: return PaperDraft()
        return PaperDraft(
            index = obj.optInt("index", 0).coerceAtLeast(0),
            answersJson = validAnswers(obj.optString("answers", "{}")),
            practiceMode = obj.optBoolean("practice", true),
            submitted = obj.optBoolean("submitted", false)
        )
    }

    fun savePaper(
        exam: UniversityExam, module: String, fingerprint: String, draft: PaperDraft
    ) {
        val json = JSONObject()
            .put("fingerprint", fingerprint)
            .put("index", draft.index)
            .put("answers", validAnswers(draft.answersJson))
            .put("practice", draft.practiceMode)
            .put("submitted", draft.submitted)
        preferences.edit().putString(draftKey("paper", exam, module), json.toString()).apply()
    }

    fun clearPaper(exam: UniversityExam, module: String) {
        preferences.edit().remove(draftKey("paper", exam, module)).apply()
    }

    fun loadDictation(exam: UniversityExam, fingerprint: String): DictationDraft {
        val obj = read(draftKey("dictation", exam, "dictation"), fingerprint)
            ?: return DictationDraft()
        return DictationDraft(
            index = obj.optInt("index", 0).coerceAtLeast(0),
            answersJson = validAnswers(obj.optString("answers", "{}")),
            advanced = obj.optBoolean("advanced", false)
        )
    }

    fun saveDictation(exam: UniversityExam, fingerprint: String, draft: DictationDraft) {
        val json = JSONObject()
            .put("fingerprint", fingerprint)
            .put("index", draft.index)
            .put("answers", validAnswers(draft.answersJson))
            .put("advanced", draft.advanced)
        preferences.edit()
            .putString(draftKey("dictation", exam, "dictation"), json.toString()).apply()
    }

    fun clearDictation(exam: UniversityExam) {
        preferences.edit().remove(draftKey("dictation", exam, "dictation")).apply()
    }
}
