package com.shiguang.english.nativeapp.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ReplicaSequenceHeader(
    sequence: Int,
    total: Int,
    section: String,
    onJump: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            onClick = onJump,
            color = CardSubtle,
            shape = RoundedCornerShape(14.dp)
        ) {
            Row(Modifier.padding(horizontal = 13.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("NO.", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = MutedInk)
                Spacer(Modifier.width(6.dp))
                Text(sequence.toString().padStart(2, '0'), fontSize = 19.sp,
                    fontWeight = FontWeight.ExtraBold, color = Ink)
                Text(" / " + total, fontSize = 12.sp, color = MutedInk)
            }
        }
        Surface(shape = RoundedCornerShape(50.dp), color = CardSubtle) {
            Text(section.take(25), modifier = Modifier.padding(
                horizontal = 12.dp, vertical = 9.dp),
                fontSize = 11.5.sp, color = MutedInk,
                fontWeight = FontWeight.Medium, maxLines = 1)
        }
    }
}

@Composable
fun ReplicaOptionCard(
    key: String,
    label: String,
    isSelected: Boolean,
    isCorrect: Boolean?,
    onSelect: () -> Unit
) {
    val background = when {
        isCorrect == true -> Color(0xFFF2FAF5)
        isCorrect == false && isSelected -> Color(0xFFFDF3F3)
        isSelected -> SoftBlue
        else -> Color.White
    }
    val border = when {
        isCorrect == true -> CorrectGreen.copy(alpha = 0.48f)
        isCorrect == false && isSelected -> WrongRed.copy(alpha = 0.42f)
        isSelected -> QuietBlue.copy(alpha = 0.45f)
        else -> PaperStroke
    }
    Surface(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(15.dp),
        color = background,
        border = BorderStroke(1.dp, border)
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 15.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            Box(
                modifier = Modifier.size(31.dp)
                    .background(if (isSelected) border.copy(alpha = 0.14f) else CardSubtle,
                        RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(key, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    color = if (isSelected) Ink else MutedInk)
            }
            Text(label, modifier = Modifier.weight(1f),
                fontSize = 15.sp, fontWeight = if (isSelected) FontWeight.SemiBold
                    else FontWeight.Normal,
                lineHeight = 23.sp, color = Ink)
        }
    }
}

@Composable
fun ReplicaAnalysisCard(answer: String, explanation: String) {
    Surface(
        color = Color(0xFFF7F9FC),
        shape = RoundedCornerShape(17.dp),
        border = BorderStroke(0.75.dp, PaperStroke)
    ) {
        Column(Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("💡 考点精析与思路剖析",
                fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
            if (answer.isNotBlank()) {
                Text("参考答案  " + answer, fontSize = 13.sp,
                    color = CorrectGreen, fontWeight = FontWeight.SemiBold)
            }
            Text(explanation.ifBlank { "该题尚无可显示的解析。" },
                fontSize = 13.5.sp, lineHeight = 23.sp, color = MutedInk)
        }
    }
}

@Composable
fun ReplicaTransportBar(
    previous: String,
    next: String,
    center: String,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onCenter: () -> Unit,
    canPrev: Boolean,
    canNext: Boolean = true
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White.copy(alpha = 0.97f),
        border = BorderStroke(0.75.dp, PaperStroke),
        shadowElevation = 9.dp
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                enabled = canPrev,
                onClick = onPrev,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 7.dp, vertical = 10.dp)
            ) {
                Icon(Icons.Outlined.ChevronLeft, contentDescription = null,
                    modifier = Modifier.size(16.dp))
                Text(previous, fontSize = 12.sp, maxLines = 1)
            }
            FilledTonalButton(
                onClick = onCenter,
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
            ) {
                Icon(Icons.Outlined.GridView, contentDescription = null,
                    modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(3.dp))
                Text(center, fontSize = 11.5.sp, maxLines = 1)
            }
            Button(
                enabled = canNext,
                onClick = onNext,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 7.dp, vertical = 10.dp)
            ) {
                Text(next, fontSize = 12.sp, maxLines = 1)
                Icon(Icons.Outlined.ChevronRight, contentDescription = null,
                    modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
fun ReplicaCanvasAction(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    selected: Boolean = false
) {
    Surface(
        modifier = modifier,
        onClick = onClick,
        color = if (selected) SoftBlue else CardSubtle,
        shape = RoundedCornerShape(100.dp)
    ) {
        Box(Modifier.padding(horizontal = 15.dp, vertical = 11.dp),
            contentAlignment = Alignment.Center) {
            Text(text, fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (selected) QuietBlue else Ink, maxLines = 1)
        }
    }
}
