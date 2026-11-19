package com.shiguang.english.nativeapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.MoreHoriz
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
import com.shiguang.english.nativeapp.data.UniversityAttemptStore
import com.shiguang.english.nativeapp.data.VocabRepository
import com.shiguang.english.nativeapp.data.WordUserSettings
import kotlinx.coroutines.launch

/**
 * The original listening/written Toy has only Home and Stats in the floating dock.
 * Practice, profile and exam lobbies are routes, not extra permanent tabs.
 */
@Composable
fun ShiguangApp() {
    val context = LocalContext.current
    val localRepository = remember(context) { LocalStudyRepository(context.applicationContext) }
    val university = remember(context) { UniversityRepository(context.applicationContext) }
    val vocab = remember(context) { VocabRepository(context.applicationContext) }
    val modeSettings by vocab.settings.collectAsState(initial = WordUserSettings())
    var currentMode by rememberSaveable { mutableStateOf("exam") }
    LaunchedEffect(modeSettings.appMode) {
        currentMode = modeSettings.appMode
    }
    val progress by localRepository.progress.collectAsState(initial = StudyProgress())
    val savedWallpaperUri by localRepository.wallpaperUri.collectAsState(initial = "")
    val scope = rememberCoroutineScope()
    var page by rememberSaveable { mutableStateOf("home") }
    var bookId by rememberSaveable { mutableStateOf("cet4") }
    var catalogLevel by rememberSaveable { mutableStateOf("cet4") }
    var catalogModule by rememberSaveable { mutableStateOf("written") }
    var paperId by rememberSaveable { mutableStateOf("") }
    var paperLevel by rememberSaveable { mutableStateOf("cet4") }
    var paperModule by rememberSaveable { mutableStateOf("written") }
    var resetGeneration by rememberSaveable { mutableIntStateOf(0) }
    val screenStates = rememberSaveableStateHolder()
    val showDock = page == "home" || page == "stats"

    fun openCatalog(mode: String, level: String) {
        catalogModule = mode
        catalogLevel = level
        page = "university"
    }
    fun openPaper(exam: com.shiguang.english.nativeapp.data.UniversityExam, module: String) {
        paperId = exam.id
        paperLevel = exam.level
        paperModule = module
        page = "university-paper"
    }
    fun navigateBack() {
        page = when (page) {
            "word-session" -> "words"
            "written-session" -> "written"
            "dictation-session" -> "home"
            "university-paper" -> "university"
            "university", "written", "words", "profile" -> "home"
            else -> "home"
        }
    }
    fun changeMode(mode: String) {
        currentMode = mode
        scope.launch { vocab.selectMode(mode) }
    }
    BackHandler(enabled = currentMode == "exam" && !showDock) { navigateBack() }

    // Android 15+ edge-to-edge: reserve system bars for both native modes.
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
    if (currentMode == "vocab") {
        screenStates.SaveableStateProvider("mode:vocab:" + resetGeneration) {
            VocabRoot(repository = vocab, onModeSwitch = { changeMode(it) })
        }
    } else Box(Modifier.fillMaxSize().background(Color.White)) {
        Column(Modifier.fillMaxSize()) {
            if (!showDock) {
                Row(
                    Modifier.fillMaxWidth().height(54.dp).background(Color.White)
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { navigateBack() }) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "返回")
                    }
                    Text(
                        when (page) {
                            "university" -> "历年真题"
                            "university-paper" -> "真题训练"
                            "words" -> "词书选择"
                            "word-session" -> "单词训练"
                            "profile" -> "个人设置"
                            "written" -> "笔试特训"
                            "written-session" -> "笔试练习"
                            "dictation-session" -> "逐句精听"
                            else -> "拾光英语"
                        },
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    StudyModeSwitch(
                        mode = "exam",
                        onSwitch = { changeMode(it) }
                    )
                }
                HorizontalDivider(thickness = 0.5.dp, color = PaperStroke)
            }

            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                val screenKey = resetGeneration.toString() + ":" + when (page) {
                    "word-session" -> "word-session:" + bookId
                    "university" -> "university:" + catalogModule + ":" + catalogLevel
                    "university-paper" -> "paper:" + paperLevel + "/" + paperId + "/" + paperModule
                    else -> page
                }
                screenStates.SaveableStateProvider(screenKey) {
                    when (page) {
                        "home" -> ReplicaHomeScreen(
                            progress = progress,
                            exams = university.exams,
                            onCatalog = { mode, level -> openCatalog(mode, level) },
                            onExam = { exam, module -> openPaper(exam, module) },
                            onProfile = { page = "profile" },
                            onWords = { changeMode("vocab") },
                            onModeSwitch = { changeMode(it) },
                            savedWallpaperUri = savedWallpaperUri,
                            onWallpaperChange = { uri ->
                                scope.launch { localRepository.setWallpaperUri(uri) }
                            }
                        )
                        "stats" -> ReplicaStatsScreen(progress, onModeSwitch = { changeMode(it) })
                        "listening", "university" -> UniversityCatalogScreen(
                            university,
                            initialLevel = catalogLevel,
                            initialModule = catalogModule,
                            onOpen = { exam, module -> openPaper(exam, module) }
                        )
                        "university-paper" -> {
                            val paper = university.exams.firstOrNull {
                                it.level == paperLevel && it.id == paperId
                            }
                            if (paper != null) UniversityPaperScreen(university, paper, paperModule)
                            else Text("未找到这套试卷，请返回目录重新选择")
                        }
                        "words" -> BooksScreen(onChoose = { bookId = it; page = "word-session" })
                        "word-session" -> WordSession(
                            bookId, progress,
                            onMark = { id, known ->
                                scope.launch { localRepository.markWord(id, known) }
                            },
                            onExit = { page = "words" }
                        )
                        "profile" -> ProfileScreen(
                            progress, onReset = {
                                scope.launch {
                                    localRepository.clear()
                                    vocab.clearMemory()
                                    UniversityAttemptStore(context.applicationContext).clearAll()
                                    resetGeneration += 1
                                }
                            }
                        )
                        "written" -> WrittenCatalog(onStart = { page = "written-session" })
                        "written-session" -> WrittenSession(
                            onAnswered = { correct -> scope.launch { localRepository.recordAnswer(correct) } },
                            onExit = { page = "written" }
                        )
                        "dictation-session" -> DictationSession()
                        else -> ReplicaHomeScreen(progress, university.exams,
                            onCatalog = { mode, level -> openCatalog(mode, level) },
                            onExam = { exam, module -> openPaper(exam, module) },
                            onProfile = { page = "profile" },
                            onWords = { changeMode("vocab") },
                            onModeSwitch = { changeMode(it) },
                            savedWallpaperUri = savedWallpaperUri,
                            onWallpaperChange = { uri ->
                                scope.launch { localRepository.setWallpaperUri(uri) }
                            })
                    }
                }
            }
        }
        if (showDock) {
            ReplicaHomeDock(
                active = page,
                onSelect = { page = it },
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp)
            )
        }
    }
    }
}
