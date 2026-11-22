package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.PlaybackRequestGate
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackRequestGateTest {
    @Test fun preventsOverlappingPlaybackRequests() {
        val gate = PlaybackRequestGate()
        assertTrue(gate.tryEnter())
        assertFalse(gate.tryEnter())
        gate.leave()
        assertTrue(gate.tryEnter())
    }

    @Test fun separatePlayersCanProceedIndependently() {
        val listening = PlaybackRequestGate()
        val dictation = PlaybackRequestGate()
        assertTrue(listening.tryEnter())
        assertTrue(dictation.tryEnter())
        assertFalse(listening.tryEnter())
        listening.leave()
        dictation.leave()
    }
}
