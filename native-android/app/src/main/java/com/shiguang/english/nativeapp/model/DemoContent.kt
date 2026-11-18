package com.shiguang.english.nativeapp.model

data class WordBook(val id: String, val title: String, val subtitle: String)
data class Word(val id: String, val bookId: String, val spelling: String, val phonetic: String, val meaning: String, val example: String)
data class ExamQuestion(val stem: String, val choices: List<String>, val answer: Int, val explanation: String)
data class DictationLine(val english: String, val chinese: String, val missingWord: String)

object DemoContent {
    // ORIGINAL, self-authored samples only; not imported from third-party Toy scripts or exam papers.
    val books = listOf(
        WordBook("cet4", "大学英语四级", "独立编写的基础示例词组"),
        WordBook("cet6", "大学英语六级", "独立编写的进阶示例词组"),
        WordBook("graduate", "考研英语", "独立编写的学术示例词组")
    )
    val words = listOf(
        Word("w01", "cet4", "arrive", "/əˈraɪv/", "到达", "We arrive at the library at eight."),
        Word("w02", "cet4", "improve", "/ɪmˈpruːv/", "改善；提高", "Daily practice can improve your listening."),
        Word("w03", "cet4", "prepare", "/prɪˈpeə(r)/", "准备", "I prepare a short study plan every morning."),
        Word("w04", "cet4", "support", "/səˈpɔːt/", "支持", "The teacher will support our project."),
        Word("w05", "cet4", "balance", "/ˈbæləns/", "平衡", "She keeps a balance between work and rest."),
        Word("w06", "cet4", "notice", "/ˈnəʊtɪs/", "注意到；通知", "Did you notice the change in the timetable?"),
        Word("w07", "cet6", "analyze", "/ˈænəlaɪz/", "分析", "We analyze the results before writing the report."),
        Word("w08", "cet6", "efficient", "/ɪˈfɪʃnt/", "高效的", "The new method is more efficient."),
        Word("w09", "cet6", "significant", "/sɪɡˈnɪfɪkənt/", "重要的；显著的", "The study reports a significant difference."),
        Word("w10", "cet6", "assumption", "/əˈsʌmpʃn/", "假设", "The conclusion depends on a clear assumption."),
        Word("w11", "cet6", "sustainable", "/səˈsteɪnəbl/", "可持续的", "They proposed a sustainable solution."),
        Word("w12", "graduate", "hypothesis", "/haɪˈpɒθəsɪs/", "假说", "Our hypothesis requires further testing."),
        Word("w13", "graduate", "framework", "/ˈfreɪmwɜːk/", "框架", "The framework connects several ideas."),
        Word("w14", "graduate", "interpret", "/ɪnˈtɜːprɪt/", "解释；理解", "Researchers interpret the observations carefully."),
        Word("w15", "graduate", "empirical", "/ɪmˈpɪrɪkl/", "经验的；实证的", "The paper includes empirical evidence."),
        Word("w16", "graduate", "consistent", "/kənˈsɪstənt/", "一致的", "The findings are consistent with the model.")
    )
    val questions = listOf(
        ExamQuestion("The report ___ ready by Friday.", listOf("will be", "are", "were", "be"), 0, "主语为单数 report，表达将来的状态使用 will be。"),
        ExamQuestion("We need to ___ the results before making a decision.", listOf("analyze", "arrival", "analysis", "analyst"), 0, "to 后应接动词原形，analyze 表示分析。"),
        ExamQuestion("Which sentence describes a habit?", listOf("I studied yesterday.", "I study every morning.", "I am studying now.", "I will study tomorrow."), 1, "一般现在时通常用于表达经常性的习惯。"),
        ExamQuestion("The new design is more ___ than the old one.", listOf("efficiency", "efficient", "efficiently", "effect"), 1, "系动词 is 后使用形容词 efficient 作表语。"),
        ExamQuestion("What does 'consistent' mean in 'The findings are consistent'?", listOf("突然的", "昂贵的", "一致的", "隐藏的"), 2, "consistent 在这里表示一致、前后一致。")
    )
    val dictation = listOf(
        DictationLine("Practice makes progress when you stay consistent.", "坚持练习才能不断进步。", "progress"),
        DictationLine("Please prepare your notes before the lesson begins.", "请在上课前准备好笔记。", "prepare"),
        DictationLine("A quiet room can improve your concentration.", "安静的房间有助于提升专注力。", "concentration")
    )
    fun wordsFor(bookId: String): List<Word> = words.filter { it.bookId == bookId }
}
