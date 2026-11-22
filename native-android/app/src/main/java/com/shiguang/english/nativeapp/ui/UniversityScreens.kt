package com.shiguang.english.nativeapp.ui

import android.media.MediaPlayer
import android.content.Context
import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityQuestion
import com.shiguang.english.nativeapp.data.UniversityRepository
import com.shiguang.english.nativeapp.data.UniversityAttemptStore
import com.shiguang.english.nativeapp.data.PaperDraft
import com.shiguang.english.nativeapp.data.DictationDraft
import com.shiguang.english.nativeapp.data.UniversitySentence
import com.shiguang.english.nativeapp.data.ExamAudioSource
import com.shiguang.english.nativeapp.model.AudioCoverage
import com.shiguang.english.nativeapp.model.ExamContentCoverage
import com.shiguang.english.nativeapp.model.PlaybackRequestGate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
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
    var search by rememberSaveable(initialLevel, initialModule) { mutableStateOf("") }
    var downloadedOnly by rememberSaveable(initialLevel, initialModule) { mutableStateOf(false) }
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
        val rangeMatches = if (yearRange == "ALL") true else {
            val halves = yearRange.split("-")
            exam.year in halves[0].toInt()..halves[1].toInt()
        }
        val query = search.trim()
        val searchMatches = query.isBlank() ||
            exam.title.contains(query, ignoreCase = true) ||
            exam.id.contains(query, ignoreCase = true) ||
            exam.year.toString().contains(query)
        val savedMatches = !downloadedOnly || module in repository.installedModules(exam)
        rangeMatches && searchMatches && savedMatches
    }
    val installed = available.count { module in repository.installedModules(it) }
    val modes = listOf(
        Triple("written", "✍️", "笔试特训"),
        Triple("listening", "🎧", "听力特训"),
        Triple("dictation", "🎙️", "逐句精听")
    )
    LazyVerticalGrid(
        columns = GridCells.Adaptive(245.dp),
        modifier = Modifier.fillMaxSize().widthIn(max = 1040.dp),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 34.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("历年真题", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("选中试卷后按需下载；已下载的可离线练习",
                        color = MutedInk, fontSize = 11.5.sp)
                }
                Text(available.size.toString() + " 套",
                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MutedInk)
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
                    Text("已下载 " + installed + " / " + available.size,
                        fontSize = 11.5.sp, color = if (installed == available.size)
                            CorrectGreen else MutedInk)
                }
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null,
                        modifier = Modifier.size(19.dp)) },
                    trailingIcon = {
                        if (search.isNotEmpty()) IconButton(onClick = { search = "" }) {
                            Icon(Icons.Outlined.Close, contentDescription = "清除搜索")
                        }
                    },
                    placeholder = { Text("搜索年份、考试名称", fontSize = 13.sp) }
                )
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    FilterChip(
                        selected = downloadedOnly,
                        onClick = { downloadedOnly = !downloadedOnly },
                        label = { Text("仅已下载", fontSize = 11.sp) }
                    )
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
                modifier = Modifier.fillMaxWidth().height(132.dp),
                shape = RoundedCornerShape(19.dp),
                color = if (usable) Color(0xFFF8FBFF) else Color.White,
                border = androidx.compose.foundation.BorderStroke(
                    0.8.dp, if (usable) Color(0xFFD1E5FF) else PaperStroke),
                onClick = { onOpen(exam, module) }
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
                            if (usable) "已缓存 · 离线开始" else "下载题目并开始",
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
            Text(if (downloadedOnly) "当前筛选下没有已下载试卷，关闭「仅已下载」可查看全部。"
                else "没有匹配的试卷，试试其他关键词或年份。",
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
    var attempt by remember(exam.id, module) { mutableIntStateOf(0) }
    var bytes by remember(exam.id, module) { mutableLongStateOf(0L) }
    var expected by remember(exam.id, module) { mutableLongStateOf(0L) }
    var loaded by remember(exam.id, module) {
        mutableStateOf<Result<Pair<List<UniversitySentence>, List<UniversityQuestion>>>?>(null)
    }
    LaunchedEffect(repository, exam.id, module, attempt) {
        loaded = null
        bytes = 0L
        expected = 0L
        loaded = runCatching {
            repository.ensureModule(exam, module, progress = { done, total ->
                bytes = done
                expected = total
            })
            if (module == "dictation")
                Pair(repository.sentences(exam), emptyList<UniversityQuestion>())
            else
                Pair(emptyList<UniversitySentence>(), repository.questions(exam, module))
        }
    }
    val state = loaded
    if (state == null) {
        Column(Modifier.fillMaxWidth().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator()
            Text(if (bytes > 0) "下载试卷中：" + formatBytes(bytes) +
                (if (expected > 0) " / " + formatBytes(expected) else "")
                else "正在检查本地试卷 / 下载所需题目…")
            Text("只下载当前练习模块；下载完成后可离线使用。", color = MutedInk)
        }
        return
    }
    if (state.isFailure) {
        Column(Modifier.fillMaxWidth().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("这套试卷暂时无法打开", style = MaterialTheme.typography.titleLarge)
            Text(state.exceptionOrNull()?.message ?: "网络或题目文件异常", color = MutedInk)
            Text("已下载过的其他试卷不受影响。", color = MutedInk)
            Button(onClick = { attempt++ }) { Text("重试下载") }
        }
        return
    }
    val (sentences, questions) = state.getOrThrow()
    val shortfall = when (module) {
        "dictation" -> ExamContentCoverage.warning(module, exam.dictationCount, sentences.size)
        "listening" -> ExamContentCoverage.warning(module, exam.listeningCount, questions.size)
        else -> null
    }
    if (module == "dictation") {
        UniversityMultiBlankScreen(repository, exam, sentences, shortfall)
    } else {
        UniversityQuestionScreen(repository, exam, questions, module, shortfall)
    }
}

private fun formatBytes(n: Long): String =
    if (n < 1024L * 1024) (n / 1024L).toString() + " KB"
    else String.format(java.util.Locale.US, "%.1f MB", n / 1048576.0)

@Composable
private fun UniversityAudioControls(repository: UniversityRepository, exam: UniversityExam) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var audio by remember(exam.id) { mutableStateOf(repository.audioSource(exam)) }
    var downloading by remember(exam.id) { mutableStateOf(false) }
    var busy by remember(exam.id) { mutableStateOf(false) }
    val playbackGate = remember(exam.id) { PlaybackRequestGate() }
    var downloadedBytes by remember(exam.id) { mutableLongStateOf(0L) }
    var expectedBytes by remember(exam.id) { mutableLongStateOf(0L) }
    var playing by remember(exam.id) { mutableStateOf(false) }
    var speed by rememberSaveable(exam.id) { mutableFloatStateOf(1f) }
    var error by remember(exam.id) { mutableStateOf("") }
    val player = remember(exam.id) { MediaPlayer() }
    var initialized by remember(exam.id) { mutableStateOf(false) }
    DisposableEffect(player) {
        player.setOnCompletionListener { playing = false }
        onDispose { runCatching { player.stop() }; player.release() }
    }
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(enabled = !busy, onClick = {
                if (playbackGate.tryEnter()) {
                    busy = true
                    scope.launch {
                    try {
                        if (audio == null) {
                            downloading = true
                            audio = repository.ensureAudio(exam) { done, total ->
                                downloadedBytes = done
                                expectedBytes = total
                            }
                            downloading = false
                        }
                        if (!initialized) {
                            when (val local = audio) {
                                is ExamAudioSource.Asset -> {
                                    context.assets.openFd(local.path).use {
                                        player.setDataSource(it.fileDescriptor, it.startOffset, it.length)
                                    }
                                }
                                is ExamAudioSource.Downloaded ->
                                    player.setDataSource(local.file.absolutePath)
                                null -> throw IllegalStateException("音频资源未下载")
                            }
                            player.prepare()
                            if (!AudioCoverage.isPlausibleRecording(
                                    player.duration.toLong(), repository.expectedAudioEndMs(exam))) {
                                throw IllegalStateException(
                                    "原声时长不足，或不能覆盖本卷已知时间轴；不将该录音标记为完整"
                                )
                            }
                            initialized = true
                        }
                        if (playing) {
                            player.pause()
                            playing = false
                        } else {
                            // On Android, setPlaybackParams(nonzero) starts a prepared
                            // or paused player. Apply speed only AFTER explicit Play.
                            player.start()
                            player.playbackParams = player.playbackParams.setSpeed(speed)
                            playing = true
                        }
                        error = ""
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (exc: Exception) {
                        playing = false
                        if (!initialized) runCatching { player.reset() }
                        error = exc.message.orEmpty()
                    } finally {
                        downloading = false
                        busy = false
                        playbackGate.leave()
                    }
                    }
                }
            }) {
                Icon(Icons.Outlined.GraphicEq, contentDescription = null)
                Text(if (downloading) "下载中" else if (playing) "暂停原声"
                    else if (audio == null) "下载原声并播放" else "播放原声")
            }
            OutlinedButton(enabled = !busy, onClick = {
                speed = when (speed) { 1f -> 1.25f; 1.25f -> 1.5f
                    1.5f -> 0.75f; else -> 1f }
                // Save the selected speed while paused; applying it here would
                // unexpectedly resume MediaPlayer playback.
                if (initialized && playing) runCatching {
                    player.playbackParams = player.playbackParams.setSpeed(speed)
                }
            }) { Text(speed.toString() + "×") }
        }
        if (downloading) {
            LinearProgressIndicator(
                progress = { if (expectedBytes > 0) (downloadedBytes.toFloat() /
                    expectedBytes).coerceIn(0f,1f) else 0f },
                modifier = Modifier.fillMaxWidth()
            )
            Text("原声下载：" + formatBytes(downloadedBytes) +
                (if (expectedBytes > 0) " / " + formatBytes(expectedBytes) else ""))
        }
        if (audio == null && !downloading)
            Text("原声按需下载，校验通过后保留在本机。缺少原站文件时会明确报错。",
                color = MutedInk)
        if (audio != null && !downloading && initialized &&
            repository.expectedAudioEndMs(exam) == null) {
            Text("当前试卷缺少完整录音时间轴，已核对播放时长，但无法确认覆盖全部题目。",
                color = MutedInk, fontSize = 12.sp)
        }
        if (error.isNotBlank()) Text("音频获取失败：" + error, color = Amber)
    }
}


@Composable
private fun UniversityQuestionScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    questions: List<UniversityQuestion>,
    module: String,
    coverageWarning: String?
) {
    if (questions.isEmpty()) {
        Text("试卷 JSON 已加载，但还没有解析出可作答题目。不能将它标记为完整试卷。",
            modifier = Modifier.padding(24.dp), color = Amber)
        return
    }
    val context = LocalContext.current
    val draftStore = remember(context) { UniversityAttemptStore(context.applicationContext) }
    // Same setting as the original CET listening quiz: hide only the spoken stem.
    val listeningPrefs = remember(context) {
        context.applicationContext.getSharedPreferences(
            "shiguang_listening_display", Context.MODE_PRIVATE
        )
    }
    var hideListeningQuestion by rememberSaveable(exam.level, exam.id, module) {
        mutableStateOf(listeningPrefs.getBoolean("hide_listening_stem", false))
    }
    val fingerprint = remember(questions) {
        questions.joinToString("|") { it.id + ":" + it.type + ":" + it.prompt }.hashCode().toString()
    }
    val draft = remember(exam.level, exam.id, module, fingerprint) {
        draftStore.loadPaper(exam, module, fingerprint)
    }
    var index by rememberSaveable(exam.id, module, fingerprint) {
        mutableIntStateOf(draft.index.coerceIn(0, questions.lastIndex))
    }
    var answersJson by rememberSaveable(exam.id, module, fingerprint) {
        mutableStateOf(draft.answersJson)
    }
    var practiceMode by rememberSaveable(exam.id, module, fingerprint) {
        mutableStateOf(draft.practiceMode)
    }
    var submitted by rememberSaveable(exam.id, module, fingerprint) {
        mutableStateOf(draft.submitted)
    }
    var reviewing by rememberSaveable(exam.id, module, fingerprint) {
        mutableStateOf(false)
    }
    var showJump by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    var showSubmit by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    var showRestart by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    var reviewFilter by rememberSaveable(exam.id, module, fingerprint) {
        mutableStateOf("all")
    }
    val listState = rememberLazyListState()
    // A new question must start at its prompt, not at the previous question's
    // scroll offset. The same applies when entering/leaving submitted review.
    LaunchedEffect(index, submitted, reviewing, reviewFilter) {
        listState.scrollToItem(0)
    }
    val answers = remember(answersJson) { JSONObject(answersJson) }
    val answered = questions.indices.filter {
        answers.optString(it.toString(), "").isNotBlank()
    }.toSet()
    val visibleReviewIndices = questions.indices.filter { questionIndex ->
        when (reviewFilter) {
            "answered" -> questionIndex in answered
            "unanswered" -> questionIndex !in answered
            else -> true
        }
    }
    val question = questions[index.coerceIn(0, questions.lastIndex)]
    val selected = answers.optString(index.toString(), "")
    val usedElsewhere = remember(index, answersJson, questions) {
        val sharedBank = question.type in setOf("matching", "banked_cloze", "seven_out_of_five")
        if (!sharedBank) emptySet() else questions.indices.filter { other ->
            if (other == index) return@filter false
            val q = questions[other]
            q.type == question.type && (
                question.section.isNotBlank() && q.section == question.section ||
                question.passage.isNotBlank() && q.passage == question.passage
            )
        }.mapNotNull { other ->
            answers.optString(other.toString(), "").takeIf { it.isNotBlank() }
        }.toSet()
    }
    LaunchedEffect(exam.level, exam.id, module, fingerprint, index, answersJson, practiceMode, submitted) {
        draftStore.savePaper(
            exam, module, fingerprint,
            PaperDraft(index, answersJson, practiceMode, submitted)
        )
    }
    fun store(text: String) {
        val updated = JSONObject(answersJson)
        updated.put(index.toString(), text)
        answersJson = updated.toString()
    }
    val goNext = {
        if (index < questions.lastIndex) index += 1
        else showSubmit = true
    }
    if (showSubmit) AlertDialog(
        onDismissRequest = { showSubmit = false },
        title = { Text("确认交卷？") },
        text = {
            Text(
                "已作答 ${answered.size} / ${questions.size} 题。" +
                    if (answered.size < questions.size)
                        "还有 ${questions.size - answered.size} 题未完成，可返回答题卡继续作答。"
                    else "交卷后仍可回顾整卷。"
            )
        },
        confirmButton = {
            TextButton(onClick = {
                showSubmit = false
                submitted = true
                reviewing = false
            }) {
                Text("确认交卷")
            }
        },
        dismissButton = {
            TextButton(onClick = { showSubmit = false }) { Text("继续作答") }
        }
    )
    if (showRestart) AlertDialog(
        onDismissRequest = { showRestart = false },
        title = { Text("确定重新作答？") },
        text = { Text("此操作会清空本卷已保存的答案和交卷状态，无法恢复。") },
        confirmButton = {
            TextButton(onClick = {
                showRestart = false
                draftStore.clearPaper(exam, module)
                answersJson = "{}"
                index = 0
                submitted = false
                reviewing = false
                reviewFilter = "all"
            }) { Text("清空并重新作答") }
        },
        dismissButton = {
            TextButton(onClick = { showRestart = false }) { Text("取消") }
        }
    )
    if (showJump) PracticeJumpSheet(
        title = "答题卡",
        total = questions.size,
        selectedIndex = index,
        answered = answered,
        onChoose = {
            index = it
            reviewing = submitted
            showJump = false
        },
        onDismiss = { showJump = false }
    )
    Scaffold(
        containerColor = Color.White,
        bottomBar = {
            ReplicaTransportBar(
                previous = "上一题",
                next = when {
                    submitted && !reviewing -> "查看第1题"
                    submitted && index == questions.lastIndex -> "返回结果"
                    !submitted && index == questions.lastIndex -> "交卷"
                    else -> "下一题"
                },
                center = (answered.size.toString() + "/" + questions.size),
                onPrev = { index = (index - 1).coerceAtLeast(0) },
                onNext = {
                    when {
                        submitted && !reviewing -> { index = 0; reviewing = true }
                        submitted && index == questions.lastIndex -> reviewing = false
                        else -> goNext()
                    }
                },
                onCenter = { showJump = true },
                canPrev = (!submitted || reviewing) && index > 0,
                canNext = true
            )
        }
    ) { insets ->
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize().padding(insets),
            contentAlignment = Alignment.TopCenter
        ) {
            val tablet = maxWidth >= 750.dp
            LazyColumn(
                state = listState,
                modifier = Modifier.widthIn(max = 1080.dp).fillMaxSize(),
                contentPadding = PaddingValues(18.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp)
            ) {
                if (coverageWarning != null) item {
                    Text(coverageWarning, color = Amber, fontSize = 12.sp,
                        modifier = Modifier.fillMaxWidth().testTag("exam-content-shortfall"))
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(exam.title, fontSize = 13.sp, color = MutedInk)
                            Text(
                                if (submitted) "已交卷 · 只读回顾" else "答题进度自动保存到本机",
                                fontSize = 12.sp, color = QuietBlue
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (submitted && reviewing) {
                                TextButton(onClick = { reviewing = false }) {
                                    Text("返回结果")
                                }
                            } else if (!submitted) {
                                Text("练习模式", fontSize = 12.sp, color = MutedInk)
                                Switch(
                                    checked = practiceMode,
                                    onCheckedChange = { practiceMode = it }
                                )
                            }
                        }
                    }
                }
                if (module == "listening") {
                    item {
                        ListeningQuestionVisibilityToggle(
                            hidden = hideListeningQuestion,
                            onHiddenChange = { hide ->
                                hideListeningQuestion = hide
                                listeningPrefs.edit().putBoolean("hide_listening_stem", hide).apply()
                            }
                        )
                    }
                }
                if (submitted && !reviewing) {
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
                                LinearProgressIndicator(
                                    progress = { answered.size.toFloat() / questions.size },
                                    modifier = Modifier.fillMaxWidth().height(7.dp)
                                        .clip(RoundedCornerShape(50.dp)),
                                    color = QuietBlue,
                                    trackColor = Color(0xFFE1E7F0)
                                )
                                Row(Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("已作答 " + answered.size + " / " + questions.size,
                                        color = Ink, fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp)
                                    Text("未作答 " + (questions.size - answered.size),
                                        color = MutedInk, fontSize = 13.sp)
                                }
                                Text("主观题与复杂题型不进行未经核验的自动评分。",
                                    color = MutedInk, fontSize = 13.sp)
                                PaperResultActions(
                                    onReview = { reviewing = true; index = 0 },
                                    onRestart = { showRestart = true }
                                )
                            }
                        }
                    }
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("题目回顾", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Row(
                                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                listOf(
                                    Triple("all", "全部", questions.size),
                                    Triple("answered", "已作答", answered.size),
                                    Triple("unanswered", "未作答", questions.size - answered.size)
                                ).forEach { (key, title, count) ->
                                    FilterChip(
                                        selected = reviewFilter == key,
                                        onClick = { reviewFilter = key },
                                        modifier = Modifier.testTag("paper-filter-" + key),
                                        label = { Text("$title $count") }
                                    )
                                }
                            }
                        }
                    }
                    if (visibleReviewIndices.isEmpty()) {
                        item {
                            Text("当前筛选下没有题目", color = MutedInk,
                                modifier = Modifier.fillMaxWidth().padding(18.dp))
                        }
                    }
                    items(visibleReviewIndices.size) { position ->
                        val reviewIndex = visibleReviewIndices[position]
                        val itemQuestion = questions[reviewIndex]
                        val savedAnswer = answers.optString(reviewIndex.toString(), "")
                        Surface(
                            onClick = { index = reviewIndex; reviewing = true },
                            shape = RoundedCornerShape(14.dp),
                            border = androidx.compose.foundation.BorderStroke(0.7.dp, PaperStroke),
                            color = Color.White
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        "第 " + (reviewIndex + 1) + " 题 · " +
                                            itemQuestion.type.ifBlank { "题目" },
                                        modifier = Modifier.weight(1f),
                                        fontWeight = FontWeight.SemiBold, color = Ink,
                                        maxLines = 1
                                    )
                                    val missing = savedAnswer.isBlank()
                                    Surface(
                                        color = if (missing) Color(0xFFFFF4E6)
                                            else Color(0xFFEAF5F0),
                                        shape = RoundedCornerShape(50.dp)
                                    ) {
                                        Text(
                                            if (missing) "未作答" else "已作答",
                                            modifier = Modifier.padding(
                                                horizontal = 9.dp, vertical = 4.dp),
                                            fontSize = 11.sp,
                                            color = if (missing) Color(0xFF9B672A)
                                                else Color(0xFF207858)
                                        )
                                    }
                                }
                                Text(
                                    itemQuestion.prompt.ifBlank { "查看原文与题目" }.take(100),
                                    fontSize = 13.sp, color = MutedInk, maxLines = 2
                                )
                                Text(
                                    if (savedAnswer.isBlank()) "我的答案：未作答"
                                    else "我的答案：" + savedAnswer.take(120),
                                    fontSize = 13.sp, color = QuietBlue, maxLines = 2
                                )
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
                                ReplicaPassagePanel(
                                    question.passage, Modifier.weight(1.02f),
                                    title = if (question.type in setOf("translation", "translation_en_zh"))
                                        "待译原文" else "阅读原文"
                                )
                                ReplicaQuestionPanel(
                                    question = question, selected = selected,
                                    practiceMode = practiceMode, onAnswer = ::store,
                                    usedElsewhere = usedElsewhere, reviewOnly = submitted,
                                    hidePrompt = module == "listening" && hideListeningQuestion,
                                    questionNumber = if (module == "listening") index + 1 else null,
                                    modifier = Modifier.weight(0.98f)
                                )
                            }
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                if (question.passage.isNotBlank()) {
                                    ReplicaPassagePanel(
                                        question.passage, Modifier.fillMaxWidth(),
                                        title = if (question.type in setOf("translation", "translation_en_zh"))
                                            "待译原文" else "阅读原文"
                                    )
                                }
                                ReplicaQuestionPanel(
                                    question = question, selected = selected,
                                    practiceMode = practiceMode, onAnswer = ::store,
                                    usedElsewhere = usedElsewhere, reviewOnly = submitted,
                                    hidePrompt = module == "listening" && hideListeningQuestion,
                                    questionNumber = if (module == "listening") index + 1 else null,
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

/** Restore the original “隐藏题目” option without hiding the answer choices. */
@Composable
internal fun ListeningQuestionVisibilityToggle(
    hidden: Boolean,
    onHiddenChange: (Boolean) -> Unit
) {
    Surface(
        color = CardSubtle,
        shape = RoundedCornerShape(15.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("隐藏题目：${if (hidden) "开" else "关"}",
                    color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text("仅隐藏听力题干，选项仍可查看和作答",
                    color = MutedInk, fontSize = 11.sp)
            }
            Switch(
                checked = hidden,
                onCheckedChange = onHiddenChange,
                modifier = Modifier.testTag("listening-hide-question-toggle")
            )
        }
    }
}

@Composable
private fun ReplicaPassagePanel(
    text: String, modifier: Modifier, title: String = "阅读原文"
) {
    Surface(
        modifier = modifier,
        color = CardSubtle,
        shape = RoundedCornerShape(17.dp),
        border = androidx.compose.foundation.BorderStroke(0.7.dp, PaperStroke)
    ) {
        Column(Modifier.fillMaxWidth().padding(19.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MutedInk)
            Text(text, fontSize = 15.sp, lineHeight = 26.sp, color = Ink)
        }
    }
}

@Composable
internal fun ReplicaQuestionPanel(
    question: UniversityQuestion,
    selected: String,
    practiceMode: Boolean,
    onAnswer: (String) -> Unit,
    usedElsewhere: Set<String> = emptySet(),
    reviewOnly: Boolean = false,
    hidePrompt: Boolean = false,
    questionNumber: Int? = null,
    modifier: Modifier = Modifier
) {
    val isTF = question.type in setOf("tfng", "true_false_not_given", "yes_no_not_given")
    val choices = if (isTF && question.choices.isEmpty()) {
        val words = if (question.type == "yes_no_not_given")
            listOf("YES", "NO", "NOT GIVEN") else listOf("TRUE", "FALSE", "NOT GIVEN")
        words.map { it to it }
    } else question.choices
    val objective = choices.isNotEmpty()
    val isTranslation = question.type in setOf("translation", "translation_en_zh")
    val isWriting = question.type == "writing"
    var referenceExpanded by rememberSaveable(question.id, question.type) {
        mutableStateOf(false)
    }
    val correctLabel = choices.firstOrNull { (label, text) ->
        label.equals(question.answer, true) || text.equals(question.answer, true)
    }?.first
    Column(modifier, verticalArrangement = Arrangement.spacedBy(13.dp)) {
        if (!hidePrompt) {
            Text(
                question.prompt.ifBlank {
                    // Some CET stems are spoken only; do not invent written content.
                    if (questionNumber != null) "Question ${questionNumber}."
                    else "根据原文与题目要求作答"
                },
                modifier = Modifier.testTag("university-question-prompt"),
                fontSize = 19.sp, lineHeight = 30.sp,
                color = Ink, fontWeight = FontWeight.Bold
            )
        }
        if (objective) {
            if (usedElsewhere.isNotEmpty()) {
                Text("同一组其他题已使用的选项会显示提示；仍可重新选择。",
                    color = MutedInk, fontSize = 12.sp)
            }
            choices.forEach { (key, text) ->
                val active = selected.equals(key, true) || selected.equals(text, true)
                val show = (practiceMode || reviewOnly) && correctLabel != null
                val alreadyUsed = key in usedElsewhere && !active
                ReplicaOptionCard(
                    key = key,
                    label = if (alreadyUsed) text + "  ·  其他题已使用" else text,
                    isSelected = active,
                    enabled = !reviewOnly,
                    isCorrect = if (!show) null else if (key == correctLabel) true
                        else if (active) false else null,
                    onSelect = { onAnswer(key) }
                )
            }
        } else {
            OutlinedTextField(
                value = selected,
                onValueChange = onAnswer,
                readOnly = reviewOnly,
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
            Text(
                if (reviewOnly) "交卷后只能查看答案；主观题不进行未经核验的自动评分。"
                else "答案会随输入保留；主观题不自动虚报分数。",
                color = MutedInk, fontSize = 12.sp
            )
        }
        if (!objective && (isTranslation || isWriting) && practiceMode && !reviewOnly) {
            OutlinedButton(
                onClick = { referenceExpanded = !referenceExpanded },
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                    .testTag("subjective-reference-toggle")
            ) {
                Text(
                    if (referenceExpanded) "收起参考答案与解析"
                    else if (isTranslation) "查看参考译文与解析"
                    else "查看参考范文与解析"
                )
            }
        }
        val showReference = reviewOnly || (practiceMode &&
            (if (isTranslation || isWriting) referenceExpanded else selected.isNotBlank()))
        if (showReference) {
            if (question.answer.isNotBlank() || question.analysis.isNotBlank()) {
                ReplicaAnalysisCard(
                    question.answer, question.analysis,
                    answerLabel = when {
                        isTranslation -> "参考译文"
                        isWriting -> "参考范文"
                        else -> "参考答案"
                    }
                )
            }
            // Analysis alone is not a reference translation: still report the missing answer.
            if ((isTranslation || isWriting) && question.answer.isBlank()) {
                Text(
                    if (isTranslation) "当前题库暂无参考译文，无法显示原站未提供的答案。"
                    else "当前题库暂无参考范文，无法显示原站未提供的答案。",
                    color = MutedInk, fontSize = 13.sp,
                    modifier = Modifier.testTag("subjective-reference-missing")
                )
            }
            if (isWriting && question.modelTranslation.isNotBlank()) {
                Surface(color = CardSubtle, shape = RoundedCornerShape(17.dp)) {
                    Column(
                        Modifier.fillMaxWidth().padding(17.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("范文中文译文", color = Ink, fontWeight = FontWeight.SemiBold)
                        Text(question.modelTranslation, color = MutedInk, lineHeight = 24.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun UniversityMultiBlankScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    sentences: List<UniversitySentence>,
    coverageWarning: String?
) {
    if (sentences.isEmpty()) {
        Text("精听资源已打包，但没有解析出有效句子。",
            modifier = Modifier.padding(24.dp), color = Amber)
        return
    }
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    val context = LocalContext.current
    val draftStore = remember(context) { UniversityAttemptStore(context.applicationContext) }
    val fingerprint = remember(sentences) {
        sentences.joinToString("|") { it.text + ":" + it.section }.hashCode().toString()
    }
    val draft = remember(exam.level, exam.id, fingerprint) {
        draftStore.loadDictation(exam, fingerprint)
    }
    var index by rememberSaveable(exam.id, fingerprint) {
        mutableIntStateOf(draft.index.coerceIn(0, sentences.lastIndex))
    }
    var advanced by rememberSaveable(exam.id, fingerprint) { mutableStateOf(draft.advanced) }
    var active by rememberSaveable(exam.id, index) { mutableIntStateOf(0) }
    var answersJson by rememberSaveable(exam.id, fingerprint) { mutableStateOf(draft.answersJson) }
    LaunchedEffect(exam.level, exam.id, fingerprint, index, advanced, answersJson) {
        draftStore.saveDictation(
            exam, fingerprint, DictationDraft(index, answersJson, advanced)
        )
    }
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
    val filledCount = blanks.indices.count { input(it).trim().isNotEmpty() }
    val totalBlanks = blanks.size
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
            verticalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            if (coverageWarning != null) item {
                Text(coverageWarning, color = Amber, fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth().testTag("exam-content-shortfall"))
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    ReplicaSequenceHeader(
                        sequence = index + 1,
                        total = sentences.size,
                        section = sent.section.ifBlank { "逐句精听" },
                        onJump = { jumpVisible = true }
                    )
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("听写进度 · 已自动保存", fontSize = 12.sp, color = MutedInk)
                        Text("已填 " + filledCount + " / " + totalBlanks +
                            " 空   ·   完成 " + completedIndices.size + " / " +
                            sentences.size + " 句", fontSize = 11.sp, color = MutedInk)
                    }
                    LinearProgressIndicator(
                        progress = {
                            if (totalBlanks == 0) 0f else
                                (filledCount.toFloat() / totalBlanks).coerceIn(0f, 1f)
                        },
                        modifier = Modifier.fillMaxWidth().height(5.dp),
                        color = QuietBlue, trackColor = Color(0xFFEAF0F6)
                    )
                }
            }
            item {
                Column(Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
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
                    Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    if (blanks.isEmpty()) {
                        Text(sent.text, fontSize = 24.sp, lineHeight = 38.sp)
                        Text("本句没有可填写的听写词，可直接切换下一句。", color = MutedInk)
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
