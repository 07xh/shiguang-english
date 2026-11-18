package com.shiguang.english.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.shiguang.english.nativeapp.ui.ShiguangApp
import com.shiguang.english.nativeapp.ui.ShiguangTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ShiguangTheme {
                ShiguangApp()
            }
        }
    }
}
