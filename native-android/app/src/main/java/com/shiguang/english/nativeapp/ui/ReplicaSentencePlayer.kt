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
import com.shiguang.english.nativeapp.model.SentenceAudioRange
import com.shiguang.english.nativeapp.model.AudioCoverage
import com.shiguang.english.nativeapp.model.PlaybackRequestGate
import kotlinx.coroutines.CancellationException
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
    var busy by remember(exam.id) { mutableStateOf(false) }
    val playbackGate = remember(exam.id) { PlaybackRequestGate() }
    val latestSentence = rememberUpdatedState(Triple(sentenceIndex, startSeconds, endSeconds))
    var bytes by remember(exam.id) { mutableLongStateOf(0L) }
    var totalBytes by remember(exam.id) { mutableLongStateOf(0L) }
    var initialized by remember(exam.id) { mutableStateOf(false) }
    var playing by remember(exam.id) { mutableStateOf(false) }
    var restartFromStart by remember(exam.id) { mutableStateOf(true) }
    var playedMs by remember(exam.id, sentenceIndex) { mutableIntStateOf(0) }
    val requestedRange = remember(startSeconds, endSeconds) {
        SentenceAudioRange.fromSeconds(startSeconds, endSeconds)
    }
    var durationMs by remember(exam.id) { mutableIntStateOf(0) }
    val range = requestedRange.bounded(durationMs)
    var failure by remember(exam.id) { mutableStateOf("") }
    var speedIndex by remember(exam.id) { mutableIntStateOf(1) }
    val rates = listOf(0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    val player = remember(exam.id) { MediaPlayer() }

    DisposableEffect(player) {
        player.setOnCompletionListener {
            playing = false
            restartFromStart = true
        }
        onDispose {
            runCatching { player.stop() }
            player.release()
        }
    }

    // Switching sentences must never resume at the previous sentence's position.
    LaunchedEffect(sentenceIndex, startSeconds, endSeconds) {
        if (initialized) {
            runCatching {
                if (player.isPlaying) player.pause()
                player.seekTo(requestedRange.bounded(player.duration).startMs)
            }
        }
        restartFromStart = true
        playing = false
        playedMs = 0
        if (initialized && AudioCoverage.missesKnownTimeline(
                durationMs.toLong(), requestedRange.endMs?.toLong())) {
            failure = "当前录音时长不足以覆盖本句时间轴，音频可能不完整"
        } else {
            failure = ""
        }
    }

    LaunchedEffect(playing, range, sentenceIndex) {
        if (playing) {
            while (playing) {
                delay(65)
                val current = runCatching { player.currentPosition }.getOrNull() ?: break
                playedMs = (current - range.startMs).coerceAtLeast(0)
                if (range.endMs != null && current >= range.endMs) {
                    runCatching { player.pause() }
                    playing = false
                    restartFromStart = true
                    break
                }
            }
        }
    }

    fun playback(replay: Boolean) {
        if (!playbackGate.tryEnter()) return
        busy = true
        val requestedSentence = Triple(sentenceIndex, startSeconds, endSeconds)
        if (audio == null) loading = true
        scope.launch {
            try {
                if (audio == null) {
                    audio = repository.ensureAudio(exam) { done, total ->
                        bytes = done
                        totalBytes = total
                    }
                    loading = false
                }
                // Do not start the previous sentence after an asynchronous download.
                if (requestedSentence != latestSentence.value) return@launch
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
                    durationMs = player.duration.coerceAtLeast(0)
                    initialized = true
                    restartFromStart = true
                }
                if (AudioCoverage.missesKnownTimeline(
                        player.duration.toLong(), requestedRange.endMs?.toLong())) {
                    throw IllegalStateException(
                        "当前 MP3 时长短于本句时间轴，可能是残缺录音，已停止播放"
                    )
                }
                val playableRange = requestedRange.bounded(player.duration)
                if (replay || !playing) {
                    if (replay || restartFromStart ||
                        playableRange.shouldRewind(player.currentPosition)) {
                        player.seekTo(playableRange.startMs)
                    }
                    // setPlaybackParams(nonzero) itself can start MediaPlayer.
                    // Seek first, then explicitly start playback before changing speed.
                    player.start()
                    player.playbackParams = player.playbackParams.setSpeed(rates[speedIndex])
                    restartFromStart = false
                    playing = true
                } else {
                    player.pause()
                    playing = false
                }
                failure = ""
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (exc: Exception) {
                playing = false
                failure = exc.message ?: "音频不可用"
            } finally {
                loading = false
                busy = false
                playbackGate.leave()
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            ReplicaCanvasAction("↺ 重听", onClick = { playback(true) })
            Button(enabled = !busy, onClick = { playback(false) }) {
                Icon(Icons.Outlined.PlayArrow, contentDescription = null,
                    modifier = Modifier.size(17.dp))
                Text(if (loading) "下载中" else if (playing) "暂停"
                    else if (audio == null) "下载原声" else "播放")
            }
            ReplicaCanvasAction(rates[speedIndex].toString() + "X", onClick = {
                if (busy) return@ReplicaCanvasAction
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
        } else if (!range.hasExactRange) {
            Text(
                if (initialized && AudioCoverage.missesKnownTimeline(
                        durationMs.toLong(), requestedRange.endMs?.toLong()))
                    "该句时间轴超出实际录音长度；可能缺少音频内容，未标记为完整片段。"
                else "该句缺少可用的精确时间轴；从头播放完整录音。"
            )
        } else {
            val segmentSeconds = ((range.endMs!! - range.startMs) / 1000).coerceAtLeast(1)
            LinearProgressIndicator(
                progress = { (playedMs / (segmentSeconds * 1000f)).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth()
            )
            Text("本句片段 " + segmentSeconds + " 秒 · 已播放 " +
                (playedMs / 1000).coerceAtMost(segmentSeconds) + " 秒")
        }
        if (failure.isNotBlank()) Text("音频获取失败：" + failure)
    }
}
