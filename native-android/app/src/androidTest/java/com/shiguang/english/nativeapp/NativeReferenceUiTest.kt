package com.shiguang.english.nativeapp

import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onAllNodesWithText
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
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithTag("exam-tab-home").assertIsDisplayed()
        rule.onNodeWithTag("exam-tab-stats").assertIsDisplayed()
        rule.onNodeWithTag("exam-home-title").assertIsDisplayed()
        rule.onNodeWithText("笔试特训").assertExists()
        rule.onNodeWithText("听力特训").assertExists()
        rule.onNodeWithText("逐句精听").assertExists()
    }

    @Test fun dockSwitchesBetweenHomeAndStats() {
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithTag("exam-tab-stats").performClick()
        rule.onNodeWithText("学习复盘").assertExists()
        rule.onNodeWithTag("exam-tab-home").performClick()
        rule.onNodeWithText("Welcome back 👋").assertExists()
    }

    @Test fun changingTrainingModesKeepsCatalogEntriesReachable() {
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithText("逐句精听").performClick()
        rule.onNodeWithText("雅思英语").assertExists()
        rule.onNodeWithText("笔试特训").performClick()
        rule.onNodeWithText("考研英语").assertExists()
    }

    @Test fun categoryNavigatesToRealNativeCatalog() {
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithText("四级英语").performScrollTo().performClick()
        rule.onNodeWithText("选择试卷").assertExists()
        rule.onNodeWithText("📕 六级").assertExists()
    }

    @Test fun catalogCompletesBackgroundCacheInventory() {
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithText("四级英语").performScrollTo().performClick()
        rule.onNodeWithText("选择试卷").assertExists()
        // The directory must finish its background scan instead of keeping
        // the downloaded-paper count in the temporary loading state.
        rule.waitUntil(timeoutMillis = 20000) {
            rule.onAllNodesWithText("已下载 ", substring = true)
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test fun switchToVocabAndBackRetainsNativeModeNavigation() {
        rule.onNodeWithTag("app-mode-vocab").performClick()
        rule.onNodeWithTag("vocab-section-title").assertTextEquals("今日")
        rule.onNodeWithTag("vocab-tab-lib").performClick()
        rule.onNodeWithTag("vocab-section-title").assertTextEquals("词库")
        rule.onNodeWithTag("app-mode-exam").performClick()
        rule.onNodeWithTag("exam-tab-home").assertExists()
    }
}
