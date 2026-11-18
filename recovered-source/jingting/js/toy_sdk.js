/* === js/toy_sdk.js === */
/**
 * ==========================================================================
 * Dual-Engine Cloud Sync Orchestrator: User Server + Bilibili Toy Cloud (js/toy_sdk.js)
 * ==========================================================================
 */

const USER_SERVER_API_URL = 'https://bilibilitoyassets.top/api/user_data';
const USER_SERVER_STATS_URL = 'https://bilibilitoyassets.top/api/active_stats';
let _cachedTodayActiveStats = null;
let _lastStatsFetchTime = 0;

/**
 * Fetch authoritative real-time daily active user count from backend server.
 * Completely eliminates the 100-user limit imposed by Bilibili getRankList.
 */
async function fetchTodayActiveUserCount() {
    const now = Date.now();
    if (_cachedTodayActiveStats && (now - _lastStatsFetchTime < 30000)) {
        return _cachedTodayActiveStats.today_active_users || 0;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(USER_SERVER_STATS_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data && data.code === 0 && typeof data.today_active_users === 'number') {
                _cachedTodayActiveStats = data;
                _lastStatsFetchTime = now;
                window._serverTodayActiveUsers = data.today_active_users;
                window._serverTotalUsers = data.total_users;
                return data.today_active_users;
            }
        }
    } catch(e) {
        // silent fallback
    }

    return window._serverTodayActiveUsers || 0;
}
window.fetchTodayActiveUserCount = fetchTodayActiveUserCount;


let _serverSyncDebounceTimer = null;
let isServerSyncing = false;
let _serverSyncQueued = false;
window._serverDirty = window._serverDirty || false;

/**
 * Save uncompressed, full-fidelity user learning data to User Server
 * Primary storage engine: Immune to B站 1024-byte ceiling and 128-key limits.
 */
async function syncToUserServer(immediate = false, useBeaconFallback = false) {
    const doSync = async () => {
        if (isServerSyncing && !immediate) {
            _serverSyncQueued = true;
            return;
        }
        if (useBeaconFallback && !window._serverDirty) {
            let hasPending = false;
            try { hasPending = window.__toyLS.getItem(getUserStorageKey('pending_server_sync')) === '1'; } catch(e) {}
            if (!hasPending) return;
        }
        isServerSyncing = true;
        try {
            const uKey = getCurrentUserKey();
            const vocabBridgePayload = (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.exportCloudPayload === 'function')
                ? window.VocabNotebookBridge.exportCloudPayload()
                : undefined;
            const vocabVst = (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.getVst === 'function')
                ? window.VocabNotebookBridge.getVst()
                : undefined;
            const vocabOh = (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.getOwnerHash === 'function')
                ? (window.VocabNotebookBridge.getOwnerHash() || undefined)
                : undefined;

            const payload = {
                user_key: uKey,
                timestamp: Date.now(),
                data: {
                    completedExams: window.completedExams || {},
                    streakInfo: window.streakInfo || {},
                    habitStreak: (window.HabitStreak && window.HabitStreak.state) ? window.HabitStreak.state : {},
                    calendarPunches: (function() {
                        try {
                            const calKey = getUserStorageKey('calendar_custom_punches');
                            return JSON.parse(window.__toyLS.getItem(calKey) || '{}');
                        } catch(e) { return {}; }
                    })(),
                    dailyHistory: (typeof getDailyPracticeHistory === 'function') ? getDailyPracticeHistory() : {},
                    todayLog: (typeof getTodayPracticeLog === 'function') ? getTodayPracticeLog() : {},
                    todayDuration: {
                        date: (typeof getTodayDateStr === 'function' ? getTodayDateStr() : ''),
                        seconds: (typeof getTodayPracticeDuration === 'function' ? getTodayPracticeDuration() : 0)
                    },
                    totalDuration: (typeof getTotalLifetimePracticeDuration === 'function' ? getTotalLifetimePracticeDuration() : 0),
                    settings: (typeof getSerializedUserSettings === 'function') ? getSerializedUserSettings() : {},
                    vocabVst,
                    vocabOh,
                    vocabNotebookBridge: vocabBridgePayload
                }
            };

            const bodyStr = JSON.stringify(payload);
            const bodyBytes = (typeof window.utf8ByteLength === 'function') ? window.utf8ByteLength(bodyStr) : bodyStr.length * 3;
            if (useBeaconFallback && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && bodyBytes < 60000) {
                try {
                    const blob = new Blob([bodyStr], { type: 'application/json' });
                    const sent = navigator.sendBeacon(`${USER_SERVER_API_URL}?user_key=${encodeURIComponent(uKey)}`, blob);
                    if (sent) {
                        window._serverDirty = false;
                        return;
                    }
                } catch (bErr) {}
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const resp = await fetch(USER_SERVER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Key': uKey
                },
                body: bodyStr,
                keepalive: bodyBytes < 60000,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const resJson = await resp.json().catch(() => null);
                if (resJson && resJson.code === 0) {
                    window._serverDirty = false;
                    try {
                        window.__toyLS.removeItem(getUserStorageKey('pending_server_sync'));
                    } catch(e) {}
                    console.log(`[ToyUserServer] Full-fidelity cloud sync saved (${resJson.bytes_written || 0} bytes)`);
                }
            } else {
                throw new Error(`HTTP ${resp.status}`);
            }
        } catch (err) {
            console.warn('[ToyUserServer] Server sync failed / offline:', err);
            try {
                window.__toyLS.setItem(getUserStorageKey('pending_server_sync'), '1');
            } catch(e) {}
        } finally {
            isServerSyncing = false;
            if (_serverSyncQueued) {
                _serverSyncQueued = false;
                syncToUserServer(false);
            }
        }
    };

    if (immediate) {
        if (_serverSyncDebounceTimer) {
            clearTimeout(_serverSyncDebounceTimer);
            _serverSyncDebounceTimer = null;
        }
        await doSync();
    } else {
        if (_serverSyncDebounceTimer) {
            clearTimeout(_serverSyncDebounceTimer);
        }
        _serverSyncDebounceTimer = setTimeout(doSync, 1000);
    }
}

/**
 * Fetch full-fidelity user data from User Server
 */
async function loadFromUserServer() {
    try {
        const uKey = getCurrentUserKey();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(`${USER_SERVER_API_URL}?user_key=${encodeURIComponent(uKey)}`, {
            method: 'GET',
            headers: {
                'X-User-Key': uKey
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (getCurrentUserKey() !== uKey) return false;
        if (!resp.ok) return false;
        const resJson = await resp.json().catch(() => null);
        if (getCurrentUserKey() !== uKey) return false;
        if (!resJson || resJson.code !== 0 || !resJson.data) return false;

        const serverData = resJson.data;

        // 1. Deep CRDT merge completed exams (sub-module & question-level merge)
        if (serverData.completedExams && typeof serverData.completedExams === 'object') {
            if (!window.completedExams) window.completedExams = {};
            Object.entries(serverData.completedExams).forEach(([title, data]) => {
                if (!data) return;
                window.completedExams[title] = mergeExamRecord(window.completedExams[title], data);
            });
        }

        // 1.5 Merge embedded VocabNotebookBridge, ownerHash & paired vst token if present
        if (serverData.vocabOh && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.bindOwnerHash === 'function') {
            try {
                window.VocabNotebookBridge.bindOwnerHash(serverData.vocabOh, false);
            } catch (e) {}
        }
        if (serverData.vocabVst && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.bindVst === 'function') {
            try {
                window.VocabNotebookBridge.bindVst(serverData.vocabVst, false);
            } catch (e) {}
        }
        if (serverData.vocabNotebookBridge && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.mergeCloudPayload === 'function') {
            try {
                window.VocabNotebookBridge.mergeCloudPayload(serverData.vocabNotebookBridge, true, false);
            } catch (e) {}
        }

        // 2. Merge habit streak & calendar punches first (so dates are populated for consecutive streak calculation)
        if (serverData.habitStreak && typeof serverData.habitStreak === 'object') {
            mergeHabitStreakData(serverData.habitStreak);
        }
        if (serverData.calendarPunches && typeof serverData.calendarPunches === 'object') {
            mergeCalendarPunchesData(serverData.calendarPunches);
        }

        // 3. Merge streak info
        if (serverData.streakInfo && typeof serverData.streakInfo === 'object') {
            const sDays = (typeof serverData.streakInfo.days === 'number' && serverData.streakInfo.days > 0)
                ? serverData.streakInfo.days
                : (serverData.streakInfo.streak || 1);
            const lDays = window.streakInfo 
                ? ((typeof window.streakInfo.days === 'number' && window.streakInfo.days > 0) ? window.streakInfo.days : (window.streakInfo.streak || 1))
                : 1;
            const calcDays = (typeof getCalculatedTotalCumulativeDays === 'function')
                ? getCalculatedTotalCumulativeDays()
                : 0;
            const maxDays = Math.max(sDays, lDays, calcDays);

            const sStreak = (typeof serverData.streakInfo.streak === 'number') ? serverData.streakInfo.streak : 1;
            const lStreak = (window.streakInfo && typeof window.streakInfo.streak === 'number') ? window.streakInfo.streak : 1;
            const hStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
                ? window.HabitStreak.calculateConsecutiveStreak()
                : 1;
            const consecutive = Math.max(sStreak, lStreak, hStreak);
            window.streakInfo = {
                streak: consecutive,
                days: maxDays,
                lastDate: serverData.streakInfo.lastDate || window.streakInfo?.lastDate || ""
            };
        }

        // 3. Merge daily history
        if (serverData.dailyHistory && typeof serverData.dailyHistory === 'object') {
            try {
                const sHist = normalizeHistoryObj(serverData.dailyHistory);
                const lHist = getDailyPracticeHistory();
                const mergedRecent = Object.assign({}, lHist.recent, sHist.recent);
                Object.keys(mergedRecent).forEach(dKey => {
                    mergedRecent[dKey] = Math.max(lHist.recent?.[dKey] || 0, sHist.recent?.[dKey] || 0);
                });
                const mergedOlder = Math.max(lHist.older || 0, sHist.older || 0);
                const mergedHist = compressHistoryWindow({ older: mergedOlder, recent: mergedRecent });
                window.__toyLS.setItem(getUserStorageKey('daily_history'), JSON.stringify(mergedHist));
            } catch(e) {}
        }

        // 4. Merge today's log
        if (serverData.todayLog && typeof serverData.todayLog === 'object') {
            try {
                const currentToday = getTodayDateStr();
                if (serverData.todayLog.date === currentToday && typeof serverData.todayLog.questions === 'object') {
                    const localLog = getTodayPracticeLog();
                    const mergedQuestions = Object.assign({}, serverData.todayLog.questions, localLog.questions);
                    Object.entries(serverData.todayLog.questions).forEach(([qKey, qVal]) => {
                        const lVal = localLog.questions[qKey];
                        if (!lVal || (qVal?.timestamp || 0) > (lVal?.timestamp || 0)) {
                            mergedQuestions[qKey] = qVal;
                        }
                    });
                    const mergedLog = { date: currentToday, questions: mergedQuestions };
                    window.__toyLS.setItem(getUserStorageKey('today_practice_log'), JSON.stringify(mergedLog));
                    const todayTotal = Object.keys(mergedQuestions).length;
                    recordDailyPracticeCount(currentToday, todayTotal);
                }
            } catch(e) {}
        }

        // 5. Merge practice durations
        if (serverData.todayDuration && typeof serverData.todayDuration === 'object') {
            try {
                const currentToday = getTodayDateStr();
                if (serverData.todayDuration.date === currentToday && typeof serverData.todayDuration.seconds === 'number') {
                    const localSec = getTodayPracticeDuration();
                    const maxSec = Math.max(localSec, serverData.todayDuration.seconds);
                    window.__toyLS.setItem(getUserStorageKey('today_practice_duration'), JSON.stringify({ date: currentToday, seconds: maxSec }));
                }
            } catch(e) {}
        }
        if (typeof serverData.totalDuration === 'number' && serverData.totalDuration > 0) {
            try {
                const localTotal = getTotalLifetimePracticeDuration();
                window.__toyLS.setItem(getUserStorageKey('total_practice_duration'), String(Math.max(localTotal, serverData.totalDuration)));
            } catch(e) {}
        }

        // 6. Merge user settings
        if (serverData.settings && typeof serverData.settings === 'object') {
            try {
                applySerializedUserSettings(serverData.settings);
            } catch(e) {}
        }

        // Persist merged state into localStorage
        try {
            if (typeof safeLocalStorageSet === 'function') {
                safeLocalStorageSet(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
                safeLocalStorageSet(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
            } else {
                window.__toyLS.setItem(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
                window.__toyLS.setItem(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
            }
        } catch(e) {}

        console.log(`[ToyUserServer] Successfully loaded user data from server for ${uKey}`);
        return true;
    } catch (e) {
        console.warn('[ToyUserServer] loadFromUserServer error:', e);
        return false;
    }
}

let isCloudSyncing = false;
let _hasCompletedFullCloudSyncOnce = false;

/**
 * Trigger pending cloud sync if previous requests failed due to network / timeout
 */
async function triggerPendingCloudSync() {
    try {
        const hasServerPending = window.__toyLS.getItem(getUserStorageKey('pending_server_sync'));
        if (hasServerPending === '1') {
            await syncToUserServer(true);
        }
    } catch(e) {}
    if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.flushPendingSync === 'function') {
        try {
            window.VocabNotebookBridge.flushPendingSync();
        } catch(e) {}
    }
    if (isCloudSyncing) return;
    try {
        const hasPending = window.__toyLS.getItem(getUserStorageKey('pending_cloud_sync'));
        if (hasPending === '1') {
            await saveUserCloudData(null, true);
        }
    } catch(e) {}
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        triggerPendingCloudSync();
        if (typeof refreshUserCloudDataIncremental === 'function') {
            refreshUserCloudDataIncremental().catch(() => {});
        }
    });
}

let _cloudSyncDebounceTimer = null;
let _pendingSyncExams = new Set();
let _knownCloudCeKeys = new Set();
let _cloudStorageRetryCount = 0;
const MAX_CLOUD_STORAGE_RETRIES = 3;
const MAX_CLOUD_CE_KEYS = 100;


/**
 * Execute actual batch synchronization to Bilibili Cloud Storage
 * Spec constraints: keys <= 128 bytes, values <= 1024 UTF-8 bytes, max 128 keys per Toy
 */
async function executeCloudStorageSync() {
    if (!window.toy || typeof window.toy.setCloudStorage !== 'function') return;
    if (typeof window.isToySdkRateLimited === 'function' && window.isToySdkRateLimited()) {
        const waitMs = Math.max(800, (window._toySdkRateLimitedUntil || 0) - Date.now() + 100);
        if (_cloudSyncDebounceTimer) clearTimeout(_cloudSyncDebounceTimer);
        _cloudSyncDebounceTimer = setTimeout(executeCloudStorageSync, waitMs);
        return;
    }
    if (isCloudSyncing) {
        _cloudSyncDebounceTimer = setTimeout(executeCloudStorageSync, 800);
        return;
    }
    isCloudSyncing = true;
    const byteLen = (s) => (typeof window.utf8ByteLength === 'function') ? window.utf8ByteLength(s) : String(s || '').length * 3;
    try {
        const items = {};
        items['toy_streak'] = JSON.stringify(window.streakInfo || {});
        items['toy_history'] = JSON.stringify(getDailyPracticeHistory());
        items['toy_today_log'] = serializeTodayLogForCloud(getTodayPracticeLog());
        items['toy_today_duration'] = JSON.stringify({ date: getTodayDateStr(), seconds: getTodayPracticeDuration() });
        items['toy_total_duration'] = String(getTotalLifetimePracticeDuration());
        items['toy_settings'] = JSON.stringify(getSerializedUserSettings());

        // Sync compact VocabNotebookBridge favorites & confirmed vst pairing token for cross-device fallback
        if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.exportCompactFavoritesForCloud === 'function') {
            try {
                const canWriteVst = (typeof window.VocabNotebookBridge.canSyncVstToBiliCloud !== 'function') || window.VocabNotebookBridge.canSyncVstToBiliCloud();
                if (canWriteVst && typeof window.VocabNotebookBridge.getVst === 'function') {
                    const vst = window.VocabNotebookBridge.getVst();
                    if (vst && byteLen(vst) <= 64) {
                        items['toy_vocab_vst'] = vst;
                    }
                }
                const vfStr = window.VocabNotebookBridge.exportCompactFavoritesForCloud();
                if (vfStr && byteLen(vfStr) <= 1024) {
                    items['toy_vocab_favs'] = vfStr;
                }
            } catch (e) {}
        }

        // Sync HabitStreak & Calendar Punches for cross-device consistency
        if (window.HabitStreak && window.HabitStreak.state) {
            const hsObj = Object.assign({}, window.HabitStreak.state);
            let hsStr = JSON.stringify(hsObj);
            if (byteLen(hsStr) > 1024 && Array.isArray(hsObj.makeupPunchedDates)) {
                hsObj.makeupPunchedDates = hsObj.makeupPunchedDates.slice(-40);
                hsStr = JSON.stringify(hsObj);
            }
            if (byteLen(hsStr) <= 1024) {
                items['toy_habit_streak'] = hsStr;
            }
        }
        try {
            const calKey = getUserStorageKey('calendar_custom_punches');
            let calPunches = window.__toyLS.getItem(calKey) || '{}';
            if (byteLen(calPunches) > 1024) {
                const parsedCal = JSON.parse(calPunches);
                const recentCalKeys = Object.keys(parsedCal).filter(k => parsedCal[k]).sort().slice(-50);
                const trimmedCal = {};
                recentCalKeys.forEach(k => { trimmedCal[k] = true; });
                calPunches = JSON.stringify(trimmedCal);
            }
            if (byteLen(calPunches) <= 1024) {
                items['toy_calendar_punches'] = calPunches;
            }
        } catch(e) {}

        const allTitles = getAllGlobalExamTitles();

        // 1. Build compact master summary table of exams (Guaranteed <= 1024 UTF-8 bytes)
        if (window.completedExams && typeof window.completedExams === 'object') {
            const summaryEntries = [];
            Object.entries(window.completedExams).forEach(([t, data]) => {
                if (data && (typeof data.score === 'number' || typeof data.writtenScore === 'number')) {
                    const idx = allTitles.indexOf(t);
                    const key = (idx >= 0) ? String(idx) : t;
                    summaryEntries.push([key, [
                        (typeof data.score === 'number') ? data.score : -1,
                        (typeof data.writtenScore === 'number') ? data.writtenScore : -1,
                        data.timestamp || Date.now()
                    ]]);
                }
            });
            summaryEntries.sort((a, b) => (b[1][2] || 0) - (a[1][2] || 0));
            const summary = {};
            for (const [k, v] of summaryEntries) {
                summary[k] = v;
                if (byteLen(JSON.stringify(summary)) > 1024) {
                    delete summary[k];
                    break;
                }
            }
            const summaryStr = JSON.stringify(summary);
            if (byteLen(summaryStr) <= 1024) {
                items['toy_exams_summary'] = summaryStr;
            }
        }

        // 2. Incremental Dirty Exam Keys vs Initial Full Sync (strictly capped to <= MAX_CLOUD_CE_KEYS total remote ce_* keys)
        const allCompletedTitles = (window.completedExams && typeof window.completedExams === 'object')
            ? Object.keys(window.completedExams)
            : [];
        allCompletedTitles.sort((a, b) => (window.completedExams[b]?.timestamp || 0) - (window.completedExams[a]?.timestamp || 0));
        const allowedTopCeKeys = new Set();
        for (const t of allCompletedTitles) {
            const idx = getExamIndex(t);
            if (idx >= 0) {
                allowedTopCeKeys.add('ce_' + idx);
                if (allowedTopCeKeys.size >= MAX_CLOUD_CE_KEYS) break;
            }
        }

        const targetTitles = new Set();
        if (_hasCompletedFullCloudSyncOnce && _pendingSyncExams.size > 0) {
            _pendingSyncExams.forEach(t => targetTitles.add(t));
        } else {
            _pendingSyncExams.forEach(t => targetTitles.add(t));
            for (const t of allCompletedTitles) {
                if (targetTitles.size >= 45) break;
                targetTitles.add(t);
            }
        }

        targetTitles.forEach(t => {
            const idx = getExamIndex(t);
            const ceKey = 'ce_' + idx;
            if (idx >= 0 && (allowedTopCeKeys.size < MAX_CLOUD_CE_KEYS || allowedTopCeKeys.has(ceKey))) {
                const serialized = serializeExamForCloud(t);
                if (serialized && byteLen(serialized) <= 1024) {
                    items[ceKey] = serialized;
                }
            }
        });

        // Strict Toy SDK Spec Safety Validation (UTF-8 byte length <= 128 for keys, <= 1024 for values)
        const validatedItems = {};
        for (const [k, v] of Object.entries(items)) {
            if (typeof k !== 'string' || k.startsWith('__') || byteLen(k) > 128 || !/^[a-zA-Z0-9_-]+$/.test(k)) {
                console.warn(`[ToySDK] Invalid CloudStorage key: "${k}", omitting.`);
                continue;
            }
            if (typeof v !== 'string') {
                continue;
            }
            const vBytes = byteLen(v);
            if (vBytes > 1024) {
                console.warn(`[ToySDK] Value for CloudStorage key "${k}" exceeds 1024 UTF-8 bytes (${vBytes} bytes), omitting to prevent batch failure.`);
                continue;
            }
            validatedItems[k] = v;
        }

        // Prune oldest ce_* keys from Bilibili Cloud Storage when total ce_* keys exceed MAX_CLOUD_CE_KEYS (100 << 128)
        const projectedCeKeys = new Set(_knownCloudCeKeys);
        Object.keys(validatedItems).forEach(k => {
            if (k.startsWith('ce_')) projectedCeKeys.add(k);
        });
        if (projectedCeKeys.size > MAX_CLOUD_CE_KEYS && typeof window.toy.removeCloudStorage === 'function') {
            const ceWithAge = Array.from(projectedCeKeys).map(ceKey => {
                const idx = parseInt(ceKey.slice(3), 10);
                const title = allTitles[idx];
                const ts = (title && window.completedExams && window.completedExams[title]?.timestamp) || 0;
                return { ceKey, ts };
            });
            ceWithAge.sort((a, b) => a.ts - b.ts);
            const evictCount = projectedCeKeys.size - MAX_CLOUD_CE_KEYS;
            const keysToRemove = ceWithAge.slice(0, evictCount).map(x => x.ceKey);
            keysToRemove.forEach(rk => {
                delete validatedItems[rk];
                _knownCloudCeKeys.delete(rk);
            });
            if (keysToRemove.length > 0) {
                try {
                    await (window.callToySdkWithTimeout
                        ? window.callToySdkWithTimeout(() => window.toy.removeCloudStorage(keysToRemove), 3500)
                        : window.toy.removeCloudStorage(keysToRemove));
                } catch (remErr) {}
            }
        }

        if (Object.keys(validatedItems).length > 0) {
            const setRes = await (window.callToySdkWithTimeout
                ? window.callToySdkWithTimeout(() => window.toy.setCloudStorage(validatedItems), 5000)
                : window.toy.setCloudStorage(validatedItems));
            if (setRes && (setRes.code === 307044 || setRes.code === '307044')) {
                const rlErr = new Error('Rate limited (307044)');
                rlErr.code = 307044;
                throw rlErr;
            }
            Object.keys(validatedItems).forEach(k => {
                if (k.startsWith('ce_')) _knownCloudCeKeys.add(k);
            });
        }

        if (getAllGlobalExamTitles().length > 0 || Object.keys(window.completedExams || {}).length === 0) {
            _hasCompletedFullCloudSyncOnce = true;
            _pendingSyncExams.clear();
        }
        _cloudStorageRetryCount = 0;
        try {
            window.__toyLS.removeItem(getUserStorageKey('pending_cloud_sync'));
        } catch(e) {}
    } catch (e) {
        const isRateLimited = (e && (e.code === 307044 || e.code === '307044' || (e.type === 'http_error' && e.code === 307044)));
        if (isRateLimited) {
            _cloudStorageRetryCount++;
            const backoffDelay = 1500 * Math.pow(2, Math.min(_cloudStorageRetryCount, 4));
            if (typeof window.markToySdkRateLimited === 'function') {
                window.markToySdkRateLimited(backoffDelay);
            }
            if (_cloudStorageRetryCount <= MAX_CLOUD_STORAGE_RETRIES) {
                console.warn(`[ToySDK] 云存储写入触发频控限流 (307044)，执行指数退避，将在 ${backoffDelay}ms 后第 ${_cloudStorageRetryCount} 次重试...`);
                setTimeout(() => {
                    executeCloudStorageSync();
                }, backoffDelay);
            } else {
                console.warn('[ToySDK] 云存储退避重试已达上限，已标记本地脏数据，将在下次网络空闲时恢复同步。');
                _cloudStorageRetryCount = 0;
                try {
                    window.__toyLS.setItem(getUserStorageKey('pending_cloud_sync'), '1');
                } catch(e2) {}
            }
        } else {
            console.log('[ToySDK] setCloudStorage offline / error:', e);
            _cloudStorageRetryCount = 0;
            try {
                window.__toyLS.setItem(getUserStorageKey('pending_cloud_sync'), '1');
            } catch(e2) {}
        }
    } finally {
        isCloudSyncing = false;
    }
}

/**
 * Save user learning progress & streak info with 1.5s trailing debounce
 */
async function saveUserCloudData(specificExamTitle = null, immediate = false) {
    window._serverDirty = true;
    if (specificExamTitle && window.completedExams && window.completedExams[specificExamTitle]) {
        window.completedExams[specificExamTitle].timestamp = Date.now();
    }
    // 1. Always save full state into account-isolated localStorage for instant offline access
    try {
        if (typeof safeLocalStorageSet === 'function') {
            safeLocalStorageSet(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
            safeLocalStorageSet(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
            safeLocalStorageSet(getUserStorageKey('daily_history'), JSON.stringify(getDailyPracticeHistory()));
        } else {
            window.__toyLS.setItem(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
            window.__toyLS.setItem(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
            window.__toyLS.setItem(getUserStorageKey('daily_history'), JSON.stringify(getDailyPracticeHistory()));
        }
    } catch (e) {
        console.log('[Storage] localStorage info:', e);
    }

    if (specificExamTitle) {
        _pendingSyncExams.add(specificExamTitle);
    }

    // 2. Dual Engine Storage: Primary full-fidelity uncompressed storage to User Server
    syncToUserServer(immediate);

    // 3. Secondary fallback sync to Bilibili Toy Cloud Storage (if available)
    if (!window.toy || typeof window.toy.setCloudStorage !== 'function') return;

    if (immediate) {
        if (_cloudSyncDebounceTimer) {
            clearTimeout(_cloudSyncDebounceTimer);
            _cloudSyncDebounceTimer = null;
        }
        await executeCloudStorageSync();
    } else {
        if (_cloudSyncDebounceTimer) {
            clearTimeout(_cloudSyncDebounceTimer);
        }
        _cloudSyncDebounceTimer = setTimeout(executeCloudStorageSync, 1500);
    }
}

window.saveUserCloudData = saveUserCloudData;
window.flushPendingCloudSync = executeCloudStorageSync;

// Auto-flush pending cloud storage sync when leaving / hiding view (throttled to 1s to collapse visibilitychange + pagehide + beforeunload)
let _lastHiddenTimestamp = 0;
let _lastHideFlushTimestamp = 0;

function flushAllPendingSyncOnHide(useBeacon = false) {
    const now = Date.now();
    if (useBeacon && (now - _lastHideFlushTimestamp < 1000)) return;
    if (useBeacon) _lastHideFlushTimestamp = now;

    if (typeof commitActivePracticeTime === 'function' && window.activePracticeStartTime) {
        commitActivePracticeTime();
    }
    syncToUserServer(true, useBeacon);
    if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.flushPendingSync === 'function') {
        window.VocabNotebookBridge.flushPendingSync(useBeacon);
    }
    if (_cloudSyncDebounceTimer) {
        clearTimeout(_cloudSyncDebounceTimer);
        _cloudSyncDebounceTimer = null;
        executeCloudStorageSync();
    }
}

window.addEventListener('beforeunload', () => {
    flushAllPendingSyncOnHide(true);
});
window.addEventListener('pagehide', () => {
    _lastHiddenTimestamp = Date.now();
    flushAllPendingSyncOnHide(true);
});
window.addEventListener('pageshow', (e) => {
    if (typeof checkMidnightRollover === 'function') checkMidnightRollover();
    if (e.persisted || (_lastHiddenTimestamp > 0 && (Date.now() - _lastHiddenTimestamp > 1200))) {
        if (typeof refreshUserCloudDataIncremental === 'function') {
            refreshUserCloudDataIncremental().catch(() => {});
        }
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        _lastHiddenTimestamp = Date.now();
        flushAllPendingSyncOnHide(true);
    } else if (document.visibilityState === 'visible') {
        if (typeof checkMidnightRollover === 'function') checkMidnightRollover();
        if (_lastHiddenTimestamp > 0 && (Date.now() - _lastHiddenTimestamp > 1200)) {
            if (typeof refreshUserCloudDataIncremental === 'function') {
                refreshUserCloudDataIncremental().catch(() => {});
            }
        }
    }
});


/**
 * Load user learning data from Bilibili Cloud Storage (Fallback Engine)
 */
async function loadFromBilibiliCloudStorage(skipSharedVocabPull = false) {
    if (!window.toy || typeof window.toy.getCloudStorage !== 'function') return false;
    if (typeof window.isToySdkRateLimited === 'function' && window.isToySdkRateLimited()) return false;
    try {
        const targetUserKey = getCurrentUserKey();
        const allTitles = getAllGlobalExamTitles();
        const res = await (window.callToySdkWithTimeout
            ? window.callToySdkWithTimeout(() => window.toy.getCloudStorage(), 4000)
            : window.toy.getCloudStorage());
        if (getCurrentUserKey() !== targetUserKey) return false;
        if (res && (res.code === 307044 || res.code === '307044')) {
            if (typeof window.markToySdkRateLimited === 'function') window.markToySdkRateLimited(10000);
            return false;
        }
        if (res && typeof res === 'object') {
            if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.markInitialCloudReadDone === 'function') {
                try { window.VocabNotebookBridge.markInitialCloudReadDone(); } catch (e) {}
            }
            const keys = Object.keys(res);
            if (keys.length > 0) {
                keys.forEach(k => {
                    if (/^ce_\d+$/.test(k)) _knownCloudCeKeys.add(k);
                });
                // Restore paired vst token & compact VocabNotebookBridge favorites (with oh) if present
                if (res.toy_vocab_vst && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.bindVst === 'function') {
                    try {
                        window.VocabNotebookBridge.bindVst(res.toy_vocab_vst, false);
                    } catch (e) {}
                }
                if (res.toy_vocab_favs && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.mergeCompactFavoritesFromCloud === 'function') {
                    try {
                        window.VocabNotebookBridge.mergeCompactFavoritesFromCloud(res.toy_vocab_favs, false);
                    } catch (e) {}
                }
                if (!skipSharedVocabPull && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.pullFromSharedCloudServer === 'function') {
                    window.VocabNotebookBridge.pullFromSharedCloudServer().catch(() => {});
                }

                // Restore HabitStreak & Calendar Punches first
                if (res.toy_habit_streak) {
                    try {
                        mergeHabitStreakData(JSON.parse(res.toy_habit_streak));
                    } catch(e) {}
                }
                if (res.toy_calendar_punches) {
                    try {
                        mergeCalendarPunchesData(JSON.parse(res.toy_calendar_punches));
                    } catch(e) {}
                }

                // Restore Cumulative Check-in Days
                if (res.toy_streak || res.toy_streak_info) {
                    try {
                        const cloudStreak = JSON.parse(res.toy_streak || res.toy_streak_info);
                        if (cloudStreak && (typeof cloudStreak.streak === 'number' || typeof cloudStreak.days === 'number')) {
                            const localDays = window.streakInfo 
                                ? ((typeof window.streakInfo.days === 'number' && window.streakInfo.days > 0) ? window.streakInfo.days : (window.streakInfo.streak || 0)) 
                                : 0;
                            const cloudDays = (typeof cloudStreak.days === 'number' && cloudStreak.days > 0) ? cloudStreak.days : (cloudStreak.streak || 0);
                            const calcDays = (typeof getCalculatedTotalCumulativeDays === 'function') ? getCalculatedTotalCumulativeDays() : 0;
                            const maxDays = Math.max(localDays, cloudDays, calcDays, 1);

                            const sStreak = (typeof cloudStreak.streak === 'number') ? cloudStreak.streak : 1;
                            const lStreak = (window.streakInfo && typeof window.streakInfo.streak === 'number') ? window.streakInfo.streak : 1;
                            const hStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
                                ? window.HabitStreak.calculateConsecutiveStreak()
                                : 1;
                            const consecutive = Math.max(sStreak, lStreak, hStreak);

                            window.streakInfo = {
                                streak: consecutive,
                                days: maxDays,
                                lastDate: cloudStreak.lastDate || window.streakInfo?.lastDate || ""
                            };
                        }
                    } catch(e) {}
                }

                // Restore Daily History
                if (res.toy_history) {
                    try {
                        const cloudHist = normalizeHistoryObj(JSON.parse(res.toy_history));
                        const localHist = getDailyPracticeHistory();
                        const mergedRecent = Object.assign({}, localHist.recent, cloudHist.recent);
                        Object.keys(mergedRecent).forEach(dKey => {
                            mergedRecent[dKey] = Math.max(localHist.recent?.[dKey] || 0, cloudHist.recent?.[dKey] || 0);
                        });
                        const mergedOlder = Math.max(localHist.older || 0, cloudHist.older || 0);
                        const mergedHist = compressHistoryWindow({ older: mergedOlder, recent: mergedRecent });
                        window.__toyLS.setItem(getUserStorageKey('daily_history'), JSON.stringify(mergedHist));
                    } catch(e) {}
                }

                // Restore and Merge Today Practice Log across devices (expanding compact #<idx>#<qId> keys)
                if (res.toy_today_log) {
                    try {
                        const cloudTodayLog = JSON.parse(res.toy_today_log);
                        const currentToday = getTodayDateStr();
                        if (cloudTodayLog && cloudTodayLog.date === currentToday && typeof cloudTodayLog.questions === 'object') {
                            const expandedCloudQs = (typeof hydrateTodayLogFromCloud === 'function')
                                ? hydrateTodayLogFromCloud(cloudTodayLog)
                                : cloudTodayLog.questions;
                            const localLog = getTodayPracticeLog();
                            const mergedQuestions = Object.assign({}, expandedCloudQs, localLog.questions);
                            Object.entries(expandedCloudQs).forEach(([qKey, qVal]) => {
                                const lVal = localLog.questions[qKey];
                                if (!lVal || (qVal?.timestamp || 0) > (lVal?.timestamp || 0)) {
                                    mergedQuestions[qKey] = qVal;
                                }
                            });
                            const mergedLog = { date: currentToday, questions: mergedQuestions };
                            window.__toyLS.setItem(getUserStorageKey('today_practice_log'), JSON.stringify(mergedLog));
                            recordDailyPracticeCount(currentToday, Object.keys(mergedQuestions).length);
                        }
                    } catch(e) {}
                }

                // Restore and Merge Practice Duration
                if (res.toy_today_duration) {
                    try {
                        const cloudTodayDur = JSON.parse(res.toy_today_duration);
                        const currentToday = getTodayDateStr();
                        if (cloudTodayDur && cloudTodayDur.date === currentToday && typeof cloudTodayDur.seconds === 'number') {
                            const localSec = getTodayPracticeDuration();
                            const maxSec = Math.max(localSec, cloudTodayDur.seconds);
                            window.__toyLS.setItem(getUserStorageKey('today_practice_duration'), JSON.stringify({ date: currentToday, seconds: maxSec }));
                        }
                    } catch(e) {}
                }
                if (res.toy_total_duration) {
                    try {
                        const cloudTotal = parseFloat(res.toy_total_duration);
                        if (!isNaN(cloudTotal) && cloudTotal > 0) {
                            const localTotal = getTotalLifetimePracticeDuration();
                            window.__toyLS.setItem(getUserStorageKey('total_practice_duration'), String(Math.max(localTotal, cloudTotal)));
                        }
                    } catch(e) {}
                }

                // Restore Partitioned keys ce_0 .. ce_350 first so resetAt tombstones are in place before summary merge
                Object.entries(res).forEach(([k, v]) => {
                    const match = k.match(/^ce_(\d+)$/);
                    if (match && typeof v === 'string') {
                        const idx = parseInt(match[1], 10);
                        const title = allTitles[idx];
                        if (title) {
                            try {
                                const compact = JSON.parse(v);
                                const existingExam = (window.completedExams && window.completedExams[title]) || {};
                                const cloudExam = (typeof hydrateExamFromCloud === 'function')
                                    ? hydrateExamFromCloud(title, compact, existingExam)
                                    : null;
                                if (cloudExam) {
                                    window.completedExams[title] = mergeExamRecord(window.completedExams[title], cloudExam);
                                }
                            } catch(e) {}
                        }
                    }
                });

                // Restore Master Exams Summary (mergeExamRecord automatically honors resetAt timestamps)
                if (res.toy_exams_summary) {
                    try {
                        const summary = JSON.parse(res.toy_exams_summary);
                        if (summary && typeof summary === 'object') {
                            Object.entries(summary).forEach(([key, val]) => {
                                const title = /^\d+$/.test(key) ? allTitles[parseInt(key, 10)] : key;
                                if (title && Array.isArray(val)) {
                                    const [s, ws, t] = val;
                                    const summaryRecord = { timestamp: t || 0 };
                                    if (typeof s === 'number' && s >= 0) summaryRecord.score = s;
                                    if (typeof ws === 'number' && ws >= 0) summaryRecord.writtenScore = ws;
                                    window.completedExams[title] = mergeExamRecord(window.completedExams[title], summaryRecord);
                                }
                            });
                        }
                    } catch(e) {}
                }

                // Restore user preferences
                if (res.toy_settings) {
                    try {
                        applySerializedUserSettings(JSON.parse(res.toy_settings));
                    } catch(e) {}
                }
                return true;
            }
        }
        return false;
    } catch (e) {
        const isRateLimited = (e && (e.code === 307044 || e.code === '307044' || (e.type === 'http_error' && e.code === 307044)));
        if (isRateLimited && typeof window.markToySdkRateLimited === 'function') {
            window.markToySdkRateLimited(10000);
        }
        console.log('[ToySDK] getCloudStorage info:', e);
        return false;
    }
}

function hydrateActiveViewsAfterCloudSync() {
    try {
        if (typeof window.hydrateWrittenArenaAnnotations === 'function') window.hydrateWrittenArenaAnnotations();
        if (window.currentExamTitle && window.completedExams && window.completedExams[window.currentExamTitle]) {
            const examRec = window.completedExams[window.currentExamTitle];
            const ansReset = examRec.answersResetAt || 0;
            const cAns = examRec.answers;
            if (typeof userAnswers === 'object' && userAnswers) {
                if (ansReset > 0) {
                    Object.keys(userAnswers).forEach(k => {
                        if ((userAnswers[k]?.ts || 0) <= ansReset) delete userAnswers[k];
                    });
                }
                if (cAns && typeof cAns === 'object') {
                    Object.entries(cAns).forEach(([k, v]) => {
                        if (!v) return;
                        const cur = userAnswers[k];
                        if (!cur || (v.ts || 0) >= (cur.ts || 0)) {
                            if (v._deleted) delete userAnswers[k];
                            else userAnswers[k] = Object.assign({}, v);
                        }
                    });
                }
            }
            if (typeof activeView !== 'undefined' && activeView === 'quiz' && typeof renderQuestion === 'function') {
                renderQuestion(window.currentQIndex || 0, { preserveScroll: true });
            }
        }
        if (window.currentWrittenExamTitle && window.completedExams && window.completedExams[window.currentWrittenExamTitle]) {
            const wRec = window.completedExams[window.currentWrittenExamTitle];
            const wReset = wRec.writtenResetAt || 0;
            const wAns = wRec.writtenAnswers;
            if (typeof userWrittenAnswers === 'object' && userWrittenAnswers) {
                if (!userWrittenAnswers[window.currentWrittenExamTitle]) userWrittenAnswers[window.currentWrittenExamTitle] = {};
                const targetMap = userWrittenAnswers[window.currentWrittenExamTitle];
                if (wReset > 0) {
                    Object.keys(targetMap).forEach(k => {
                        if ((targetMap[k]?.ts || 0) <= wReset) delete targetMap[k];
                    });
                }
                if (wAns && typeof wAns === 'object') {
                    Object.entries(wAns).forEach(([k, v]) => {
                        if (!v) return;
                        const cur = targetMap[k];
                        if (!cur || (v.ts || 0) >= (cur.ts || 0)) {
                            if (v._deleted) delete targetMap[k];
                            else targetMap[k] = Object.assign({}, v);
                        }
                    });
                }
            }
            if (typeof activeView !== 'undefined' && activeView === 'written-arena' && typeof renderWrittenQuestion === 'function') {
                const passageCard = document.getElementById('written-passage-card');
                if (passageCard) passageCard._renderedPassageKey = '';
                renderWrittenQuestion(window.currentWrittenQIndex || 0, { preserveScroll: true });
            }
        }
    } catch (e) {
        console.warn('[ToySDK] hydrateActiveViewsAfterCloudSync warning:', e);
    }
}
window.hydrateActiveViewsAfterCloudSync = hydrateActiveViewsAfterCloudSync;

async function loadUserCloudData(preserveInMemory = false) {
    const targetUserKey = getCurrentUserKey();
    const inMemorySnapshot = (preserveInMemory && window.completedExams && typeof window.completedExams === 'object')
        ? JSON.parse(JSON.stringify(window.completedExams))
        : {};
    if (!preserveInMemory) {
        window.completedExams = {};
        window.streakInfo = { streak: 1, lastDate: "" };
    }
    try {
        const localExams = window.__toyLS.getItem(getUserStorageKey('completed_exams'));
        if (localExams) {
            const parsedLocal = JSON.parse(localExams);
            if (parsedLocal && typeof parsedLocal === 'object') {
                Object.entries(parsedLocal).forEach(([title, examData]) => {
                    window.completedExams[title] = mergeExamRecord(window.completedExams[title], examData);
                });
            }
        }
        Object.entries(inMemorySnapshot).forEach(([title, examData]) => {
            window.completedExams[title] = mergeExamRecord(window.completedExams[title], examData);
        });
        const localStreak = window.__toyLS.getItem(getUserStorageKey('streak_info'));
        if (localStreak) window.streakInfo = Object.assign({}, window.streakInfo || {}, JSON.parse(localStreak));
    } catch (e) {}
    hydrateActiveViewsAfterCloudSync();
    // 先恢复 UserServer 与 B站原生云存储中的权威配对令牌 (vst / oh)，再拉取跨端共享生词全量云桶，根治新设备冷启动并发竞态
    const syncTasks = [loadFromUserServer()];
    if (window.toy && typeof window.toy.getCloudStorage === 'function') {
        window._initialBootCloudLoadDone = true;
        syncTasks.push(loadFromBilibiliCloudStorage(true));
    }

    await Promise.allSettled(syncTasks);

    if (getCurrentUserKey() === targetUserKey && window.VocabNotebookBridge && typeof window.VocabNotebookBridge.pullFromSharedCloudServer === 'function') {
        await window.VocabNotebookBridge.pullFromSharedCloudServer().catch(() => {});
    }

    // Abort if active user switched while awaiting network responses
    if (getCurrentUserKey() !== targetUserKey) return;

    // 3. Final atomic write of merged state to account-isolated localStorage
    try {
        if (typeof safeLocalStorageSet === 'function') {
            safeLocalStorageSet(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
            safeLocalStorageSet(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
        } else {
            window.__toyLS.setItem(getUserStorageKey('completed_exams'), JSON.stringify(window.completedExams || {}));
            window.__toyLS.setItem(getUserStorageKey('streak_info'), JSON.stringify(window.streakInfo || {}));
        }
    } catch(e) {}

    // 4. Reactive UI Refresh with merged cloud data
    try {
        const calcStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
            ? window.HabitStreak.calculateConsecutiveStreak()
            : 1;
        const maxStreak = Math.max(calcStreak, window.streakInfo?.streak || 1, (window.HabitStreak && window.HabitStreak.state?.streakCount) || 1);
        
        const calcDays = (typeof getCalculatedTotalCumulativeDays === 'function') ? getCalculatedTotalCumulativeDays() : 0;
        const maxDays = Math.max((window.streakInfo && window.streakInfo.days) || 1, calcDays);

        if (window.HabitStreak && window.HabitStreak.state) {
            window.HabitStreak.state.streakCount = maxStreak;
            if (typeof window.HabitStreak.saveToLocal === 'function') {
                window.HabitStreak.saveToLocal(false);
            }
            if (typeof window.HabitStreak.syncStreakDisplay === 'function') {
                window.HabitStreak.syncStreakDisplay();
            }
        }

        if (!window.streakInfo) {
            window.streakInfo = { streak: maxStreak, days: maxDays, lastDate: (typeof getTodayDateStr === 'function' ? getTodayDateStr() : "") };
        } else {
            window.streakInfo.streak = maxStreak;
            window.streakInfo.days = maxDays;
        }

        try {
            const sKey = getUserStorageKey('streak_info');
            if (typeof safeLocalStorageSet === 'function') {
                safeLocalStorageSet(sKey, JSON.stringify(window.streakInfo));
            } else {
                window.__toyLS.setItem(sKey, JSON.stringify(window.streakInfo));
            }
        } catch(e) {}

        hydrateActiveViewsAfterCloudSync();
        if (typeof updateHomeCalendar === 'function') updateHomeCalendar();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof renderLobbyGrid === 'function') renderLobbyGrid();
        if (typeof renderWrittenLobbyGrid === 'function') renderWrittenLobbyGrid();
        if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid();
    } catch(e) {}
}

async function refreshUserCloudDataIncremental() {
    return loadUserCloudData(true);
}
window.refreshUserCloudDataIncremental = refreshUserCloudDataIncremental;


function resetCloudSyncTimersForSwitch() {
    if (_cloudSyncDebounceTimer) {
        clearTimeout(_cloudSyncDebounceTimer);
        _cloudSyncDebounceTimer = null;
    }
    if (_serverSyncDebounceTimer) {
        clearTimeout(_serverSyncDebounceTimer);
        _serverSyncDebounceTimer = null;
    }
    _serverSyncQueued = false;
    window._serverDirty = false;
    if (_pendingSyncExams) {
        _pendingSyncExams.clear();
    }
    if (_knownCloudCeKeys) {
        _knownCloudCeKeys.clear();
    }
    _hasCompletedFullCloudSyncOnce = false;
}
window.resetCloudSyncTimersForSwitch = resetCloudSyncTimersForSwitch;
window.syncToUserServer = syncToUserServer;
window.loadFromUserServer = loadFromUserServer;
window.triggerPendingCloudSync = triggerPendingCloudSync;
window.executeCloudStorageSync = executeCloudStorageSync;
window.flushAllPendingSyncOnHide = flushAllPendingSyncOnHide;
window.loadFromBilibiliCloudStorage = loadFromBilibiliCloudStorage;
window.loadUserCloudData = loadUserCloudData;
