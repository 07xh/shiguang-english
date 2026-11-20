package com.shiguang.english.nativeapp.data

/**
 * In CET listening, the question is often spoken in the audio recording.
 * A non-empty A-D option set must remain answerable even when no text stem
 * was provided by the original source. This does not synthesize any question.
 */
internal object ListeningQuestionPolicy {
    fun isAnswerableWithoutStem(module: String, optionCount: Int): Boolean =
        module == "listening" && optionCount > 0
}
