package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.data.ListeningQuestionPolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ListeningQuestionPolicyTest {
    @Test fun spokenOnlyQuestionRemainsAnswerableWhenChoicesExist() {
        assertTrue(ListeningQuestionPolicy.isAnswerableWithoutStem("listening", 4))
        assertTrue(ListeningQuestionPolicy.isAnswerableWithoutStem("listening", 2))
    }

    @Test fun emptyQuestionWithoutChoicesIsNotInvented() {
        assertFalse(ListeningQuestionPolicy.isAnswerableWithoutStem("listening", 0))
        assertFalse(ListeningQuestionPolicy.isAnswerableWithoutStem("written", 4))
        assertFalse(ListeningQuestionPolicy.isAnswerableWithoutStem("dictation", 4))
    }
}
