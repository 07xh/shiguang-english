package com.shiguang.english.nativeapp.ui

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.StudyProgress
import com.shiguang.english.nativeapp.model.AnswerLedger
import com.shiguang.english.nativeapp.model.DemoContent
import java.util.Locale

@Composable
private fun Screen(content: LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 980.dp).imePadding(),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        content = content
    )
}

@Composable
private fun Panel(content: @Composable ColumnScope.() -> Unit) {
    Surface(color = Color.White, shape = RoundedCornerShape(22.dp)) {
        Column(
            Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content
        )
    }
}

@Composable
private fun Muted(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MutedInk)
}

@Composable
private fun Heading(text: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Ink)
}

@Composable
private fun Feature(title: String, description: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Muted(description)
            }
            Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = MutedInk)
        }
    }
}

@Composable
private fun Metric(title: String, count: Int, unit: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Muted(title)
        Text(count.toString(), fontSize = 27.sp, fontWeight = FontWeight.Bold, color = Ink)
        Muted(unit)
    }
}

@Composable
fun HomeScreen(progress: StudyProgress, onGo: (String) -> Unit) {
    Screen {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("SHIGUANG ENGLISH", fontSize = 11.sp, color = QuietBlue, fontWeight = FontWeight.Medium)
                Heading("今天，学点英语")
                Muted("熟悉的练习流程，重新做成原生体验。")
            }
        }
        item {
            Panel {
                Text("本机学习记录", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    Metric("已认识", progress.known.size, "词")
                    Metric("待复习", progress.needsReview.size, "词")
                    Metric("已答题", progress.answered, "道")
                }
                HorizontalDivider(color = Color(0xFFEDF0F4))
                Muted("记录来自你的实际操作；不预设签到、排名或学习时长。")
            }
        }
        item { Text("练习入口", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
        item { Feature("大学英语真题", "四级 / 六级 / 雅思 / 考研 · 原版 231 套目录", onClick = { onGo("listening") }) }
        item { Feature("原版听力", "按级别、年份、试卷进入真实听力模块", onClick = { onGo("listening") }) }
        item { Feature("原版多空精听", "同一试卷内练习不同句子与多个听写空格", onClick = { onGo("listening") }) }
        item { Feature("单词学习", "选择词书、认识 / 不认识、进度保存", onClick = { onGo("words") }) }
    }
}

@Composable
fun ListeningScreen(onPractice: () -> Unit) {
    Screen {
        item { Heading("听力训练") }
        item {
            Panel {
                Text("真实真题音频尚未接入", fontWeight = FontWeight.SemiBold)
                Muted("原版有分级、年份、试卷目录。当前仅先落地操作流程，不把静态目录伪装成可播放真题。")
            }
        }
        item { Feature("原创逐句精听示例", "3 句原创练习 · Android 系统语音朗读", onClick = onPractice) }
    }
}

@Composable
fun WrittenCatalog(onStart: () -> Unit) {
    Screen {
        item { Heading("笔试特训") }
        item {
            Panel {
                Text("基础练习 · 原创样本", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Muted("5 道独立编写的英语选择题，用于验证原生作答和解析交互，不是 CET 历年真题。")
                Button(onClick = onStart) { Text("开始练习") }
            }
        }
        item { Muted("正式的级别、年份、试卷筛选将在获得合法的题库内容后接入。") }
    }
}

@Composable
fun WrittenSession(onAnswered: (Boolean) -> Unit, onExit: () -> Unit) {
    val questions = DemoContent.questions
    var index by rememberSaveable { mutableIntStateOf(0) }
    var answerKeys by rememberSaveable { mutableStateOf(AnswerLedger.empty(questions.size)) }
    var showJump by rememberSaveable { mutableStateOf(false) }
    var finished by rememberSaveable { mutableStateOf(false) }
    val answeredCount = AnswerLedger.answeredCount(answerKeys)
    val correctCount = AnswerLedger.correctCount(answerKeys, questions)

    if (showJump) {
        PracticeJumpSheet(
            title = "题目快速跳转",
            total = questions.size,
            selectedIndex = index,
            answered = questions.indices.filter { AnswerLedger.selection(answerKeys, it) != null }.toSet(),
            onChoose = { destination ->
                index = destination
                finished = false
                showJump = false
            },
            onDismiss = { showJump = false }
        )
    }

    Screen {
        if (finished) {
            item {
                Panel {
                    Heading("本轮练习完成")
                    Text(
                        "答对 " + correctCount + " / " + questions.size + " 题",
                        style = MaterialTheme.typography.titleLarge,
                        color = QuietBlue
                    )
                    Muted("答题记录仅来自本轮的首次提交。")
                    Button(onClick = { showJump = true }) { Text("回顾整卷") }
                    Button(onClick = onExit) { Text("返回练习入口") }
                    OutlinedButton(onClick = {
                        index = 0
                        answerKeys = AnswerLedger.empty(questions.size)
                        finished = false
                    }) { Text("重新练习") }
                }
            }
        } else {
            val q = questions[index]
            val selected = AnswerLedger.selection(answerKeys, index) ?: -1
            item {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Muted("原创示例 · " + (index + 1) + " / " + questions.size + " · 已答 " + answeredCount)
                    OutlinedButton(onClick = { showJump = true }) { Text("题目列表") }
                }
            }
            item {
                Panel {
                    Text(q.stem, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                }
            }
            items(q.choices.indices.toList()) { option ->
                val showRight = selected >= 0 && option == q.answer
                val showWrong = selected == option && option != q.answer
                val background = when {
                    showRight -> Color(0xFFE4F4EA)
                    showWrong -> Color(0xFFFFEAE7)
                    else -> Color.White
                }
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable {
                        if (selected == -1) {
                            val changed = AnswerLedger.markOnce(answerKeys, index, option, q.choices.size)
                            if (changed != answerKeys) {
                                answerKeys = changed
                                onAnswered(option == q.answer)
                            }
                        }
                    },
                    shape = RoundedCornerShape(17.dp),
                    color = background
                ) {
                    Text(
                        ('A' + option).toString() + ".  " + q.choices[option],
                        modifier = Modifier.padding(19.dp),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
            if (selected >= 0) {
                item {
                    Panel {
                        Text(
                            if (selected == q.answer) "回答正确" else "正确答案：" + ('A' + q.answer),
                            fontWeight = FontWeight.SemiBold
                        )
                        Muted(q.explanation)
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        enabled = index > 0,
                        onClick = { index -= 1 },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Outlined.ChevronLeft, contentDescription = null)
                        Text("上一题")
                    }
                    Button(
                        onClick = {
                            if (index == questions.lastIndex) {
                                if (answeredCount == questions.size) finished = true
                                else showJump = true
                            } else index += 1
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (index == questions.lastIndex) "交卷 / 报告" else "下一题")
                        Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                    }
                }
            }
            if (index == questions.lastIndex && answeredCount < questions.size) {
                item { Muted("还有 " + (questions.size - answeredCount) + " 道题未答，点击交卷可查看题目列表。") }
            }
        }
    }
}

@Composable
fun BooksScreen(onChoose: (String) -> Unit) {
    Screen {
        item { Heading("选择词书") }
        item { Muted("以下仅是验证交互的原创小样本，不是完整四级、六级或考研词库。") }
        items(DemoContent.books) { book ->
            Feature(book.title + " · " + DemoContent.wordsFor(book.id).size + " 词",
                book.subtitle, onClick = { onChoose(book.id) })
        }
    }
}

@Composable
fun WordSession(
    bookId: String,
    progress: StudyProgress,
    onMark: (String, Boolean) -> Unit,
    onExit: () -> Unit
) {
    val list = DemoContent.wordsFor(bookId)
    var index by rememberSaveable(bookId) { mutableIntStateOf(0) }
    var reveal by rememberSaveable(bookId) { mutableStateOf(false) }
    val context = LocalContext.current
    var speechReady by remember { mutableStateOf(false) }
    val tts = remember(context) { TextToSpeech(context) { speechReady = it == TextToSpeech.SUCCESS } }
    DisposableEffect(tts) { onDispose { tts.stop(); tts.shutdown() } }
    Screen {
        if (index >= list.size) {
            item {
                Panel {
                    Heading("这一组完成")
                    Muted("单词的认识 / 待复习状态已保存。")
                    Button(onClick = onExit) { Text("返回词书") }
                    OutlinedButton(onClick = { index = 0; reveal = false }) { Text("再练一遍") }
                }
            }
        } else {
            val word = list[index]
            item { Muted("第 " + (index + 1) + " / " + list.size + " 词") }
            item {
                Panel {
                    Muted(when (word.id) {
                        in progress.known -> "此前标记：认识"
                        in progress.needsReview -> "此前标记：待复习"
                        else -> "尚未标记"
                    })
                    Spacer(Modifier.height(14.dp))
                    Text(word.spelling, fontSize = 36.sp, fontWeight = FontWeight.Bold)
                    Text(word.phonetic, color = QuietBlue)
                    OutlinedButton(
                        enabled = speechReady,
                        onClick = {
                            tts.language = Locale.US
                            tts.setSpeechRate(0.9f)
                            tts.speak(word.spelling, TextToSpeech.QUEUE_FLUSH, null, "word")
                        }
                    ) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null)
                        Text("发音")
                    }
                    if (reveal) {
                        Text(word.meaning, style = MaterialTheme.typography.titleMedium)
                        Muted(word.example)
                    } else {
                        OutlinedButton(onClick = { reveal = true }) { Text("显示释义和例句") }
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(
                        onClick = { onMark(word.id, false); index += 1; reveal = false },
                        modifier = Modifier.weight(1f)
                    ) { Text("不认识") }
                    Button(
                        onClick = { onMark(word.id, true); index += 1; reveal = false },
                        modifier = Modifier.weight(1f)
                    ) { Text("认识") }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    OutlinedButton(
                        onClick = { index = (index - 1).coerceAtLeast(0); reveal = false },
                        enabled = index > 0
                    ) {
                        Icon(Icons.Outlined.ChevronLeft, contentDescription = null)
                        Text("上一词")
                    }
                    OutlinedButton(onClick = { index += 1; reveal = false }) {
                        Text("跳过")
                        Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                    }
                }
            }
        }
    }
}

@Composable
fun DictationSession() {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val systemKeyboard = LocalSoftwareKeyboardController.current
    var ready by remember { mutableStateOf(false) }
    val tts = remember(context) { TextToSpeech(context) { ready = it == TextToSpeech.SUCCESS } }
    DisposableEffect(tts) { onDispose { tts.stop(); tts.shutdown() } }

    val sentences = DemoContent.dictation
    val separator = "\u001f"
    var index by rememberSaveable { mutableIntStateOf(0) }
    var speedIndex by rememberSaveable { mutableIntStateOf(1) }
    var accent by rememberSaveable { mutableStateOf("US") }
    var customKeyboard by rememberSaveable { mutableStateOf(true) }
    var responseStore by rememberSaveable { mutableStateOf(List(sentences.size) { "" }.joinToString(separator)) }
    var revealFlags by rememberSaveable { mutableStateOf("0".repeat(sentences.size)) }
    var hintFlags by rememberSaveable { mutableStateOf("0".repeat(sentences.size)) }
    var checkedFlags by rememberSaveable { mutableStateOf("0".repeat(sentences.size)) }
    var completeFlags by rememberSaveable { mutableStateOf("0".repeat(sentences.size)) }
    var showJump by rememberSaveable { mutableStateOf(false) }
    val speed = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    val line = sentences[index]
    val responses = responseStore.split(separator)
    val answer = responses.getOrElse(index) { "" }
    val reveal = revealFlags[index] == '1'
    val hint = hintFlags[index] == '1'
    val checked = checkedFlags[index] == '1'
    val passed = completeFlags[index] == '1'

    fun updateAnswer(text: String) {
        val list = responses.toMutableList()
        while (list.size < sentences.size) list.add("")
        list[index] = text
        responseStore = list.joinToString(separator)
        checkedFlags = checkedFlags.replaceRange(index, index + 1, "0")
    }

    if (showJump) {
        PracticeJumpSheet(
            title = "精听句子索引",
            total = sentences.size,
            selectedIndex = index,
            answered = sentences.indices.filter { completeFlags[it] == '1' }.toSet(),
            onChoose = { next ->
                tts.stop()
                index = next
                showJump = false
            },
            onDismiss = { showJump = false }
        )
    }

    Screen {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Muted("原创句子 · " + (index + 1) + " / " + sentences.size)
                OutlinedButton(onClick = { showJump = true }) { Text("选句") }
            }
        }
        item {
            Panel {
                Text("听句子，填写缺失单词", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Muted("Android 系统 TTS 朗读示例；不是历年真题原声。")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        enabled = ready,
                        onClick = {
                            tts.language = if (accent == "UK") Locale.UK else Locale.US
                            tts.setSpeechRate(speed[speedIndex])
                            tts.speak(line.english, TextToSpeech.QUEUE_FLUSH, null, "dictation")
                        }
                    ) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null)
                        Text("朗读 / 重听")
                    }
                    OutlinedButton(onClick = { tts.stop() }) {
                        Icon(Icons.Outlined.Stop, contentDescription = null)
                        Text("停止")
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = true,
                        onClick = {
                            tts.stop()
                            speedIndex = (speedIndex + 1) % speed.size
                        },
                        label = { Text(speed[speedIndex].toString() + "x") }
                    )
                    FilterChip(
                        selected = true,
                        onClick = {
                            tts.stop()
                            accent = if (accent == "US") "UK" else "US"
                        },
                        label = { Text(accent) }
                    )
                }
                if (!ready) Muted("语音引擎尚未就绪，请检查系统 TTS 服务。")
            }
        }
        item {
            Panel {
                Text(
                    if (reveal) line.english else line.english.replace(line.missingWord, "_______", ignoreCase = true),
                    style = MaterialTheme.typography.titleLarge,
                    lineHeight = 30.sp
                )
                OutlinedTextField(
                    value = answer,
                    onValueChange = { updateAnswer(it) },
                    modifier = Modifier.fillMaxWidth(),
                    readOnly = customKeyboard,
                    singleLine = true,
                    label = { Text("输入缺失的英文单词") },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None)
                )
                OutlinedButton(onClick = {
                    customKeyboard = !customKeyboard
                    if (customKeyboard) {
                        systemKeyboard?.hide()
                        focusManager.clearFocus()
                    }
                }) {
                    Text(if (customKeyboard) "切换系统键盘" else "切换自制键盘")
                }
                if (hint) Muted("提示：首字母 " + line.missingWord.first())
                if (reveal) Muted("参考译文：" + line.chinese)
                if (checked) Text(
                    if (passed) "填写正确" else "还不正确，可以重试",
                    color = if (passed) Color(0xFF278354) else Amber
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        hintFlags = hintFlags.replaceRange(index, index + 1, "1")
                    }) { Text("提示") }
                    OutlinedButton(onClick = {
                        revealFlags = revealFlags.replaceRange(index, index + 1, "1")
                    }) { Text("答案") }
                    Button(onClick = {
                        val ok = answer.trim().equals(line.missingWord, ignoreCase = true)
                        completeFlags = completeFlags.replaceRange(index, index + 1, if (ok) "1" else "0")
                        checkedFlags = checkedFlags.replaceRange(index, index + 1, "1")
                    }) { Text("检查") }
                }
                if (customKeyboard) {
                    NativeQwertyKeyboard(
                        onLetter = { updateAnswer(answer + it) },
                        onErase = { updateAnswer(answer.dropLast(1)) },
                        onHide = { customKeyboard = false }
                    )
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                OutlinedButton(
                    enabled = index > 0,
                    onClick = { tts.stop(); index -= 1 }
                ) {
                    Icon(Icons.Outlined.ChevronLeft, contentDescription = null)
                    Text("上一句")
                }
                Button(onClick = { tts.stop(); index = (index + 1) % sentences.size }) {
                    Text("下一句")
                    Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                }
            }
        }
    }
}

@Composable
fun StatsScreen(progress: StudyProgress) {
    Screen {
        item { Heading("学习复盘") }
        item {
            Panel {
                Text("笔试示例", fontWeight = FontWeight.SemiBold)
                Text(progress.answered.toString() + " 道", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Muted("答对 " + progress.correct + " 道 · 正确率 " + progress.accuracy + "%")
            }
        }
        item {
            Panel {
                Text("单词进度", fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    Metric("认识", progress.known.size, "词")
                    Metric("待复习", progress.needsReview.size, "词")
                }
            }
        }
        item { Muted("暂不生成虚假的连续天数、排行和学习时长。") }
    }
}

@Composable
fun ProfileScreen(progress: StudyProgress, onReset: () -> Unit) {
    var confirming by rememberSaveable { mutableStateOf(false) }
    Screen {
        item { Heading("我的") }
        item {
            Panel {
                Text("拾光英语 · 原生预览", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Muted("Kotlin + Jetpack Compose · 设备本地记录")
                HorizontalDivider()
                Muted("累计作答 " + progress.answered + " 道 · 标记单词 " + (progress.known.size + progress.needsReview.size) + " 个")
            }
        }
        item { ContentCachePanel() }
        item {
            Panel {
                Text("数据管理", fontWeight = FontWeight.SemiBold)
                Muted("不需要登录；本阶段使用 DataStore 保存本机练习状态，不提供云端同步。")
                OutlinedButton(onClick = { confirming = true }) { Text("清空本机学习记录") }
            }
        }
    }
    if (confirming) AlertDialog(
        onDismissRequest = { confirming = false },
        title = { Text("确定清空学习记录？") },
        text = { Text("将删除本机单词标记及练习统计，无法恢复。") },
        confirmButton = { Button(onClick = { onReset(); confirming = false }) { Text("确认清空") } },
        dismissButton = { OutlinedButton(onClick = { confirming = false }) { Text("取消") } }
    )
}
