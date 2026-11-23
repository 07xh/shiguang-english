package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.AudioContainer
import org.junit.Assert.assertEquals
import org.junit.Test

class AudioContainerTest {
    @Test fun detectsOrdinaryMp3Headers() {
        assertEquals(AudioContainer.Format.MP3,
            AudioContainer.detect(byteArrayOf('I'.code.toByte(), 'D'.code.toByte(),
                '3'.code.toByte(), 0x04)))
        assertEquals(AudioContainer.Format.MP3,
            AudioContainer.detect(byteArrayOf(0xff.toByte(), 0xfb.toByte(), 0x90.toByte(), 0x64)))
    }

    @Test fun recognizesRealFtypContainerBytesFromHistoricalAudioProbe() {
        val header = byteArrayOf(
            0x00, 0x00, 0x00, 0x18,
            'f'.code.toByte(), 't'.code.toByte(),
            'y'.code.toByte(), 'p'.code.toByte(),
            'i'.code.toByte(), 's'.code.toByte(),
            'o'.code.toByte(), 'm'.code.toByte()
        )
        assertEquals(AudioContainer.Format.ISO_BMFF, AudioContainer.detect(header))
    }

    @Test fun rejectsHtmlAndUnreasonableFtypBoxSizes() {
        assertEquals(AudioContainer.Format.UNKNOWN,
            AudioContainer.detect("<html>not audio".toByteArray()))
        assertEquals(AudioContainer.Format.UNKNOWN, AudioContainer.detect(byteArrayOf(
            0, 0, 0, 8, 'f'.code.toByte(), 't'.code.toByte(),
            'y'.code.toByte(), 'p'.code.toByte(), 0, 0, 0, 0
        )))
    }
}
