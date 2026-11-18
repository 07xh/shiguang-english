package com.shiguang.english.nativeapp.model

/**
 * Stores a single immutable selection for each question in a demo practice round.
 * A dot means unanswered; digit characters encode selected option indexes.
 * Re-visiting an answered question never changes the aggregate stats.
 */
object AnswerLedger {
    fun empty(count: Int): String {
        require(count >= 0)
        return ".".repeat(count)
    }

    fun selection(answers: String, index: Int): Int? =
        answers.getOrNull(index)?.digitToIntOrNull()

    fun markOnce(answers: String, index: Int, option: Int, choices: Int): String {
        require(index in answers.indices)
        require(option in 0 until choices)
        require(choices <= 10)
        if (answers[index] != '.') return answers
        return answers.replaceRange(index, index + 1, option.toString())
    }

    fun answeredCount(answers: String): Int = answers.count { it != '.' }

    fun correctCount(answers: String, questions: List<ExamQuestion>): Int =
        questions.indices.count { index ->
            selection(answers, index) == questions[index].answer
        }
}
