package com.shiguang.english.nativeapp.model

/**
 * Inspect actual media bytes, not the URL suffix or server Content-Type.
 * Some authorized *.mp3 URLs return an MP4-family ("ftyp") container.
 * A recognized container alone is NOT proof that it has an audio track
 * or covers the known sentence timeline.
 */
internal object AudioContainer {
    enum class Format { MP3, ISO_BMFF, UNKNOWN }

    fun detect(header: ByteArray): Format {
        if (header.size < 4) return Format.UNKNOWN
        val id3 = header[0] == 'I'.code.toByte() &&
            header[1] == 'D'.code.toByte() && header[2] == '3'.code.toByte()
        val mpegFrame = (header[0].toInt() and 0xff) == 0xff &&
            (header[1].toInt() and 0xe0) == 0xe0
        if (id3 || mpegFrame) return Format.MP3

        // ISO BMFF begins with a bounded ftyp box size followed by "ftyp".
        if (header.size >= 12 &&
            header[4] == 'f'.code.toByte() &&
            header[5] == 't'.code.toByte() &&
            header[6] == 'y'.code.toByte() &&
            header[7] == 'p'.code.toByte()) {
            val boxSize = ((header[0].toLong() and 255) shl 24) or
                ((header[1].toLong() and 255) shl 16) or
                ((header[2].toLong() and 255) shl 8) or
                (header[3].toLong() and 255)
            if (boxSize in 16..4096) return Format.ISO_BMFF
        }
        return Format.UNKNOWN
    }
}
