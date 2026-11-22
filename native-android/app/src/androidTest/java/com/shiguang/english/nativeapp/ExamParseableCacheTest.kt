package com.shiguang.english.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.OnDemandStore
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityRepository
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** A non-empty JSON file is not a real exercise unless its contents can be used. */
class ExamParseableCacheTest {
    private val exam = UniversityExam(
        level = "cet4", id = "__parseable_cache_test__",
        title = "parseable cache test", year = 2026,
        listeningCount = 2, dictationCount = 2, isWrittenOnly = false
    )

    @Test fun rejectsMetadataOnlyListeningAndRecoversWhenQuestionsArrive() {
        checkRecovery(
            "listening",
            """{"listening":{"metadata":"no question here"}}""",
            """{"listening":[{"id":"1","question":"Select a word","options":["yes","no"],"answer":"A"}]}"""
        )
    }

    @Test fun rejectsDictationWithoutAnySentenceAndRecovers() {
        checkRecovery(
            "dictation",
            """{"dictation":[{"section":"header"},{"text":""}]}""",
            """{"dictation":[{"text":"The first sentence.","start":0,"end":3}]}"""
        )
    }

    @Test fun rejectsEmptyWrittenPaperAndRecovers() {
        checkRecovery(
            "written",
            """{"questions":[],"paper_stem":"header only"}""",
            """{"questions":[{"type":"writing","question":"Write a short paragraph","answer":"example"}]}"""
        )
    }

    private fun checkRecovery(module: String, bad: String, good: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val target = OnDemandStore(context).local(
            "university", exam.level + "_" + exam.id, "$module.json"
        )
        val old = target.takeIf { it.isFile }?.readBytes()
        try {
            target.parentFile?.mkdirs()
            target.writeText(bad)
            val repository = UniversityRepository(context)
            assertFalse("$module: metadata must not be treated as downloaded exercises",
                module in repository.installedModules(exam))
            target.writeText(good)
            assertTrue("$module: replacement real content must become usable",
                module in repository.installedModules(exam))
            if (module == "dictation") {
                assertEquals(1, repository.sentences(exam).size)
            } else {
                assertEquals(1, repository.questions(exam, module).size)
            }
        } finally {
            if (old != null) target.writeBytes(old) else target.delete()
        }
    }
}
