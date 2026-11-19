package com.shiguang.english.nativeapp

import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Rule
import org.junit.Test

/**
 * Runs on phone- and tablet-sized emulators. Still requires physical device
 * acceptance for precise color, insets, gestures and audio behavior.
 */
class NativeReferenceUiTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    @Test fun homeHasOriginalTwoTabsAndThreeTrainingModes() {
        rule.onNodeWithText("首页").assertExists()
        rule.onNodeWithText("统计").assertExists()
        rule.onNodeWithText("笔试特训").assertExists()
        rule.onNodeWithText("听力特训").assertExists()
        rule.onNodeWithText("逐句精听").assertExists()
    }

    @Test fun dockSwitchesBetweenHomeAndStats() {
        rule.onNodeWithText("统计").performClick()
        rule.onNodeWithText("学习复盘").assertExists()
        rule.onNodeWithText("首页").performClick()
        rule.onNodeWithText("Welcome back 👋").assertExists()
    }

    @Test fun categoryNavigatesToRealNativeCatalog() {
        rule.onNodeWithText("四级英语").performScrollTo().performClick()
        rule.onNodeWithText("选择试卷").assertExists()
        rule.onNodeWithText("📕 六级").assertExists()
    }

    @Test fun switchToVocabAndBackRetainsNativeModeNavigation() {
        rule.onNodeWithTag("app-mode-vocab").performClick()
        rule.onNodeWithText("今日").assertExists()
        rule.onNodeWithText("词库").performClick()
        rule.onNodeWithText("选择词书").assertExists()
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithText("首页").assertExists()
    }
}
