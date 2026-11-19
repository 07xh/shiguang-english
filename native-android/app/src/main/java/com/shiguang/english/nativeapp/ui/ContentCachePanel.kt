package com.shiguang.english.nativeapp.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shiguang.english.nativeapp.data.OnDemandStore
import kotlinx.coroutines.launch
import java.util.Locale

/** Local download/cache manager. Saved learning progress is never deleted. */
@Composable
fun ContentCachePanel() {
    val context = LocalContext.current
    val store = remember(context) { OnDemandStore(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var refresh by remember { mutableIntStateOf(0) }
    var stats by remember { mutableStateOf<OnDemandStore.CacheStats?>(null) }
    var deleteTarget by remember { mutableStateOf<String?>(null) }
    var clearing by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf("") }

    LaunchedEffect(refresh) { stats = store.stats() }
    fun pretty(bytes: Long): String {
        if (bytes < 1024L) return bytes.toString() + " B"
        if (bytes < 1048576L) return String.format(Locale.US, "%.1f KB", bytes / 1024.0)
        return String.format(Locale.US, "%.1f MB", bytes / 1048576.0)
    }

    Surface(shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.38f)) {
        Column(Modifier.fillMaxWidth().padding(17.dp),
            verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Text("离线资源与存储", style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold)
            Text("需要时才下载，下载后可离线复用。清理缓存不会删除学习记录。",
                style = MaterialTheme.typography.bodySmall)
            if (stats == null) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            } else {
                val value = stats!!
                Text("已缓存 " + pretty(value.completedBytes), fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("真题与原声 · " + value.examFiles + " 个文件")
                    Text(pretty(value.examBytes))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("大学词库 · " + value.vocabFiles + " 个文件")
                    Text(pretty(value.vocabBytes))
                }
                if (value.unfinishedBytes > 0L) {
                    Text("未完成的下载：" + pretty(value.unfinishedBytes),
                        style = MaterialTheme.typography.bodySmall)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        enabled = !clearing && value.examFiles > 0,
                        onClick = { deleteTarget = "university" },
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 5.dp, vertical = 10.dp)
                    ) { Text("清理真题") }
                    OutlinedButton(
                        enabled = !clearing && value.vocabFiles > 0,
                        onClick = { deleteTarget = "vocabulary" },
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 5.dp, vertical = 10.dp)
                    ) { Text("清理词库") }
                }
            }
            TextButton(enabled = !clearing, onClick = { refresh++ }) { Text("刷新存储统计") }
            if (failure.isNotEmpty())
                Text("清理失败：" + failure, color = MaterialTheme.colorScheme.error)
        }
    }

    val target = deleteTarget
    if (target != null) {
        AlertDialog(
            onDismissRequest = { if (!clearing) deleteTarget = null },
            title = { Text("清理离线资源？") },
            text = {
                Text(if (target == "university")
                    "会删除已下载的题目和原声。再次使用需联网重新下载；答题进度不会被清除。"
                else "会删除缓存的原版词库。下次进入背词模式需联网重下；记忆等级不会被清除。")
            },
            confirmButton = {
                Button(enabled = !clearing, onClick = {
                    clearing = true
                    scope.launch {
                        try {
                            store.clearCategory(target)
                            failure = ""
                            refresh++
                        } catch (exc: Exception) {
                            failure = exc.message ?: "未知错误"
                        } finally {
                            clearing = false
                            deleteTarget = null
                        }
                    }
                }) { Text(if (clearing) "清理中" else "确认清理") }
            },
            dismissButton = {
                TextButton(enabled = !clearing, onClick = { deleteTarget = null }) { Text("取消") }
            }
        )
    }
}
