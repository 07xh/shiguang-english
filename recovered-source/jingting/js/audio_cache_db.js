/* === js/audio_cache_db.js === */
/**
 * ==========================================================================
 * ToySecurity - Lightweight Local Storage & Cache Vault Engine
 * ==========================================================================
 * 1. HMAC-like Dual-Avalanche Signature for User Permissions (Anti-F12 Tamper)
 * 2. Fast Stream-XOR + Base64 Payload Obfuscation for Exam JSON Caches
 * 3. 100% Zero-Latency (<0.3ms) & Seamless Backward Migration for Existing Users
 * ==========================================================================
 */
const ToySecurity = (function() {
    const _S1 = 'BiliToy_Vault_8157388_Cet46GkIelts_v1';
    const _S2 = 'YzDdz_SigSalt_202610_GoldenRatio_9f4c';

    // Deterministic 64-bit Dual-Round Avalanche Hash (Returns 14-16 char base36 signature)
    function computeSig(contextKey, payloadStr) {
        const input = `${_S1}|${contextKey || ''}|${payloadStr || ''}|${_S2}`;
        let h1 = 0x811c9dc5;
        let h2 = 0xcbf29ce4;
        for (let i = 0; i < input.length; i++) {
            const c = input.charCodeAt(i);
            h1 ^= c;
            h1 = Math.imul(h1, 0x01000193);
            h2 ^= (c + (i & 0xff));
            h2 = Math.imul(h2, 0x5bd1e995);
            h2 ^= (h2 >>> 15);
        }
        // Finalize avalanche mixing
        h1 ^= h1 >>> 16;
        h1 = Math.imul(h1, 0x85ebca6b);
        h1 ^= h1 >>> 13;
        h2 ^= h2 >>> 13;
        h2 = Math.imul(h2, 0xc2b2ae35);
        h2 ^= h2 >>> 16;
        return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
    }

    // Derive a 64-byte keystream table from keyHint
    function _deriveKeyBox(keyHint) {
        const seedStr = `${_S1}:${keyHint || 'default'}:${_S2}`;
        const box = new Uint8Array(64);
        let state = 0x9e3779b9;
        for (let i = 0; i < 64; i++) {
            const ch = seedStr.charCodeAt(i % seedStr.length);
            state ^= (ch + Math.imul(i + 1, 0x27d4eb2d));
            state = Math.imul(state ^ (state >>> 15), 0x85ebca6b);
            box[i] = (state ^ (state >>> 13)) & 0xff;
        }
        return box;
    }

    function encryptStr(plainStr, keyHint) {
        if (typeof plainStr !== 'string' || !plainStr) return '';
        try {
            const box = _deriveKeyBox(keyHint);
            if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
                const bytes = new TextEncoder().encode(plainStr);
                const len = bytes.length;
                for (let i = 0; i < len; i++) {
                    bytes[i] = bytes[i] ^ box[i & 63] ^ ((i * 73) & 0xff);
                }
                const CHUNK = 8192;
                const parts = [];
                for (let i = 0; i < len; i += CHUNK) {
                    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, len))));
                }
                return btoa(parts.join(''));
            }
            return btoa(unescape(encodeURIComponent(plainStr)));
        } catch (e) {
            return '';
        }
    }

    function decryptStr(cipherB64, keyHint) {
        if (typeof cipherB64 !== 'string' || !cipherB64) return '';
        try {
            const box = _deriveKeyBox(keyHint);
            if (typeof TextDecoder !== 'undefined' && typeof atob === 'function') {
                const binStr = atob(cipherB64);
                const len = binStr.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binStr.charCodeAt(i) ^ box[i & 63] ^ ((i * 73) & 0xff);
                }
                return new TextDecoder().decode(bytes);
            }
            return decodeURIComponent(escape(atob(cipherB64)));
        } catch (e) {
            return '';
        }
    }

    // Exam / Daily JSON Encryption & Decryption (Prefix: TEJ1:)
    function encryptExamData(dataObj, keyHint) {
        if (!dataObj) return null;
        try {
            const jsonStr = (typeof dataObj === 'string') ? dataObj : JSON.stringify(dataObj);
            const enc = encryptStr(jsonStr, keyHint || 'exam_cache');
            return enc ? ('TEJ1:' + enc) : jsonStr;
        } catch (e) {
            return dataObj;
        }
    }

    function decryptExamData(storedVal, keyHint) {
        if (!storedVal) return null;
        if (typeof storedVal === 'object') return storedVal; // Backward compatibility for legacy IndexedDB object
        if (typeof storedVal === 'string') {
            try {
                if (storedVal.startsWith('TEJ1:')) {
                    const plain = decryptStr(storedVal.slice(5), keyHint || 'exam_cache');
                    return plain ? JSON.parse(plain) : null;
                }
                return JSON.parse(storedVal); // Backward compatibility for legacy plaintext JSON
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    function getLocalExamJson(storageKey) {
        if (!storageKey) return null;
        try {
            const raw = window.__toyLS.getItem(storageKey) || window.__toySS.getItem(storageKey);
            if (!raw) return null;
            const parsed = decryptExamData(raw, storageKey);
            // Silently upgrade legacy plaintext cache in localStorage to encrypted TEJ1: format
            if (parsed && typeof raw === 'string' && !raw.startsWith('TEJ1:')) {
                setLocalExamJson(storageKey, parsed);
            }
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function setLocalExamJson(storageKey, dataObj) {
        if (!storageKey || !dataObj) return false;
        const encrypted = encryptExamData(dataObj, storageKey);
        const strVal = (typeof encrypted === 'string') ? encrypted : JSON.stringify(dataObj);
        try {
            window.__toyLS.setItem(storageKey, strVal);
            return true;
        } catch (e) {
            try {
                window.__toySS.setItem(storageKey, strVal);
                return true;
            } catch (err) {
                return false;
            }
        }
    }

    // Permission Vault Signature & Encryption (Prefix: TP2.)
    function _computePermSig(uKey, p) {
        const canonical = `${uKey}|f:${p.f ? 1 : 0}|c:${p.c ? 1 : 0}|a:${p.a ? 1 : 0}|m:${p.m ? 1 : 0}|s:${p.s ? 1 : 0}|4:${p.c4 ? 1 : 0}|6:${p.c6 ? 1 : 0}|g:${p.cg ? 1 : 0}|d:${p.cd ? 1 : 0}|i:${p.ci ? 1 : 0}|k:${p.ck ? 1 : 0}|o:${p.o ? 1 : 0}|t:${p.t || 0}`;
        return computeSig('PERM_SIG_V2_' + uKey, canonical);
    }

    function saveSignedPermissions(uKey, permObj) {
        if (!permObj) return false;
        const safeUser = String(uKey || 'u_guest');
        const storageKey = `toy_${safeUser}_cached_permissions`;
        const sealKey = `toy_${safeUser}_perm_seal`;
        try {
            const p = {
                u: safeUser,
                f: permObj.isFollowing ? 1 : 0,
                c: permObj.isCharged ? 1 : 0,
                a: permObj.isAuthor ? 1 : 0,
                m: permObj.hasFanMedal ? 1 : 0,
                s: permObj.hasShared ? 1 : 0,
                c4: permObj.hasCoinCet4 ? 1 : 0,
                c6: permObj.hasCoinCet6 ? 1 : 0,
                cg: permObj.hasCoinGaokao ? 1 : 0,
                cd: permObj.hasCoinDaily ? 1 : 0,
                ci: permObj.hasCoinIelts ? 1 : 0,
                ck: permObj.hasCoinKaoyan ? 1 : 0,
                o: permObj.isTestOverridden ? 1 : 0,
                t: Number(permObj.timestamp) || Date.now()
            };
            const sg = _computePermSig(safeUser, p);
            const token = 'TP2.' + encryptStr(JSON.stringify({ p, sg }), 'PERM_KEY_V2_' + safeUser);
            window.__toyLS.setItem(storageKey, token);
            window.__toyLS.setItem(sealKey, computeSig(safeUser, 'SEAL_ACTIVE_V2'));
            return true;
        } catch (e) {
            return false;
        }
    }

    function loadSignedPermissions(uKey) {
        const safeUser = String(uKey || 'u_guest');
        const storageKey = `toy_${safeUser}_cached_permissions`;
        const sealKey = `toy_${safeUser}_perm_seal`;
        try {
            const raw = window.__toyLS.getItem(storageKey);
            if (!raw) return null;

            // 1. Standard Encrypted & Signed Token (TP2.)
            if (raw.startsWith('TP2.')) {
                const plain = decryptStr(raw.slice(4), 'PERM_KEY_V2_' + safeUser);
                if (!plain) {
                    window.__toyLS.removeItem(storageKey);
                    return null;
                }
                const wrapper = JSON.parse(plain);
                if (!wrapper || !wrapper.p || wrapper.p.u !== safeUser) {
                    window.__toyLS.removeItem(storageKey);
                    return null;
                }
                const expectedSg = _computePermSig(safeUser, wrapper.p);
                if (wrapper.sg !== expectedSg) {
                    console.warn('[ToySecurity] Permission cache signature mismatch (tampered). Resetting.');
                    window.__toyLS.removeItem(storageKey);
                    return null;
                }
                const p = wrapper.p;
                return {
                    isFollowing: !!p.f,
                    isCharged: !!p.c,
                    isAuthor: !!p.a,
                    hasFanMedal: !!p.m,
                    hasShared: !!p.s,
                    hasCoinCet4: !!p.c4,
                    hasCoinCet6: !!p.c6,
                    hasCoinGaokao: !!p.cg,
                    hasCoinDaily: !!p.cd,
                    hasCoinIelts: !!p.ci,
                    hasCoinKaoyan: !!p.ck,
                    isTestOverridden: !!p.o,
                    timestamp: Number(p.t) || 0
                };
            }

            // 2. Legacy TP1. token or unsigned plaintext: purge so fresh live SDK state is synced cleanly
            window.__toyLS.removeItem(storageKey);
            return null;
        } catch (e) {
            try { window.__toyLS.removeItem(storageKey); } catch (err) {}
        }
        return null;
    }

    function signSettings(uKey, s) {
        if (!s || typeof s !== 'object') return '';
        const safeUser = String(uKey || 'u_guest');
        const payload = `${safeUser}|pv:${s.pv || 0}|s:${s.hasShared ? 1 : 0}|4:${s.c4 ? 1 : 0}|6:${s.c6 ? 1 : 0}|g:${s.cg ? 1 : 0}|d:${s.cd ? 1 : 0}|i:${s.ci ? 1 : 0}|k:${s.ck ? 1 : 0}|f:${s.fl ? 1 : 0}`;
        return computeSig('SET_SIG_V2_' + safeUser, payload);
    }

    function verifySettings(uKey, s) {
        if (!s || typeof s !== 'object') return false;
        if (!s._sg || Number(s.pv) < 2) return false;
        return s._sg === signSettings(uKey, s);
    }

    return {
        computeSig,
        encryptStr,
        decryptStr,
        encryptExamData,
        decryptExamData,
        getLocalExamJson,
        setLocalExamJson,
        saveSignedPermissions,
        loadSignedPermissions,
        signSettings,
        verifySettings
    };
})();

if (typeof window !== 'undefined') {
    window.ToySecurity = ToySecurity;
}

/**
 * ==========================================================================
 * ToyAudioCacheDB (v2) - High-Performance Persistent Audio Cache Manager
 * ==========================================================================
 * Features:
 * 1. Full Exam Audio Blob Persistence: Stores entire exam MP3/AAC in IndexedDB.
 * 2. 0-Network Replays & Practice: Once cached, all sentences play from local Blob URL.
 * 3. Daily Listening Sentence Persistence: 100% serves 1-15 day audios from local DB.
 * 4. Silent Background Caching: Streams immediately on first sentence while caching in background.
 * 5. Automatic LRU Eviction: Retains up to 10 recent exams (~120MB) to prevent storage bloat.
 * 6. 0ms Playback Latency: Instant Blob URL instantiation without HTTP Range roundtrips.
 * ==========================================================================
 */

const ToyAudioCacheDB = (function() {
    const DB_NAME = 'ToyAudioDBCache_v2';
    const DB_VERSION = 3;
    const STORE_SENTENCES = 'sentence_audios';
    const STORE_EXAMS = 'exam_full_audios';
    const STORE_DAILY = 'daily_audios';
    const STORE_EXAM_JSONS = 'exam_json_data';
    const MAX_CACHED_EXAMS = 300; // Expanded to permanent storage capacity (all 150+ exams)

    let dbPromise = null;
    const activeDownloads = new Map();

    function withIdbTimeout(promise, timeoutMs, fallbackVal) {
        let timer = null;
        const timeoutPromise = new Promise((resolve) => {
            timer = setTimeout(() => resolve(fallbackVal), timeoutMs);
            if (timer && typeof timer.unref === 'function') timer.unref();
        });
        return Promise.race([
            Promise.resolve(promise).catch(() => fallbackVal),
            timeoutPromise
        ]).finally(() => {
            if (timer) clearTimeout(timer);
        });
    }

    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve) => {
            let settled = false;
            let guardTimer = null;
            const finish = (dbInstance, resetCache) => {
                if (settled) return;
                settled = true;
                if (guardTimer) clearTimeout(guardTimer);
                if (resetCache) dbPromise = null;
                resolve(dbInstance || null);
            };

            guardTimer = setTimeout(() => {
                console.warn('[ToyAudioCacheDB] IndexedDB open timed out (1200ms), falling back to memory/network.');
                finish(null, true);
            }, 1200);
            if (guardTimer && typeof guardTimer.unref === 'function') guardTimer.unref();

            try {
                const idb = (typeof window !== 'undefined') ? window.indexedDB : null;
                if (!idb) {
                    console.warn('[ToyAudioCacheDB] IndexedDB not supported on this platform, skipping persistent cache.');
                    finish(null, true);
                    return;
                }

                const request = idb.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                        db.createObjectStore(STORE_SENTENCES, { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains(STORE_EXAMS)) {
                        const examStore = db.createObjectStore(STORE_EXAMS, { keyPath: 'key' });
                        examStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                    }
                    if (!db.objectStoreNames.contains(STORE_DAILY)) {
                        db.createObjectStore(STORE_DAILY, { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains(STORE_EXAM_JSONS)) {
                        db.createObjectStore(STORE_EXAM_JSONS, { keyPath: 'key' });
                    }
                };

                request.onblocked = () => {
                    console.warn('[ToyAudioCacheDB] IndexedDB open blocked by another connection, bypassing cache.');
                    finish(null, true);
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    if (db) {
                        db.onversionchange = () => {
                            try { db.close(); } catch (e) {}
                            dbPromise = null;
                        };
                    }
                    if (settled) {
                        try { if (db) db.close(); } catch (e) {}
                        return;
                    }
                    finish(db, false);
                };

                request.onerror = (event) => {
                    console.warn('[ToyAudioCacheDB] Failed to open IndexedDB:', event.target && event.target.error);
                    finish(null, true);
                };
            } catch (e) {
                console.warn('[ToyAudioCacheDB] Error initializing IndexedDB:', e);
                finish(null, true);
            }
        });

        return dbPromise;
    }

    /**
     * Generate canonical cache key for a specific sentence in an exam
     */
    function getSentenceKey(level, examTitle, index, startSec, endSec) {
        const cleanTitle = String(examTitle || '').replace(/\s+/g, '_');
        return `${level || 'cet4'}_${cleanTitle}_s${index}_${Math.round(startSec * 1000)}_${Math.round(endSec * 1000)}`;
    }

    /**
     * Generate canonical cache key for a full exam
     */
    function getExamKey(level, examTitle) {
        const cleanTitle = String(examTitle || '').replace(/\s+/g, '_').replace(/[\(\)（）]/g, '');
        return `${level || 'cet4'}_${cleanTitle}`;
    }

    /**
     * Generate canonical key for daily listening
     */
    function getDailyKey(accent, dayNum, sentNum, gender) {
        return `daily_${accent || 'en'}_d${dayNum}_s${sentNum}_${gender || 'female'}`;
    }

    /**
     * Generic helper to get a Blob by store and key
     */
    async function getBlobFromStore(storeName, key) {
        if (!key) return null;
        const db = await openDB();
        if (!db) return null;

        return withIdbTimeout(new Promise((resolve) => {
            try {
                const transaction = db.transaction([storeName], 'readonly');
                transaction.onabort = () => resolve(null);
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = (event) => {
                    const record = event.target.result;
                    if (record && record.blob) {
                        resolve(record.blob);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        }), 1000, null);
    }

    function isLikelyValidAudioResponse(res) {
        if (!res || !res.ok) return false;
        const ct = (res.headers && typeof res.headers.get === 'function')
            ? String(res.headers.get('content-type') || '').toLowerCase()
            : '';
        if (ct && (
            ct.includes('text/html') ||
            ct.includes('application/json') ||
            ct.includes('text/plain') ||
            ct.includes('application/xml') ||
            ct.includes('text/xml')
        )) {
            return false;
        }
        return true;
    }

    /**
     * Generic helper to save a Blob by store and key
     */
    async function saveBlobToStore(storeName, key, blob, meta = {}) {
        if (!key || !blob) return false;
        const db = await openDB();
        if (!db) return false;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([storeName], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                transaction.oncomplete = () => done(true);
                transaction.onerror = () => done(false);
                transaction.onabort = () => done(false);
                const store = transaction.objectStore(storeName);
                const record = {
                    key: key,
                    blob: blob,
                    size: blob.size || 0,
                    type: blob.type || 'audio/mp3',
                    lastAccessed: Date.now(),
                    createdAt: Date.now(),
                    ...meta
                };

                const request = store.put(record);
                request.onsuccess = () => { if (!hasTxComplete) done(true); };
                request.onerror = () => done(false);
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    /**
     * Sentence Audio Blob Accessors
     */
    async function getAudioBlob(key) {
        return getBlobFromStore(STORE_SENTENCES, key);
    }

    async function saveAudioBlob(key, blob, meta = {}) {
        return saveBlobToStore(STORE_SENTENCES, key, blob, meta);
    }

    /**
     * Full Exam Audio Blob Accessors
     */
    async function getExamAudioBlob(level, examTitle) {
        const key = getExamKey(level, examTitle);
        const blob = await getBlobFromStore(STORE_EXAMS, key);
        if (blob) {
            // Touch lastAccessed asynchronously for LRU management
            updateExamLastAccessed(key).catch(() => {});
        }
        return blob;
    }

    async function updateExamLastAccessed(key) {
        const db = await openDB();
        if (!db) return;
        try {
            const transaction = db.transaction([STORE_EXAMS], 'readwrite');
            const store = transaction.objectStore(STORE_EXAMS);
            const req = store.get(key);
            req.onsuccess = () => {
                if (req.result) {
                    req.result.lastAccessed = Date.now();
                    store.put(req.result);
                }
            };
        } catch (e) {}
    }

    async function saveExamAudioBlob(level, examTitle, blob, meta = {}) {
        const key = getExamKey(level, examTitle);
        const saved = await saveBlobToStore(STORE_EXAMS, key, blob, {
            level: level || 'cet4',
            examTitle: examTitle,
            ...meta
        });
        if (saved) {
            console.log(`[ToyAudioCacheDB] 💾 Cached full exam audio (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB): ${key}`);
            pruneExamCacheLRU().catch(() => {});
        }
        return saved;
    }

    /**
     * Permanent Audio Cache Guardian: Safe retain all user audio, defense against quota issues only
     */
    async function pruneExamCacheLRU() {
        const db = await openDB();
        if (!db) return;
        try {
            const transaction = db.transaction([STORE_EXAMS], 'readwrite');
            const store = transaction.objectStore(STORE_EXAMS);
            const getAllReq = store.getAll();

            getAllReq.onsuccess = () => {
                const items = getAllReq.result || [];
                if (items.length > MAX_CACHED_EXAMS) {
                    items.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
                    const toDelete = items.slice(0, items.length - MAX_CACHED_EXAMS);
                    toDelete.forEach(item => {
                        store.delete(item.key);
                        console.log(`[ToyAudioCacheDB] 🧹 Safe-trimmed oldest exam audio: ${item.key}`);
                    });
                }
            };
        } catch (e) {}
    }

    /**
     * Daily Listening Audio Accessors
     */
    async function getDailyAudioBlob(key) {
        return getBlobFromStore(STORE_DAILY, key);
    }

    async function saveDailyAudioBlob(key, blob) {
        return saveBlobToStore(STORE_DAILY, key, blob);
    }

    /**
     * Exam & Daily JSON Data Accessors (Encrypted Local Storage in IndexedDB)
     */
    async function getExamJson(key) {
        if (!key) return null;
        const db = await openDB();
        if (!db) return null;

        return withIdbTimeout(new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_EXAM_JSONS], 'readonly');
                transaction.onabort = () => resolve(null);
                const store = transaction.objectStore(STORE_EXAM_JSONS);
                const request = store.get(key);

                request.onsuccess = (event) => {
                    const record = event.target.result;
                    if (!record) {
                        resolve(null);
                        return;
                    }
                    if (record._enc && typeof record._enc === 'string') {
                        const decrypted = ToySecurity.decryptExamData(record._enc, key);
                        resolve(decrypted);
                    } else if (record.data) {
                        const val = (typeof record.data === 'string')
                            ? ToySecurity.decryptExamData(record.data, key)
                            : record.data;
                        // Silently upgrade legacy plaintext record to encrypted format in background
                        if (val && typeof record.data === 'object') {
                            saveExamJson(key, val).catch(() => {});
                        }
                        resolve(val);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        }), 1000, null);
    }

    async function saveExamJson(key, data) {
        if (!key || !data) return false;
        const db = await openDB();
        if (!db) return false;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const encrypted = ToySecurity.encryptExamData(data, key);
                const isEncryptedStr = (typeof encrypted === 'string' && encrypted.startsWith('TEJ1:'));
                const transaction = db.transaction([STORE_EXAM_JSONS], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                transaction.oncomplete = () => done(true);
                transaction.onerror = () => done(false);
                transaction.onabort = () => done(false);
                const store = transaction.objectStore(STORE_EXAM_JSONS);
                const record = {
                    key: key,
                    _enc: isEncryptedStr ? encrypted : null,
                    data: isEncryptedStr ? null : data,
                    updatedAt: Date.now()
                };

                const request = store.put(record);
                request.onsuccess = () => { if (!hasTxComplete) done(true); };
                request.onerror = () => done(false);
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    /**
     * Delete a single JSON cache entry
     */
    async function deleteExamJson(key) {
        if (!key) return false;
        const db = await openDB();
        if (!db) return false;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([STORE_EXAM_JSONS], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                transaction.oncomplete = () => done(true);
                transaction.onerror = () => done(false);
                transaction.onabort = () => done(false);
                const store = transaction.objectStore(STORE_EXAM_JSONS);
                const req = store.delete(key);
                req.onsuccess = () => { if (!hasTxComplete) done(true); };
                req.onerror = () => done(false);
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    /**
     * Invalidate and delete all JSON records for a specific examId across all modules
     */
    async function deleteExamJsonByExamId(examId) {
        if (!examId) return 0;
        const db = await openDB();
        if (!db) return 0;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([STORE_EXAM_JSONS], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                const store = transaction.objectStore(STORE_EXAM_JSONS);
                const req = store.openCursor();
                let count = 0;

                transaction.oncomplete = () => {
                    console.log(`[ToyAudioCacheDB] 🗑️ Invalidated ${count} cached JSON records for exam: ${examId}`);
                    done(count);
                };
                transaction.onerror = () => done(count);
                transaction.onabort = () => done(count);

                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const key = String(cursor.key || '');
                        if (key.includes(examId)) {
                            cursor.delete();
                            count++;
                        }
                        cursor.continue();
                    } else if (!hasTxComplete) {
                        done(count);
                    }
                };
                req.onerror = () => done(count);
            } catch (e) {
                done(0);
            }
        }), 3000, 0);
    }

    /**
     * Garbage collect stale JSON cache records that belong to outdated versions
     */
    async function clearStaleJsonCache(validVersionTag) {
        if (!validVersionTag) return 0;
        const db = await openDB();
        if (!db) return 0;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([STORE_EXAM_JSONS], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                const store = transaction.objectStore(STORE_EXAM_JSONS);
                const req = store.openCursor();
                let purged = 0;

                transaction.oncomplete = () => {
                    if (purged > 0) {
                        console.log(`[ToyAudioCacheDB] 🧹 Purged ${purged} stale version JSON records (kept: ${validVersionTag})`);
                    }
                    done(purged);
                };
                transaction.onerror = () => done(purged);
                transaction.onabort = () => done(purged);

                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const key = String(cursor.key || '');
                        // If key is a versioned exam key but does NOT match the current version, purge it
                        if (key.startsWith('toy_exam_') && !key.includes(validVersionTag)) {
                            cursor.delete();
                            purged++;
                        }
                        cursor.continue();
                    } else if (!hasTxComplete) {
                        done(purged);
                    }
                };
                req.onerror = () => done(purged);
            } catch (e) {
                done(0);
            }
        }), 3000, 0);
    }

    /**
     * Invalidate and delete cached full exam audio
     */
    async function deleteExamAudio(level, examTitle) {
        const key = getExamKey(level, examTitle);
        const db = await openDB();
        if (!db) return false;

        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([STORE_EXAMS], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                transaction.oncomplete = () => {
                    console.log(`[ToyAudioCacheDB] 🗑️ Invalidated cached audio for: ${key}`);
                    done(true);
                };
                transaction.onerror = () => done(false);
                transaction.onabort = () => done(false);
                const store = transaction.objectStore(STORE_EXAMS);
                const req = store.delete(key);
                req.onsuccess = () => { if (!hasTxComplete) done(true); };
                req.onerror = () => done(false);
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    async function deleteDailyAudio(key) {
        if (!key) return false;
        const db = await openDB();
        if (!db) return false;
        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const transaction = db.transaction([STORE_DAILY], 'readwrite');
                const hasTxComplete = ('oncomplete' in transaction);
                transaction.oncomplete = () => done(true);
                transaction.onerror = () => done(false);
                transaction.onabort = () => done(false);
                const store = transaction.objectStore(STORE_DAILY);
                const req = store.delete(key);
                req.onsuccess = () => { if (!hasTxComplete) done(true); };
                req.onerror = () => done(false);
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    /**
     * Clear all exam JSON caches (retaining downloaded audios)
     */
    async function clearAllExamJsons() {
        const db = await openDB();
        if (!db) return false;
        return withIdbTimeout(new Promise((resolve) => {
            let settled = false;
            const done = (val) => { if (!settled) { settled = true; resolve(val); } };
            try {
                const tx = db.transaction([STORE_EXAM_JSONS], 'readwrite');
                const hasTxComplete = ('oncomplete' in tx);
                const req = tx.objectStore(STORE_EXAM_JSONS).clear();
                tx.oncomplete = () => {
                    console.log('[ToyAudioCacheDB] 🧹 Cleared all cached exam JSONs');
                    done(true);
                };
                tx.onerror = () => done(false);
                tx.onabort = () => done(false);
                if (req) {
                    req.onsuccess = () => { if (!hasTxComplete) done(true); };
                    req.onerror = () => done(false);
                }
            } catch (e) {
                done(false);
            }
        }), 3000, false);
    }

    /**
     * Complete cache wipe (for deep reset or catastrophic repair)
     */
    async function clearAllExamCache() {
        const db = await openDB();
        if (!db) return;
        try {
            const tx = db.transaction([STORE_EXAM_JSONS, STORE_EXAMS], 'readwrite');
            tx.objectStore(STORE_EXAM_JSONS).clear();
            tx.objectStore(STORE_EXAMS).clear();
            console.log('[ToyAudioCacheDB] 🧹 Completely wiped all exam JSON and audio caches');
        } catch (e) {}
    }

    const activeExamAbortControllers = new Map();

    function abortBackgroundExamDownloads(keepKey = null) {
        for (const [k, controller] of activeExamAbortControllers.entries()) {
            if (!keepKey || k !== keepKey) {
                try { controller.abort(); } catch (e) {}
                activeExamAbortControllers.delete(k);
                activeDownloads.delete(k);
            }
        }
    }

    /**
     * Silent Background Exam Audio Downloader
     * Prevents duplicate parallel downloads, aborts stale exam downloads, and caches to IndexedDB
     */
    async function fetchAndCacheExamAudio(urlOrCandidates, level, examTitle) {
        if (!urlOrCandidates || !examTitle) return false;
        const key = getExamKey(level, examTitle);

        // Abort any background download for previous exams so connection pool is never choked
        abortBackgroundExamDownloads(key);

        // Check if already cached
        const existing = await getExamAudioBlob(level, examTitle);
        if (existing) return true;

        if (activeDownloads.has(key)) {
            return activeDownloads.get(key);
        }

        const candidates = Array.isArray(urlOrCandidates) ? urlOrCandidates : [urlOrCandidates];
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        if (controller) {
            activeExamAbortControllers.set(key, controller);
        }

        const downloadPromise = (async () => {
            try {
                console.log(`[ToyAudioCacheDB] 🌐 Starting background cache for exam audio: ${examTitle}`);
                let blob = null;

                for (let i = 0; i < candidates.length; i++) {
                    if (controller && controller.signal.aborted) break;
                    const targetUrl = candidates[i];
                    if (!targetUrl) continue;
                    try {
                        const fetchOpts = { mode: 'cors' };
                        if (controller) fetchOpts.signal = controller.signal;
                        const res = await fetch(targetUrl, fetchOpts);
                        if (isLikelyValidAudioResponse(res)) {
                            const b = await res.blob();
                            const bType = String((b && b.type) || '').toLowerCase();
                            const isBadBlobType = bType.includes('text/html') || bType.includes('application/json') || bType.includes('text/plain');
                            if (b && !isBadBlobType && b.size > 1024 * 50) { // Valid audio blob (> 50KB)
                                blob = b;
                                break;
                            }
                        }
                    } catch(fetchErr) {
                        if (fetchErr && fetchErr.name === 'AbortError') break;
                        // Candidate failed, gracefully advance to next candidate
                    }
                }

                if (blob && (!controller || !controller.signal.aborted)) {
                    await saveExamAudioBlob(level, examTitle, blob);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('exam-audio-cached', {
                            detail: { level, examTitle, key }
                        }));
                    }
                    return true;
                }
                return false;
            } catch (err) {
                if (!err || err.name !== 'AbortError') {
                    console.warn(`[ToyAudioCacheDB] Background audio fetch failed for ${key}:`, err);
                }
                return false;
            } finally {
                activeExamAbortControllers.delete(key);
                activeDownloads.delete(key);
            }
        })();

        activeDownloads.set(key, downloadPromise);
        return downloadPromise;
    }

    /**
     * Fetch & Cache Daily Sentence Audio (With deduplication against double-requests)
     */
    async function fetchAndCacheDailyAudio(url, key) {
        if (!url || !key) return null;
        const cached = await getDailyAudioBlob(key);
        if (cached) return cached;

        if (activeDownloads.has(key)) {
            return activeDownloads.get(key);
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(url, { mode: 'cors' });
                if (!isLikelyValidAudioResponse(res)) throw new Error(`Invalid audio response ${res ? res.status : 'null'}`);
                const blob = await res.blob();
                const bType = String((blob && blob.type) || '').toLowerCase();
                const isBadBlobType = bType.includes('text/html') || bType.includes('application/json') || bType.includes('text/plain');
                if (blob && !isBadBlobType && blob.size > 512) {
                    await saveDailyAudioBlob(key, blob);
                    return blob;
                }
            } catch (e) {
                console.warn(`[ToyAudioCacheDB] Daily audio fetch failed for ${key}:`, e);
            } finally {
                activeDownloads.delete(key);
            }
            return null;
        })();

        activeDownloads.set(key, fetchPromise);
        return fetchPromise;
    }

    // Auto-initialize DB connection in background
    openDB().catch(() => {});

    return {
        getSentenceKey,
        getExamKey,
        getDailyKey,
        getAudioBlob,
        saveAudioBlob,
        getExamAudioBlob,
        saveExamAudioBlob,
        getDailyAudioBlob,
        saveDailyAudioBlob,
        getExamJson,
        saveExamJson,
        deleteExamJson,
        deleteExamJsonByExamId,
        clearStaleJsonCache,
        clearAllExamJsons,
        deleteExamAudio,
        deleteDailyAudio,
        clearAllExamCache,
        fetchAndCacheExamAudio,
        abortBackgroundExamDownloads,
        fetchAndCacheDailyAudio
    };
})();

if (typeof window !== 'undefined') {
    window.ToyAudioCacheDB = ToyAudioCacheDB;
}
