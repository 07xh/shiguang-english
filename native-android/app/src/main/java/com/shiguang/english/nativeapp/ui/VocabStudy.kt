package com.shiguang.english.nativeapp.ui

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.BorderStroke
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GraphicEq
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shiguang.english.nativeapp.data.VocabRepository
import com.shiguang.english.nativeapp.data.VocabCatalog
import com.shiguang.english.nativeapp.data.VocabBook
import kotlinx.coroutines.launch
import java.util.Locale

private val StudyInk = Color(0xFF0F172A)
private val StudyDim = Color(0xFF64748B)

/** Native flip-style word learning, with per-book review levels persisted to SQLite. */
@Composable
fun VocabStudyPage(
    repository: VocabRepository, catalog: VocabCatalog, book: VocabBook,
    dailyGoal: Int, reviewOnly: Boolean, onFinish: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val allWords = remember(catalog, book.id) { catalog.items(book) }
    val byId = remember(allWords) { allWords.associateBy { it.id } }
    var initialized by rememberSaveable(book.id, reviewOnly) { mutableStateOf(false) }
    var queue by rememberSaveable(book.id, reviewOnly) { mutableStateOf(emptyList<String>()) }
    var completed by rememberSaveable(book.id, reviewOnly) { mutableIntStateOf(0) }
    var total by rememberSaveable(book.id, reviewOnly) { mutableIntStateOf(0) }
    var revealed by rememberSaveable(book.id, reviewOnly) { mutableStateOf(false) }
    var saveError by remember { mutableStateOf("") }
    LaunchedEffect(book.id, reviewOnly) {
        if (!initialized) {
            val memory = repository.snapshot(book.id)
            val due = allWords.filter { memory[it.id]?.due == true }
            val selected = if (reviewOnly) due else {
                val fresh = allWords.filter { !memory.containsKey(it.id) }
                (due + fresh).distinctBy { it.id }
            }
            queue = selected.take(dailyGoal.coerceIn(5, 200)).map { it.id }
            total = queue.size
            initialized = true
        }
    }
    val word = queue.firstOrNull()?.let { byId[it] }
    var saving by remember(word?.id) { mutableStateOf(false) }
    var ready by remember { mutableStateOf(false) }
    val speaker = remember(context) {
        TextToSpeech(context) { ready = it == TextToSpeech.SUCCESS }
    }
    DisposableEffect(speaker) {
        onDispose {
            speaker.stop()
            speaker.shutdown()
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 720.dp
        Column(
            modifier = Modifier.fillMaxSize()
                .padding(horizontal = if (wide) 48.dp else 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (!initialized) {
                CircularProgressIndicator(Modifier.padding(top = 55.dp))
            } else if (word == null) {
                Spacer(Modifier.height(70.dp))
                Text(if (total == 0) "当前没有到期复习或未学习单词" else "这组完成了",
                    fontSize = 22.sp, fontWeight = FontWeight.Bold, color = StudyInk,
                    textAlign = TextAlign.Center)
                Text(
                    if (total == 0) "可切换词书或返回今日页。"
                    else "已完成 " + completed + " / " + total + " 个词，学习结果已保存。",
                    color = StudyDim, fontSize = 13.sp, textAlign = TextAlign.Center
                )
                Button(onClick = onFinish) { Text("返回今日") }
            } else {
                Column(Modifier.fillMaxWidth().widthIn(max = 780.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(book.title, color = StudyDim, fontSize = 12.sp,
                            modifier = Modifier.weight(1f), maxLines = 1)
                        Text((completed + 1).toString() + " / " + total,
                            color = StudyDim, fontSize = 12.sp)
                    }
                    LinearProgressIndicator(
                        progress = {
                            if (total == 0) 0f else completed.toFloat() / total
                        },
                        color = StudyInk, trackColor = Color(0xFFE7EDF3),
                        modifier = Modifier.fillMaxWidth().height(7.dp)
                    )
                }
                Surface(
                    onClick = { revealed = !revealed },
                    modifier = Modifier.fillMaxWidth().widthIn(max = 780.dp)
                        .weight(1f),
                    color = Color.White,
                    shape = RoundedCornerShape(28.dp),
                    border = BorderStroke(1.dp, Color(0xFFE3EAF1)),
                    shadowElevation = 3.dp
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                                .padding(24.dp),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(if (reviewOnly) "REVIEW" else "VOCABULARY",
                            fontSize = 11.sp, letterSpacing = 2.sp,
                            fontWeight = FontWeight.Bold, color = StudyDim)
                        Spacer(Modifier.height(24.dp))
                        Text(word.spelling, fontSize = when {
                            word.spelling.length >= 22 -> 24.sp
                            word.spelling.length >= 15 -> 29.sp
                            wide -> 43.sp
                            else -> 34.sp
                        },
                            fontWeight = FontWeight.ExtraBold,
                            textAlign = TextAlign.Center, color = StudyInk,
                            lineHeight = 48.sp)
                        Spacer(Modifier.height(12.dp))
                        Text(word.phoneticUs.ifBlank { word.phoneticUk },
                            color = QuietBlue, fontSize = 15.sp)
                        Spacer(Modifier.height(12.dp))
                        OutlinedButton(
                            enabled = ready,
                            onClick = {
                                speaker.language = Locale.US
                                speaker.setSpeechRate(0.9f)
                                speaker.speak(word.spelling, TextToSpeech.QUEUE_FLUSH,
                                    null, word.id)
                            }
                        ) {
                            Icon(Icons.Outlined.GraphicEq, contentDescription = null,
                                modifier = Modifier.size(18.dp))
                            Text("发音")
                        }
                        Spacer(Modifier.height(22.dp))
                        AnimatedVisibility(
                            visible = revealed,
                            enter = fadeIn() + expandVertically(),
                            exit = fadeOut() + shrinkVertically()
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Text(word.translation, fontSize = 20.sp,
                                    fontWeight = FontWeight.SemiBold, color = StudyInk,
                                    textAlign = TextAlign.Center, lineHeight = 29.sp)
                                if (word.partOfSpeech.isNotBlank())
                                    Text(word.partOfSpeech, color = StudyDim, fontSize = 12.sp)
                                if (word.exampleEn.isNotBlank()) {
                                    Spacer(Modifier.height(7.dp))
                                    Text(word.exampleEn, fontSize = 14.sp, lineHeight = 22.sp,
                                        textAlign = TextAlign.Center, color = StudyInk)
                                }
                                if (word.exampleCn.isNotBlank())
                                    Text(word.exampleCn, fontSize = 12.sp,
                                        textAlign = TextAlign.Center, color = StudyDim)
                            }
                        }
                        if (!revealed) Text("轻触词卡查看释义",
                            fontSize = 12.sp, color = StudyDim)
                        }
                    }
                }
                if (!revealed) {
                    Button(
                        onClick = { revealed = true },
                        modifier = Modifier.fillMaxWidth().widthIn(max = 780.dp).height(50.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = StudyInk)
                    ) { Text("显示释义") }
                } else {
                    Text("回忆程度 · 点击后保存并进入下一词",
                        fontSize = 12.sp, color = StudyDim)
                    Row(
                        modifier = Modifier.fillMaxWidth().widthIn(max = 780.dp),
                        horizontalArrangement = Arrangement.spacedBy(7.dp)
                    ) {
                        (0..3).forEach { tier ->
                            val tint = memoryColor(tier)
                            Surface(
                                modifier = Modifier.weight(1f).height(54.dp),
                                enabled = !saving,
                                color = tint.copy(alpha = 0.10f),
                                shape = RoundedCornerShape(15.dp),
                                border = BorderStroke(1.dp, tint.copy(alpha = 0.35f)),
                                onClick = {
                                    if (!saving) {
                                        saving = true
                                        saveError = ""
                                        val id = word.id
                                        scope.launch {
                                            try {
                                                repository.rate(book.id, id, tier)
                                                queue = queue.drop(1)
                                                completed += 1
                                                revealed = false
                                            } catch (exc: Exception) {
                                                saveError = exc.message ?: "保存失败，请重试"
                                            } finally {
                                                saving = false
                                            }
                                        }
                                    }
                                }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(memoryName(tier), color = tint,
                                        fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
                if (saveError.isNotEmpty()) {
                    Text("学习记录未保存：" + saveError,
                        color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                }
                Spacer(Modifier.height(10.dp))
            }
        }
    }
}
