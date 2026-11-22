package com.shiguang.english.nativeapp.model

/**
 * Catalog counts are metadata, not proof that every downloaded source question
 * or sentence is present. Report a shortfall without hiding usable exercises.
 */
internal object ExamContentCoverage {
    fun warning(module: String, expected: Int, actual: Int): String? {
        if (expected <= 0 || actual >= expected) return null
        val noun = when (module) {
            "listening" -> "听力题"
            "dictation" -> "精听句"
            else -> return null
        }
        return "内容可能不完整：目录标注 ${expected} ${noun}，当前解析到 ${actual} ${noun}。" +
            "可以练习已加载内容，但不能据此认定整套试卷已完整。"
    }
}
