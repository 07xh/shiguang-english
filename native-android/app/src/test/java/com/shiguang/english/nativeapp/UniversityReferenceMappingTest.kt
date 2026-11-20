package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.data.UniversityReferenceMapping
import org.junit.Assert.assertEquals
import org.junit.Test

class UniversityReferenceMappingTest {
    private fun answer(type: String, fields: Map<String, String>): String =
        UniversityReferenceMapping.answer(type) { fields[it].orEmpty() }

    @Test fun cetTranslationUsesOriginalReferenceField() {
        assertEquals("An accurate English translation.",
            answer("translation", mapOf("reference" to "An accurate English translation.")))
    }

    @Test fun englishToChineseTranslationUsesOfficialFallback() {
        assertEquals("经过核验的中文参考译文",
            answer("translation_en_zh", mapOf("official_reference_zh" to "经过核验的中文参考译文")))
    }

    @Test fun originalReferenceTakesPrecedenceOverGenericAnswer() {
        assertEquals("原版参考译文",
            answer("translation", mapOf("answer" to "旧字段", "reference" to "原版参考译文")))
    }

    @Test fun writingUsesModelEssayAndOptionalChineseVersion() {
        val fields = mapOf(
            "essay" to "A model university essay.",
            "essay_zh" to "范文的中文译文"
        )
        assertEquals("A model university essay.", answer("writing", fields))
        assertEquals("范文的中文译文",
            UniversityReferenceMapping.modelTranslation("writing") { fields[it].orEmpty() })
    }

    @Test fun objectiveQuestionStillUsesOriginalAnswerField() {
        assertEquals("B", answer("multiple_choice", mapOf("answer" to "B", "reference" to "not an option")))
        assertEquals("C", answer("fill_in", mapOf("correct_answer" to "C")))
    }

    @Test fun missingSourceReferenceDoesNotInventAnAnswer() {
        assertEquals("", answer("translation", mapOf("prompt_zh" to "将下列句子译成英文")))
        assertEquals("", answer("writing", emptyMap()))
    }
}
