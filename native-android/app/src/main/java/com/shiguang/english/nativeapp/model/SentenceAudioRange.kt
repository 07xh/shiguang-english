package com.shiguang.english.nativeapp.model

/**
 * Validated sentence boundaries in milliseconds. A null end marks a full-recording
 * fallback, not a fabricated sentence cut. Pure Kotlin for fast JVM testing.
 */
data class SentenceAudioRange(val startMs: Int, val endMs: Int?) {
    val hasExactRange: Boolean get() = endMs != null

    /** Never seek beyond the real MP3 duration or claim impossible boundaries. */
    fun bounded(durationMs: Int): SentenceAudioRange {
        if (endMs == null || durationMs <= 0 || startMs >= durationMs) {
            return FULL_RECORDING
        }
        val end = endMs.coerceAtMost(durationMs)
        return if (end > startMs) SentenceAudioRange(startMs, end) else FULL_RECORDING
    }

    fun shouldRewind(positionMs: Int): Boolean =
        positionMs < startMs || (endMs != null && positionMs >= endMs)

    companion object {
        val FULL_RECORDING = SentenceAudioRange(0, null)

        fun fromSeconds(start: Double?, end: Double?): SentenceAudioRange {
            if (start == null || end == null ||
                !start.isFinite() || !end.isFinite() ||
                start < 0 || end <= start || end * 1000 > Int.MAX_VALUE) {
                return FULL_RECORDING
            }
            val startMs = (start * 1000).toInt()
            val endMs = (end * 1000).toInt()
            return if (endMs > startMs) SentenceAudioRange(startMs, endMs)
                else FULL_RECORDING
        }
    }
}
