package com.shiguang.english.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Original-style numbered navigation: index does not mutate exercise answers.
 * The answered set is meaningful only in the written quiz; the dictation sample
 * currently has one missing word per sentence.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeJumpSheet(
    title: String,
    total: Int,
    selectedIndex: Int,
    answered: Set<Int>,
    onChoose: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text("已完成 " + answered.size + " / " + total, style = MaterialTheme.typography.bodySmall)
            for (row in (0 until total).chunked(5)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (i in row) {
                        val color = when {
                            i == selectedIndex -> Color(0xFFCADFF2)
                            i in answered -> Color(0xFFDFF1E6)
                            else -> Color(0xFFF0F3F6)
                        }
                        FilledTonalButton(
                            modifier = Modifier.weight(1f).height(48.dp),
                            onClick = { onChoose(i) },
                            contentPadding = PaddingValues(0.dp),
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = color),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text((i + 1).toString(), color = Ink)
                        }
                    }
                    repeat(5 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            Text("蓝色：当前 · 绿色：已完成 · 灰色：未完成", style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
fun NativeQwertyKeyboard(
    onLetter: (String) -> Unit,
    onErase: () -> Unit,
    onHide: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        listOf("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM").forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                row.forEach { letter ->
                    Surface(
                        modifier = Modifier.weight(1f).height(46.dp),
                        shape = RoundedCornerShape(9.dp),
                        color = Color(0xFFE8EEF5),
                        onClick = { onLetter(letter.lowercase()) }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(letter.toString(), fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(modifier = Modifier.weight(1f), onClick = onErase) {
                Text("退格")
            }
            Button(modifier = Modifier.weight(1f), onClick = onHide) {
                Text("收起键盘")
            }
        }
    }
}
