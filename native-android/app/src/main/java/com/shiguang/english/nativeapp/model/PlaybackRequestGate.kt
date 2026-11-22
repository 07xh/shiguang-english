package com.shiguang.english.nativeapp.model

import java.util.concurrent.atomic.AtomicBoolean

/**
 * Rejects overlapping play/prepare/download operations on the same MediaPlayer.
 * The holder belongs to a player instance; release it in a coroutine finally block.
 */
internal class PlaybackRequestGate {
    private val running = AtomicBoolean(false)

    fun tryEnter(): Boolean = running.compareAndSet(false, true)

    fun leave() {
        running.set(false)
    }
}
