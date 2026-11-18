package com.shiguang.english.nativeapp.ui

import android.media.MediaPlayer
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
    onOpen: (UniversityExam, String) -> Unit
) {
    var level by rememberSaveable { mutableStateOf("cet4") }
    var year by rememberSaveable(level) { mutableStateOf(0) }
    val available = remember(level) { repository.exams.filter { it.level == level } }
    val years = available.map { it.year }.distinct().sortedDescending()
    val filtered = if (year == 0) available else available.filter { it.year == year }
    val verifiedCount = available.count { exam ->
        repository.installedModules(exam).containsAll(exam.modules)
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 1100.dp),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("大学英语原版题库", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("四级、六级、雅思、考研 · 安装后优先使用 APK 内置的已验证资源",
                color = MutedInk, style = MaterialTheme.typography.bodySmall)
        }
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                levelDisplay.forEach { (key, label) ->
                    FilterChip(selected = level == key, onClick = { level = key; year = 0 },
                        label = { Text(label) })
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(selected = year == 0, onClick = { year = 0 }, label = { Text("全部年份") })
                years.forEach { y ->
                    FilterChip(selected = year == y, onClick = { year = y }, label = { Text(y.toString()) })
                }
            }
        }
        item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("原版目录 " + available.size + " 套", fontWeight = FontWeight.Bold)
                    Text("已完整打包并校验 " + verifiedCount + " 套",
                        color = if (verifiedCount == available.size) QuietBlue else Amber)
                    if (verifiedCount != available.size)
                        Text("目录已收录，但缺少内容的试卷不会伪装为已安装。完整离线包仅在全部资源验证后发布。",
                            color = MutedInk, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        items(filtered, key = { it.level + "/" + it.id }) { exam ->
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(exam.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    val installed = repository.installedModules(exam)
                    if (installed.isEmpty()) {
                        Text("内容尚未打包，无法离线练习", color = Amber, style = MaterialTheme.typography.bodySmall)
                    } else {
                        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (module in exam.modules) {
                                OutlinedButton(
                                    enabled = module in installed,
                                    onClick = { onOpen(exam, module) }
                                ) {
                                    Text(moduleDisplay[module] ?: module)
                                }
                            }
                        }
                    }
                }
            }
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
        Text("内容文件已存在，但题目结构尚未成功解析，不能冒充完整可答题试卷。",
            modifier = Modifier.padding(24.dp), color = Amber)
        return
    }
    var index by rememberSaveable(exam.id, module) { mutableIntStateOf(0) }
    var drafts by rememberSaveable(exam.id, module) { mutableStateOf("{}") }
    var jump by rememberSaveable(exam.id, module) { mutableStateOf(false) }
    val answers = remember(drafts) { JSONObject(drafts) }
    val answered = questions.indices.filter { answers.has(it.toString()) }.toSet()
    val q = questions[index.coerceIn(0, questions.lastIndex)]
    val selected = answers.optString(index.toString())
    var draft by rememberSaveable(exam.id, module, index) { mutableStateOf(selected) }
    fun submit(choice: String) {
        val updated = JSONObject(drafts)
        updated.put(index.toString(), choice)
        drafts = updated.toString()
        draft = choice
    }
    if (jump) PracticeJumpSheet(
        "原版题目索引", questions.size, index, answered,
        onChoose = { index = it; jump = false }, onDismiss = { jump = false }
    )
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 1050.dp),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(exam.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()) {
                Text("第 " + (index + 1) + " / " + questions.size + " 题 · 已答 " + answered.size,
                    color = MutedInk)
                OutlinedButton(onClick = { jump = true }) { Text("题目索引") }
            }
        }
        if (module == "listening") item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(16.dp)) {
                    UniversityAudioControls(repository, exam)
                }
            }
        }
        if (q.passage.isNotBlank()) item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(18.dp)) {
                    Text("阅读原文", fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(q.passage, lineHeight = 24.sp)
                }
            }
        }
        item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(q.type.ifBlank { "练习题" }, color = MutedInk, style = MaterialTheme.typography.labelMedium)
                    Text(q.prompt.ifBlank { "请根据原文与题目要求作答" },
                        style = MaterialTheme.typography.titleLarge)
                }
            }
        }
        val isTF = q.type in setOf("tfng", "true_false_not_given", "yes_no_not_given")
        val choices = if (isTF && q.choices.isEmpty()) {
            val yesNo = q.type == "yes_no_not_given"
            (if (yesNo) listOf("YES", "NO", "NOT GIVEN")
             else listOf("TRUE", "FALSE", "NOT GIVEN")).map { it to it }
        } else q.choices
        if (choices.isNotEmpty()) {
            items(choices) { (label, text) ->
                val active = selected == label || selected == text
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable { submit(label) },
                    color = if (active) SoftBlue else Color.White,
                    shape = RoundedCornerShape(15.dp)
                ) {
                    Text(label + "  " + text, modifier = Modifier.padding(16.dp))
                }
            }
        } else item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(16.dp)) {
                    OutlinedTextField(value = draft, onValueChange = { draft = it },
                        label = { Text("填写答案 / 译文 / 作文") }, minLines = 2, maxLines = 12,
                        modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { submit(draft) }) { Text("保存本题答案") }
                    Text("主观题只保存作答，不自动伪造评分。",
                        color = MutedInk, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (selected.isNotBlank() && q.answer.isNotBlank()) item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text("参考答案：" + q.answer, fontWeight = FontWeight.SemiBold)
                    if (q.analysis.isNotBlank()) Text(q.analysis)
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(modifier = Modifier.weight(1f), enabled = index > 0,
                    onClick = { index-- }) {
                    Icon(Icons.Outlined.ChevronLeft, contentDescription = null)
                    Text("上一题")
                }
                Button(modifier = Modifier.weight(1f), enabled = index < questions.lastIndex,
                    onClick = { index++ }) {
                    Text("下一题")
                    Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                }
            }
        }
    }
}

private val wordToken = Regex("[A-Za-z]+(?:['’-][A-Za-z]+)*")

private fun sentenceBlanks(text: String): List<MatchResult> {
    val candidates = wordToken.findAll(text).filter { it.value.length >= 4 }.toList()
    if (candidates.isEmpty()) return emptyList()
    val selected = candidates.filterIndexed { index, _ -> index % 3 == 1 }
    return if (selected.isEmpty()) listOf(candidates.first()) else selected
}

@Composable
private fun UniversityMultiBlankScreen(
    repository: UniversityRepository,
    exam: UniversityExam,
    sentences: List<UniversitySentence>
) {
    if (sentences.isEmpty()) {
        Text("精听文件存在，但尚未解析出有效句子。", modifier = Modifier.padding(24.dp))
        return
    }
    var index by rememberSaveable(exam.id) { mutableIntStateOf(0) }
    var active by rememberSaveable(exam.id, index) { mutableIntStateOf(0) }
    var answersJson by rememberSaveable(exam.id) { mutableStateOf("{}") }
    var showAnswer by rememberSaveable(exam.id, index) { mutableStateOf(false) }
    var showHint by rememberSaveable(exam.id, index) { mutableStateOf(false) }
    var showJump by rememberSaveable(exam.id) { mutableStateOf(false) }
    var useCustomKeyboard by rememberSaveable(exam.id) { mutableStateOf(true) }
    val sent = sentences[index]
    val blanks = remember(sent.text) { sentenceBlanks(sent.text) }
    val store = remember(answersJson) { JSONObject(answersJson) }
    fun key(blank: Int) = index.toString() + "_" + blank
    fun input(blank: Int) = store.optString(key(blank))
    fun change(blank: Int, value: String) {
        val next = JSONObject(answersJson)
        next.put(key(blank), value)
        answersJson = next.toString()
    }
    val display = remember(sent.text, showAnswer) {
        if (showAnswer) sent.text else {
            val out = StringBuilder()
            var cursor = 0
            blanks.forEach { match ->
                out.append(sent.text.substring(cursor, match.range.first))
                out.append(" ______ ")
                cursor = match.range.last + 1
            }
            out.append(sent.text.substring(cursor)).toString()
        }
    }
    val complete = blanks.isNotEmpty() && blanks.indices.all {
        input(it).trim().equals(blanks[it].value, ignoreCase = true)
    }
    if (showJump) PracticeJumpSheet(
        "句子索引", sentences.size, index,
        answered = sentences.indices.filter { sentenceIndex ->
            val possible = sentenceBlanks(sentences[sentenceIndex].text)
            possible.isNotEmpty() && possible.indices.all { b ->
                store.optString(sentenceIndex.toString() + "_" + b)
                    .trim().equals(possible[b].value, ignoreCase = true)
            }
        }.toSet(),
        onChoose = { index = it; showJump = false }, onDismiss = { showJump = false }
    )
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 900.dp),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(exam.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween) {
                Text("句子 " + (index + 1) + "/" + sentences.size + " · " + blanks.size + " 个空")
                OutlinedButton(onClick = { showJump = true }) { Text("选句") }
            }
        }
        item {
            Surface(color = Color.White, shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    UniversityAudioControls(repository, exam)
                    if (sent.section.isNotBlank()) Text(sent.section, color = MutedInk)
                    Text(display, fontSize = 20.sp, lineHeight = 30.sp)
                    if (showHint) Text("首字母提示：" + blanks.joinToString(" / ") { it.value.first().toString() })
                    if (showAnswer && sent.chinese.isNotBlank()) Text(sent.chinese, color = MutedInk)
                    Text(if (complete) "全部填写正确" else "依次填写每个空格", color = if (complete) QuietBlue else MutedInk)
                }
            }
        }
        items(blanks.indices.toList()) { blank ->
            val current = input(blank)
            Surface(
                color = if (blank == active) SoftBlue else Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().clickable { active = blank }
            ) {
                Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("第 " + (blank + 1) + " 空", fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = current,
                        onValueChange = { change(blank, it) },
                        readOnly = useCustomKeyboard,
                        singleLine = true,
                        label = { Text("英文单词") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (current.isNotBlank())
                        Text(if (current.trim().equals(blanks[blank].value, ignoreCase = true))
                            "正确" else "可继续修改", color = MutedInk)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showHint = !showHint }) { Text("提示") }
                OutlinedButton(onClick = { showAnswer = !showAnswer }) { Text("答案") }
                OutlinedButton(onClick = { useCustomKeyboard = !useCustomKeyboard }) {
                    Text(if (useCustomKeyboard) "系统键盘" else "自制键盘")
                }
            }
        }
        if (useCustomKeyboard && blanks.isNotEmpty()) item {
            Surface(color = Color.White, shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text("正在填写第 " + (active + 1) + " 空", color = MutedInk)
                    NativeQwertyKeyboard(
                        onLetter = { change(active, input(active) + it) },
                        onErase = { change(active, input(active).dropLast(1)) },
                        onHide = { useCustomKeyboard = false }
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        OutlinedButton(enabled = active > 0, onClick = { active-- }) { Text("上一空") }
                        OutlinedButton(enabled = active < blanks.lastIndex, onClick = { active++ }) { Text("下一空") }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                OutlinedButton(enabled = index > 0, onClick = { index-- }) { Text("上一句") }
                Button(enabled = index < sentences.lastIndex, onClick = { index++ }) { Text("下一句") }
            }
        }
    }
}
