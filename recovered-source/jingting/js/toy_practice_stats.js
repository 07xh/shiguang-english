/* === js/toy_practice_stats.js === */
/**
 * ==========================================================================
 * Practice Duration Tracker, Beijing Midnight Rollover & Leaderboard Score Engine (js/toy_practice_stats.js)
 * ==========================================================================
 */

/**
 * Practice Duration Tracker (刷题时长统计引擎)
 * Unit: min (以 min 为单位，精确到小数点后一位，如 12.5 min)
 * Active continuously whenever user is in 'quiz' or 'written-arena'
 */
let activePracticeStartTime = null;
let activePracticeTimer = null;
const MAX_PRACTICE_IDLE_MS = 5 * 60 * 1000; // 5 minutes strict AFK anti-idling limit
let lastPracticeInteractionTime = Date.now();

function recordPracticeInteraction() {
    const now = Date.now();
    if (now - lastPracticeInteractionTime > MAX_PRACTICE_IDLE_MS) {
        // Waking up from idle pause: do NOT bridge the idle gap
        activePracticeStartTime = now;
    }
    lastPracticeInteractionTime = now;
}

function getTodayPracticeDuration() {
    const today = getTodayDateStr();
    let maxSec = 0;
    try {
        const raw = window.__toyLS.getItem(getUserStorageKey('today_practice_duration'));
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.date === today && typeof data.seconds === 'number') {
                maxSec = Math.max(0, data.seconds);
            }
        }
    } catch (e) {}
    return maxSec;
}

function getTotalLifetimePracticeDuration() {
    let totalSec = 0;
    try {
        const currentKey = getUserStorageKey('total_practice_duration');
        const raw = window.__toyLS.getItem(currentKey);
        if (raw) {
            const val = parseFloat(raw);
            if (!isNaN(val) && val > 0) totalSec = val;
        }
    } catch (e) {}

    const todaySec = getTodayPracticeDuration();
    return Math.max(totalSec, todaySec);
}

/**
 * Strict Practice Duration Formatter for Dashboard:
 * Format practice duration in 'h' and 'min' units:
 * - < 1min: '0min'
 * - Minutes: 'Xmin' (e.g. 25min)
 * - Hours and minutes: 'Xh Ymin' (e.g. 9h 37min, 1h = 60min)
 */
function formatPracticeDuration(totalSeconds) {
    const sec = Math.floor(Math.max(0, totalSeconds || 0));
    const totalMins = Math.floor(sec / 60);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${mins}min`;
}

function formatPracticeDurationHTML(totalSeconds) {
    const sec = Math.floor(Math.max(0, totalSeconds || 0));
    const totalMins = Math.floor(sec / 60);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) {
        return mins > 0 
            ? `${hours}<small>h</small> ${mins}<small>min</small>` 
            : `${hours}<small>h</small>`;
    }
    return `${mins}<small>min</small>`;
}

/**
 * Leaderboard Exact Duration Formatter (Exact minutes and seconds, e.g. 100min30s, or 51s if < 1min)
 */
function formatRankDuration(totalSeconds) {
    const sec = Math.floor(Math.max(0, totalSeconds || 0));
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    if (mins > 0) {
        return `${mins}min${s}s`;
    }
    return `${s}s`;
}

function formatRankDurationHTML(totalSeconds) {
    const sec = Math.floor(Math.max(0, totalSeconds || 0));
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    if (mins > 0) {
        return `${mins}<small>min</small>${s}<small>s</small>`;
    }
    return `${s}<small>s</small>`;
}


try {
    Object.defineProperty(window, 'activePracticeStartTime', {
        get() { return activePracticeStartTime; },
        set(v) { activePracticeStartTime = v; },
        configurable: true
    });
} catch (e) {
    window.activePracticeStartTime = activePracticeStartTime;
}

function formatDurationMin(seconds) {
    return formatPracticeDuration(seconds);
}

function formatDurationMinNum(seconds) {
    return formatPracticeDuration(seconds);
}

function commitActivePracticeTime() {
    if (!activePracticeStartTime) return;
    const now = Date.now();
    
    // Effective end time is capped at (lastPracticeInteractionTime + 5 mins) to strictly prevent AFK idling
    const maxAllowedTime = lastPracticeInteractionTime + MAX_PRACTICE_IDLE_MS;
    const effectiveEndTime = Math.min(now, maxAllowedTime);

    let elapsedMs = 0;
    if (activePracticeStartTime < effectiveEndTime) {
        elapsedMs = effectiveEndTime - activePracticeStartTime;
    }

    activePracticeStartTime = now;
    const elapsedSec = elapsedMs / 1000;
    if (elapsedSec <= 0) return;

    const today = getTodayDateStr();
    const currentTodaySec = getTodayPracticeDuration() + elapsedSec;
    const currentTotalSec = getTotalLifetimePracticeDuration() + elapsedSec;
    window._serverDirty = true;

    try {
        window.__toyLS.setItem(getUserStorageKey('today_practice_duration'), JSON.stringify({ date: today, seconds: currentTodaySec }));
        window.__toyLS.setItem(getUserStorageKey('total_practice_duration'), String(currentTotalSec));
        const durLogKey = getUserStorageKey('daily_duration_log');
        const rawDurLog = window.__toyLS.getItem(durLogKey);
        const durLog = rawDurLog ? JSON.parse(rawDurLog) : {};
        if (durLog && typeof durLog === 'object') {
            durLog[today] = Math.round(currentTodaySec);
            const durDates = Object.keys(durLog).sort();
            if (durDates.length > 40) {
                durDates.slice(0, durDates.length - 40).forEach(d => delete durLog[d]);
            }
            window.__toyLS.setItem(durLogKey, JSON.stringify(durLog));
        }
    } catch (e) {}
}

function startPracticeTimer() {
    recordPracticeInteraction();
    if (!activePracticeStartTime) {
        activePracticeStartTime = Date.now();
    }
    if (!activePracticeTimer) {
        activePracticeTimer = setInterval(() => {
            commitActivePracticeTime();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
        }, 8000);
    }
}

function stopPracticeTimer() {
    if (activePracticeStartTime) {
        commitActivePracticeTime();
        activePracticeStartTime = null;
    }
    if (activePracticeTimer) {
        clearInterval(activePracticeTimer);
        activePracticeTimer = null;
    }
    submitUserScore(true);
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
}

window.getTodayPracticeDuration = getTodayPracticeDuration;
window.getTotalLifetimePracticeDuration = getTotalLifetimePracticeDuration;
window.formatPracticeDuration = formatPracticeDuration;
window.formatDurationMin = formatDurationMin;
window.formatDurationMinNum = formatDurationMinNum;
window.startPracticeTimer = startPracticeTimer;
window.stopPracticeTimer = stopPracticeTimer;
window.recordPracticeInteraction = recordPracticeInteraction;

// Hook window unload, interaction & visibility changes
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (activePracticeStartTime) commitActivePracticeTime();
    });

    // Global passive listeners to capture real user actions (click, tap, keydown, typing)
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'input'].forEach(evt => {
        window.addEventListener(evt, recordPracticeInteraction, { passive: true, capture: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (activePracticeStartTime) commitActivePracticeTime();
        } else {
            recordPracticeInteraction();
            if (typeof activeView !== 'undefined' && (activeView === 'quiz' || activeView === 'written-arena' || activeView === 'dictation-arena')) {
                activePracticeStartTime = Date.now();
            }
        }
    });
}

/**
 * Parse rank score (Strictly today's practice duration in seconds: exact min and s, or Xs if < 1min)
 */
function parseRankScore(scoreVal) {
    if (typeof scoreVal !== 'number' || isNaN(scoreVal) || scoreVal <= 0) {
        return { durationSec: 0, durationFormatted: '0s', durationHTML: '0<small>s</small>' };
    }
    const durationSec = Math.floor(scoreVal);
    return {
        durationSec,
        durationFormatted: formatRankDuration(durationSec),
        durationHTML: formatRankDurationHTML(durationSec)
    };
}

/**
 * Daily Practice History & Lifetime Cumulative Stats Engine
 * Uses a 30-day sliding window with older count aggregation to guarantee key size < 400 bytes.
 */
function normalizeHistoryObj(obj) {
    if (!obj || typeof obj !== 'object') {
        return { older: 0, recent: {} };
    }
    // If legacy flat format { "2026-08-20": 15, "2026-08-21": 20 }
    if (!obj.recent && !('older' in obj)) {
        return compressHistoryWindow({ older: 0, recent: Object.assign({}, obj) });
    }
    return compressHistoryWindow({
        older: typeof obj.older === 'number' ? obj.older : 0,
        recent: (obj.recent && typeof obj.recent === 'object') ? Object.assign({}, obj.recent) : {}
    });
}

function compressHistoryWindow(hist) {
    if (!hist || !hist.recent) return { older: 0, recent: {} };
    const dates = Object.keys(hist.recent).sort();
    if (dates.length > 30) {
        // Keep the newest 30 days in recent, accumulate older days into older
        const toArchive = dates.slice(0, dates.length - 30);
        toArchive.forEach(d => {
            const count = parseInt(hist.recent[d], 10) || 0;
            hist.older = (hist.older || 0) + count;
            delete hist.recent[d];
        });
    }
    // Hard size limit guard: ensure serialized JSON string stays safely under 850 UTF-8 bytes (Cloud limit 1024)
    const measureHistBytes = (obj) => {
        const s = JSON.stringify(obj);
        return (typeof window.utf8ByteLength === 'function') ? window.utf8ByteLength(s) : s.length * 3;
    };
    while (measureHistBytes(hist) > 850 && Object.keys(hist.recent).length > 5) {
        const sorted = Object.keys(hist.recent).sort();
        const oldest = sorted[0];
        hist.older = (hist.older || 0) + (parseInt(hist.recent[oldest], 10) || 0);
        delete hist.recent[oldest];
    }
    return hist;
}

function getDailyPracticeHistory() {
    try {
        const raw = window.__toyLS.getItem(getUserStorageKey('daily_history'));
        if (raw) {
            const parsed = JSON.parse(raw);
            return normalizeHistoryObj(parsed);
        }
    } catch(e) {}
    return { older: 0, recent: {} };
}

function recordDailyPracticeCount(dateStr, count) {
    const history = getDailyPracticeHistory();
    history.recent[dateStr] = count;
    const compressed = compressHistoryWindow(history);
    try {
        if (typeof safeLocalStorageSet === 'function') {
            safeLocalStorageSet(getUserStorageKey('daily_history'), JSON.stringify(compressed));
        } else {
            window.__toyLS.setItem(getUserStorageKey('daily_history'), JSON.stringify(compressed));
        }
    } catch(e) {}
}

function getTotalCumulativeQuestions() {
    const history = getDailyPracticeHistory();
    const today = getTodayDateStr();
    const todayLog = getTodayPracticeLog();
    const todayCount = Object.keys(todayLog.questions || {}).length;
    
    // Ensure today's count is recorded in history
    history.recent[today] = todayCount;

    // Sum older cumulative + all recent 30 days
    let sum = history.older || 0;
    Object.values(history.recent || {}).forEach(n => {
        const c = parseInt(n, 10);
        if (!isNaN(c) && c > 0) sum += c;
    });

    // Also compare with unique question slots in completedExams (excluding _deleted tombstones)
    let completedSlots = 0;
    if (window.completedExams && typeof window.completedExams === 'object') {
        Object.values(window.completedExams).forEach(exam => {
            if (!exam) return;
            if (exam.answers && typeof exam.answers === 'object') {
                completedSlots += Object.values(exam.answers).filter(a => a && !a._deleted).length;
            }
            if (exam.writtenAnswers && typeof exam.writtenAnswers === 'object') {
                completedSlots += Object.values(exam.writtenAnswers).filter(a => a && !a._deleted).length;
            }
            if (exam.dictationCompleted && typeof exam.dictationCompleted === 'object') {
                completedSlots += Object.values(exam.dictationCompleted).filter(Boolean).length;
            }
        });
    }

    return Math.max(sum, completedSlots);
}

window.getDailyPracticeHistory = getDailyPracticeHistory;
window.getTotalCumulativeQuestions = getTotalCumulativeQuestions;

/**
 * Strict Day-by-Day (今日) Practice Tracker
 * Uses Beijing Time (UTC+8 / Asia/Shanghai) to guarantee exact 00:00:00 midnight daily reset.
 */
function getTodayDateStr() {
    try {
        const now = new Date();
        const beijing = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
        const year = beijing.getFullYear();
        const month = String(beijing.getMonth() + 1).padStart(2, '0');
        const day = String(beijing.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch(e) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
window.getTodayDateStr = getTodayDateStr;

let _lastObservedBeijingDate = getTodayDateStr();

function checkMidnightRollover() {
    const currentToday = getTodayDateStr();
    if (_lastObservedBeijingDate && currentToday !== _lastObservedBeijingDate) {
        _lastObservedBeijingDate = currentToday;
        try {
            getTodayPracticeLog();
            getTodayPracticeDuration();
            if (window.HabitStreak && typeof window.HabitStreak.checkInToday === 'function') {
                window.HabitStreak.checkInToday();
            }
            if (typeof updateHomeCalendar === 'function') updateHomeCalendar();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
        } catch (e) {}
        return true;
    }
    _lastObservedBeijingDate = currentToday;
    return false;
}
window.checkMidnightRollover = checkMidnightRollover;

function getTodayPracticeLog() {
    const today = getTodayDateStr();
    try {
        const raw = window.__toyLS.getItem(getUserStorageKey('today_practice_log'));
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.date === today && typeof data.questions === 'object') {
                return data;
            }
        }
    } catch (e) {}

    // Auto reset to empty when past midnight 0:00
    const newLog = { date: today, questions: {} };
    try {
        window.__toyLS.setItem(getUserStorageKey('today_practice_log'), JSON.stringify(newLog));
    } catch (e) {}
    return newLog;
}

function recordTodayQuestionAnswer(examTitle, qId, isCorrect) {
    if (!examTitle || qId === undefined || qId === null) return;
    checkMidnightRollover();
    const log = getTodayPracticeLog();
    const key = `${examTitle}#${qId}`;
    log.questions[key] = {
        isCorrect: !!isCorrect,
        timestamp: Date.now()
    };
    try {
        window.__toyLS.setItem(getUserStorageKey('today_practice_log'), JSON.stringify(log));
    } catch (e) {}

    // Record into daily history
    const today = getTodayDateStr();
    const todayTotal = Object.keys(log.questions).length;
    recordDailyPracticeCount(today, todayTotal);
    window._serverDirty = true;

    if (saveCloudTimer) clearTimeout(saveCloudTimer);
    saveCloudTimer = setTimeout(() => {
        saveCloudTimer = null;
        if (typeof saveUserCloudData === 'function') {
            saveUserCloudData(null, false).catch(() => {});
        }
    }, 1500);
}

window.recordTodayQuestionAnswer = recordTodayQuestionAnswer;

/**
 * Calculate user's practice questions strictly for TODAY
 */
function getTodayPracticeStats() {
    const log = getTodayPracticeLog();
    const qList = Object.values(log.questions || {});
    const todayTotalQ = qList.length;
    let todayCorrect = 0;
    qList.forEach(q => {
        if (q && q.isCorrect) todayCorrect++;
    });

    return { todayTotalQ, todayCorrect };
}

let submitScoreTimer = null;
let saveCloudTimer = null;
let _lastSubmittedRankKey = '';
window._toySdkRateLimitedUntil = window._toySdkRateLimitedUntil || 0;

function isToySdkRateLimited() {
    return (window._toySdkRateLimitedUntil || 0) > Date.now();
}
function markToySdkRateLimited(backoffMs = 8000) {
    window._toySdkRateLimitedUntil = Math.max(window._toySdkRateLimitedUntil || 0, Date.now() + backoffMs);
}
window.isToySdkRateLimited = isToySdkRateLimited;
window.markToySdkRateLimited = markToySdkRateLimited;

/**
 * Submit user score to Leaderboard & schedule incremental cloud data sync
 * Fixes previous dead-code bug so todayDuration, totalDuration, and todayLog always sync to cloud.
 */
async function submitUserScore(immediate = false, opts = {}) {
    checkMidnightRollover();
    commitActivePracticeTime();

    const skipCloudSave = !!(opts && opts.skipCloudSave);

    // 1. Schedule incremental cloud storage & server sync unless caller only wants rank registration
    if (!skipCloudSave) {
        if (saveCloudTimer) {
            clearTimeout(saveCloudTimer);
            saveCloudTimer = null;
        }
        if (immediate) {
            saveUserCloudData(null, true).catch(() => {});
        } else {
            saveCloudTimer = setTimeout(() => {
                saveCloudTimer = null;
                saveUserCloudData(null, false).catch(() => {});
            }, 1200);
        }
    }

    // 2. Submit score to Bilibili Official Leaderboard (only when user has authorized profile)
    const uKey = getCurrentUserKey();
    if (uKey === 'u_guest' || !window.currentUserProfile || window.currentUserProfile.nickname === '同学' || window.currentUserProfile.nickname === '本地测试用户') {
        return null;
    }
    const todaySec = getTodayPracticeDuration();
    // Guarantee at least 1s score for any user active today, so they are immediately registered on B站 daily leaderboard
    const score = Math.max(1, Math.floor(todaySec));
    const rankDedupKey = `${uKey}:${getTodayDateStr()}:${score}`;

    if (submitScoreTimer) {
        clearTimeout(submitScoreTimer);
        submitScoreTimer = null;
    }

    if (isToySdkRateLimited() || _lastSubmittedRankKey === rankDedupKey) {
        return null;
    }

    const doSubmit = async () => {
        if (isToySdkRateLimited() || _lastSubmittedRankKey === rankDedupKey) return null;
        if (window.toy && typeof window.toy.submitScore === 'function') {
            try {
                const res = await (window.callToySdkWithTimeout
                    ? window.callToySdkWithTimeout(() => window.toy.submitScore({ board: 1, score: score }), 3500)
                    : window.toy.submitScore({ board: 1, score: score }));
                if (res && (res.code === 307044 || res.code === '307044')) {
                    markToySdkRateLimited(10000);
                    return null;
                }
                _lastSubmittedRankKey = rankDedupKey;
                return res;
            } catch (e) {
                const isRateLimited = (e && (e.code === 307044 || e.code === '307044' || (e.type === 'http_error' && e.code === 307044)));
                if (isRateLimited) {
                    markToySdkRateLimited(10000);
                    console.warn('[ToySDK] submitScore 触发频率限制 (307044)，静默等待下次打点以避免放大限流。');
                } else {
                    console.log('[ToySDK] submitScore info:', e);
                }
            }
        }
        return null;
    };

    if (immediate) {
        return await doSubmit();
    } else {
        submitScoreTimer = setTimeout(doSubmit, 600);
        return null;
    }
}


function resetPracticeSessionTimersForSwitch() {
    if (activePracticeTimer) {
        clearInterval(activePracticeTimer);
        activePracticeTimer = null;
    }
    activePracticeStartTime = null;
    lastPracticeInteractionTime = Date.now();
    _lastSubmittedRankKey = '';
    if (submitScoreTimer) {
        clearTimeout(submitScoreTimer);
        submitScoreTimer = null;
    }
    if (saveCloudTimer) {
        clearTimeout(saveCloudTimer);
        saveCloudTimer = null;
    }
}
window.resetPracticeSessionTimersForSwitch = resetPracticeSessionTimersForSwitch;
window.formatPracticeDurationHTML = formatPracticeDurationHTML;
window.formatRankDuration = formatRankDuration;
window.formatRankDurationHTML = formatRankDurationHTML;
window.commitActivePracticeTime = commitActivePracticeTime;
window.parseRankScore = parseRankScore;
window.normalizeHistoryObj = normalizeHistoryObj;
window.compressHistoryWindow = compressHistoryWindow;
window.recordDailyPracticeCount = recordDailyPracticeCount;
window.getTodayPracticeLog = getTodayPracticeLog;
window.getTodayPracticeStats = getTodayPracticeStats;
window.submitUserScore = submitUserScore;
