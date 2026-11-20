package com.shiguang.english.nativeapp

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.shiguang.english.nativeapp.data.UniversityQuestion
import com.shiguang.english.nativeapp.ui.ReplicaQuestionPanel
import com.shiguang.english.nativeapp.ui.ShiguangTheme
import org.junit.Rule
import org.junit.Test

/** Both emulator layouts must show the original subjective references. */
class SubjectiveReferenceUiTest {
    @get:Rule val rule = createComposeRule()

    private fun question(
        type: String, answer: String = "", modelTranslation: String = ""
    ) = UniversityQuestion(
        id = "subjective-1", type = type, prompt = "请翻译以下内容",
        passage = "", choices = emptyList(), answer = answer,
        analysis = "", modelTranslation = modelTranslation
    )

    @Test fun submittedTranslationDisplaysSourceReference() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question("translation", "Reference translation from the paper."),
                    selected = "My own translation", practiceMode = false,
                    reviewOnly = true, onAnswer = {}
                )
            }
        }
        rule.onNodeWithTag("reference-answer-text")
            .assertIsDisplayed()
            .assertTextContains("Reference translation from the paper.", substring = true)
    }

    @Test fun practiceModeCanRevealTranslationBeforeAnswering() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question("translation_en_zh", "经过核对的参考译文"),
                    selected = "", practiceMode = true, onAnswer = {}
                )
            }
        }
        rule.onNodeWithTag("subjective-reference-toggle").assertIsDisplayed().performClick()
        rule.onNodeWithTag("reference-answer-text")
            .assertIsDisplayed().assertTextContains("经过核对的参考译文", substring = true)
    }

    @Test fun missingReferenceShowsAnExplicitMessage() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question("translation"), selected = "",
                    practiceMode = false, reviewOnly = true, onAnswer = {}
                )
            }
        }
        rule.onNodeWithTag("subjective-reference-missing").assertIsDisplayed()
            .assertTextContains("暂无参考译文", substring = true)
    }

    @Test fun writingModelHasSeparateChineseTranslation() {
        rule.setContent {
            ShiguangTheme {
                ReplicaQuestionPanel(
                    question = question("writing", "A model essay.", "范文中文译文内容"),
                    selected = "", practiceMode = false, reviewOnly = true, onAnswer = {}
                )
            }
        }
        rule.onNodeWithTag("reference-answer-text").assertIsDisplayed()
            .assertTextContains("A model essay.", substring = true)
        rule.onNodeWithText("范文中文译文").assertIsDisplayed()
    }
}
