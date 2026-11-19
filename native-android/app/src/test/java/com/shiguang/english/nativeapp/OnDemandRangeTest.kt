package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.data.OnDemandRange
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OnDemandRangeTest {
    @Test fun correctResumeWindow() {
        assertTrue(OnDemandRange.valid("bytes 1024-2047/4096", 1024L, 8192L))
    }

    @Test fun rejectsWrongStartOrOutOfRangeBytes() {
        assertFalse(OnDemandRange.valid("bytes 0-2047/4096", 1024L, 8192L))
        assertFalse(OnDemandRange.valid("bytes 1024-4096/4096", 1024L, 8192L))
        assertFalse(OnDemandRange.valid("bytes 1024-2047/4096", 1024L, 2048L))
    }

    @Test fun rejectsInvalidOrIndeterminateHeaders() {
        assertFalse(OnDemandRange.valid(null, 1024L, 8192L))
        assertFalse(OnDemandRange.valid("bytes */4096", 1024L, 8192L))
        assertFalse(OnDemandRange.valid("bytes 1024-2047/*", 1024L, 8192L))
        assertFalse(OnDemandRange.valid("not a range", 1024L, 8192L))
    }
}
