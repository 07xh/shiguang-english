package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.ExamContentCoverage
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExamContentCoverageTest {
    @Test fun warnsAboutMissingListeningQuestions() {
        val warning = ExamContentCoverage.warning("listening", 25, 17)
        assertTrue(warning!!.contains("25"))
        assertTrue(warning.contains("17"))
        assertTrue(warning.contains("不能据此认定"))
    }

    @Test fun warnsAboutMissingDictationSentences() {
        val warning = ExamContentCoverage.warning("dictation", 57, 31)
        assertTrue(warning!!.contains("精听句"))
    }

    @Test fun unknownOrFullyAvailableCountsAreNotMisrepresented() {
        assertNull(ExamContentCoverage.warning("listening", 0, 5))
        assertNull(ExamContentCoverage.warning("listening", 25, 25))
        assertNull(ExamContentCoverage.warning("listening", 25, 30))
        assertNull(ExamContentCoverage.warning("written", 25, 7))
    }
}
