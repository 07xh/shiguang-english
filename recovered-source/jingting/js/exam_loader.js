/* === js/exam_loader.js === */
/**
 * ==========================================================================
 * Dynamic On-Demand Exam Data Loader (Optimized for Mobile WebView & Bilibili Toy)
 * Features:
 * 1. 0ms Instant Local Manifest Startup + Background Remote Sync
 * 2. Version-Aware Automatic Cache Invalidation (Cache-Busting via ?v= query)
 * 3. Modular On-Demand JSON Loading (Prioritizes ~3KB modular endpoints)
 * 4. Silent Background Prefetching Engine (prefetchExamModule)
 * 5. Robust Multi-Tier Offline & Local Storage Fallbacks
 * ==========================================================================
 */

window.TOY_DATA_VERSION = '20261108_v6.1';

// ⚡ Validation helper to guarantee exam question stems are authentic English
function isExamDataValid(data, moduleType) {
    if (!data) return false;
    if (moduleType === 'dictation') {
        const dictArr = Array.isArray(data.dictation) ? data.dictation : (Array.isArray(data) ? data : null);
        if (!dictArr || dictArr.length === 0) return false;
    }
    if (moduleType === 'listening') {
        const listArr = Array.isArray(data.listening) ? data.listening : (Array.isArray(data) ? data : null);
        if (!listArr || listArr.length === 0) return false;
    }
    if (moduleType === 'written' || moduleType === 'all') {
        const written = data.written || data;
        const careful = written?.reading?.careful_reading;
        if (careful && Array.isArray(careful)) {
            for (const p of careful) {
                for (const q of (p.questions || [])) {
                    const en = (q.question || q.question_text || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
                    const zh = (q.question_zh || q.question_text_zh || '').trim();
                    // If careful reading question lacks English stem but has Chinese, it is an invalid legacy cache!
                    if (!en && zh) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}
window.isExamDataValid = isExamDataValid;

function hasNonEmptyObject(obj) {
    return Boolean(obj && typeof obj === 'object' && Object.keys(obj).length > 0);
}

function hasValidModulePayload(data, moduleType) {
    if (!data || typeof data !== 'object' || !isExamDataValid(data, moduleType)) return false;
    const hasListening = Array.isArray(data.listening) && data.listening.length > 0;
    const hasDictation = Array.isArray(data.dictation) && data.dictation.length > 0;
    const w = (data.written && typeof data.written === 'object') ? data.written : data;
    const hasWritten = Boolean(
        (Array.isArray(w.questions) && w.questions.length > 0) ||
        hasNonEmptyObject(w.reading) ||
        hasNonEmptyObject(w.writing) ||
        hasNonEmptyObject(w.translation) ||
        hasNonEmptyObject(w.language_use) ||
        (typeof w.paper_stem === 'string' && w.paper_stem.trim().length > 0)
    );
    if (moduleType === 'listening') return hasListening;
    if (moduleType === 'dictation') return hasDictation;
    if (moduleType === 'written') return hasWritten;
    return hasListening || hasDictation || hasWritten;
}
window.hasValidModulePayload = hasValidModulePayload;

// ⚡ Global Listening Dictation Deduplication Helper
// Official exams (e.g. Gaokao) broadcast each audio dialogue twice ("每段对话读两遍").
// Deduplicate to ensure users only practice unique sentences once.
window.deduplicateDictationSentences = function(sentences) {
    if (!Array.isArray(sentences) || sentences.length <= 1) return sentences || [];
    const seen = new Set();
    const unique = [];
    const getNorm = (t) => (t || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const getWords = (t) => (t || '').toLowerCase().match(/[a-z0-9]+/g) || [];

    for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i];
        if (!s || !s.text) continue;
        const norm = getNorm(s.text);
        if (!norm) continue;
        if (seen.has(norm)) continue;

        // Check for near-duplicate within the same group (ASR transcription variants between Pass 1 and Pass 2)
        const words = getWords(s.text);
        let isNearDup = false;
        for (let j = 0; j < unique.length; j++) {
            const u = unique[j];
            if (u.group && s.group && u.group === s.group) {
                const uWords = getWords(u.text);
                if (Math.abs(words.length - uWords.length) <= 2 && words.length >= 6) {
                    let matches = 0;
                    for (let w of words) if (uWords.includes(w)) matches++;
                    if (matches / Math.max(words.length, uWords.length) >= 0.85) {
                        isNearDup = true;
                        break;
                    }
                }
            }
        }

        if (!isNearDup) {
            seen.add(norm);
            unique.push(s);
        }
    }
    return unique.map((s, idx) => ({ ...s, index: idx + 1 }));
};

// Purge legacy and stale cache keys on startup
try {
    for (let i = window.__toyLS.length - 1; i >= 0; i--) {
        const key = window.__toyLS.key(i);
        if (key && (key.startsWith('toy_exam_v6_') || key.startsWith('toy_exam_20260829_v1'))) {
            window.__toyLS.removeItem(key);
        }
    }
} catch(e) {}

window.EXAM_OSS_CONFIG = {
    baseUrl: 'https://bilibilitoyassets.top/',
    backupUrl: 'https://bilibilitoyassets.top/',
    fallbackLocal: true
};

window.EXAMS_MAP = window.EXAMS_MAP || {};
window.CLOZE_EXAMS_MAP = window.CLOZE_EXAMS_MAP || {};
window.WRITTEN_EXAMS_MAP = window.WRITTEN_EXAMS_MAP || {};
window.EXAM_ID_MAP = window.EXAM_ID_MAP || {};

const loadedExamsCache = new Map();
const activeJsonFetchPromises = new Map();
const preloadedImageUrls = new Set();

function persistExamCacheAsync(cacheKeyModule, cacheKeyFull, cacheKeyAll, moduleType, data) {
    if (!data || !cacheKeyModule || !hasValidModulePayload(data, moduleType)) return;
    Promise.resolve().then(async () => {
        try {
            if (window.ToySecurity && typeof window.ToySecurity.setLocalExamJson === 'function') {
                window.ToySecurity.setLocalExamJson(cacheKeyModule, data);
                if (moduleType === 'all') {
                    window.ToySecurity.setLocalExamJson(cacheKeyFull, data);
                }
            } else {
                try {
                    window.__toyLS.setItem(cacheKeyModule, JSON.stringify(data));
                } catch (e) {
                    try { window.__toySS.setItem(cacheKeyModule, JSON.stringify(data)); } catch (err) {}
                }
            }
        } catch (e) {}

        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.saveExamJson === 'function') {
            try {
                await window.ToyAudioCacheDB.saveExamJson(cacheKeyModule, data);
                if (moduleType === 'all' || (data.listening && data.dictation && data.written)) {
                    window.ToyAudioCacheDB.saveExamJson(cacheKeyFull, data).catch(() => {});
                    window.ToyAudioCacheDB.saveExamJson(cacheKeyAll, data).catch(() => {});
                }
            } catch (e) {}
        }
    });
}

function preloadWrittenVisuals(writtenPayload) {
    if (!writtenPayload || typeof window === 'undefined') return;
    const questions = Array.isArray(writtenPayload.questions) ? writtenPayload.questions : [];
    if (questions.length === 0) return;
    const ossBaseUrl = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
        ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '')
        : 'https://bilibilitoyassets.top';
    const isLocalHost = Boolean(window.location && (
        window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    ));
    questions.forEach(q => {
        if (!q || !q.image_url) return;
        const cleanRel = String(q.image_url).replace(/^\//, '');
        const targetUrl = isLocalHost
            ? q.image_url
            : (cleanRel.startsWith('http') ? cleanRel : `${ossBaseUrl}/${cleanRel}`);
        if (!targetUrl || preloadedImageUrls.has(targetUrl)) return;
        preloadedImageUrls.add(targetUrl);
        const scheduleImg = window.requestIdleCallback || ((cb) => setTimeout(cb, 180));
        scheduleImg(() => {
            try {
                const img = new Image();
                img.decoding = 'async';
                img.src = targetUrl;
            } catch (e) {}
        });
    });
}

const PROTECTED_USER_PREF_KEYS = new Set([
    'toy_exam_mode',
    'toy_daily_accent',
    'toy_daily_repeat_count',
    'toy_daily_design_variant'
]);

function isEvictableExamCacheKey(k, includeManifest = false) {
    if (!k || PROTECTED_USER_PREF_KEYS.has(k)) return false;
    if (k.startsWith('toy_exam_') || k.startsWith('toy_daily_')) return true;
    return Boolean(includeManifest && k.startsWith('toy_manifest_'));
}

// ⚡ 1. App Lifecycle Guardian (Wipes obsolete legacy cache when version bumps)
(async function checkVersionAndCleanCache() {
    try {
        const storedAppVer = window.__toyLS.getItem('toy_app_code_ver');
        if (storedAppVer !== window.TOY_DATA_VERSION) {
            // Force clean all stale exam caches across localStorage (preserving user preference keys)
            for (let i = window.__toyLS.length - 1; i >= 0; i--) {
                const k = window.__toyLS.key(i);
                if (isEvictableExamCacheKey(k, true)) {
                    window.__toyLS.removeItem(k);
                }
            }
            // Clear IndexedDB exam JSON caches to guarantee latest authentic question stems
            if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.clearAllExamJsons === 'function') {
                await window.ToyAudioCacheDB.clearAllExamJsons();
            }
            window.__toyLS.setItem('toy_app_code_ver', window.TOY_DATA_VERSION);
            console.log('[ExamLoader] App package updated to ' + window.TOY_DATA_VERSION + '. Stale caches wiped cleanly.');
        }
    } catch(e) {}
})();

function getActiveExamManifest(level) {
    let activeLevel = level || window.currentExamLevel || 'cet4';
    if (activeLevel === 'daily') activeLevel = 'cet4';
    if (window.EXAMS_MANIFEST && Array.isArray(window.EXAMS_MANIFEST[activeLevel])) {
        return window.EXAMS_MANIFEST[activeLevel];
    }
    return [];
}

function findExamMeta(title, level) {
    if (!title) return null;
    const list = getActiveExamManifest(level);
    let found = Array.isArray(list) ? list.find(m => m && (m.title === title || m.examId === title)) : null;
    if (found) {
        if (!found.level && level) found.level = level;
        return found;
    }
    if (window.EXAMS_MANIFEST && typeof window.EXAMS_MANIFEST === 'object') {
        for (const k of Object.keys(window.EXAMS_MANIFEST)) {
            const arr = window.EXAMS_MANIFEST[k];
            if (Array.isArray(arr)) {
                const m = arr.find(item => item && (item.title === title || item.examId === title));
                if (m) {
                    if (!m.level) m.level = k;
                    return m;
                }
            }
        }
    }
    return null;
}

// ⚡ 3. UI Inline Micro Loading & Top Slim Progress Bar (Zero-Backdrop Architecture)
let _topProgressActiveCount = 0;
let _topProgressHideTimer = null;

function showTopSlimProgressBar() {
    _topProgressActiveCount++;
    if (_topProgressHideTimer) {
        clearTimeout(_topProgressHideTimer);
        _topProgressHideTimer = null;
    }
    let bar = document.getElementById('top-slim-progress-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'top-slim-progress-bar';
        bar.className = 'top-slim-progress-bar';
        bar.innerHTML = '<div class="top-slim-progress-fill"></div>';
        document.body.appendChild(bar);
    }
    bar.classList.remove('finished');
    bar.classList.add('active');
}

function hideTopSlimProgressBar() {
    _topProgressActiveCount = Math.max(0, _topProgressActiveCount - 1);
    if (_topProgressActiveCount > 0) return;
    const bar = document.getElementById('top-slim-progress-bar');
    if (bar) {
        bar.classList.add('finished');
        if (_topProgressHideTimer) clearTimeout(_topProgressHideTimer);
        _topProgressHideTimer = setTimeout(() => {
            _topProgressHideTimer = null;
            if (_topProgressActiveCount === 0) {
                bar.classList.remove('active', 'finished');
            }
        }, 220);
    }
}

function setCardInlineLoading(title, isLoading) {
    if (!title) return;
    const safeTitle = (window.CSS && typeof CSS.escape === 'function')
        ? CSS.escape(title)
        : title.replace(/["\\]/g, '\\$&');
    let cards = [];
    try {
        cards = document.querySelectorAll(`.exam-card[data-exam-title="${safeTitle}"]`);
    } catch(e) {
        cards = Array.from(document.querySelectorAll('.exam-card')).filter(c => c.dataset.examTitle === title);
    }
    cards.forEach(card => {
        const tag = card.querySelector('.status-tag');
        if (!tag) return;
        if (isLoading) {
            if (!card.dataset.originalTagHtml) {
                card.dataset.originalTagHtml = tag.innerHTML;
            }
            tag.classList.add('loading-inline');
            tag.innerHTML = '<span class="inline-spinner-ring"></span> 加载中';
        } else {
            tag.classList.remove('loading-inline');
            if (card.dataset.originalTagHtml) {
                tag.innerHTML = card.dataset.originalTagHtml;
                delete card.dataset.originalTagHtml;
            }
        }
    });
}

function showExamLoadingSpinner(title = '') {
    showTopSlimProgressBar();
    if (title && typeof title === 'string' && !title.startsWith('正在')) {
        setCardInlineLoading(title, true);
    }
}

function hideExamLoadingSpinner(title = '') {
    hideTopSlimProgressBar();
    if (title && typeof title === 'string' && !title.startsWith('正在')) {
        setCardInlineLoading(title, false);
    } else {
        document.querySelectorAll('.status-tag.loading-inline').forEach(tag => {
            const card = tag.closest('.exam-card');
            if (card && card.dataset.originalTagHtml) {
                tag.classList.remove('loading-inline');
                tag.innerHTML = card.dataset.originalTagHtml;
                delete card.dataset.originalTagHtml;
            }
        });
    }
}

// ⚡ 4. On-Demand Data Loader with Cache-Busting & Prioritization
async function ensureExamDataLoaded(title, level = null, moduleType = 'all', forceFresh = false) {
    if (!title) return false;
    
    // Check in-memory state (bypass if forceFresh requested)
    if (!forceFresh) {
        if (moduleType === 'listening' && Array.isArray(window.EXAMS_MAP[title]) && window.EXAMS_MAP[title].length > 0) return true;
        if (moduleType === 'dictation' && Array.isArray(window.CLOZE_EXAMS_MAP[title]) && window.CLOZE_EXAMS_MAP[title].length > 0) return true;
        if (moduleType === 'written' && window.WRITTEN_EXAMS_MAP[title] && hasValidModulePayload(window.WRITTEN_EXAMS_MAP[title], 'written')) return true;
        if (moduleType === 'all' && Array.isArray(window.EXAMS_MAP[title]) && window.EXAMS_MAP[title].length > 0 && Array.isArray(window.CLOZE_EXAMS_MAP[title]) && window.CLOZE_EXAMS_MAP[title].length > 0 && window.WRITTEN_EXAMS_MAP[title] && hasValidModulePayload(window.WRITTEN_EXAMS_MAP[title], 'written')) return true;
    }
    
    const meta = findExamMeta(title, level);
    const examId = meta ? meta.examId : title;
    const examLevel = meta ? meta.level : (level || window.currentExamLevel || 'cet4');
    
    // Version-scoped primary cache keys (Ensures new code version never reads obsolete legacy cache)
    const cacheKeyModule = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId + '_' + moduleType;
    const cacheKeyFull = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId;
    const cacheKeyAll = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId + '_all';
    
    // Unversioned legacy keys for checking & validating
    const legacyKeyModule = 'toy_exam_' + examLevel + '_' + examId + '_' + moduleType;
    const legacyKeyFull = 'toy_exam_' + examLevel + '_' + examId;

    if (!forceFresh) {
        // ⚡ 1. Ultra-fast synchronous localStorage / sessionStorage check (<0.3ms, zero IPC latency on Mobile/Tablet/PC)
        try {
            const readLocalJson = (k) => (window.ToySecurity && typeof window.ToySecurity.getLocalExamJson === 'function')
                ? window.ToySecurity.getLocalExamJson(k)
                : (function() { const r = window.__toyLS.getItem(k); return r ? JSON.parse(r) : null; })();

            let data = readLocalJson(cacheKeyModule) 
                    || readLocalJson(cacheKeyFull) 
                    || readLocalJson(cacheKeyAll);

            if (!data) {
                const legacyParsed = readLocalJson(legacyKeyModule) || readLocalJson(legacyKeyFull);
                if (legacyParsed) {
                    if (isExamDataValid(legacyParsed, moduleType)) {
                        data = legacyParsed;
                    } else {
                        window.__toyLS.removeItem(legacyKeyModule);
                        window.__toyLS.removeItem(legacyKeyFull);
                    }
                }
            }

            if (data) {
                if (hasValidModulePayload(data, moduleType)) {
                    injectExamData(title, data);
                    if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.saveExamJson === 'function') {
                        window.ToyAudioCacheDB.saveExamJson(cacheKeyModule, data).catch(() => {});
                    }
                    return true;
                } else {
                    window.__toyLS.removeItem(cacheKeyModule);
                    window.__toyLS.removeItem(cacheKeyFull);
                    window.__toyLS.removeItem(cacheKeyAll);
                }
            }
        } catch(e) {}

        // ⚡ 2. Check permanent IndexedDB in parallel with single 1100ms timeout guard
        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.getExamJson === 'function') {
            try {
                let idbRaceTimer = null;
                const idbLookupPromise = Promise.all([
                    window.ToyAudioCacheDB.getExamJson(cacheKeyModule),
                    window.ToyAudioCacheDB.getExamJson(cacheKeyFull),
                    window.ToyAudioCacheDB.getExamJson(cacheKeyAll),
                    window.ToyAudioCacheDB.getExamJson(legacyKeyModule),
                    window.ToyAudioCacheDB.getExamJson(legacyKeyFull)
                ]);
                const idbResults = await Promise.race([
                    idbLookupPromise,
                    new Promise((resolve) => {
                        idbRaceTimer = setTimeout(() => resolve(null), 1100);
                        if (idbRaceTimer && typeof idbRaceTimer.unref === 'function') idbRaceTimer.unref();
                    })
                ]);
                if (idbRaceTimer) clearTimeout(idbRaceTimer);

                if (Array.isArray(idbResults)) {
                    let idbData = idbResults[0] || idbResults[1] || idbResults[2] || null;
                    if (!idbData) {
                        const legacyData = idbResults[3] || idbResults[4] || null;
                        if (legacyData && isExamDataValid(legacyData, moduleType)) {
                            idbData = legacyData;
                        } else if (legacyData) {
                            window.ToyAudioCacheDB.deleteExamJson(legacyKeyModule).catch(() => {});
                            window.ToyAudioCacheDB.deleteExamJson(legacyKeyFull).catch(() => {});
                        }
                    }
                    if (idbData && hasValidModulePayload(idbData, moduleType)) {
                        injectExamData(title, idbData);
                        return true;
                    }
                }
            } catch(e) {}
        }

        // ⚡ 3. Reuse in-flight speculative prefetch Promise if already downloading (bounded by 10s guard)!
        if (activeJsonFetchPromises.has(cacheKeyModule)) {
            showExamLoadingSpinner(title);
            let inflightTimer = null;
            try {
                const inflightData = await Promise.race([
                    activeJsonFetchPromises.get(cacheKeyModule),
                    new Promise((resolve) => {
                        inflightTimer = setTimeout(() => resolve(null), 10000);
                        if (inflightTimer && typeof inflightTimer.unref === 'function') inflightTimer.unref();
                    })
                ]);
                if (inflightTimer) clearTimeout(inflightTimer);
                if (inflightData && hasValidModulePayload(inflightData, moduleType)) {
                    injectExamData(title, inflightData);
                    hideExamLoadingSpinner(title);
                    return true;
                }
            } catch(e) {
                if (inflightTimer) clearTimeout(inflightTimer);
            }
            hideExamLoadingSpinner(title);
        }
    }
    
    showExamLoadingSpinner(title);
    
    const vTag = '?v=' + encodeURIComponent(window.TOY_DATA_VERSION) + (forceFresh ? ('_' + Date.now()) : '');
    const fetchUrls = [];
    const ossBase = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl) 
        ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
        : '';
    const backupBase = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.backupUrl)
        ? window.EXAM_OSS_CONFIG.backupUrl.replace(/\/$/, '') + '/'
        : '';
        
    // 1. If requesting a specific module (dictation / listening / written), prioritize modular URL!
    const paperStem = (meta && meta.paperStem) ? meta.paperStem : title;
    const isLocalDevEnv = (typeof window !== 'undefined' && window.location && (
        window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    ));
    if (moduleType && moduleType !== 'all') {
        if (isLocalDevEnv) {
            fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '/' + moduleType + '.json');
            if (examLevel === 'kaoyan') {
                fetchUrls.push('input/jsons/modules/' + moduleType + '/' + paperStem + '.json');
            }
        }
        if (ossBase) {
            fetchUrls.push(ossBase + examLevel + '/jsons/' + examId + '/' + moduleType + '.json' + vTag);
        }
        if (backupBase && backupBase !== ossBase) {
            fetchUrls.push(backupBase + examLevel + '/jsons/' + examId + '/' + moduleType + '.json' + vTag);
        }
        fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '/' + moduleType + '.json');
        if (examLevel === 'kaoyan') {
            fetchUrls.push('input/jsons/modules/' + moduleType + '/' + paperStem + '.json');
        }
    }
    
    // 2. Full exam fallback
    if (isLocalDevEnv) {
        fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '.json');
        fetchUrls.push('bucket_dist/' + examLevel + '/' + examId + '.json');
    }
    if (ossBase) {
        fetchUrls.push(ossBase + examLevel + '/jsons/' + examId + '.json' + vTag);
        fetchUrls.push(ossBase + examLevel + '/' + examId + '.json' + vTag);
    }
    if (backupBase && backupBase !== ossBase) {
        fetchUrls.push(backupBase + examLevel + '/jsons/' + examId + '.json' + vTag);
        fetchUrls.push(backupBase + examLevel + '/' + examId + '.json' + vTag);
    }
    fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '.json');
    fetchUrls.push('bucket_dist/' + examLevel + '/' + examId + '.json');
    fetchUrls.push('data/exams/' + examLevel + '/' + examId + '.json');

    const uniqueFetchUrls = Array.from(new Set(fetchUrls));
    let loadedData = null;
    let didTimeout = false;

    const networkPromise = (async () => {
        for (const url of uniqueFetchUrls) {
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => {
                didTimeout = true;
                controller.abort();
            }, 8000) : null;

            try {
                const fetchOptions = { headers: { 'Accept': 'application/json' } };
                if (controller) fetchOptions.signal = controller.signal;
                const res = await fetch(url, fetchOptions);
                if (res.ok) {
                    const parsedJson = await res.json();
                    if (hasValidModulePayload(parsedJson, moduleType)) {
                        return parsedJson;
                    }
                    console.warn('[ExamLoader] Skipped empty or invalid payload from ' + url);
                }
            } catch(err) {
                if (err && err.name === 'AbortError') {
                    console.warn('[ExamLoader] 试卷切片请求超时(>8s)已触发自动熔断: ' + url);
                } else {
                    console.warn('[ExamLoader] Failed to fetch from ' + url, err);
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        }
        return null;
    })();

    activeJsonFetchPromises.set(cacheKeyModule, networkPromise);
    try {
        loadedData = await networkPromise;
    } finally {
        activeJsonFetchPromises.delete(cacheKeyModule);
    }

    hideExamLoadingSpinner(title);

    if (loadedData && hasValidModulePayload(loadedData, moduleType)) {
        injectExamData(title, loadedData);
        // ⚡ Non-blocking background persistence to localStorage + IndexedDB (0ms UI blocking!)
        persistExamCacheAsync(cacheKeyModule, cacheKeyFull, cacheKeyAll, moduleType, loadedData);
        return true;
    } else {
        if (typeof showToyToast === 'function') {
            if (didTimeout) {
                showToyToast('⚠️ 网络连接响应超时（>10s），已自动切换离线备用缓存');
            } else {
                showToyToast('⚠️ 试卷加载遇到网络波动，请检查网络连接后重试');
            }
        }
        return false;
    }
}

// ⚡ 5. Silent Background Prefetching API (Eliminates Click Wait Time across PC, Tablet & Mobile)
async function prefetchExamModule(title, level = null, moduleType = 'dictation') {
    if (!title) return;
    if (moduleType === 'listening' && Array.isArray(window.EXAMS_MAP[title]) && window.EXAMS_MAP[title].length > 0) return;
    if (moduleType === 'dictation' && Array.isArray(window.CLOZE_EXAMS_MAP[title]) && window.CLOZE_EXAMS_MAP[title].length > 0) return;
    if (moduleType === 'written' && window.WRITTEN_EXAMS_MAP[title]) return;
    
    const meta = findExamMeta(title, level);
    if (meta && ((moduleType !== 'written' && meta.isWrittenOnly) || (moduleType === 'dictation' && meta.dictationCount === 0) || (moduleType === 'listening' && meta.listeningCount === 0))) return;
    const examId = meta ? meta.examId : title;
    const examLevel = meta ? meta.level : (level || window.currentExamLevel || 'cet4');
    const cacheKeyModule = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId + '_' + moduleType;
    const cacheKeyFull = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId;
    const cacheKeyAll = 'toy_exam_' + window.TOY_DATA_VERSION + '_' + examLevel + '_' + examId + '_all';
    const legacyKeyModule = 'toy_exam_' + examLevel + '_' + examId + '_' + moduleType;

    if (activeJsonFetchPromises.has(cacheKeyModule)) {
        return activeJsonFetchPromises.get(cacheKeyModule);
    }

    try {
        const readLocalJson = (k) => (window.ToySecurity && typeof window.ToySecurity.getLocalExamJson === 'function')
            ? window.ToySecurity.getLocalExamJson(k)
            : (function() { const r = window.__toyLS.getItem(k); return r ? JSON.parse(r) : null; })();
        const localCached = readLocalJson(cacheKeyModule) || readLocalJson(cacheKeyFull) || readLocalJson(cacheKeyAll) || readLocalJson(legacyKeyModule);
        if (localCached && hasValidModulePayload(localCached, moduleType)) {
            injectExamData(title, localCached);
            return localCached;
        }
    } catch(e) {}

    if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.getExamJson === 'function') {
        try {
            let idbRaceTimer = null;
            const idbResults = await Promise.race([
                Promise.all([
                    window.ToyAudioCacheDB.getExamJson(cacheKeyModule),
                    window.ToyAudioCacheDB.getExamJson(cacheKeyFull),
                    window.ToyAudioCacheDB.getExamJson(cacheKeyAll),
                    window.ToyAudioCacheDB.getExamJson(legacyKeyModule)
                ]),
                new Promise((resolve) => {
                    idbRaceTimer = setTimeout(() => resolve(null), 1100);
                    if (idbRaceTimer && typeof idbRaceTimer.unref === 'function') idbRaceTimer.unref();
                })
            ]);
            if (idbRaceTimer) clearTimeout(idbRaceTimer);
            const cachedIdb = Array.isArray(idbResults)
                ? (idbResults[0] || idbResults[1] || idbResults[2] || idbResults[3] || null)
                : null;
            if (cachedIdb && hasValidModulePayload(cachedIdb, moduleType)) {
                injectExamData(title, cachedIdb);
                return cachedIdb;
            }
        } catch(e) {}
    }

    if (activeJsonFetchPromises.has(cacheKeyModule)) {
        return activeJsonFetchPromises.get(cacheKeyModule);
    }

    const vTag = '?v=' + encodeURIComponent(window.TOY_DATA_VERSION);
    const ossBase = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
        ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
        : '';
    const paperStem = (meta && meta.paperStem) ? meta.paperStem : title;
    const isLocalDevEnv = (typeof window !== 'undefined' && window.location && (
        window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    ));
        
    const fetchUrls = [];
    if (isLocalDevEnv) {
        fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '/' + moduleType + '.json');
        if (examLevel === 'kaoyan') {
            fetchUrls.push('input/jsons/modules/' + moduleType + '/' + paperStem + '.json');
        }
    }
    if (ossBase) {
        fetchUrls.push(ossBase + examLevel + '/jsons/' + examId + '/' + moduleType + '.json' + vTag);
    }
    fetchUrls.push('bucket_dist/' + examLevel + '/jsons/' + examId + '/' + moduleType + '.json');
    if (examLevel === 'kaoyan') {
        fetchUrls.push('input/jsons/modules/' + moduleType + '/' + paperStem + '.json');
    }

    const uniquePrefetchUrls = Array.from(new Set(fetchUrls));
    const prefetchPromise = (async () => {
        for (const url of uniquePrefetchUrls) {
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
            try {
                const res = await fetch(url, controller ? { signal: controller.signal } : {});
                if (res.ok) {
                    const data = await res.json();
                    if (hasValidModulePayload(data, moduleType)) {
                        injectExamData(title, data);
                        persistExamCacheAsync(cacheKeyModule, cacheKeyFull, cacheKeyAll, moduleType, data);
                        return data;
                    }
                }
            } catch(e) {
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        }
        return null;
    })();

    activeJsonFetchPromises.set(cacheKeyModule, prefetchPromise);
    try {
        return await prefetchPromise;
    } finally {
        activeJsonFetchPromises.delete(cacheKeyModule);
    }
}

function bindCardSpeculativePrefetch(cardEl, title, level, moduleType) {
    if (!cardEl || !title) return;
    let prefetched = false;
    const trigger = () => {
        if (prefetched) return;
        prefetched = true;
        prefetchExamModule(title, level, moduleType).catch(() => {});
    };
    cardEl.addEventListener('pointerenter', (e) => {
        if (!e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen') {
            trigger();
        }
    }, { passive: true });
    cardEl.addEventListener('touchstart', trigger, { passive: true });
}

let _lobbyPrefetchTimer = null;
function scheduleLobbyTopPrefetch(titles, level, moduleType) {
    if (!Array.isArray(titles) || titles.length === 0) return;
    if (_lobbyPrefetchTimer) clearTimeout(_lobbyPrefetchTimer);
    const targets = titles.slice(0, 2);
    _lobbyPrefetchTimer = setTimeout(() => {
        const runIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
        runIdle(async () => {
            for (const t of targets) {
                await prefetchExamModule(t, level, moduleType).catch(() => {});
            }
        });
    }, 100);
}
window.bindCardSpeculativePrefetch = bindCardSpeculativePrefetch;
window.scheduleLobbyTopPrefetch = scheduleLobbyTopPrefetch;

// ⚡ 6. Data Injector
function injectExamData(title, data) {
    if (!data) return;
    const examTitle = data.title || data.exam_title || title;
    const keys = [examTitle];
    if (title && title !== examTitle) keys.push(title);
    
    let dictationData = data.dictation;
    if (dictationData && Array.isArray(dictationData) && typeof window.deduplicateDictationSentences === 'function') {
        dictationData = window.deduplicateDictationSentences(dictationData);
        data.dictation = dictationData;
    }

    const writtenPayload = data.written || ((data.questions || data.paper_stem || data.reading || data.writing) ? data : null);
    if (writtenPayload) {
        preloadWrittenVisuals(writtenPayload);
    }
    keys.forEach(k => {
        if (Array.isArray(data.listening) && data.listening.length > 0) window.EXAMS_MAP[k] = data.listening;
        if (Array.isArray(dictationData) && dictationData.length > 0) window.CLOZE_EXAMS_MAP[k] = dictationData;
        if (writtenPayload) window.WRITTEN_EXAMS_MAP[k] = writtenPayload;
        if (data.examId || data.exam_id) window.EXAM_ID_MAP[k] = data.examId || data.exam_id;
        loadedExamsCache.set(k, true);
    });
}

// ⚡ 7. Background Manifest Remote Synchronization & Intelligent Cloud Invalidation
async function syncRemoteManifestAsync(forceFresh = false) {
    const ossBase = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
        ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
        : '';
    if (!ossBase) return;

    // Check once per session or every 3 minutes to stay fresh with cloud changes
    if (!forceFresh) {
        try {
            const lastSyncTime = parseInt(window.__toyLS.getItem('toy_manifest_last_sync') || '0', 10);
            const lastSyncVer = window.__toyLS.getItem('toy_manifest_last_ver') || '';
            const now = Date.now();
            const THREE_MINUTES = 3 * 60 * 1000;
            if (lastSyncVer === window.TOY_DATA_VERSION && (now - lastSyncTime < THREE_MINUTES)) {
                return;
            }
        } catch (e) {}
    }

    const manifestController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const manifestTimeoutId = manifestController ? setTimeout(() => manifestController.abort(), 8000) : null;
    try {
        const vTag = encodeURIComponent(window.TOY_DATA_VERSION || 'latest') + '_' + Date.now();
        const res = await fetch(
            ossBase + 'exams_manifest.js?v=' + vTag,
            manifestController ? { signal: manifestController.signal } : {}
        );
        if (res.ok) {
            const scriptText = await res.text();
            if (manifestTimeoutId) clearTimeout(manifestTimeoutId);
            const match = scriptText.match(/window\.EXAMS_MANIFEST\s*=\s*(\{[\s\S]*?\});/);
            if (match) {
                const parsed = JSON.parse(match[1]);
                if (parsed && (parsed.cet4 || parsed.cet6 || parsed.gaokao || parsed.kaoyan || parsed.ielts)) {
                    // Extract cloud manifest version and updatedAt
                    const remoteVer = parsed.version || (scriptText.match(/window\.EXAMS_MANIFEST_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '';
                    const remoteTime = parsed.updatedAt || parseInt((scriptText.match(/window\.EXAMS_MANIFEST_UPDATED_AT\s*=\s*(\d+)/) || [])[1] || '0', 10);
                    
                    const storedCloudVer = window.__toyLS.getItem('toy_cloud_manifest_ver');
                    const storedCloudTime = window.__toyLS.getItem('toy_cloud_manifest_time');
                    const lastRemoteVer = storedCloudVer || String((window.EXAMS_MANIFEST && window.EXAMS_MANIFEST.version) || '');
                    const lastRemoteTime = parseInt(storedCloudTime || String((window.EXAMS_MANIFEST && window.EXAMS_MANIFEST.updatedAt) || '0'), 10);
                    const isFirstCloudRecord = !storedCloudVer && !storedCloudTime;
                    const isCloudUpdated = !isFirstCloudRecord && Boolean(
                        (remoteVer && lastRemoteVer && String(remoteVer) !== String(lastRemoteVer)) ||
                        (remoteTime && lastRemoteTime && remoteTime > lastRemoteTime)
                    );

                    let examVersionMap = {};
                    try {
                        examVersionMap = JSON.parse(window.__toyLS.getItem('toy_cloud_exam_versions') || '{}');
                    } catch(e) {}

                    const currentManifest = window.EXAMS_MANIFEST || {};
                    let invalidatedCount = 0;

                    // If cloud manifest bumped, invalidate all cached JSONs immediately!
                    if (isCloudUpdated) {
                        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.clearAllExamJsons === 'function') {
                            window.ToyAudioCacheDB.clearAllExamJsons().catch(() => {});
                        }
                        for (let i = window.__toyLS.length - 1; i >= 0; i--) {
                            const k = window.__toyLS.key(i);
                            if (isEvictableExamCacheKey(k, false)) {
                                window.__toyLS.removeItem(k);
                            }
                        }
                        loadedExamsCache.clear();
                        console.log(`[ExamLoader] ⚡ Global cloud update detected (ver: ${remoteVer}, time: ${remoteTime}). Stale exam caches purged.`);
                    }

                    ['cet4', 'cet6', 'gaokao', 'kaoyan', 'ielts'].forEach(lvl => {
                        if (parsed[lvl] && Array.isArray(parsed[lvl])) {
                            const localMap = new Map((currentManifest[lvl] || []).map(m => [m.examId || m.title, m]));
                            const mergedList = parsed[lvl].map(remoteItem => {
                                const id = remoteItem.examId || remoteItem.title;
                                const localItem = localMap.get(id);

                                // Check if this individual exam has been updated on cloud
                                const remoteItemVer = remoteItem.v || remoteItem.updatedAt || (isCloudUpdated ? (remoteVer || remoteTime) : null);
                                if (remoteItemVer && examVersionMap[id] && examVersionMap[id] !== remoteItemVer) {
                                    // Stale cache detected: invalidate this specific exam
                                    invalidateExamCache(remoteItem.title, lvl, id);
                                    invalidatedCount++;
                                }
                                if (remoteItemVer) {
                                    examVersionMap[id] = remoteItemVer;
                                }

                                if (localItem) {
                                    return {
                                        ...remoteItem,
                                        dictationCount: typeof localItem.dictationCount === 'number' ? localItem.dictationCount : remoteItem.dictationCount,
                                        listeningCount: typeof localItem.listeningCount === 'number' ? localItem.listeningCount : remoteItem.listeningCount,
                                        isWrittenOnly: !!(localItem.isWrittenOnly || remoteItem.isWrittenOnly)
                                    };
                                }
                                return remoteItem;
                            });

                            // Authoritative cloud manifest list with preserved local counts
                            if (mergedList.length > 0) {
                                currentManifest[lvl] = mergedList;
                            }
                        }
                    });

                    window.EXAMS_MANIFEST = currentManifest;

                    try {
                        window.__toyLS.setItem('toy_manifest_last_sync', String(Date.now()));
                        window.__toyLS.setItem('toy_manifest_last_ver', window.TOY_DATA_VERSION || '');
                        window.__toyLS.setItem('toy_cloud_exam_versions', JSON.stringify(examVersionMap));
                        if (remoteVer) window.__toyLS.setItem('toy_cloud_manifest_ver', remoteVer);
                        if (remoteTime) window.__toyLS.setItem('toy_cloud_manifest_time', String(remoteTime));
                    } catch (e) {}

                    if (invalidatedCount > 0) {
                        console.log(`[ExamLoader] ♻️ Cloud update detected: invalidated ${invalidatedCount} stale exams for fresh re-download.`);
                    } else {
                        console.log('[ExamLoader] Successfully synchronized remote manifest in background.');
                    }
                }
            }
        }
    } catch (e) {
    } finally {
        if (manifestTimeoutId) clearTimeout(manifestTimeoutId);
    }
}

/**
 * ⚡ Full User-Facing One-Click Data Sync & Repair (Preserves all user progress/scores!)
 */
window.refreshAllExamData = async function(showMessage = true) {
    if (showMessage && typeof showToyToast === 'function') {
        showToyToast('🔄 正在同步云端最新题库...');
    }
    try {
        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.clearAllExamJsons === 'function') {
            await window.ToyAudioCacheDB.clearAllExamJsons();
        }
        for (let i = window.__toyLS.length - 1; i >= 0; i--) {
            const k = window.__toyLS.key(i);
            if (isEvictableExamCacheKey(k, true)) {
                window.__toyLS.removeItem(k);
            }
        }
        loadedExamsCache.clear();
        window.EXAMS_MAP = {};
        window.CLOZE_EXAMS_MAP = {};
        window.WRITTEN_EXAMS_MAP = {};
        window.EXAM_ID_MAP = {};

        await syncRemoteManifestAsync(true /* forceFresh */);

        if (showMessage && typeof showToyToast === 'function') {
            showToyToast('✅ 题库已成功同步至最新版本！');
        }

        // Auto reload currently viewed arena or lobby if active
        const curView = window.activeView || '';
        if (curView === 'written-arena' && window.currentWrittenExamTitle && typeof window.reloadExamFromCloud === 'function') {
            const ok = await window.reloadExamFromCloud(window.currentWrittenExamTitle, window.currentExamLevel, 'written');
            if (ok && window.WRITTEN_EXAMS_MAP && window.WRITTEN_EXAMS_MAP[window.currentWrittenExamTitle]) {
                if (typeof buildWrittenQuestionsList === 'function') {
                    window.currentWrittenQuestions = currentWrittenQuestions = buildWrittenQuestionsList(window.WRITTEN_EXAMS_MAP[window.currentWrittenExamTitle]);
                }
                if (typeof renderWrittenQuestion === 'function') {
                    renderWrittenQuestion(window.currentWrittenQIndex || 0, { preserveScroll: true });
                }
            }
        } else if (curView === 'quiz' && window.currentExamTitle && typeof window.reloadExamFromCloud === 'function') {
            const ok = await window.reloadExamFromCloud(window.currentExamTitle, window.currentExamLevel, 'listening');
            if (ok && window.EXAMS_MAP && window.EXAMS_MAP[window.currentExamTitle]) {
                window.currentQuestions = currentQuestions = window.EXAMS_MAP[window.currentExamTitle];
                if (typeof renderQuestion === 'function') {
                    renderQuestion(window.currentQIndex || 0, { preserveScroll: true });
                }
            }
        } else if (curView === 'dictation-arena' && window.currentDictExamTitle) {
            if (window._isDailyListening && typeof window.startDailyDictation === 'function') {
                window.startDailyDictation(window._currentDailyDay || 1, window.currentDictIndex || 0);
            } else if (typeof window.reloadExamFromCloud === 'function') {
                const ok = await window.reloadExamFromCloud(window.currentDictExamTitle, window.currentExamLevel, 'dictation');
                if (ok && window.CLOZE_EXAMS_MAP && window.CLOZE_EXAMS_MAP[window.currentDictExamTitle]) {
                    window.currentDictSentences = window.CLOZE_EXAMS_MAP[window.currentDictExamTitle];
                    if (typeof renderDictationSentence === 'function') {
                        renderDictationSentence(window.currentDictIndex || 0, { preserveScroll: true });
                    }
                }
            }
        } else if (typeof window.reRenderActiveLobbies === 'function') {
            window.reRenderActiveLobbies();
        }
    } catch(err) {
        console.error('[ExamLoader] refreshAllExamData error:', err);
    }
};

/**
 * ⚡ Invalidate local cache for a specific exam (IndexedDB + localStorage + memory)
 */
function invalidateExamCache(title, level = null, explicitExamId = null) {
    if (!title && !explicitExamId) return;
    const meta = findExamMeta(title, level);
    const examId = explicitExamId || (meta ? meta.examId : title);
    const examLevel = level || (meta ? meta.level : window.currentExamLevel || 'cet4');
    const examTitle = meta ? meta.title : title;

    // 1. Wipe from IndexedDB
    if (window.ToyAudioCacheDB) {
        if (typeof window.ToyAudioCacheDB.deleteExamJsonByExamId === 'function') {
            window.ToyAudioCacheDB.deleteExamJsonByExamId(examId).catch(() => {});
        }
        if (typeof window.ToyAudioCacheDB.deleteExamAudio === 'function') {
            window.ToyAudioCacheDB.deleteExamAudio(examLevel, examTitle).catch(() => {});
        }
    }

    // 2. Wipe from localStorage & sessionStorage (strictly scoped to exam cache keys)
    try {
        for (let i = window.__toyLS.length - 1; i >= 0; i--) {
            const k = window.__toyLS.key(i);
            if (k && (k.startsWith('toy_exam_') || k.startsWith('toy_daily_')) && (k.includes(examId) || (examTitle && k.includes(examTitle)))) {
                window.__toyLS.removeItem(k);
            }
        }
        for (let i = window.__toySS.length - 1; i >= 0; i--) {
            const k = window.__toySS.key(i);
            if (k && (k.startsWith('toy_exam_') || k.startsWith('toy_daily_')) && (k.includes(examId) || (examTitle && k.includes(examTitle)))) {
                window.__toySS.removeItem(k);
            }
        }
    } catch(e) {}

    // 3. Wipe from in-memory cache
    if (examTitle) {
        delete window.EXAMS_MAP[examTitle];
        delete window.CLOZE_EXAMS_MAP[examTitle];
        delete window.WRITTEN_EXAMS_MAP[examTitle];
        delete window.EXAM_ID_MAP[examTitle];
        loadedExamsCache.delete(examTitle);
    }
    if (examId) {
        delete window.EXAMS_MAP[examId];
        delete window.CLOZE_EXAMS_MAP[examId];
        delete window.WRITTEN_EXAMS_MAP[examId];
        delete window.EXAM_ID_MAP[examId];
        loadedExamsCache.delete(examId);
    }
    console.log(`[ExamLoader] 🗑️ Invalidation complete for exam: ${examTitle || examId}`);
}

/**
 * ⚡ Forced reload of an exam from Cloud Server (Overwrites stale local cache)
 */
async function reloadExamFromCloud(title, level = null, moduleType = 'all') {
    if (!title) return false;
    showExamLoadingSpinner(title);
    invalidateExamCache(title, level);
    const success = await ensureExamDataLoaded(title, level, moduleType, true /* forceFresh */);
    hideExamLoadingSpinner(title);
    if (success && typeof showToyToast === 'function') {
        showToyToast('✅ 已成功从云端重新拉取最新真题数据');
    }
    return success;
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete') {
        setTimeout(syncRemoteManifestAsync, 1200);
    } else {
        window.addEventListener('load', () => setTimeout(syncRemoteManifestAsync, 1200));
    }
}

window.getActiveExamManifest = getActiveExamManifest;
window.findExamMeta = findExamMeta;
window.ensureExamDataLoaded = ensureExamDataLoaded;
window.prefetchExamModule = prefetchExamModule;
window.showExamLoadingSpinner = showExamLoadingSpinner;
window.hideExamLoadingSpinner = hideExamLoadingSpinner;
window.invalidateExamCache = invalidateExamCache;
window.reloadExamFromCloud = reloadExamFromCloud;
