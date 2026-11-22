package com.shiguang.english.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.OnDemandStore
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityRepository
import com.shiguang.english.nativeapp.data.VocabRepository
import java.io.IOException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Regression tests for damaged downloaded resources; never touch study progress. */
class LearningCacheRecoveryTest {
    @Test fun malformedPaperCacheIsNotReportedAsInstalledAndCanBeReplaced() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val exam = UniversityExam(
            level = "cet4", id = "__cache_integrity_test__",
            title = "cache test", year = 2026,
            listeningCount = 1, dictationCount = 0, isWrittenOnly = false
        )
        val file = OnDemandStore(context).local(
            "university", exam.level + "_" + exam.id, "listening.json"
        )
        val original = file.takeIf { it.isFile }?.readBytes()
        try {
            file.parentFile?.mkdirs()
            file.writeText("{damaged-download")
            val repository = UniversityRepository(context)
            assertFalse("Corrupt JSON must be offered for redownload",
                "listening" in repository.installedModules(exam))

            file.writeText(
                """[{"question":"Choose A","options":["A","B"],"answer":"A"}]"""
            )
            assertTrue("A repaired file should become usable",
                "listening" in repository.installedModules(exam))
            assertEquals(1, repository.questions(exam, "listening").size)
        } finally {
            if (original != null) file.writeBytes(original) else file.delete()
        }
    }

    @Test fun malformedDictionaryCacheFallsBackOrRequestsRedownload() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val file = OnDemandStore(context).local(
            "vocabulary", "shared", "university-words.json"
        )
        val original = file.takeIf { it.isFile }?.readBytes()
        try {
            file.parentFile?.mkdirs()
            file.writeText("{damaged-dictionary")
            val result = runCatching { VocabRepository(context).loadCatalog() }
            if (result.isSuccess) {
                assertTrue("Bundled fallback must be verified",
                    result.getOrThrow().isOriginalComplete)
            } else {
                assertTrue("Missing fallback must trigger download rather than crash",
                    result.exceptionOrNull() is IOException)
            }
        } finally {
            if (original != null) file.writeBytes(original) else file.delete()
        }
    }
}
