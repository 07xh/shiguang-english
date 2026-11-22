package com.shiguang.english.nativeapp

import androidx.test.platform.app.InstrumentationRegistry
import com.shiguang.english.nativeapp.data.OnDemandStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** Resume metadata is not downloaded content; a .part counts only as unfinished bytes. */
class CacheStorageStatsTest {
    @Test fun excludesResumeSidecarsFromCompletedStorage() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = OnDemandStore(context)
        val target = store.local("university", "__partial_stat_test__", "listening.json")
        val part = File(target.parentFile, target.name + ".part")
        val sidecar = File(target.parentFile, target.name + ".part.url")
        val priorPart = part.takeIf { it.isFile }?.readBytes()
        val priorSidecar = sidecar.takeIf { it.isFile }?.readBytes()
        try {
            target.parentFile?.mkdirs()
            val previous = store.stats()
            val previousTotal = store.totalBytes()
            part.writeBytes(ByteArray(512) { 42 })
            sidecar.writeText("https://example.invalid/source\n".repeat(6))
            val after = store.stats()
            assertEquals(previous.examFiles, after.examFiles)
            assertEquals(previous.examBytes, after.examBytes)
            assertEquals(previous.examPartialBytes + 512L -
                (priorPart?.size?.toLong() ?: 0L), after.examPartialBytes)
            assertEquals(previousTotal, store.totalBytes())
        } finally {
            if (priorPart != null) part.writeBytes(priorPart) else part.delete()
            if (priorSidecar != null) sidecar.writeBytes(priorSidecar) else sidecar.delete()
            target.parentFile?.takeIf { it.listFiles()?.isEmpty() == true }?.delete()
        }
    }
}
