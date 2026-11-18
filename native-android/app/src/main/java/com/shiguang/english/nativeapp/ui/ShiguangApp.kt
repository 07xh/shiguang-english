package com.shiguang.english.nativeapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shiguang.english.nativeapp.data.LocalStudyRepository
import com.shiguang.english.nativeapp.data.StudyProgress
import com.shiguang.english.nativeapp.data.UniversityRepository
import kotlinx.coroutines.launch

private val mainTabs = listOf("home", "stats", "listening", "words", "profile")
private val tabLabels = listOf("首页", "统计", "听力", "单词", "我的")

@Composable
private fun NavIcon(index: Int) {
    val icon = when (index) {
        0 -> Icons.Outlined.Home
        1 -> Icons.Outlined.Assessment
        2 -> Icons.Outlined.GraphicEq
        3 -> Icons.Outlined.MenuBook
        else -> Icons.Outlined.PersonOutline
    }
    Icon(icon, contentDescription = null)
}

@Composable
fun ShiguangApp() {
    val context = LocalContext.current
    val repository = remember(context) { LocalStudyRepository(context.applicationContext) }
    val university = remember(context) { UniversityRepository(context.applicationContext) }
    val progress by repository.progress.collectAsState(initial = StudyProgress())
    val scope = rememberCoroutineScope()
    var page by rememberSaveable { mutableStateOf("home") }
    var bookId by rememberSaveable { mutableStateOf("cet4") }
    var paperId by rememberSaveable { mutableStateOf("") }
    var paperLevel by rememberSaveable { mutableStateOf("cet4") }
    var paperModule by rememberSaveable { mutableStateOf("listening") }
    val saveableScreens = rememberSaveableStateHolder()
    val secondary = page !in mainTabs
    val goBack = {
        page = when (page) {
            "word-session" -> "words"
            "written-session" -> "written"
            "dictation-session" -> "listening"
            "university-paper" -> "listening"
            else -> "home"
        }
    }
    BackHandler(enabled = secondary) { goBack() }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 700.dp
        Scaffold(
            containerColor = CanvasColor,
            topBar = {
                Row(
                    Modifier.fillMaxWidth().height(58.dp).background(CanvasColor).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (secondary) IconButton(onClick = goBack) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "返回")
                    }
                    Text(
                        if (secondary) "拾光英语 · 练习" else "拾光英语",
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    if (!secondary) IconButton(onClick = { page = "profile" }) {
                        Icon(Icons.Outlined.PersonOutline, contentDescription = "个人中心")
                    }
                }
            },
            bottomBar = {
                if (!wide) NavigationBar(containerColor = Color.White) {
                    mainTabs.forEachIndexed { index, route ->
                        NavigationBarItem(
                            selected = page == route,
                            onClick = { page = route },
                            icon = { NavIcon(index) },
                            label = { Text(tabLabels[index]) }
                        )
                    }
                }
            }
        ) { insets ->
            Row(Modifier.padding(insets).fillMaxSize()) {
                if (wide) NavigationRail(containerColor = Color.White) {
                    mainTabs.forEachIndexed { index, route ->
                        NavigationRailItem(
                            selected = page == route,
                            onClick = { page = route },
                            icon = { NavIcon(index) },
                            label = { Text(tabLabels[index]) }
                        )
                    }
                }
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
                    val screenKey = when (page) {
                        "word-session" -> "word-session:" + bookId
                        "university-paper" -> "university-paper:" + paperLevel + "/" + paperId + "/" + paperModule
                        else -> page
                    }
                    saveableScreens.SaveableStateProvider(screenKey) {
                    when (page) {
                        "home" -> HomeScreen(progress, onGo = { page = it })
                        "stats" -> StatsScreen(progress)
                        "listening", "university" -> UniversityCatalogScreen(university, onOpen = { paper, module ->
                            paperId = paper.id
                            paperLevel = paper.level
                            paperModule = module
                            page = "university-paper"
                        })
                        "university-paper" -> {
                            val paper = university.exams.firstOrNull { it.level == paperLevel && it.id == paperId }
                            if (paper != null) UniversityPaperScreen(university, paper, paperModule)
                            else Text("试卷不存在，请从原版目录重新选择")
                        }
                        "words" -> BooksScreen(onChoose = { bookId = it; page = "word-session" })
                        "profile" -> ProfileScreen(progress, onReset = { scope.launch { repository.clear() } })
                        "written" -> WrittenCatalog(onStart = { page = "written-session" })
                        "written-session" -> WrittenSession(
                            onAnswered = { ok -> scope.launch { repository.recordAnswer(ok) } },
                            onExit = { page = "written" }
                        )
                        "word-session" -> WordSession(
                            bookId, progress,
                            onMark = { id, known -> scope.launch { repository.markWord(id, known) } },
                            onExit = { page = "words" }
                        )
                        "dictation-session" -> DictationSession()
                        else -> HomeScreen(progress, onGo = { page = it })
                    }
                    }
                }
            }
        }
    }
}
