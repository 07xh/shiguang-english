package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.AnswerLedger
import com.shiguang.english.nativeapp.model.DemoContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AnswerLedgerTest {
    @Test fun untouchedHasNoAnswer() {
        val record = AnswerLedger.empty(5)
        assertEquals(0, AnswerLedger.answeredCount(record))
        assertNull(AnswerLedger.selection(record, 3))
    }

    @Test fun switchingQuestionsDoesNotOverwriteAnswers() {
        val first = AnswerLedger.markOnce(AnswerLedger.empty(5), 0, 2, 4)
        val second = AnswerLedger.markOnce(first, 4, 1, 4)
        val attemptedOverwrite = AnswerLedger.markOnce(second, 0, 0, 4)
        assertEquals(second, attemptedOverwrite)
        assertEquals(2, AnswerLedger.answeredCount(attemptedOverwrite))
        assertEquals(2, AnswerLedger.selection(attemptedOverwrite, 0))
        assertEquals(1, AnswerLedger.selection(attemptedOverwrite, 4))
    }

    @Test fun scoreComesOnlyFromSubmittedSelections() {
        val questions = DemoContent.questions
        val a = AnswerLedger.markOnce(AnswerLedger.empty(questions.size), 0, questions[0].answer, questions[0].choices.size)
        val b = AnswerLedger.markOnce(a, 1, 2, questions[1].choices.size)
        assertEquals(1, AnswerLedger.correctCount(b, questions))
        assertEquals(2, AnswerLedger.answeredCount(b))
    }

    @Test(expected = IllegalArgumentException::class)
    fun outOfBoundsIsRejected() {
        AnswerLedger.markOnce(AnswerLedger.empty(2), 5, 0, 4)
    }
}
