package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.DictationBlankSelector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DictationBlankSelectorTest {
    @Test fun blanksMatchOriginalTextAndNeverOverlap() {
        val sample = "We have made remarkable progress, and we can still improve."
        val basics = DictationBlankSelector.select(sample)
        assertTrue(basics.isNotEmpty())
        basics.zipWithNext().forEach { (left, right) ->
            assertTrue(left.endExclusive <= right.start)
        }
        basics.forEach { b -> assertEquals(b.word, sample.substring(b.start, b.endExclusive)) }
    }

    @Test fun differentDensityDoesNotChangeTokenIdentity() {
        val sentence = "Please prepare a careful analysis of the information."
        val basic = DictationBlankSelector.select(sentence, false)
        val hard = DictationBlankSelector.select(sentence, true)
        assertTrue(hard.size >= basic.size)
        assertEquals(basic, DictationBlankSelector.select(sentence, false))
        assertEquals(hard, DictationBlankSelector.select(sentence, true))
    }

    @Test fun emptyAndShortSentencesAreSafe() {
        assertTrue(DictationBlankSelector.select("1, 2, 3!").isEmpty())
        assertEquals(1, DictationBlankSelector.select("Hello!").size)
    }
}
