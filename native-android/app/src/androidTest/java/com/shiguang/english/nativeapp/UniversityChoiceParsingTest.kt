package com.shiguang.english.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.OnDemandStore
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/** Real Android org.json: verify the full downloaded-question parsing path. */
class UniversityChoiceParsingTest {
    @Test fun preservesNestedChoiceTextAndExplicitArrayLabels() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val exam = UniversityExam(
            level = "cet4", id = "__nested_options_test__",
            title = "option parsing test", year = 2026,
            listeningCount = 1, dictationCount = 0, isWrittenOnly = false
        )
        val file = OnDemandStore(context).local(
            "university", exam.level + "_" + exam.id, "listening.json"
        )
        val backup = file.takeIf { it.exists() }?.readBytes()
        try {
            file.parentFile?.mkdirs()
            file.writeText(
                """
                [
                  {
                    "id": "object-map", "type": "choice", "question": "Object options",
                    "options": {"A": {"text": "alpha"}, "B": {"content": "beta"}},
                    "answer": "B"
                  },
                  {
                    "id": "array-labels", "type": "choice", "question": "Array options",
                    "options": [{"label": "C", "text": "gamma"},
                                {"key": "D", "value": "delta"}],
                    "answer": "D"
                  },
                  {
                    "id": "plain-array", "type": "choice", "question": "Plain options",
                    "options": ["first", "second"], "answer": "A"
                  },
                  {
                    "id": "legacy-label", "type": "choice", "question": "Legacy label text",
                    "options": {"A": {"label": "legacy alpha"}, "B": {"label": "legacy beta"}},
                    "answer": "A"
                  },
                  {
                    "id": "legacy-array", "type": "choice", "question": "Legacy array label text",
                    "options": [{"label": "first legacy"}, {"label": "second legacy"}],
                    "answer": "B"
                  }
                ]
                """.trimIndent()
            )
            val questions = UniversityRepository(context)
                .questions(exam, "listening").associateBy { it.id }
            assertEquals(5, questions.size)
            assertEquals("alpha", questions.getValue("object-map").choices.first { it.first == "A" }.second)
            assertEquals("beta", questions.getValue("object-map").choices.first { it.first == "B" }.second)
            assertEquals("gamma", questions.getValue("array-labels").choices.first { it.first == "C" }.second)
            assertEquals("delta", questions.getValue("array-labels").choices.first { it.first == "D" }.second)
            assertEquals(listOf("A" to "first", "B" to "second"),
                questions.getValue("plain-array").choices)
            assertEquals(listOf("A" to "legacy alpha", "B" to "legacy beta"),
                questions.getValue("legacy-label").choices)
            assertEquals(listOf("A" to "first legacy", "B" to "second legacy"),
                questions.getValue("legacy-array").choices)
            assertFalse(questions.values.flatMap { it.choices }.any { it.second.startsWith("{") })
        } finally {
            if (backup != null) file.writeBytes(backup) else file.delete()
        }
    }
}
