package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.SentenceAudioRange
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SentenceAudioRangeTest {
    @Test fun preservesRealSentenceBoundaries() {
        val range = SentenceAudioRange.fromSeconds(12.25, 16.5).bounded(60000)
        assertEquals(12250, range.startMs)
        assertEquals(16500, range.endMs)
        assertTrue(range.hasExactRange)
        assertTrue(range.shouldRewind(12249))
        assertFalse(range.shouldRewind(13000))
        assertTrue(range.shouldRewind(16500))
    }

    @Test fun rejectsInvalidOrMissingTimestampsWithoutInventingClips() {
        val empty = SentenceAudioRange.FULL_RECORDING
        assertEquals(empty, SentenceAudioRange.fromSeconds(null, 12.0))
        assertEquals(empty, SentenceAudioRange.fromSeconds(10.0, null))
        assertEquals(empty, SentenceAudioRange.fromSeconds(12.0, 11.0))
        assertEquals(empty, SentenceAudioRange.fromSeconds(-1.0, 2.0))
        assertEquals(empty, SentenceAudioRange.fromSeconds(Double.NaN, 2.0))
        assertEquals(empty, SentenceAudioRange.fromSeconds(0.0, Double.POSITIVE_INFINITY))
        assertEquals(empty, SentenceAudioRange.fromSeconds(0.0, Double.MAX_VALUE))
        assertFalse(empty.hasExactRange)
    }

    @Test fun clampsEndToActualMediaAndFallsBackIfStartIsBeyondEnd() {
        assertEquals(
            SentenceAudioRange(1000, 5000),
            SentenceAudioRange.fromSeconds(1.0, 9.0).bounded(5000)
        )
        assertEquals(
            SentenceAudioRange.FULL_RECORDING,
            SentenceAudioRange.fromSeconds(8.0, 12.0).bounded(5000)
        )
        assertEquals(
            SentenceAudioRange.FULL_RECORDING,
            SentenceAudioRange.fromSeconds(1.0, 3.0).bounded(0)
        )
    }
}
