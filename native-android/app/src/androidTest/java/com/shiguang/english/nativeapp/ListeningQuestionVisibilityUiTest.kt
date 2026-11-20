package com.shiguang.english.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.shiguang.english.nativeapp.data.UniversityQuestion
import com.shiguang.english.nativeapp.ui.ListeningQuestionVisibilityToggle
import com.shiguang.english.nativeapp.ui.ReplicaQuestionPanel
import com.shiguang.english.nativeapp.ui.ShiguangTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** Runs on phone and tablet emulator configurations. */
class ListeningQuestionVisibilityUiTest {
    @get:Rule val rule = createComposeRule()

    private val question = UniversityQuestion(
        id = "audio-q1", type = "listening", prompt = "What is the speaker's purpose?",
        passage = "", choices = listOf("A" to "Option A", "B" to "Option B"),
        answer = "A", analysis = ""
    )

    @Test fun visibilitySwitchHasOriginalOffByDefaultSemantics() {
        var hidden = false
        rule.setContent {
            ShiguangTheme {
                ListeningQuestionVisibilityToggle(
                    hidden = hidden,
                    onHiddenChange = { hidden = it }
                )
            }
        }
        rule.onNodeWithText("隐藏题目：关").assertIsDisplayed()
        rule.onNodeWithTag("listening-hide-question-toggle").performClick()
        rule.runOnIdle { assertEquals(true, hidden) }
    }

    @Test fun hiddenStemDoesNotRemoveAnswerOptionsOrTaps() {
        var selected = ""
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question,
                    selected = selected, practiceMode = false,
                    hidePrompt = true, questionNumber = 1,
                    onAnswer = { selected = it }
                )
            }
        }
        rule.onNodeWithTag("university-question-prompt").assertDoesNotExist()
        rule.onNodeWithText("Option A").assertIsDisplayed().performClick()
        rule.onNodeWithText("Option B").assertIsDisplayed()
        rule.runOnIdle { assertEquals("A", selected) }
    }

    @Test fun visibleQuestionShowsRealStemAndChoices() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question,
                    selected = "", practiceMode = false,
                    hidePrompt = false, questionNumber = 1,
                    onAnswer = {}
                )
            }
        }
        rule.onNodeWithTag("university-question-prompt").assertIsDisplayed()
        rule.onNodeWithText("What is the speaker's purpose?").assertIsDisplayed()
        rule.onNodeWithText("Option B").assertIsDisplayed()
    }

    @Test fun spokenOnlyQuestionDisplaysNumberWithoutInventingContent() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question.copy(prompt = ""),
                    selected = "", practiceMode = false,
                    hidePrompt = false, questionNumber = 7,
                    onAnswer = {}
                )
            }
        }
        rule.onNodeWithText("Question 7.").assertIsDisplayed()
        rule.onNodeWithText("Option A").assertIsDisplayed()
    }
}
