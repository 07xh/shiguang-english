package com.shiguang.english.nativeapp.model

data class DictationBlank(val start: Int, val endExclusive: Int, val word: String)

/** Stable blank indexes so user answers survive sentence navigation and screen recreation. */
object DictationBlankSelector {
    private val words = Regex("[A-Za-z]+(?:['’-][A-Za-z]+)*")

    fun select(text: String, advanced: Boolean = false): List<DictationBlank> {
        val eligible = words.findAll(text).filter { it.value.length >= 3 }.toList()
        if (eligible.isEmpty()) return emptyList()
        val chosen = eligible.filterIndexed { index, _ ->
            if (advanced) index % 5 in setOf(0, 2, 4)
            else index % 3 == 1
        }.ifEmpty { listOf(eligible.first()) }
        return chosen.map { DictationBlank(it.range.first, it.range.last + 1, it.value) }
    }
}
