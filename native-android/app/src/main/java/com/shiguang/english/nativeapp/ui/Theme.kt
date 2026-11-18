package com.shiguang.english.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Ink = Color(0xFF20344B)
val MutedInk = Color(0xFF748398)
val QuietBlue = Color(0xFF466D95)
val CanvasColor = Color(0xFFF7F8FA)
val SoftBlue = Color(0xFFEAF1F7)
val Amber = Color(0xFFBF8D4B)

private val Palette = lightColorScheme(
    primary = QuietBlue,
    onPrimary = Color.White,
    secondary = Amber,
    background = CanvasColor,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = SoftBlue,
    onSurfaceVariant = MutedInk,
    outline = Color(0xFFDCE4ED)
)

@Composable
fun ShiguangTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Palette, content = content)
}
