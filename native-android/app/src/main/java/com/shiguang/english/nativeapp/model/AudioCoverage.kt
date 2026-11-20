package com.shiguang.english.nativeapp.model

/**
 * A valid MP3 header is not evidence that a recording covers the whole paper.
 * Compare decoded media duration against the latest verified sentence ending
 * when such a timeline exists. A small tolerance accommodates MP3 padding.
 */
internal object AudioCoverage {
    const val TIMELINE_TOLERANCE_MS = 2000L
    private const val MIN_RECORDING_MS = 5000L

    fun isPlausibleRecording(durationMs: Long, expectedLastEndMs: Long?): Boolean {
        if (durationMs < MIN_RECORDING_MS) return false
        return expectedLastEndMs == null ||
            durationMs + TIMELINE_TOLERANCE_MS >= expectedLastEndMs
    }

    fun missesKnownTimeline(durationMs: Long, expectedLastEndMs: Long?): Boolean =
        expectedLastEndMs != null &&
            durationMs + TIMELINE_TOLERANCE_MS < expectedLastEndMs
}
