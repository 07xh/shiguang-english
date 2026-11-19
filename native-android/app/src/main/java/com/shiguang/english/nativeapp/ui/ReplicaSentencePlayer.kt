package com.shiguang.english.nativeapp.ui

import android.media.MediaPlayer
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.shiguang.english.nativeapp.data.ExamAudioSource
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Native sentence audio: download the MP3 on first playback, reuse it offline. */
@Composable
fun ReplicaSentencePlayer(
    repository: UniversityRepository,
    exam: UniversityExam,
    sentenceIndex: Int,
    startSeconds: Double?,
    endSeconds: Double?
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var audio by remember(exam.id) { mutableStateOf(repository.audioSource(exam)) }
    var loading by remember(exam.id) { mutableStateOf(false) }
    var bytes by remember(exam.id) { mutableLongStateOf(0L) }
    var totalBytes by remember(exam.id) { mutableLongStateOf(0L) }
    var initialized by remember(exam.id) { mutableStateOf(false) }
    var playing by remember(exam.id) { mutableStateOf(false) }
    var failure by remember(exam.id) { mutableStateOf("") }
    var speedIndex by remember(exam.id) { mutableIntStateOf(1) }
    val rates = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    val player = remember(exam.id) { MediaPlayer() }

    DisposableEffect(player) {
        player.setOnCompletionListener { playing = false }
        onDispose {
            runCatching { player.stop() }
            player.release()
        }
    }

    LaunchedEffect(sentenceIndex) {
        if (initialized) {
            runCatching {
                player.pause()
                player.seekTo(((startSeconds ?: 0.0) * 1000).toInt().coerceAtLeast(0))
            }
        }
        playing = false
    }

    LaunchedEffect(playing, endSeconds, sentenceIndex) {
        if (playing && endSeconds != null && endSeconds > (startSeconds ?: 0.0)) {
            val cutoff = (endSeconds * 1000).toLong()
            while (playing) {
                delay(65)
                val current = runCatching { player.currentPosition.toLong() }.getOrNull()
                if (current != null && current >= cutoff) {
                    runCatching { player.pause() }
                    playing = false
                    break
                }
            }
        }
    }

    fun playback(replay: Boolean) {
        scope.launch {
            try {
                if (audio == null) {
                    loading = true
                    audio = repository.ensureAudio(exam) { done, total ->
                        bytes = done
                        totalBytes = total
                    }
                    loading = false
                }
                if (!initialized) {
                    when (val source = audio) {
                        is ExamAudioSource.Asset ->
                            context.assets.openFd(source.path).use {
                                player.setDataSource(it.fileDescriptor, it.startOffset, it.length)
                            }
                        is ExamAudioSource.Downloaded ->
                            player.setDataSource(source.file.absolutePath)
                        null -> throw IllegalStateException("音频尚不可用")
                    }
                    player.prepare()
                    initialized = true
                }
                if (replay || !playing) {
                    val startMs = ((startSeconds ?: 0.0) * 1000).toInt().coerceAtLeast(0)
                    if (replay || player.currentPosition < startMs) player.seekTo(startMs)
                    player.playbackParams = player.playbackParams.setSpeed(rates[speedIndex])
                    player.start()
                    playing = true
                } else {
                    player.pause()
                    playing = false
                }
                failure = ""
            } catch (exc: Exception) {
                playing = false
                loading = false
                failure = exc.message ?: "音频不可用"
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            ReplicaCanvasAction("↺ 重听", onClick = { playback(true) })
            Button(enabled = !loading, onClick = { playback(false) }) {
                Icon(Icons.Outlined.PlayArrow, contentDescription = null,
                    modifier = Modifier.size(17.dp))
                Text(if (loading) "下载中" else if (playing) "暂停"
                    else if (audio == null) "下载原声" else "播放")
            }
            ReplicaCanvasAction(rates[speedIndex].toString() + "X", onClick = {
                speedIndex = (speedIndex + 1) % rates.size
                if (initialized && playing) {
                    runCatching {
                        player.playbackParams =
                            player.playbackParams.setSpeed(rates[speedIndex])
                    }
                }
            })
        }
        if (loading) {
            LinearProgressIndicator(
                progress = { if (totalBytes > 0)
                    (bytes.toFloat() / totalBytes).coerceIn(0f, 1f) else 0f },
                modifier = Modifier.fillMaxWidth()
            )
            Text("下载原声音频：" + (bytes / 1024) + " KB")
        } else if (audio == null) {
            Text("第一次点击播放才下载原声，下载后离线可用。")
        } else if (startSeconds == null || endSeconds == null) {
            Text("该句缺少精确时间轴，播放完整录音。")
        }
        if (failure.isNotBlank()) Text("音频获取失败：" + failure)
    }
}
