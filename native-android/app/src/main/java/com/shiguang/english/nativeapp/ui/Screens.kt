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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.StudyProgress
import com.shiguang.english.nativeapp.model.DemoContent
import java.util.Locale

@Composable
private fun Screen(content: LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 980.dp),
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
        item { Feature("笔试特训", "题目 → 选项 → 解析 → 下一题", onClick = { onGo("written") }) }
        item { Feature("听力特训", "听力入口与原生朗读练习", onClick = { onGo("listening") }) }
        item { Feature("逐句精听", "重听、变速、提示、填空、答案与换句", onClick = { onGo("dictation-session") }) }
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
    var index by rememberSaveable { mutableIntStateOf(0) }
    var selected by rememberSaveable { mutableIntStateOf(-1) }
    var correct by rememberSaveable { mutableIntStateOf(0) }
    val questions = DemoContent.questions

    Screen {
        if (index >= questions.size) {
            item {
                Panel {
                    Heading("本轮练习完成")
                    Text("答对 " + correct + " / " + questions.size + " 题",
                        style = MaterialTheme.typography.titleLarge, color = QuietBlue)
                    Muted("本轮答题结果已保存至本机统计。")
                    Button(onClick = onExit) { Text("返回练习入口") }
                    OutlinedButton(onClick = { index = 0; selected = -1; correct = 0 }) {
                        Text("重新练习")
                    }
                }
            }
        } else {
            val question = questions[index]
            item { Muted("原创示例 · 第 " + (index + 1) + " / " + questions.size + " 题") }
            item {
                Panel {
                    Text(question.stem, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                }
            }
            items(question.choices.indices.toList()) { option ->
                val showRight = selected >= 0 && option == question.answer
                val showWrong = selected == option && option != question.answer
                val background = when {
                    showRight -> Color(0xFFE4F4EA)
                    showWrong -> Color(0xFFFFEAE7)
                    else -> Color.White
                }
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable {
                        if (selected == -1) {
                            selected = option
                            val ok = option == question.answer
                            if (ok) correct += 1
                            onAnswered(ok)
                        }
                    },
                    shape = RoundedCornerShape(17.dp),
                    color = background
                ) {
                    Text(
                        ('A' + option).toString() + ".  " + question.choices[option],
                        modifier = Modifier.padding(19.dp),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
            if (selected >= 0) {
                item {
                    Panel {
                        Text(if (selected == question.answer) "回答正确" else "正确答案：" + ('A' + question.answer),
                            fontWeight = FontWeight.SemiBold)
                        Muted(question.explanation)
                        Button(onClick = { index += 1; selected = -1 }) {
                            Text(if (index == questions.lastIndex) "查看本轮结果" else "下一题")
                        }
                    }
                }
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
    var ready by remember { mutableStateOf(false) }
    val tts = remember(context) { TextToSpeech(context) { ready = it == TextToSpeech.SUCCESS } }
    DisposableEffect(tts) { onDispose { tts.stop(); tts.shutdown() } }
    var index by rememberSaveable { mutableIntStateOf(0) }
    var speedIndex by rememberSaveable { mutableIntStateOf(1) }
    var accent by rememberSaveable { mutableStateOf("US") }
    var answer by rememberSaveable(index) { mutableStateOf("") }
    var reveal by rememberSaveable(index) { mutableStateOf(false) }
    var hint by rememberSaveable(index) { mutableStateOf(false) }
    var checked by rememberSaveable(index) { mutableStateOf(false) }
    val speed = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    val line = DemoContent.dictation[index]
    Screen {
        item { Muted("原创句子 · " + (index + 1) + " / " + DemoContent.dictation.size) }
        item {
            Panel {
                Text("听句子，填写缺失单词", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Muted("设备内置语音朗读示例，并非历年真题音频。")
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
                        Text("朗读")
                    }
                    OutlinedButton(onClick = { tts.stop() }) {
                        Icon(Icons.Outlined.Stop, contentDescription = null)
                        Text("停止")
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = true, onClick = { speedIndex = (speedIndex + 1) % speed.size },
                        label = { Text(speed[speedIndex].toString() + "x") })
                    FilterChip(selected = true, onClick = { accent = if (accent == "US") "UK" else "US" },
                        label = { Text(accent) })
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
                    onValueChange = { answer = it; checked = false },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("输入缺失的英文单词") },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None)
                )
                if (hint) Muted("提示：首字母 " + line.missingWord.first())
                if (reveal) Muted("参考译文：" + line.chinese)
                if (checked) Text(
                    if (answer.trim().equals(line.missingWord, ignoreCase = true)) "填写正确" else "还不正确，可以重试",
                    color = if (answer.trim().equals(line.missingWord, ignoreCase = true)) Color(0xFF278354) else Amber
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { hint = true }) { Text("提示") }
                    OutlinedButton(onClick = { reveal = true }) { Text("答案") }
                    Button(onClick = { checked = true }) { Text("检查") }
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
                Button(onClick = { tts.stop(); index = (index + 1) % DemoContent.dictation.size }) {
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
