package com.shiguang.english.nativeapp.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Image as ImageIcon
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.R
import com.shiguang.english.nativeapp.data.StudyProgress
import com.shiguang.english.nativeapp.data.UniversityExam
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters

private val FloatGlass = Color(0xFFF5F6F9)
private val MutedSlate = Color(0xFF94A3B8)

@Composable
fun ReplicaHomeDock(active: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.shadow(14.dp, RoundedCornerShape(100.dp)),
        color = Color.White.copy(alpha = 0.94f),
        shape = RoundedCornerShape(100.dp),
        border = androidx.compose.foundation.BorderStroke(0.75.dp, Color.White)
    ) {
        Row(Modifier.padding(5.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            listOf("home" to "首页", "stats" to "统计").forEach { (page, title) ->
                val selected = page == active
                val icon = if (page == "home") Icons.Outlined.Home else Icons.Outlined.Assessment
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(100.dp))
                        .background(if (selected) Color(0xFFE9EEF5) else Color.Transparent)
                        .clickable { onSelect(page) }
                        .height(40.dp)
                        .padding(horizontal = if (selected) 16.dp else 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    Icon(icon, title, modifier = Modifier.size(20.dp),
                        tint = if (selected) Ink else MutedInk)
                    if (selected) Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun ReplicaHomeScreen(
    progress: StudyProgress,
    exams: List<UniversityExam>,
    onCatalog: (String, String) -> Unit,
    onExam: (UniversityExam, String) -> Unit,
    onProfile: () -> Unit,
    onWords: () -> Unit
) {
    val context = LocalContext.current
    var mode by rememberSaveable { mutableStateOf("written") }
    val modeLabels = listOf(
        Triple("written", "笔试特训", "✍️"),
        Triple("listening", "听力特训", "🎧"),
        Triple("dictation", "逐句精听", "🎙️")
    )
    val eligible = when (mode) {
        "listening" -> listOf("cet4", "cet6")
        "dictation" -> listOf("cet4", "cet6", "ielts")
        else -> listOf("cet4", "cet6", "kaoyan")
    }
    var heroUri by rememberSaveable { mutableStateOf("") }
    val chooser = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}
            heroUri = uri.toString()
        }
    }
    val chosenBitmap by produceState<ImageBitmap?>(null, heroUri) {
        value = if (heroUri.isEmpty()) null else withContext(Dispatchers.IO) {
            runCatching {
                context.contentResolver.openInputStream(Uri.parse(heroUri)).use { stream ->
                    val options = BitmapFactory.Options().apply { inSampleSize = 2 }
                    BitmapFactory.decodeStream(stream, null, options)?.asImageBitmap()
                }
            }.getOrNull()
        }
    }
    val share = {
        val content = "拾光英语｜已答 " + progress.answered +
            " 题，认识 " + progress.known.size + " 词，继续学习。"
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, content)
        }
        context.startActivity(Intent.createChooser(intent, "分享学习记录"))
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 980.dp),
        contentPadding = PaddingValues(bottom = 102.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        item {
            Box(
                modifier = Modifier.fillMaxWidth().height(326.dp)
            ) {
                if (chosenBitmap != null) {
                    Image(bitmap = chosenBitmap!!, contentDescription = "自定义首页壁纸",
                        modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Image(
                        painter = painterResource(R.drawable.hero_nature),
                        contentDescription = "原版自然风景头图",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }
                Box(
                    Modifier.fillMaxSize().background(
                        Brush.verticalGradient(
                            listOf(Color(0x18000000), Color.Transparent, Color(0xAA0D1925))
                        )
                    )
                )
                Column(
                    Modifier.fillMaxSize().padding(start = 22.dp, end = 20.dp, top = 18.dp, bottom = 61.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        HeroCircle("更换壁纸", Icons.Outlined.ImageIcon) { chooser.launch(arrayOf("image/*")) }
                        Spacer(Modifier.width(9.dp))
                        HeroCircle("分享学习记录", Icons.Outlined.Share, onClick = share)
                        Spacer(Modifier.width(9.dp))
                        HeroCircle("个人设置", Icons.Outlined.PersonOutline, onClick = onProfile)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Welcome back 👋", fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold, color = Color.White)
                        Text("同学", fontSize = 30.sp,
                            fontWeight = FontWeight.ExtraBold, color = Color.White)
                    }
                }
            }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth().offset(y = (-28).dp),
                color = Color.White,
                shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 12.dp, bottom = 34.dp),
                    verticalArrangement = Arrangement.spacedBy(19.dp)
                ) {
                    Box(
                        Modifier.align(Alignment.CenterHorizontally)
                            .size(width = 38.dp, height = 5.dp)
                            .clip(RoundedCornerShape(100.dp))
                            .background(Color(0xFFE4E6EA))
                    )
                    ReplicaCalendar()
                    ReplicaProgressCard(progress)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("开始训练", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Row(
                            Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFFF2F2F5))
                                .padding(4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            modeLabels.forEach { (key, label, symbol) ->
                                val picked = mode == key
                                Surface(
                                    modifier = Modifier.weight(1f).height(43.dp),
                                    onClick = { mode = key },
                                    shape = RoundedCornerShape(11.dp),
                                    color = if (picked) Color.White else Color.Transparent,
                                    shadowElevation = if (picked) 3.dp else 0.dp
                                ) {
                                    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center) {
                                        Text(symbol, fontSize = 15.sp)
                                        Spacer(Modifier.width(3.dp))
                                        Text(label, fontSize = 12.5.sp, fontWeight = if (picked)
                                            FontWeight.Bold else FontWeight.Medium,
                                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                                            color = if (picked) Ink else MutedInk)
                                    }
                                }
                            }
                        }
                        AnimatedContent(targetState = mode, label = "训练模式", transitionSpec = {
                            androidx.compose.animation.fadeIn(tween(140)) togetherWith
                                androidx.compose.animation.fadeOut(tween(80))
                        }) { current ->
                            val validLevels = when (current) {
                                "listening" -> listOf("cet4", "cet6")
                                "dictation" -> listOf("cet4", "cet6", "ielts")
                                else -> listOf("cet4", "cet6", "kaoyan")
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                validLevels.forEach { level ->
                                    ModuleTile(
                                        modifier = Modifier.weight(1f),
                                        mode = current,
                                        level = level,
                                        onClick = { onCatalog(current, level) }
                                    )
                                }
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("历年真题", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            TextButton(onClick = { onCatalog(mode, eligible.first()) }) {
                                Text("查看全部", fontSize = 12.sp)
                                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(16.dp))
                            }
                        }
                        val featured = exams.filter { it.level in eligible && when (mode) {
                            "dictation" -> it.dictationCount > 0
                            "listening" -> it.listeningCount > 0
                            else -> true
                        } }.sortedWith(compareByDescending<UniversityExam> { it.year }.thenBy { it.level }).take(4)
                        featured.forEach { exam ->
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color.White,
                                border = androidx.compose.foundation.BorderStroke(0.8.dp, PaperStroke),
                                onClick = { onExam(exam, mode) }
                            ) {
                                Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                                        .background(CardSubtle), contentAlignment = Alignment.Center) {
                                        Icon(
                                            when (mode) {
                                                "dictation" -> Icons.Outlined.Mic
                                                "listening" -> Icons.Outlined.GraphicEq
                                                else -> Icons.Outlined.AutoStories
                                            },
                                            contentDescription = null, tint = Ink,
                                            modifier = Modifier.size(21.dp)
                                        )
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(exam.title, fontSize = 13.5.sp,
                                            fontWeight = FontWeight.SemiBold, maxLines = 2)
                                        Text(
                                            (when (exam.level) {
                                                "cet4" -> "CET-4"
                                                "cet6" -> "CET-6"
                                                "ielts" -> "IELTS"
                                                else -> "考研英语"
                                            }) + "  ·  " + exam.year,
                                            fontSize = 11.sp, color = MutedInk
                                        )
                                    }
                                    Icon(Icons.Outlined.ChevronRight, null, tint = MutedSlate)
                                }
                            }
                        }
                        if (featured.isEmpty()) Text("当前分类还没有对应的试卷目录", color = MutedInk)
                    }
                    Surface(
                        onClick = onWords,
                        color = Color.White,
                        border = androidx.compose.foundation.BorderStroke(0.8.dp, PaperStroke),
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Row(Modifier.fillMaxWidth().padding(17.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.MenuBook, contentDescription = null,
                                tint = QuietBlue)
                            Spacer(Modifier.width(11.dp))
                            Column(Modifier.weight(1f)) {
                                Text("背单词", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text("词书 · 发音 · 记忆复习",
                                    fontSize = 12.sp, color = MutedInk)
                            }
                            Icon(Icons.Outlined.ChevronRight, contentDescription = null,
                                tint = MutedInk)
                        }
                    }
                    Surface(
                        onClick = { onCatalog("written", "cet4") },
                        color = Color(0xFFF5F8FC),
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.MenuBook, contentDescription = null, tint = QuietBlue)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text("大学英语题库", fontWeight = FontWeight.SemiBold)
                                Text("四级 · 六级 · 雅思 · 考研", color = MutedInk, fontSize = 12.sp)
                            }
                            Icon(Icons.Outlined.ChevronRight, null, tint = QuietBlue)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HeroCircle(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.size(38.dp),
        color = Color(0x6E111820),
        shape = CircleShape,
        border = androidx.compose.foundation.BorderStroke(0.5.dp, Color.White.copy(alpha = 0.2f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, label, tint = Color.White, modifier = Modifier.size(19.dp))
        }
    }
}

@Composable
private fun ReplicaCalendar() {
    val today = remember { LocalDate.now() }
    var opened by rememberSaveable { mutableStateOf(false) }
    var currentMonth by rememberSaveable { mutableStateOf(YearMonth.now().toString()) }
    val month = remember(currentMonth) { YearMonth.parse(currentMonth) }
    var selectedDate by rememberSaveable { mutableStateOf(today.toString()) }
    val weekStart = today.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
    val weekDays = (0..6).map { weekStart.plusDays(it.toLong()) }
    val days = if (opened) {
        val firstDay = month.atDay(1)
        val first = firstDay.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
        val count = (((firstDay.dayOfWeek.value - 1 + month.lengthOfMonth() + 6) / 7)
            .coerceAtLeast(5)) * 7
        (0 until count).map { first.plusDays(it.toLong()) }
    } else weekDays
    val weekday = listOf("一", "二", "三", "四", "五", "六", "日")
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (opened) currentMonth.replace("-", " 年 ") + " 月" else
                today.year.toString() + " 年 " + today.monthValue + " 月",
                fontSize = 15.sp, fontWeight = FontWeight.Bold)
            TextButton(onClick = { opened = !opened }) {
                Text(if (opened) "收起月历  ⌃" else "展开月历  ⌄", fontSize = 12.sp)
            }
        }
        if (opened) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = { currentMonth = month.minusMonths(1).toString() }) { Text("‹ 上月") }
                TextButton(onClick = { currentMonth = YearMonth.from(today).toString() }) { Text("本月") }
                TextButton(onClick = { currentMonth = month.plusMonths(1).toString() }) { Text("下月 ›") }
            }
        }
        Row(Modifier.fillMaxWidth()) {
            weekday.forEach { name ->
                Text(name, modifier = Modifier.weight(1f), textAlign = TextAlign.Center,
                    color = MutedSlate, fontSize = 11.5.sp)
            }
        }
        days.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                week.forEach { day ->
                    val todayFlag = day == today
                    val selected = day.toString() == selectedDate
                    Box(
                        Modifier.weight(1f).height(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (todayFlag) Ink else if (selected) SoftBlue else Color.Transparent
                            )
                            .clickable {
                                selectedDate = day.toString()
                                if (!opened) opened = true
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(day.dayOfMonth.toString(), fontWeight = if (selected || todayFlag)
                            FontWeight.Bold else FontWeight.Medium,
                            fontSize = 13.5.sp,
                            color = when {
                                todayFlag -> Color.White
                                opened && day.month != month.month -> MutedSlate
                                else -> Ink
                            })
                    }
                }
            }
        }
    }
}

@Composable
private fun ReplicaProgressCard(progress: StudyProgress) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shape = RoundedCornerShape(24.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, PaperStroke),
        shadowElevation = 2.dp
    ) {
        Row(Modifier.fillMaxWidth().padding(vertical = 17.dp, horizontal = 10.dp),
            horizontalArrangement = Arrangement.SpaceAround) {
            ReplicaStat("已答题", progress.answered.toString(), "道")
            Box(Modifier.width(1.dp).height(45.dp).background(PaperStroke))
            ReplicaStat("正确率", progress.accuracy.toString(), "%")
            Box(Modifier.width(1.dp).height(45.dp).background(PaperStroke))
            ReplicaStat("认识单词", progress.known.size.toString(), "个")
        }
    }
}

@Composable
private fun ReplicaStat(label: String, value: String, suffix: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = MutedInk, fontSize = 11.sp)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
            Text(suffix, fontSize = 10.sp, color = MutedSlate, modifier = Modifier.padding(bottom = 3.dp))
        }
    }
}

@Composable
private fun ModuleTile(
    modifier: Modifier, mode: String, level: String, onClick: () -> Unit
) {
    val display = when (level) {
        "cet4" -> Triple("CET-4", "四级英语", "📘")
        "cet6" -> Triple("CET-6", "六级英语", "📕")
        "ielts" -> Triple("IELTS", "雅思英语", "🎧")
        else -> Triple("POSTGRAD", "考研英语", "📖")
    }
    Surface(
        modifier = modifier.height(125.dp),
        onClick = onClick,
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(0.8.dp, PaperStroke),
        shadowElevation = 1.dp
    ) {
        Column(
            Modifier.fillMaxSize().padding(vertical = 9.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(display.third, fontSize = 29.sp)
            Text(display.first, fontSize = 10.sp, color = QuietBlue,
                fontWeight = FontWeight.Bold)
            Text(display.second, fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(
                when (mode) {
                    "dictation" -> "DICTATION"
                    "listening" -> "LISTENING"
                    else -> "READING"
                },
                fontSize = 9.sp, fontWeight = FontWeight.Medium, color = MutedSlate
            )
        }
    }
}

@Composable
fun ReplicaStatsScreen(progress: StudyProgress) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().widthIn(max = 900.dp),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        item {
            Text("学习复盘", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold)
            Text("把每一点真实进步记录下来", color = MutedInk, fontSize = 13.sp)
        }
        item { ReplicaProgressCard(progress) }
        item {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = CardSubtle,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("词汇掌握", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    LinearProgressIndicator(
                        progress = {
                            val all = progress.known.size + progress.needsReview.size
                            if (all == 0) 0f else progress.known.size.toFloat() / all
                        },
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape),
                        color = QuietBlue,
                        trackColor = Color(0xFFE3E6EB)
                    )
                    Text("认识 " + progress.known.size + " · 待复习 " + progress.needsReview.size,
                        color = MutedInk)
                }
            }
        }
        item {
            Text("数据来自本机真实操作。日历签到、学习时长、排行榜还没有完成事件记录和在线同步，因此不显示虚假统计。",
                color = MutedInk, fontSize = 13.sp, lineHeight = 21.sp)
        }
    }
}
