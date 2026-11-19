package com.shiguang.english.nativeapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.VocabRepository
import com.shiguang.english.nativeapp.data.VocabCatalog
import com.shiguang.english.nativeapp.data.VocabBook
import com.shiguang.english.nativeapp.data.WordMemory
import com.shiguang.english.nativeapp.data.WordUserSettings
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

private val WordInk = Color(0xFF0F172A)
private val WordDim = Color(0xFF64748B)
private val WordCanvas = Color(0xFFF8FAFC)

@Composable
fun VocabRoot(repository: VocabRepository, onModeSwitch: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val settings by repository.settings.collectAsState(initial = WordUserSettings())
    var retry by remember { mutableIntStateOf(0) }
    var downloadedBytes by remember { mutableLongStateOf(0L) }
    var expectedBytes by remember { mutableLongStateOf(0L) }
    val loaded by produceState<Result<VocabCatalog>?>(null, repository, retry) {
        value = runCatching {
            repository.ensureCatalog { done, total ->
                downloadedBytes = done
                expectedBytes = total
            }
        }
    }
    val catalog = loaded?.getOrNull()
    var selectedBook by rememberSaveable { mutableStateOf("cet4") }
    var page by rememberSaveable { mutableStateOf("today") }
    var reviewOnly by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(settings.selectedBookId, catalog) {
        if (catalog?.book(settings.selectedBookId) != null) selectedBook = settings.selectedBookId
    }
    val book = catalog?.book(selectedBook) ?: catalog?.books?.firstOrNull()
    val memoryFlow = remember(repository, book?.id) {
        repository.observeMemory(book?.id ?: "__no_book__")
    }
    val memory by memoryFlow.collectAsState(initial = emptyMap())
    val tab = page in setOf("today", "lib", "stats", "me")
    BackHandler(enabled = !tab) { page = "today" }
    Box(Modifier.fillMaxSize().background(WordCanvas)) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().height(66.dp).padding(horizontal = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween) {
                if (!tab) IconButton(onClick = { page = "today" }) {
                    Icon(Icons.Outlined.ArrowBack, contentDescription = "返回今日")
                } else Text(when (page) {
                    "lib" -> "词库"
                    "stats" -> "统计"
                    "me" -> "我的"
                    else -> "今日"
                }, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = WordInk)
                StudyModeSwitch("vocab", onModeSwitch)
            }
            if (catalog == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    if (loaded == null) {
                        Column(Modifier.padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            CircularProgressIndicator()
                            Text("首次进入背单词，下载原版大学词库中…")
                            Text("只获取一次共享词表，之后各词书离线复用。",
                                color = WordDim, fontSize = 12.sp)
                            if (downloadedBytes > 0L) {
                                LinearProgressIndicator(progress = {
                                    if (expectedBytes > 0L)
                                        (downloadedBytes.toFloat() / expectedBytes).coerceIn(0f, 1f)
                                    else 0f
                                }, modifier = Modifier.fillMaxWidth())
                                Text((downloadedBytes / 1024).toString() + " KB",
                                    color = WordDim, fontSize = 12.sp)
                            }
                        }
                    } else Column(Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("词库下载失败", fontWeight = FontWeight.Bold)
                        Text(loaded?.exceptionOrNull()?.message.orEmpty(), color = WordDim)
                        Button(onClick = { retry++ }) { Text("重试获取词库") }
                    }
                }
            } else if (book != null) {
                when (page) {
                    "today" -> VocabTodayPage(catalog, book, settings, memory,
                        onLibrary = { page = "lib" },
                        onStudy = { reviewOnly = false; page = "study" },
                        onReview = { reviewOnly = true; page = "study" })
                    "lib" -> VocabLibraryPage(catalog, book.id,
                        onSelect = { id ->
                            selectedBook = id
                            scope.launch { repository.selectBook(id) }
                        },
                        onStudy = { reviewOnly = false; page = "study" })
                    "stats" -> VocabStatsPage(catalog, book, memory, onLibrary = { page = "lib" })
                    "me" -> VocabSettingsPage(settings, catalog.isOriginalComplete,
                        onGoal = { amount -> scope.launch { repository.changeGoal(amount) } },
                        onLibrary = { page = "lib" })
                    "study" -> VocabStudyPage(repository, catalog, book,
                        dailyGoal = settings.dailyGoal, reviewOnly = reviewOnly,
                        onFinish = { page = "today" })
                }
            }
        }
        if (tab) VocabGlassDock(active = page, onSelect = { page = it },
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
    }
}

private fun todayReviewed(memory: Map<String, WordMemory>): Int {
    val midnight = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    return memory.values.count { it.reviewedAt >= midnight }
}

@Composable
private fun VocabTodayPage(
    catalog: VocabCatalog, book: VocabBook, settings: WordUserSettings,
    memory: Map<String, WordMemory>,
    onLibrary: () -> Unit, onStudy: () -> Unit, onReview: () -> Unit
) {
    val words = remember(catalog, book.id) { catalog.items(book) }
    val used = words.count { it.id in memory }
    val mastered = words.count { (memory[it.id]?.tier ?: -1) >= 2 }
    val due = words.count { memory[it.id]?.due == true }
    val today = todayReviewed(memory)
    val progress = if (words.isEmpty()) 0f else mastered.toFloat() / words.size
    LazyColumn(modifier = Modifier.fillMaxSize().widthIn(max = 950.dp),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 108.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("TODAY · " + LocalDate.now().toString(), fontSize = 10.sp,
                    color = WordDim, letterSpacing = 1.sp)
                Text("今天，记几个单词", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                Text("熟悉的学习方式，进度会保存在本机。",
                    fontSize = 12.sp, color = WordDim)
            }
        }
        item {
            Surface(onClick = onLibrary, color = Color.White, shape = RoundedCornerShape(23.dp),
                border = BorderStroke(1.dp, Color(0xFFE5EAF1))) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        VocabBookCover(book.id, 60.dp)
                        Spacer(Modifier.width(13.dp))
                        Column(Modifier.weight(1f)) {
                            Text("当前词书", color = WordDim, fontSize = 11.sp)
                            Text(book.title, fontSize = 18.sp, fontWeight = FontWeight.Bold,
                                maxLines = 2, color = WordInk)
                            Text(book.tag.ifBlank { "交互示例" },
                                color = WordDim, fontSize = 11.sp)
                        }
                        Icon(Icons.Outlined.ChevronRight, "切换词书", tint = WordDim)
                    }
                    LinearProgressIndicator(progress = { progress },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = WordInk, trackColor = Color(0xFFE6ECF1))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("已掌握 " + mastered + " / " + words.size,
                            fontSize = 12.sp, color = WordDim)
                        Text(((progress * 100).toInt()).toString() + "%",
                            fontSize = 12.sp, color = WordInk, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item {
            WordSection {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("今日计划", fontSize = 17.sp, fontWeight = FontWeight.Bold)
                    Text(today.toString() + " / " + settings.dailyGoal,
                        color = WordDim, fontSize = 13.sp)
                }
                LinearProgressIndicator(progress = {
                    (today.toFloat() / settings.dailyGoal).coerceIn(0f, 1f)
                }, modifier = Modifier.fillMaxWidth().height(7.dp),
                    color = WordInk, trackColor = Color(0xFFE8EDF2))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    WordMetric("已学习", used, "词")
                    WordMetric("今天完成", today, "词")
                    WordMetric("待复习", due, "词")
                }
                Button(onClick = onStudy, modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = WordInk)) {
                    Text("开始学习")
                    Icon(Icons.Outlined.ArrowForward, contentDescription = null)
                }
                OutlinedButton(onClick = onReview, enabled = due > 0,
                    modifier = Modifier.fillMaxWidth()) {
                    Text(if (due == 0) "暂无到期复习" else "复习到期单词 · " + due)
                }
            }
        }
        item { Text("记忆状态", fontSize = 17.sp, fontWeight = FontWeight.Bold) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf(3, 2, 1, 0).forEach { tier ->
                    val amount = memory.values.count { it.tier == tier }
                    Surface(modifier = Modifier.weight(1f),
                        color = Color.White, shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(0.8.dp, Color(0xFFE8EDF2))) {
                        Column(Modifier.padding(vertical = 14.dp, horizontal = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(amount.toString(), fontSize = 21.sp, fontWeight = FontWeight.Bold,
                                color = memoryColor(tier))
                            Text(memoryName(tier), fontSize = 11.sp, color = WordDim)
                        }
                    }
                }
            }
        }
        if (!catalog.isOriginalComplete) item {
            Text("当前安装包未含原版完整词库，显示少量原创词条以验证原生交互。",
                color = Color(0xFFA2793D), fontSize = 12.sp)
        }
    }
}

@Composable
private fun VocabLibraryPage(
    catalog: VocabCatalog, selected: String,
    onSelect: (String) -> Unit, onStudy: () -> Unit
) {
    var search by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("全部") }
    val categories = listOf("全部", "四六级", "考研", "出国考试", "专升本", "英语专业")
    fun group(id: String): String = when {
        id in listOf("cet4", "cet6") -> "四六级"
        id.startsWith("kaoyan") || id == "graduate" -> "考研"
        id in listOf("ielts_core", "toefl_core") -> "出国考试"
        id == "zhuanshengben" -> "专升本"
        id.startsWith("tem") -> "英语专业"
        else -> "四六级"
    }
    val books = catalog.books.filter {
        (category == "全部" || category == group(it.id)) &&
            (search.isBlank() || it.title.contains(search, ignoreCase = true) ||
                it.tag.contains(search, ignoreCase = true))
    }
    LazyVerticalGrid(columns = GridCells.Adaptive(215.dp),
        modifier = Modifier.fillMaxSize().widthIn(max = 1100.dp),
        contentPadding = PaddingValues(18.dp, 10.dp, 18.dp, 110.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("选择词书", fontSize = 25.sp, fontWeight = FontWeight.Bold)
                Text("全部分类仅显示大学层面和出国考试相关内容",
                    color = WordDim, fontSize = 12.sp)
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            OutlinedTextField(value = search, onValueChange = { search = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true, label = { Text("搜索词书") },
                shape = RoundedCornerShape(16.dp))
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Row(Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                categories.forEach { type ->
                    FilterChip(selected = category == type,
                        onClick = { category = type }, label = { Text(type) })
                }
            }
        }
        items(books, key = { it.id }) { book ->
            val current = selected == book.id
            Surface(onClick = { onSelect(book.id) },
                color = if (current) Color(0xFFEFF5FA) else Color.White,
                shape = RoundedCornerShape(19.dp),
                border = BorderStroke(1.dp,
                    if (current) Color(0xFF89A9C8) else Color(0xFFE4E9EF))) {
                Column(Modifier.fillMaxWidth().padding(17.dp),
                    verticalArrangement = Arrangement.spacedBy(11.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        VocabBookCover(book.id, 51.dp)
                        if (current) Text("当前词书", fontSize = 11.sp, color = QuietBlue)
                    }
                    Text(book.title, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                        maxLines = 2, color = WordInk)
                    Text(book.tag.ifBlank { book.wordIndexes.size.toString() + " 词" },
                        fontSize = 11.5.sp, color = WordDim)
                    if (current) Button(onClick = onStudy, modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = WordInk)) {
                        Text("继续学习")
                    } else Text("选择词书", color = QuietBlue,
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun VocabStatsPage(
    catalog: VocabCatalog, book: VocabBook,
    memory: Map<String, WordMemory>, onLibrary: () -> Unit
) {
    val studied = catalog.items(book).count { it.id in memory }
    val total = book.wordIndexes.size
    val due = memory.values.count { it.due }
    LazyColumn(modifier = Modifier.fillMaxSize().widthIn(max = 850.dp),
        contentPadding = PaddingValues(18.dp, 12.dp, 18.dp, 110.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item {
            Text("学习复盘", fontSize = 25.sp, fontWeight = FontWeight.Bold)
            Text("来自本机的真实词汇学习记录", color = WordDim, fontSize = 12.sp)
        }
        item {
            WordSection {
                Text(book.title, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                LinearProgressIndicator(progress = {
                    if (total == 0) 0f else studied.toFloat() / total
                }, color = WordInk, trackColor = Color(0xFFE9EDF2),
                    modifier = Modifier.fillMaxWidth().height(9.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    WordMetric("已学习", studied)
                    WordMetric("牢固/稳定", memory.values.count { it.tier >= 2 })
                    WordMetric("待复习", due)
                }
                OutlinedButton(onClick = onLibrary) { Text("切换词书") }
            }
        }
        item { Text("记忆分布", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
        items(listOf(3, 2, 1, 0)) { tier ->
            WordSection {
                val amount = memory.values.count { it.tier == tier }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(memoryName(tier), color = memoryColor(tier),
                        fontWeight = FontWeight.Bold)
                    Text(amount.toString() + " 词", color = WordDim)
                }
                LinearProgressIndicator(progress = {
                    if (studied == 0) 0f else amount.toFloat() / studied
                }, color = memoryColor(tier), trackColor = Color(0xFFE8ECF1),
                    modifier = Modifier.fillMaxWidth().height(7.dp))
            }
        }
    }
}

@Composable
private fun VocabSettingsPage(
    settings: WordUserSettings, original: Boolean,
    onGoal: (Int) -> Unit, onLibrary: () -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize().widthIn(max = 850.dp),
        contentPadding = PaddingValues(18.dp, 12.dp, 18.dp, 110.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item { Text("我的", fontSize = 26.sp, fontWeight = FontWeight.Bold) }
        item {
            WordSection {
                Text("每日学习目标", fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(onClick = {
                        onGoal((settings.dailyGoal - 5).coerceAtLeast(5))
                    }, enabled = settings.dailyGoal > 5) { Text("－5") }
                    Text(settings.dailyGoal.toString() + " 词 / 天",
                        fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    OutlinedButton(onClick = {
                        onGoal((settings.dailyGoal + 5).coerceAtMost(200))
                    }, enabled = settings.dailyGoal < 200) { Text("＋5") }
                }
                Text("设置保存在本机，不会因为切换训练模式而清除。",
                    fontSize = 12.sp, color = WordDim)
            }
        }
        item { ContentCachePanel() }
        item {
            WordSection {
                Text("数据来源", fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(if (original) "原版大学词库 · 已验证内置"
                    else "当前 APK 仅包含原生交互示例词条",
                    color = if (original) CorrectGreen else Color(0xFFA2783A),
                    fontSize = 13.sp)
                Text("学习结果单独存入本机 SQLite；题库答题记录互不覆盖。",
                    color = WordDim, fontSize = 12.sp)
                OutlinedButton(onClick = onLibrary) { Text("管理词书") }
            }
        }
    }
}
