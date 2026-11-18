package com.shiguang.english.nativeapp.ui

import android.media.MediaPlayer
import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.border
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.TextStyle
import com.shiguang.english.nativeapp.model.DictationBlankSelector
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityQuestion
import com.shiguang.english.nativeapp.data.UniversityRepository
import com.shiguang.english.nativeapp.data.UniversitySentence
import org.json.JSONObject

private val levelDisplay = mapOf(
    "cet4" to "四级", "cet6" to "六级", "ielts" to "雅思", "kaoyan" to "考研"
)
private val moduleDisplay = mapOf("listening" to "听力题", "written" to "笔试", "dictation" to "逐句精听")

@Composable
fun UniversityCatalogScreen(
    repository: UniversityRepository,
    initialLevel: String = "cet4",
    initialModule: String = "written",
    onOpen: (UniversityExam, String) -> Unit
) {
    var module by rememberSaveable(initialModule) { mutableStateOf(initialModule) }
    var level by rememberSaveable(initialLevel, initialModule) { mutableStateOf(initialLevel) }
    var yearRange by rememberSaveable(initialLevel, initialModule) { mutableStateOf("ALL") }
    val validLevels = when (module) {
        "listening" -> listOf("cet4", "cet6")
        "dictation" -> listOf("cet4", "cet6", "ielts")
        else -> listOf("cet4", "cet6", "kaoyan")
    }
    LaunchedEffect(module) {
        if (level !in validLevels) level = validLevels.first()
        yearRange = "ALL"
    }
    val available = remember(level, module) {
        repository.exams.filter { it.level == level && module in it.modules }
    }
    val rangeLabels = if (level == "ielts") {
        listOf("ALL" to "全部册数", "15-99" to "第15–21册", "0-14" to "第4–14册")
    } else {
        listOf("ALL" to "全部年份", "2021-2099" to "2021–2026年",
            "2015-2020" to "2015–2020年", "0-2014" to "2014年以前")
    }
    val visible = available.filter { exam ->
        if (yearRange == "ALL") true else {
            val halves = yearRange.split("-")
            exam.year in halves[0].toInt()..halves[1].toInt()
        }
    }
    val installed = available.count { module in repository.installedModules(it) }
    val modes = listOf(
        Triple("written", "✍️", "笔试特训"),
        Triple("listening", "🎧", "听力特训"),
        Triple("dictation", "🎙️", "逐句精听")
    )
    LazyVerticalGrid(
        columns = GridCells.Adaptive(226.dp),
        modifier = Modifier.fillMaxSize().widthIn(max = 1040.dp),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 34.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Surface(
                shape = RoundedCornerShape(19.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, PaperStroke)
            ) {
                Column(Modifier.fillMaxWidth().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(
                        when (module) {
                            "listening" -> "🎧 历年听力精刷"
                            "dictation" -> "🎙️ 历年逐句精听"
                            else -> "✍️ 历年笔试特训"
                        },
                        fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink
                    )
                    Text("选择考级与年份，再进入试卷", fontSize = 12.5.sp, color = MutedInk)
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp))
                    .background(CardSubtle).padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                modes.forEach { (value, symbol, title) ->
                    val active = value == module
                    Surface(
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(12.dp),
                        color = if (active) Color.White else Color.Transparent,
                        onClick = {
                            module = value
                            yearRange = "ALL"
                        },
                        shadowElevation = if (active) 2.dp else 0.dp
                    ) {
                        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically) {
                            Text(symbol, fontSize = 13.sp)
                            Spacer(Modifier.width(4.dp))
                            Text(title, fontSize = 12.sp, fontWeight = if (active)
                                FontWeight.Bold else FontWeight.Medium, maxLines = 1)
                        }
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                validLevels.forEach { key ->
                    val selected = level == key
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = if (selected) Color.White else CardSubtle,
                        border = androidx.compose.foundation.BorderStroke(
                            0.8.dp, if (selected) PaperStroke else Color.Transparent
                        ),
                        shadowElevation = if (selected) 3.dp else 0.dp,
                        onClick = { level = key; yearRange = "ALL" }
                    ) {
                        Text(
                            when (key) {
                                "cet4" -> "📘 四级"
                                "cet6" -> "📕 六级"
                                "ielts" -> "🎧 雅思"
                                else -> "📖 考研"
                            },
                            modifier = Modifier.padding(horizontal = 17.dp, vertical = 11.dp),
                            color = if (selected) Ink else MutedInk,
                            fontSize = 13.sp,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("选择试卷", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text("已内置 " + installed + " / " + available.size,
                        fontSize = 11.5.sp, color = if (installed == available.size)
                            CorrectGreen else MutedInk)
                }
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    rangeLabels.forEach { (value, title) ->
                        val active = yearRange == value
                        Surface(
                            onClick = { yearRange = value },
                            shape = RoundedCornerShape(20.dp),
                            color = if (active) Ink else CardSubtle
                        ) {
                            Text(title, modifier = Modifier.padding(
                                horizontal = 12.dp, vertical = 8.dp),
                                color = if (active) Color.White else MutedInk,
                                fontSize = 11.5.sp)
                        }
                    }
                }
            }
        }
        items(visible, key = { it.level + "/" + it.id }) { exam ->
            val usable = module in repository.installedModules(exam)
            Surface(
                modifier = Modifier.fillMaxWidth().height(143.dp),
                shape = RoundedCornerShape(19.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(0.8.dp, PaperStroke),
                onClick = { if (usable) onOpen(exam, module) }
            ) {
                Column(
                    Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            when (module) {
                                "listening" -> "LISTENING"
                                "dictation" -> "DICTATION"
                                else -> "WRITTEN"
                            },
                            color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold
                        )
                        Text(exam.year.toString(), color = MutedInk, fontSize = 12.sp)
                    }
                    Text(
                        exam.title,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        lineHeight = 19.sp
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (usable) "开始练习" else "资源未打包",
                            fontSize = 12.sp, color = if (usable) QuietBlue else MutedInk,
                            fontWeight = FontWeight.SemiBold
                        )
                        Icon(Icons.Outlined.ChevronRight, contentDescription = null,
                            tint = if (usable) QuietBlue else MutedInk, modifier = Modifier.size(19.dp))
                    }
                }
            }
        }
        if (visible.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }) {
            Text("该分类暂无试卷，尝试调整年份范围。",
                color = MutedInk, modifier = Modifier.padding(vertical = 25.dp))
        }
    }
}

@Composable
fun UniversityPaperScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    module: String
) {
    val raw = remember(repository, exam.id, module) {
        runCatching {
            if (module == "dictation") Pair(repository.sentences(exam), emptyList<UniversityQuestion>())
            else Pair(emptyList<UniversitySentence>(), repository.questions(exam, module))
        }
    }
    if (raw.isFailure) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("当前题目文件不可用", style = MaterialTheme.typography.titleLarge)
            Text(raw.exceptionOrNull()?.message ?: "无法读取试卷", color = MutedInk)
        }
        return
    }
    val (sentences, questions) = raw.getOrThrow()
    if (module == "dictation") {
        UniversityMultiBlankScreen(repository, exam, sentences)
    } else {
        UniversityQuestionScreen(repository, exam, questions, module)
    }
}

@Composable
private fun UniversityAudioControls(repository: UniversityRepository, exam: UniversityExam) {
    val context = LocalContext.current
    val path = remember(exam.id) { repository.audioAsset(exam) }
    var playing by remember(exam.id) { mutableStateOf(false) }
    var speed by rememberSaveable(exam.id) { mutableFloatStateOf(1f) }
    var error by remember(exam.id) { mutableStateOf("") }
    val player = remember(exam.id) { MediaPlayer() }
    var initialized by remember(exam.id) { mutableStateOf(false) }
    DisposableEffect(player) {
        player.setOnCompletionListener { playing = false }
        onDispose { player.stopSafe(); player.release() }
    }
    if (path == null) {
        Text("这套试卷没有通过离线音频校验", color = Amber, style = MaterialTheme.typography.bodySmall)
        return
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = {
            try {
                if (!initialized) {
                    context.assets.openFd(path).use {
                        player.setDataSource(it.fileDescriptor, it.startOffset, it.length)
                    }
                    player.prepare()
                    player.playbackParams = player.playbackParams.setSpeed(speed)
                    initialized = true
                }
                if (playing) player.pause() else player.start()
                playing = !playing
                error = ""
            } catch (exc: Exception) {
                playing = false
                error = exc.message.orEmpty()
            }
        }) {
            Icon(Icons.Outlined.GraphicEq, contentDescription = null)
            Text(if (playing) "暂停原声" else "播放原声")
        }
        OutlinedButton(onClick = {
            speed = when (speed) { 1f -> 1.25f; 1.25f -> 1.5f; 1.5f -> 0.75f; else -> 1f }
            if (initialized) try { player.playbackParams = player.playbackParams.setSpeed(speed) }
            catch (_: Exception) {}
        }) { Text(speed.toString() + "×") }
    }
    if (error.isNotBlank()) Text("音频播放失败：" + error, color = Amber)
    Text("当前为完整试卷音频；逐句时间轴尚需根据源数据校准。",
        style = MaterialTheme.typography.bodySmall, color = MutedInk)
}

private fun MediaPlayer.stopSafe() {
    try { stop() } catch (_: Exception) {}
}

@Composable
private fun UniversityQuestionScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    questions: List<UniversityQuestion>,
    module: String
) {
    if (questions.isEmpty()) {
        Text("试卷 JSON 已加载，但还没有解析出可作答题目。不能将它标记为完整试卷。",
            modifier = Modifier.padding(24.dp), color = Amber)
        return
    }
    var index by rememberSaveable(exam.id, module) { mutableIntStateOf(0) }
    var answersJson by rememberSaveable(exam.id, module) { mutableStateOf("{}") }
    var practiceMode by rememberSaveable(exam.id, module) { mutableStateOf(true) }
    var submitted by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    var showJump by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    val answers = remember(answersJson) { JSONObject(answersJson) }
    val answered = questions.indices.filter { answers.has(it.toString()) }.toSet()
    val question = questions[index.coerceIn(0, questions.lastIndex)]
    val selected = answers.optString(index.toString(), "")
    fun store(text: String) {
        val updated = JSONObject(answersJson)
        updated.put(index.toString(), text)
        answersJson = updated.toString()
    }
    val goNext = {
        if (index < questions.lastIndex) index += 1
        else if (answered.size == questions.size) submitted = true
        else showJump = true
    }
    if (showJump) PracticeJumpSheet(
        title = "答题卡",
        total = questions.size,
        selectedIndex = index,
        answered = answered,
        onChoose = { index = it; submitted = false; showJump = false },
        onDismiss = { showJump = false }
    )
    Scaffold(
        containerColor = Color.White,
        bottomBar = {
            ReplicaTransportBar(
                previous = "上一题", next = if (index == questions.lastIndex) "交卷" else "下一题",
                center = (answered.size.toString() + "/" + questions.size),
                onPrev = { index = (index - 1).coerceAtLeast(0); submitted = false },
                onNext = goNext,
                onCenter = { showJump = true },
                canPrev = index > 0,
                canNext = !submitted
            )
        }
    ) { insets ->
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize().padding(insets),
            contentAlignment = Alignment.TopCenter
        ) {
            val tablet = maxWidth >= 750.dp
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 1080.dp),
                contentPadding = PaddingValues(18.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp)
            ) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(exam.title, fontSize = 12.sp,
                            color = MutedInk, modifier = Modifier.weight(1f))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("练习", fontSize = 11.sp, color = MutedInk)
                            Switch(
                                checked = practiceMode,
                                onCheckedChange = { practiceMode = it },
                                modifier = Modifier.height(34.dp)
                            )
                        }
                    }
                }
                if (submitted) {
                    item {
                        Surface(
                            color = CardSubtle,
                            shape = RoundedCornerShape(20.dp),
                            border = androidx.compose.foundation.BorderStroke(0.7.dp, PaperStroke)
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(22.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text("本卷练习已完成", fontWeight = FontWeight.Bold, fontSize = 23.sp)
                                Text("共 " + questions.size + " 题 · 已作答 " + answered.size + " 题",
                                    color = MutedInk)
                                Text("主观题与复杂题型不进行未经核验的自动评分。",
                                    color = MutedInk, fontSize = 13.sp)
                                Button(onClick = { submitted = false; index = 0 }) {
                                    Text("回顾整卷")
                                }
                            }
                        }
                    }
                } else {
                    item {
                        ReplicaSequenceHeader(
                            sequence = index + 1, total = questions.size,
                            section = question.type.ifBlank {
                                if (module == "listening") "Listening" else "Reading"
                            },
                            onJump = { showJump = true }
                        )
                    }
                    if (module == "listening") item {
                        Surface(
                            color = CardSubtle, shape = RoundedCornerShape(17.dp)
                        ) {
                            Column(Modifier.fillMaxWidth().padding(15.dp),
                                verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                UniversityAudioControls(repository, exam)
                            }
                        }
                    }
                    item {
                        if (tablet && question.passage.isNotBlank()) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(18.dp),
                                verticalAlignment = Alignment.Top,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                ReplicaPassagePanel(question.passage, Modifier.weight(1.02f))
                                ReplicaQuestionPanel(
                                    question = question, selected = selected,
                                    practiceMode = practiceMode, onAnswer = ::store,
                                    modifier = Modifier.weight(0.98f)
                                )
                            }
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                if (question.passage.isNotBlank()) {
                                    ReplicaPassagePanel(question.passage, Modifier.fillMaxWidth())
                                }
                                ReplicaQuestionPanel(
                                    question = question, selected = selected,
                                    practiceMode = practiceMode, onAnswer = ::store,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReplicaPassagePanel(text: String, modifier: Modifier) {
    Surface(
        modifier = modifier,
        color = CardSubtle,
        shape = RoundedCornerShape(17.dp),
        border = androidx.compose.foundation.BorderStroke(0.7.dp, PaperStroke)
    ) {
        Column(Modifier.fillMaxWidth().padding(19.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Text("阅读原文", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MutedInk)
            Text(text, fontSize = 15.sp, lineHeight = 26.sp, color = Ink)
        }
    }
}

@Composable
private fun ReplicaQuestionPanel(
    question: UniversityQuestion,
    selected: String,
    practiceMode: Boolean,
    onAnswer: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val isTF = question.type in setOf("tfng", "true_false_not_given", "yes_no_not_given")
    val choices = if (isTF && question.choices.isEmpty()) {
        val words = if (question.type == "yes_no_not_given")
            listOf("YES", "NO", "NOT GIVEN") else listOf("TRUE", "FALSE", "NOT GIVEN")
        words.map { it to it }
    } else question.choices
    val objective = choices.isNotEmpty()
    val correctLabel = choices.firstOrNull { (label, text) ->
        label.equals(question.answer, true) || text.equals(question.answer, true)
    }?.first
    Column(modifier, verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Text(
            question.prompt.ifBlank { "根据原文与题目要求作答" },
            fontSize = 19.sp, lineHeight = 30.sp,
            color = Ink, fontWeight = FontWeight.Bold
        )
        if (objective) {
            choices.forEach { (key, text) ->
                val active = selected.equals(key, true) || selected.equals(text, true)
                val show = practiceMode && selected.isNotBlank() && correctLabel != null
                ReplicaOptionCard(
                    key = key, label = text,
                    isSelected = active,
                    isCorrect = if (!show) null else if (key == correctLabel) true
                        else if (active) false else null,
                    onSelect = { onAnswer(key) }
                )
            }
        } else {
            OutlinedTextField(
                value = selected,
                onValueChange = onAnswer,
                modifier = Modifier.fillMaxWidth(),
                minLines = 3, maxLines = 16,
                label = {
                    Text(
                        when (question.type) {
                            "writing" -> "写作内容"
                            "translation", "translation_en_zh" -> "输入译文"
                            "proofread" -> "输入修改后的句子或答案"
                            else -> "输入答案"
                        }
                    )
                }
            )
            Text("答案会随输入保留；主观题不自动虚报分数。",
                color = MutedInk, fontSize = 12.sp)
        }
        if (practiceMode && selected.isNotBlank() &&
            (question.answer.isNotBlank() || question.analysis.isNotBlank())) {
            ReplicaAnalysisCard(question.answer, question.analysis)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun UniversityMultiBlankScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    sentences: List<UniversitySentence>
) {
    if (sentences.isEmpty()) {
        Text("精听资源已打包，但没有解析出有效句子。",
            modifier = Modifier.padding(24.dp), color = Amber)
        return
    }
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    var index by rememberSaveable(exam.id) { mutableIntStateOf(0) }
    var advanced by rememberSaveable(exam.id) { mutableStateOf(false) }
    var active by rememberSaveable(exam.id, index) { mutableIntStateOf(0) }
    var answersJson by rememberSaveable(exam.id) { mutableStateOf("{}") }
    var answerVisible by rememberSaveable(exam.id, index) { mutableStateOf(false) }
    var hintVisible by rememberSaveable(exam.id, index) { mutableStateOf(false) }
    var jumpVisible by rememberSaveable(exam.id) { mutableStateOf(false) }
    var customKeyboard by rememberSaveable(exam.id) { mutableStateOf(!isLandscape) }
    val sent = sentences[index]
    val blanks = remember(sent.text, advanced) {
        DictationBlankSelector.select(sent.text, advanced)
    }
    val recorded = remember(answersJson) { JSONObject(answersJson) }
    fun key(sentIndex: Int, startOffset: Int) =
        sentIndex.toString() + "_" + startOffset
    fun input(blank: Int): String = recorded.optString(key(index, blanks[blank].start), "")
    fun write(blank: Int, text: String) {
        if (blank !in blanks.indices) return
        val updated = JSONObject(answersJson)
        updated.put(key(index, blanks[blank].start), text)
        answersJson = updated.toString()
    }
    fun done(sentenceIndex: Int): Boolean {
        val selected = DictationBlankSelector.select(sentences[sentenceIndex].text, advanced)
        return selected.isNotEmpty() && selected.all {
            recorded.optString(key(sentenceIndex, it.start), "")
                .trim().equals(it.word, ignoreCase = true)
        }
    }
    val completedIndices = sentences.indices.filter { done(it) }.toSet()
    val currentCompleted = done(index)
    if (jumpVisible) {
        PracticeJumpSheet(
            title = "逐句精听索引",
            total = sentences.size,
            selectedIndex = index,
            answered = completedIndices,
            onChoose = { index = it; jumpVisible = false },
            onDismiss = { jumpVisible = false }
        )
    }

    Scaffold(
        containerColor = Color.White,
        bottomBar = {
            Column {
                if (customKeyboard && blanks.isNotEmpty()) {
                    Surface(
                        color = Color(0xFFF2F3F7),
                        shadowElevation = 4.dp,
                        border = androidx.compose.foundation.BorderStroke(0.75.dp, PaperStroke)
                    ) {
                        Column(
                            Modifier.fillMaxWidth().widthIn(max = 800.dp)
                                .padding(start = 12.dp, end = 12.dp, top = 9.dp, bottom = 4.dp),
                            verticalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Row(Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    "第 " + (active.coerceIn(0, blanks.lastIndex) + 1) +
                                        " / " + blanks.size + " 空",
                                    fontSize = 12.sp, color = MutedInk
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = {
                                        active = (active - 1).coerceAtLeast(0)
                                    }, enabled = active > 0) { Text("上一空") }
                                    TextButton(onClick = {
                                        active = (active + 1).coerceAtMost(blanks.lastIndex)
                                    }, enabled = active < blanks.lastIndex) { Text("下一空") }
                                }
                            }
                            NativeQwertyKeyboard(
                                onLetter = {
                                    val safe = active.coerceIn(0, blanks.lastIndex)
                                    write(safe, input(safe) + it)
                                },
                                onErase = {
                                    val safe = active.coerceIn(0, blanks.lastIndex)
                                    write(safe, input(safe).dropLast(1))
                                },
                                onHide = { customKeyboard = false }
                            )
                        }
                    }
                }
                ReplicaTransportBar(
                    previous = "上一句",
                    center = "选句",
                    next = "下一句",
                    onPrev = { index = (index - 1).coerceAtLeast(0) },
                    onCenter = { jumpVisible = true },
                    onNext = { index = (index + 1).coerceAtMost(sentences.lastIndex) },
                    canPrev = index > 0,
                    canNext = index < sentences.lastIndex
                )
            }
        }
    ) { inset ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(inset).widthIn(max = 1000.dp),
            contentPadding = PaddingValues(
                start = 18.dp, end = 18.dp, top = 15.dp, bottom = 18.dp
            ),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item {
                ReplicaSequenceHeader(
                    sequence = index + 1,
                    total = sentences.size,
                    section = sent.section.ifBlank { "逐句精听" },
                    onJump = { jumpVisible = true }
                )
            }
            item {
                Column(Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    ReplicaSentencePlayer(
                        repository = repository,
                        exam = exam,
                        sentenceIndex = index,
                        startSeconds = sent.startSeconds,
                        endSeconds = sent.endSeconds
                    )
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("听写模式", fontSize = 12.sp, color = MutedInk)
                        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            ReplicaCanvasAction(
                                text = if (advanced) "进阶 · 60%" else "基础 · 30%",
                                onClick = { advanced = !advanced },
                                selected = true
                            )
                            ReplicaCanvasAction(
                                text = if (customKeyboard) "⌨ 自制" else "⌨ 系统",
                                onClick = { customKeyboard = !customKeyboard }
                            )
                        }
                    }
                }
            }
            item {
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    if (blanks.isEmpty()) {
                        Text(sent.text, fontSize = 24.sp, lineHeight = 38.sp)
                        Text("本句无符合条件的英文听写词。", color = MutedInk)
                    } else {
                        FlowRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(0.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val allWords = Regex("[A-Za-z]+(?:['’-][A-Za-z]+)*")
                                .findAll(sent.text).toList()
                            var cursor = 0
                            allWords.forEach { match ->
                                val gap = sent.text.substring(cursor, match.range.first)
                                if (gap.isNotEmpty()) {
                                    Text(gap, fontSize = if (isLandscape) 18.5.sp else 23.sp, lineHeight = if (isLandscape) 30.sp else 45.sp)
                                }
                                val blankIndex = blanks.indexOfFirst { it.start == match.range.first }
                                if (blankIndex < 0 || answerVisible) {
                                    Text(match.value, fontSize = if (isLandscape) 18.5.sp else 23.sp,
                                        color = Ink, lineHeight = if (isLandscape) 30.sp else 45.sp,
                                        fontWeight = FontWeight.Medium)
                                } else {
                                    val value = input(blankIndex)
                                    val correct = value.isNotBlank() &&
                                        value.trim().equals(blanks[blankIndex].word, ignoreCase = true)
                                    val activated = active == blankIndex
                                    BasicTextField(
                                        value = value,
                                        onValueChange = { write(blankIndex, it) },
                                        singleLine = true,
                                        readOnly = customKeyboard,
                                        textStyle = TextStyle(
                                            fontSize = if (isLandscape) 16.sp else 20.sp, fontWeight = FontWeight.SemiBold,
                                            color = if (correct) CorrectGreen else Ink
                                        ),
                                        modifier = Modifier
                                            .width(((value.length.coerceAtLeast(5) * 13)
                                                .coerceAtMost(170)).dp)
                                            .onFocusChanged { if (it.isFocused) active = blankIndex }
                                            .clip(RoundedCornerShape(11.dp))
                                            .background(
                                                when {
                                                    correct -> Color(0xFFF2FAF5)
                                                    activated -> SoftBlue
                                                    else -> CardSubtle
                                                }
                                            )
                                            .border(
                                                1.dp,
                                                when {
                                                    correct -> CorrectGreen.copy(alpha = 0.45f)
                                                    activated -> QuietBlue
                                                    else -> PaperStroke
                                                },
                                                RoundedCornerShape(11.dp)
                                            )
                                            .padding(horizontal = 9.dp, vertical = 8.dp),
                                        decorationBox = { inner ->
                                            Box(contentAlignment = Alignment.CenterStart) {
                                                if (value.isBlank()) Text(
                                                    "____", fontSize = 18.sp,
                                                    color = Color(0xFF8AAED2)
                                                )
                                                inner()
                                            }
                                        }
                                    )
                                }
                                cursor = match.range.last + 1
                            }
                            if (cursor < sent.text.length) {
                                Text(sent.text.substring(cursor), fontSize = if (isLandscape) 18.5.sp else 23.sp,
                                    lineHeight = if (isLandscape) 30.sp else 45.sp)
                            }
                        }
                    }
                    if (hintVisible && blanks.isNotEmpty()) {
                        Text(
                            "💡 首尾提示  " + blanks.joinToString("   ") {
                                it.word.first() + "…" + it.word.last()
                            },
                            fontSize = 13.sp, color = QuietBlue
                        )
                    }
                    if (answerVisible && sent.chinese.isNotBlank()) {
                        Text(sent.chinese, fontSize = 15.sp,
                            lineHeight = 26.sp, color = MutedInk)
                    }
                    if (currentCompleted) {
                        Surface(
                            shape = RoundedCornerShape(15.dp),
                            color = Color(0xFFE8F7EC)
                        ) {
                            Text("✓ 本句全部填写正确",
                                modifier = Modifier.fillMaxWidth().padding(15.dp),
                                color = CorrectGreen, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        ReplicaCanvasAction(
                            text = if (answerVisible) "📖 收起答案" else "📖 答案",
                            onClick = { answerVisible = !answerVisible },
                            selected = answerVisible
                        )
                        ReplicaCanvasAction(
                            text = if (hintVisible) "💡 关闭提示" else "💡 提示",
                            onClick = { hintVisible = !hintVisible },
                            selected = hintVisible
                        )
                    }
                }
            }
        }
    }
}
