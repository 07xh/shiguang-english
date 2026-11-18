package com.shiguang.english.nativeapp.ui

import android.media.MediaPlayer
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.shiguang.english.nativeapp.data.UniversityExam
import com.shiguang.english.nativeapp.data.UniversityRepository
import kotlinx.coroutines.delay

/**
 * Native audio segment player. Uses verified MP3 assets, not the source website or WebView.
 * Sentence start/end are sourced from the JSON; absent timings mean full-track playback.
 */
@Composable
fun ReplicaSentencePlayer(
    repository: UniversityRepository,
    exam: UniversityExam,
    sentenceIndex: Int,
    startSeconds: Double?,
    endSeconds: Double?
) {
    val context = LocalContext.current
    val audioAsset = remember(exam.id) { repository.audioAsset(exam) }
    var initialized by remember(exam.id) { mutableStateOf(false) }
    var playing by remember(exam.id) { mutableStateOf(false) }
    var error by remember(exam.id) { mutableStateOf("") }
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
        if (audioAsset == null) {
            error = "当前试卷没有已验证的离线 MP3"
            return
        }
        try {
            if (!initialized) {
                context.assets.openFd(audioAsset).use {
                    player.setDataSource(it.fileDescriptor, it.startOffset, it.length)
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
            error = ""
        } catch (exc: Exception) {
            playing = false
            error = "无法播放本地 MP3：" + (exc.message ?: "播放器错误")
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            ReplicaCanvasAction("↺ 重听", onClick = { playback(true) })
            Button(onClick = { playback(false) }, enabled = audioAsset != null) {
                Icon(Icons.Outlined.PlayArrow, contentDescription = null,
                    modifier = Modifier.size(17.dp))
                Text(if (playing) "暂停" else "播放")
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
        if (audioAsset == null) {
            Text("原版录音未验证入包，不能播放；没有用语音合成冒充原声。")
        } else if (startSeconds == null || endSeconds == null) {
            Text("此句缺少精确时间轴，播放整段原声")
        }
        if (error.isNotBlank()) Text(error)
    }
}
