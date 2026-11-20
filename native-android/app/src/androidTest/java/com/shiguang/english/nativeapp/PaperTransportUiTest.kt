package com.shiguang.english.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.shiguang.english.nativeapp.ui.PaperResultActions
import com.shiguang.english.nativeapp.ui.ReplicaTransportBar
import com.shiguang.english.nativeapp.ui.ShiguangTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** Native transport regression for both phone and tablet emulator profiles. */
class PaperTransportUiTest {
    @get:Rule val rule = createComposeRule()

    @Test fun answerSheetRemainsReachableAndNavigationCallsCorrectHandlers() {
        var opened = 0
        var advanced = 0
        var wentBack = 0
        rule.setContent {
            ShiguangTheme {
                ReplicaTransportBar(
                    previous = "上一题",
                    next = "下一题",
                    center = "3/20",
                    onPrev = { wentBack++ },
                    onNext = { advanced++ },
                    onCenter = { opened++ },
                    canPrev = false
                )
            }
        }

        rule.onNodeWithTag("paper-previous").assertIsDisplayed().assertIsNotEnabled()
        rule.onNodeWithTag("paper-answer-sheet").assertIsDisplayed().performClick()
        rule.onNodeWithTag("paper-next").assertIsDisplayed().performClick()

        rule.runOnIdle {
            assertEquals(1, opened)
            assertEquals(1, advanced)
            assertEquals(0, wentBack)
        }
    }

    @Test fun resultActionsRemainTappableOnPhoneAndTablet() {
        var reviewTaps = 0
        var restartTaps = 0
        rule.setContent {
            ShiguangTheme {
                PaperResultActions(
                    onReview = { reviewTaps++ },
                    onRestart = { restartTaps++ }
                )
            }
        }

        rule.onNodeWithTag("paper-review-all").assertIsDisplayed().performClick()
        rule.onNodeWithTag("paper-restart").assertIsDisplayed().performClick()
        rule.runOnIdle {
            assertEquals(1, reviewTaps)
            assertEquals(1, restartTaps)
        }
    }
}
