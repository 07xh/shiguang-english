package com.shiguang.english.nativeapp

import com.shiguang.english.nativeapp.model.DemoContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DemoContentTest {
    @Test fun allSampleWordIdsAreUnique() {
        assertEquals(DemoContent.words.size, DemoContent.words.map { it.id }.toSet().size)
    }
    @Test fun everyBookHasItsOwnWords() {
        DemoContent.books.forEach { book ->
            val words = DemoContent.wordsFor(book.id)
            assertTrue(words.isNotEmpty())
            assertTrue(words.all { it.bookId == book.id })
        }
    }
    @Test fun questionAnswersAreValid() {
        assertTrue(DemoContent.questions.all { it.answer in it.choices.indices && it.explanation.isNotBlank() })
    }
}
