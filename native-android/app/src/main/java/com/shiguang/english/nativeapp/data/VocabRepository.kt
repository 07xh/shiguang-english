package com.shiguang.english.nativeapp.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Base64
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
import org.json.JSONArray
import java.io.File
import java.io.IOException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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
    private val store = OnDemandStore(context)
    private val downloadMutex = Mutex()
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

    private val bookIds = listOf(
        "cet4", "cet6", "zhuanshengben", "kaoyan_core", "kaoyan_2",
        "ielts_core", "toefl_core", "tem4_core", "tem8_core"
    )

    private val xorMask = intArrayOf(
        87, 84, 95, 50, 48, 50, 54, 95, 154, 76, 227, 113, 43, 216, 101, 25,
        167, 62, 242, 132, 92, 193, 13, 119, 233, 35, 107, 181, 72, 145, 212, 58, 130,
        247, 20, 110, 163, 89, 200, 47, 125, 176, 65, 149, 236, 51, 138, 209, 31, 100,
        186, 7, 82, 230, 156, 56, 245, 77, 129, 202, 38, 115, 185, 14
    )

    private fun unpackSourceJson(text: String): JSONArray {
        val trimmed = text.trimStart('\uFEFF', ' ', '\n', '\r')
        if (trimmed.startsWith("[")) return JSONArray(trimmed)
        val obj = JSONObject(trimmed)
        require(obj.optInt("_v") == 1) { "原版词库格式发生变化" }
        val seed = obj.getString("_s").fold(0) { acc, char ->
            (acc * 33 + char.code) and 255
        }
        val bytes = Base64.decode(obj.getString("_c"), Base64.DEFAULT)
        val table = IntArray(256) { index ->
            xorMask[(index + seed) and 63] xor ((index * 31 + seed) and 255)
        }
        for (i in bytes.indices) {
            bytes[i] = (bytes[i].toInt() xor table[i and 255]).toByte()
        }
        return JSONArray(String(bytes, Charsets.UTF_8))
    }

    private fun packedFile(): File =
        store.local("vocabulary", "shared", "university-words.json")

    suspend fun loadCatalog(): VocabCatalog = withContext(Dispatchers.IO) {
        val file = packedFile()
        val raw = if (file.isFile) {
            file.readText(Charsets.UTF_8)
        } else {
            // Backward compatibility for already installed offline builds.
            context.assets.open("vocabulary/university-words.json")
                .bufferedReader(Charsets.UTF_8).use { it.readText() }
        }
        parsePack(raw)
    }

    /**
     * On first entry into vocabulary mode, obtain the two shared source files
     * (not on app install). All nine university books reuse this one corpus.
     */
    suspend fun ensureCatalog(
        progress: (Long, Long) -> Unit = { _, _ -> }
    ): VocabCatalog {
        try {
            return loadCatalog()
        } catch (_: IOException) {
            // Nothing bundled/cached; download when the user enters the mode.
        }
        return downloadMutex.withLock {
            try {
                loadCatalog()
            } catch (_: IOException) {
                val masterFile = store.local("vocabulary", "shared", "vocab_master.json")
                val bookFile = store.local("vocabulary", "shared", "books_manifest.json")
                val source = "https://bilibilitoyassets.top/word_toy/data/"
                for ((file, name, minimum) in listOf(
                    Triple(masterFile, "vocab_master.json", 1000),
                    Triple(bookFile, "books_manifest.json", 9)
                )) {
                    if (!file.isFile || runCatching {
                            unpackSourceJson(file.readText()).length() >= minimum
                        }.getOrDefault(false).not()) {
                        store.download(source + name, file, 40L * 1024 * 1024,
                            validate = { candidate ->
                                runCatching {
                                    unpackSourceJson(candidate.readText()).length() >= minimum
                                }.getOrDefault(false)
                            }, progress = progress)
                    }
                }
                val master = unpackSourceJson(masterFile.readText(Charsets.UTF_8))
                val sourceBooks = unpackSourceJson(bookFile.readText(Charsets.UTF_8))
                val normalized = normalizeSource(master, sourceBooks)
                val target = packedFile()
                val partial = File(target.parentFile, target.name + ".part")
                target.parentFile?.mkdirs()
                try {
                    partial.writeText(normalized.toString(), Charsets.UTF_8)
                    require(parsePack(partial.readText()).isOriginalComplete)
                    if (target.exists()) target.delete()
                    if (!partial.renameTo(target)) throw IOException("无法缓存词库")
                } finally {
                    partial.delete()
                }
                loadCatalog()
            }
        }
    }

    private fun normalizeSource(master: JSONArray, manifests: JSONArray): JSONObject {
        val selected = linkedMapOf<String, JSONObject>()
        for (i in 0 until manifests.length()) {
            val row = manifests.optJSONObject(i) ?: continue
            val id = row.optString("id")
            if (id in bookIds && row.optJSONArray("words") != null) {
                require(id !in selected) { "原版词书 ID 重复" }
                selected[id] = row
            }
        }
        require(bookIds.all { it in selected }) { "原版大学词书列表不完整" }
        val used = sortedSetOf<Int>()
        for (id in bookIds) {
            val indexes = selected.getValue(id).getJSONArray("words")
            require(indexes.length() >= 500) { "词书内容不足：" + id }
            for (j in 0 until indexes.length()) {
                val position = indexes.getInt(j)
                require(position in 0 until master.length()) { "词书索引越界：" + id }
                used.add(position)
            }
        }
        val compact = used.withIndex().associate { (i, original) -> original to i }
        val wordKeys = listOf("w", "s", "t", "us", "uk", "en", "cn", "p", "tip")
        val words = JSONArray()
        for (i in used) {
            val original = master.getJSONObject(i)
            require(original.optString("w").isNotBlank()) { "原版词条缺少单词" }
            val word = JSONObject()
            wordKeys.forEach { key -> word.put(key, original.optString(key)) }
            words.put(word)
        }
        val books = JSONArray()
        for (id in bookIds) {
            val original = selected.getValue(id)
            val arr = JSONArray()
            val sourceIndexes = original.getJSONArray("words")
            for (j in 0 until sourceIndexes.length()) {
                arr.put(compact.getValue(sourceIndexes.getInt(j)))
            }
            val book = JSONObject()
            listOf("id", "title", "tag", "category", "description").forEach { key ->
                book.put(key, original.optString(key))
            }
            book.put("words", arr)
            books.put(book)
        }
        return JSONObject().put("schema", 1)
            .put("source", "original-word-toy-authorized")
            .put("words", words).put("books", books)
    }

    private fun parsePack(raw: String): VocabCatalog {
        val root = JSONObject(raw)
        require(root.optInt("schema") == 1 &&
            root.optString("source") == "original-word-toy-authorized") {
            "词库资源未通过完整性验证"
        }
        val rows = root.getJSONArray("words")
        require(rows.length() >= 1000)
        val words = buildList {
            for (i in 0 until rows.length()) {
                val x = rows.getJSONObject(i)
                add(VocabWord(
                    id = x.optString("s").ifBlank { "vocab_" + i },
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
        val books = buildList {
            val items = root.getJSONArray("books")
            for (i in 0 until items.length()) {
                val x = items.getJSONObject(i)
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
        require(books.size == bookIds.size && books.map { it.id }.toSet() == bookIds.toSet())
        return VocabCatalog(books, words, true)
    }

    fun cachedBytes(): Long = store.totalBytes()
}
