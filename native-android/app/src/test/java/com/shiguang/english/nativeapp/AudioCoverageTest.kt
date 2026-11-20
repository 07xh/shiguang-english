package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.AudioCoverage
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioCoverageTest {
    @Test fun plausibleLongRecordingPassesWithKnownTimeline() {
        assertTrue(AudioCoverage.isPlausibleRecording(125_000L, 124_000L))
    }

    @Test fun rejectsOnlyHeaderAndTinyRecordingEvenWithoutTimeline() {
        assertFalse(AudioCoverage.isPlausibleRecording(0L, null))
        assertFalse(AudioCoverage.isPlausibleRecording(3_000L, null))
        assertTrue(AudioCoverage.isPlausibleRecording(120_000L, null))
    }

    @Test fun rejectsRecordingShorterThanLastVerifiedSentence() {
        assertFalse(AudioCoverage.isPlausibleRecording(50_000L, 120_000L))
        assertTrue(AudioCoverage.missesKnownTimeline(50_000L, 120_000L))
    }

    @Test fun toleratesMp3PaddingWithoutClaimingMissingAudio() {
        assertTrue(AudioCoverage.isPlausibleRecording(118_500L, 120_000L))
        assertFalse(AudioCoverage.missesKnownTimeline(118_500L, 120_000L))
    }
}
