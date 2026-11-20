package com.shiguang.english.nativeapp.data

/**
 * Maps the original university paper's subjective-answer fields into the
 * single answer displayed by the native app. No answer is synthesized when
 * the source paper has no reference text.
 */
internal object UniversityReferenceMapping {
    fun answer(type: String, read: (String) -> String): String {
        val keys = when (type) {
            "translation", "translation_en_zh" -> listOf(
                "reference", "official_reference_zh", "answer", "correct_answer"
            )
            "writing" -> listOf(
                "essay", "model_answer", "sample_answer", "answer", "correct_answer"
            )
            else -> listOf("answer", "correct_answer", "word")
        }
        return keys.firstNotNullOfOrNull { key ->
            read(key).trim().takeIf { it.isNotBlank() }
        }.orEmpty()
    }

    /** The original writing paper optionally includes a translated model essay. */
    fun modelTranslation(type: String, read: (String) -> String): String =
        if (type == "writing") read("essay_zh").trim() else ""
}
