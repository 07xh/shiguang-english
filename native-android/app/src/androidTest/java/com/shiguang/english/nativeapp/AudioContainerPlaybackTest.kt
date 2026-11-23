package com.shiguang.english.nativeapp

import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.util.Base64
import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.OnDemandStore
import com.shiguang.english.nativeapp.model.AudioContainer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Synthetic 0.5s AAC tone generated with ffmpeg (no third-party recording).
 * The bytes are MP4/ISO BMFF despite the temporary .mp3 file name.
 * Check Android's real extractor, not only our Kotlin header classifier.
 */
class AudioContainerPlaybackTest {
    @Test fun preparesMp4AudioWithMisleadingMp3Extension() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val testContext = instrumentation.context
        val appContext = instrumentation.targetContext
        val encoded = testContext.assets.open("audio-ftyp-aac.b64")
            .bufferedReader(Charsets.UTF_8).use { it.readText() }
        val bytes = Base64.decode(encoded, Base64.DEFAULT)
        val sample = File(appContext.cacheDir, "synthetic_ftyp_audio_named_mp3.mp3")
        sample.writeBytes(bytes)
        try {
            assertEquals(
                AudioContainer.Format.ISO_BMFF,
                OnDemandStore(appContext).audioContainer(sample)
            )
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(sample.absolutePath)
                assertEquals("yes",
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO))
                val duration = retriever.extractMetadata(
                    MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                assertTrue("A valid AAC track needs a positive decoded duration", duration >= 300L)
            } finally {
                retriever.release()
            }
            val player = MediaPlayer()
            try {
                player.setDataSource(sample.absolutePath)
                player.prepare()
                assertTrue("MediaPlayer should prepare AAC ftyp under .mp3 suffix",
                    player.duration >= 300)
                player.seekTo(100)
            } finally {
                player.release()
            }
        } finally {
            sample.delete()
        }
    }
}
