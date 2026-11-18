package com.shiguang.english.nativeapp.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Native rendering of original licensed university wordbook cover assets. */
@Composable
fun VocabBookCover(bookId: String, size: Dp) {
    val context = LocalContext.current
    val image by produceState<ImageBitmap?>(null, bookId) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                context.assets.open("vocabulary/covers/" + bookId + ".webp").use {
                    BitmapFactory.decodeStream(it)?.asImageBitmap()
                }
            }.getOrNull()
        }
    }
    Box(Modifier.size(size).clip(RoundedCornerShape(16.dp))
        .background(Color(0xFFEAF0F6)), contentAlignment = Alignment.Center) {
        if (image != null) Image(
            bitmap = image!!, contentDescription = "词书封面",
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size)
        ) else Icon(
            Icons.Outlined.AutoStories,
            contentDescription = null,
            tint = Color(0xFF0F172A),
            modifier = Modifier.size(size * 0.47f)
        )
    }
}
