package com.shiguang.english.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.DictationDraft
import com.shiguang.english.nativeapp.data.PaperDraft
import com.shiguang.english.nativeapp.data.UniversityAttemptStore
import com.shiguang.english.nativeapp.data.UniversityExam
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UniversityDraftPersistenceTest {
    private val exam = UniversityExam(
        level = "cet4", id = "__instrumented_draft_test__",
        title = "instrumented test", year = 2026,
        listeningCount = 1, dictationCount = 1, isWrittenOnly = false
    )

    @Test fun questionDraftSurvivesStoreRecreationAndIsolatedByModuleAndContent() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = UniversityAttemptStore(context)
        try {
            store.clearPaper(exam, "written")
            store.clearPaper(exam, "listening")
            store.savePaper(exam, "written", "paper-v1",
                PaperDraft(index = 3, answersJson = "{\"0\":\"A\",\"3\":\"essay\"}",
                    practiceMode = false, submitted = true)
            )
            val reopened = UniversityAttemptStore(context)
            val restored = reopened.loadPaper(exam, "written", "paper-v1")
            assertEquals(3, restored.index)
            assertEquals("{\"0\":\"A\",\"3\":\"essay\"}", restored.answersJson)
            assertFalse(restored.practiceMode)
            assertTrue(restored.submitted)
            assertEquals(PaperDraft(), reopened.loadPaper(exam, "listening", "paper-v1"))
            assertEquals(PaperDraft(), reopened.loadPaper(exam, "written", "paper-v2"))
        } finally {
            store.clearPaper(exam, "written")
            store.clearPaper(exam, "listening")
        }
    }

    @Test fun dictationDraftKeepsEnteredBlanksAndMode() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = UniversityAttemptStore(context)
        try {
            store.clearDictation(exam)
            store.saveDictation(exam, "sentences-v1",
                DictationDraft(index = 4, answersJson = "{\"4_12\":\"world\"}", advanced = true)
            )
            val restored = UniversityAttemptStore(context).loadDictation(exam, "sentences-v1")
            assertEquals(4, restored.index)
            assertEquals("{\"4_12\":\"world\"}", restored.answersJson)
            assertTrue(restored.advanced)
            assertEquals(DictationDraft(), store.loadDictation(exam, "sentences-v2"))
        } finally {
            store.clearDictation(exam)
        }
    }
}
