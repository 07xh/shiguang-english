package com.shiguang.english.nativeapp.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.studyDataStore by preferencesDataStore(name = "shiguang_native_progress")
private val KNOWN = stringSetPreferencesKey("known")
private val REVIEW = stringSetPreferencesKey("needs_review")
private val ANSWERED = intPreferencesKey("answered")
private val CORRECT = intPreferencesKey("correct")

data class StudyProgress(
    val known: Set<String> = emptySet(),
    val needsReview: Set<String> = emptySet(),
    val answered: Int = 0,
    val correct: Int = 0
) {
    val accuracy: Int get() = if (answered == 0) 0 else (correct * 100 / answered)
}

class LocalStudyRepository(context: Context) {
    private val store = context.applicationContext.studyDataStore

    val progress: Flow<StudyProgress> = store.data
        .catch { error ->
            if (error is IOException) emit(emptyPreferences()) else throw error
        }
        .map { preferences ->
            StudyProgress(
                known = preferences[KNOWN] ?: emptySet(),
                needsReview = preferences[REVIEW] ?: emptySet(),
                answered = preferences[ANSWERED] ?: 0,
                correct = preferences[CORRECT] ?: 0
            )
        }

    suspend fun markWord(id: String, known: Boolean) {
        store.edit { p ->
            val yes = (p[KNOWN] ?: emptySet()).toMutableSet()
            val again = (p[REVIEW] ?: emptySet()).toMutableSet()
            if (known) {
                yes.add(id)
                again.remove(id)
            } else {
                again.add(id)
                yes.remove(id)
            }
            p[KNOWN] = yes
            p[REVIEW] = again
        }
    }

    suspend fun recordAnswer(isCorrect: Boolean) {
        store.edit { p ->
            p[ANSWERED] = (p[ANSWERED] ?: 0) + 1
            if (isCorrect) p[CORRECT] = (p[CORRECT] ?: 0) + 1
        }
    }

    suspend fun clear() {
        store.edit { it.clear() }
    }
}
