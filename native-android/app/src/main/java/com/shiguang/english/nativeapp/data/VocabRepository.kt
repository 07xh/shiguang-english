package com.shiguang.english.nativeapp.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.shiguang.english.nativeapp.model.DemoContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicLong

private val Context.wordPreferences by preferencesDataStore(name = "shiguang_word_mode")
private val SELECTED_BOOK = stringPreferencesKey("selected_book")
private val DAILY_GOAL = intPreferencesKey("daily_goal")
private val APP_MODE = stringPreferencesKey("active_app_mode")

data class VocabWord(
    val id: String, val spelling: String, val translation: String,
    val phoneticUs: String, val phoneticUk: String,
    val partOfSpeech: String, val exampleEn: String, val exampleCn: String,
    val tip: String
)

data class VocabBook(
    val id: String, val title: String, val tag: String,
    val category: String, val description: String,
    val wordIndexes: List<Int>
)

data class VocabCatalog(
    val books: List<VocabBook>, val words: List<VocabWord>,
    val isOriginalComplete: Boolean
) {
    fun book(id: String): VocabBook? = books.firstOrNull { it.id == id }
    fun items(book: VocabBook): List<VocabWord> =
        book.wordIndexes.mapNotNull { words.getOrNull(it) }
}

data class WordUserSettings(
    val selectedBookId: String = "cet4",
    val dailyGoal: Int = 20,
    val appMode: String = "exam"
)

data class WordMemory(
    val tier: Int, val reviewedAt: Long, val dueAt: Long, val sessions: Int
) {
    val due: Boolean get() = dueAt <= System.currentTimeMillis()
}

private class WordDb(context: Context) :
    SQLiteOpenHelper(context, "shiguang_vocabulary_progress.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS word_reviews (" +
                "book_id TEXT NOT NULL, word_id TEXT NOT NULL, " +
                "tier INTEGER NOT NULL, reviewed_at INTEGER NOT NULL, " +
                "due_at INTEGER NOT NULL, sessions INTEGER NOT NULL, " +
                "PRIMARY KEY(book_id, word_id))"
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS due_reviews ON word_reviews(book_id,due_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    fun snapshot(bookId: String): Map<String, WordMemory> {
        val result = linkedMapOf<String, WordMemory>()
        readableDatabase.query(
            "word_reviews", arrayOf("word_id", "tier", "reviewed_at", "due_at", "sessions"),
            "book_id=?", arrayOf(bookId), null, null, null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result[cursor.getString(0)] = WordMemory(
                    cursor.getInt(1), cursor.getLong(2), cursor.getLong(3),
                    cursor.getInt(4)
                )
            }
        }
        return result
    }

    fun mark(bookId: String, wordId: String, tier: Int) {
        require(tier in 0..3)
        var sessions = 0
        readableDatabase.query(
            "word_reviews", arrayOf("sessions"),
            "book_id=? AND word_id=?", arrayOf(bookId, wordId),
            null, null, null
        ).use { cursor ->
            if (cursor.moveToFirst()) sessions = cursor.getInt(0)
        }
        val now = System.currentTimeMillis()
        val intervalsMs = longArrayOf(0L, 86400000L, 3L * 86400000L, 7L * 86400000L)
        val values = ContentValues().apply {
            put("book_id", bookId)
            put("word_id", wordId)
            put("tier", tier)
            put("reviewed_at", now)
            put("due_at", now + intervalsMs[tier])
            put("sessions", sessions + 1)
        }
        writableDatabase.insertWithOnConflict(
            "word_reviews", null, values, SQLiteDatabase.CONFLICT_REPLACE
        )
    }
}

class VocabRepository(private val context: Context) {
    private val db = WordDb(context.applicationContext)
    private val revision = MutableStateFlow(0L)
    private val version = AtomicLong(0L)

    val settings: Flow<WordUserSettings> = context.applicationContext.wordPreferences.data
        .map { preferences ->
            WordUserSettings(
                selectedBookId = preferences[SELECTED_BOOK] ?: "cet4",
                dailyGoal = (preferences[DAILY_GOAL] ?: 20).coerceIn(5, 200),
                appMode = preferences[APP_MODE] ?: "exam"
            )
        }

    suspend fun selectBook(id: String) {
        context.applicationContext.wordPreferences.edit { it[SELECTED_BOOK] = id }
    }

    suspend fun changeGoal(amount: Int) {
        context.applicationContext.wordPreferences.edit {
            it[DAILY_GOAL] = amount.coerceIn(5, 200)
        }
    }

    suspend fun selectMode(mode: String) {
        require(mode in setOf("exam", "vocab"))
        context.applicationContext.wordPreferences.edit { it[APP_MODE] = mode }
    }

    fun observeMemory(bookId: String): Flow<Map<String, WordMemory>> =
        revision.map { withContext(Dispatchers.IO) { db.snapshot(bookId) } }

    suspend fun snapshot(bookId: String): Map<String, WordMemory> =
        withContext(Dispatchers.IO) { db.snapshot(bookId) }

    suspend fun rate(bookId: String, wordId: String, tier: Int) {
        withContext(Dispatchers.IO) { db.mark(bookId, wordId, tier) }
        revision.value = version.incrementAndGet()
    }

    suspend fun loadCatalog(): VocabCatalog = withContext(Dispatchers.IO) {
        try {
            val file = context.assets.open("vocabulary/university-words.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
            val root = JSONObject(file)
            require(root.optInt("schema") == 1 && root.optString("source") == "original-word-toy-authorized")
            val wordsArray = root.getJSONArray("words")
            require(wordsArray.length() >= 1000)
            val words = buildList {
                for (i in 0 until wordsArray.length()) {
                    val x = wordsArray.getJSONObject(i)
                    add(VocabWord(
                        id = x.optString("s").ifBlank { "vocab_$i" },
                        spelling = x.getString("w"),
                        translation = x.optString("t"),
                        phoneticUs = x.optString("us"),
                        phoneticUk = x.optString("uk"),
                        partOfSpeech = x.optString("p"),
                        exampleEn = x.optString("en"),
                        exampleCn = x.optString("cn"),
                        tip = x.optString("tip")
                    ))
                }
            }
            val booksArray = root.getJSONArray("books")
            val books = buildList {
                for (i in 0 until booksArray.length()) {
                    val x = booksArray.getJSONObject(i)
                    val indexes = x.getJSONArray("words")
                    val indices = (0 until indexes.length()).map { indexes.getInt(it) }
                    require(indices.size >= 500 && indices.all { it in words.indices })
                    add(VocabBook(
                        id = x.getString("id"), title = x.getString("title"),
                        tag = x.optString("tag"), category = x.optString("category"),
                        description = x.optString("description"), wordIndexes = indices
                    ))
                }
            }
            require(books.size >= 9)
            VocabCatalog(books, words, true)
        } catch (e: IOException) {
            sampleCatalog()
        }
    }

    private fun sampleCatalog(): VocabCatalog {
        val books = DemoContent.books.map { book ->
            val indexes = DemoContent.words.mapIndexedNotNull { index, word ->
                index.takeIf { word.bookId == book.id }
            }
            VocabBook(book.id, book.title, "原生交互样本", "demo", book.subtitle, indexes)
        }
        val words = DemoContent.words.map {
            VocabWord(it.id, it.spelling, it.meaning, it.phonetic, it.phonetic,
                "", it.example, "", "")
        }
        return VocabCatalog(books, words, false)
    }
}
