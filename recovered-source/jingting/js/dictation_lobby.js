/* === js/dictation_lobby.js === */
// ==========================================================================
// Dictation & Daily Listening Lobby Grid, Filter Bar & Startup (js/dictation_lobby.js)
// ==========================================================================

// 1. Render Dictation Lobby Grid
function renderDictationLobbyGrid(filterRange, options = {}) {
    const grid = document.getElementById('dictation-exam-grid');
    if (!grid) return;
    
    const curLvlCheck = window.currentExamLevel || 'cet4';
    let activeFilter = filterRange || window.currentDictationFilter || 'ALL';
    if (curLvlCheck === 'ielts' && activeFilter !== 'ALL' && !activeFilter.startsWith('ielts_')) {
        activeFilter = 'ALL';
    } else if (curLvlCheck !== 'ielts' && activeFilter.startsWith('ielts_')) {
        activeFilter = 'ALL';
    } else if (curLvlCheck !== 'gaokao' && activeFilter === '2008-2014') {
        activeFilter = 'ALL';
    }
    window.currentDictationFilter = activeFilter;

    const manifestList = (typeof getActiveExamManifest === 'function')
        ? getActiveExamManifest()
        : (window.CLOZE_EXAMS_MAP ? Object.keys(window.CLOZE_EXAMS_MAP).map(t => ({ title: t })) : []);

    if (!manifestList || manifestList.length === 0) {
        const retryCount = (options && typeof options._retryCount === 'number') ? options._retryCount : 0;
        if (retryCount < 40) {
            setTimeout(() => renderDictationLobbyGrid(activeFilter, Object.assign({}, options, { _retryCount: retryCount + 1 })), 50);
        } else {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; color: var(--ink-sub); font-size: 13.5px;">暂无可用精听试卷，请检查网络后重试</div>';
        }
        return;
    }

    const dictFilterBar = document.getElementById('dictation-year-filter-bar');
    if (dictFilterBar) {
        dictFilterBar.querySelectorAll('.chip-year').forEach(c => {
            c.classList.toggle('active', (c.dataset.range || 'ALL') === activeFilter);
        });
        if (typeof updateSegmentedSlider === 'function') {
            updateSegmentedSlider(dictFilterBar, !!(options && options.animateSlider));
        }
    }

    grid.innerHTML = '';

    const tier = (window.ToyPermissions && typeof window.ToyPermissions.getTier === 'function')
        ? window.ToyPermissions.getTier()
        : 0;
    const hasSharedAndFollowed = (window.ToyPermissions && window.ToyPermissions.isFollowing && window.ToyPermissions.hasShared);

    const unlockedDictTitles = [];
    const activeDictLvl = window.currentExamLevel || 'cet4';
    manifestList.forEach((item, idx) => {
        if (!item || item.isWrittenOnly || item.dictationCount === 0 || item.examId === '2024_12_cet4_set3') return;
        const title = item.title;
        const yearMatch = title.match(/(\d{4})年/);
        const y = yearMatch ? parseInt(yearMatch[1]) : (item.year || 0);
        const b = item.book || (title.match(/真题(\d+)听力/) ? parseInt(title.match(/真题(\d+)听力/)[1]) : (item.year || 0));

        if (activeFilter === '2021-2026' && !(y >= 2021 && y <= 2026)) return;
        if (activeFilter === '2015-2020' && !(y >= 2015 && y <= 2020)) return;
        if (activeFilter === '2008-2014' && !(y >= 2008 && y <= 2014)) return;
        if (activeFilter === 'ielts_18_21' && !(b >= 18 && b <= 21)) return;
        if (activeFilter === 'ielts_14_17' && !(b >= 14 && b <= 17)) return;
        if (activeFilter === 'ielts_10_13' && !(b >= 10 && b <= 13)) return;
        if (activeFilter === 'ielts_4_9' && !(b >= 4 && b <= 9)) return;

        const isDone = window.completedExams && window.completedExams[title];
        const curLevel = window.currentExamLevel || 'cet4';
        const isCharged = !!(window.ToyPermissions && (window.ToyPermissions.isCharged || window.ToyPermissions.isAuthor));
        const hasTrackUnlocked = !!(window.ToyPermissions && window.ToyPermissions.hasUnlockedTrack(curLevel));
        let statusText = '未练习';
        let isCompleted = false;
        let isLocked = (idx > 0 && !isCharged);

        const totalCount = item.dictationCount || ((window.CLOZE_EXAMS_MAP && window.CLOZE_EXAMS_MAP[title]) ? window.CLOZE_EXAMS_MAP[title].length : 70);

        if (isLocked) {
            statusText = '包月充电解锁';
        } else if (idx === 0) {
            const doneDict = isDone && isDone.dictationCompleted ? Object.keys(isDone.dictationCompleted).length : 0;
            if (isCharged) {
                if (doneDict > 0) {
                    statusText = doneDict >= totalCount ? '已满分精听 🏆' : `已练 ${doneDict}/${totalCount} 句`;
                    isCompleted = true;
                } else {
                    statusText = '未练习';
                }
            } else if (hasTrackUnlocked) {
                const part1Count = (window.ToyPermissions && typeof window.ToyPermissions._getPart1EndIndex === 'function')
                    ? (window.ToyPermissions._getPart1EndIndex(curLevel, title) + 1)
                    : 28;
                statusText = doneDict > 0 ? (doneDict >= part1Count ? 'Part 1 已练完 🏆' : `Part 1 已练 ${doneDict}/${part1Count} 句`) : 'Part 1 已解锁';
                isCompleted = doneDict > 0;
            } else {
                statusText = doneDict > 0 ? '已试做' : '免费试做 (前2句)';
                isCompleted = doneDict > 0;
            }
        } else if (isDone && isDone.dictationCompleted) {
            const doneCount = Object.keys(isDone.dictationCompleted).length;
            if (doneCount > 0) {
                statusText = doneCount >= totalCount ? '已满分精听 🏆' : `已练 ${doneCount}/${totalCount} 句`;
                isCompleted = true;
            }
        }

        const card = document.createElement('div');
        card.className = `exam-card ${isLocked ? 'is-locked-card' : ''}`;
        card.dataset.examTitle = title;
        card.innerHTML = `
            <div class="exam-card-title">${title}</div>
            <div class="exam-card-meta">
                <span class="status-tag ${isLocked ? 'locked-tag' : (isCompleted ? 'completed' : '')}">${statusText}</span>
            </div>
        `;
        if (!isLocked) {
            unlockedDictTitles.push(title);
            if (typeof window.bindCardSpeculativePrefetch === 'function') {
                window.bindCardSpeculativePrefetch(card, title, curLevel, 'dictation');
            }
        }
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        card.addEventListener('click', () => {
            const currentlyLocked = window.ToyPermissions ? !window.ToyPermissions.canAccessDictation(idx, 0, curLevel, title) : false;
            if (currentlyLocked) {
                window.ToyPermissions.showUnlockModal('dictation', { examIndex: idx, level: curLevel, examTitle: title });
                return;
            }
            if (card.classList.contains('is-activating')) return;
            card.classList.add('is-activating');
            setTimeout(() => card.classList.remove('is-activating'), 1000);
            startDictationExam(title);
        });

        grid.appendChild(card);
    });
    if (unlockedDictTitles.length > 0 && typeof window.scheduleLobbyTopPrefetch === 'function') {
        window.scheduleLobbyTopPrefetch(unlockedDictTitles, activeDictLvl, 'dictation');
    }
}

window.updateDictationLobbyGridState = function(filter) {
    const dFilter = filter || window.currentDictationFilter || 'ALL';
    renderDictationLobbyGrid(dFilter);
};

// 2. Start Dictation Exam
let _dictStartSeqId = 0;

async function startDictationExam(title, initialIndex = 0) {
    if (!title || typeof title !== 'string') return;
    const myStartSeq = ++_dictStartSeqId;
    const navSeq = window._navActionSeqId || 0;

    let meta = (typeof findExamMeta === 'function') ? findExamMeta(title) : null;
    let level = meta ? meta.level : null;
    if (!level) {
        if (title.includes('雅思') || title.toLowerCase().includes('ielts')) level = 'ielts';
        else if (title.includes('高考')) level = 'gaokao';
        else if (title.includes('六级')) level = 'cet6';
        else if (title.includes('四级')) level = 'cet4';
        else level = window.currentExamLevel || 'cet4';
    }
    window.currentExamLevel = level;

    const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(level) : [];
    const examIdx = manifestList.findIndex(m => m.title === title || m.examId === title);
    const safeExamIdx = examIdx >= 0 ? examIdx : 0;
    if (window.ToyPermissions && !window.ToyPermissions.canAccessDictation(safeExamIdx, 0, level, title)) {
        if (typeof window.ToyPermissions.shouldAwaitInitialSync === 'function' && window.ToyPermissions.shouldAwaitInitialSync()) {
            await window.ToyPermissions.ensureSynced(1200);
        }
        if (!window.ToyPermissions.canAccessDictation(safeExamIdx, 0, level, title)) {
            window.ToyPermissions.showUnlockModal('dictation', { examIndex: safeExamIdx, sentenceIndex: 0, level: level, examTitle: title });
            return;
        }
    }

    // Stop any previous exam's audio or auto-advance timers before awaiting network
    if (typeof clearDictAutoAdvance === 'function') clearDictAutoAdvance();
    if (window.DictAudioEngine && typeof window.DictAudioEngine.stop === 'function') {
        window.DictAudioEngine.stop(false);
    }

    if (typeof ensureExamDataLoaded === 'function') {
        const loaded = await ensureExamDataLoaded(title, level, 'dictation');
        if (!loaded || myStartSeq !== _dictStartSeqId || (window._navActionSeqId || 0) !== navSeq) return;
    }

    let sents = (window.CLOZE_EXAMS_MAP && window.CLOZE_EXAMS_MAP[title]) ? window.CLOZE_EXAMS_MAP[title] : [];
    if (typeof window.deduplicateDictationSentences === 'function') {
        sents = window.deduplicateDictationSentences(sents);
        if (window.CLOZE_EXAMS_MAP) window.CLOZE_EXAMS_MAP[title] = sents;
    }

    if (!sents || sents.length === 0) {
        if (typeof showToyToast === 'function') {
            showToyToast('ℹ️ 该套真题与同场次共用听力，请练习第一/二套');
        }
        return;
    }

    currentDictExamTitle = title;
    window.currentDictExamTitle = title;
    window._isDailyListening = false;
    window._currentDailyDay = 0;
    currentDictSentences = sents;
    currentDictIndex = Math.max(0, Math.min(initialIndex, sents.length - 1));
    lastRenderedSentIdx = -1;
    currentSentenceChosenIndices = null;
    window.currentSentenceSolvedTokens = {};
    dictSkeletonModeActive = false;
    dictAnswerModeActive = false;
    dictationStreak = 0;
    isDictZhVisible = false;

    // Load Audio Source with Server HTTPS + Local Fallback
    const audioPlayer = document.getElementById('dictation-audio-player');
    if (audioPlayer) {
        const PRIMARY_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
            ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
            : 'https://bilibilitoyassets.top/';
        const BACKUP_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.backupUrl)
            ? window.EXAM_OSS_CONFIG.backupUrl.replace(/\/$/, '') + '/'
            : 'https://bilibilitoyassets.top/';

        let examId = meta ? meta.examId : '';
        if (!examId && level === 'ielts') {
            const m = title.match(/(\d+).*?Test\s*(\d+)/i);
            if (m) examId = `ielts_${m[1]}_test${m[2]}`;
        }
        if (!examId) {
            examId = (window.EXAM_ID_MAP && window.EXAM_ID_MAP[title]) || title;
        }
        const cleanTitleNoLevel = title.replace('六级', '').replace('四级', '');
        const titleWithoutSet = title.replace(/\s*（第[一二三123]套\s*）|\s*\(第[一二三123]套\s*\)/g, '');
        const cleanNoLevelNoSet = cleanTitleNoLevel.replace(/\s*（第[一二三123]套\s*）|\s*\(第[一二三123]套\s*\)/g, '');
        
        let rawCandidates = [];
        if (level === 'cet4') {
            rawCandidates = [
                `${PRIMARY_BASE}cet4/audios/${encodeURIComponent(title)}.mp3`,
                `${PRIMARY_BASE}cet4/audios/${encodeURIComponent(titleWithoutSet)}.mp3`,
                `${PRIMARY_BASE}cet4/audios/${encodeURIComponent(cleanTitleNoLevel)}.mp3`,
                `${PRIMARY_BASE}cet4/audios/${encodeURIComponent(cleanNoLevelNoSet)}.mp3`,
                `${PRIMARY_BASE}cet4/audios/${encodeURIComponent(examId)}.mp3`,
                `${BACKUP_BASE}cet4/audios/${encodeURIComponent(title)}.mp3`,
                `${BACKUP_BASE}cet4/audios/${encodeURIComponent(titleWithoutSet)}.mp3`,
                `bucket_dist/cet4/audios/${title}.mp3`,
                `bucket_dist/cet4/audios/${titleWithoutSet}.mp3`,
                `bucket_dist/cet4/audios/${cleanTitleNoLevel}.mp3`
            ];
        } else if (level === 'gaokao') {
            rawCandidates = [
                `${PRIMARY_BASE}gaokao/audios/${encodeURIComponent(title)}.mp3`,
                `${PRIMARY_BASE}gaokao/audios/${encodeURIComponent(cleanTitleNoLevel)}.mp3`,
                `${PRIMARY_BASE}gaokao/audios/${encodeURIComponent(examId)}.mp3`,
                `${BACKUP_BASE}gaokao/audios/${encodeURIComponent(title)}.mp3`,
                `${BACKUP_BASE}gaokao/audios/${encodeURIComponent(cleanTitleNoLevel)}.mp3`,
                `bucket_dist/gaokao/audios/${title}.mp3`,
                `bucket_dist/gaokao/audios/${cleanTitleNoLevel}.mp3`,
                `bucket_dist/gaokao/audios/${examId}.mp3`
            ];
        } else if (level === 'ielts') {
            const rawFileBase = title.replace(/\s+/g, '').replace('Test', 'test');
            rawCandidates = [
                `${PRIMARY_BASE}ielts/audios/${examId}.mp3`,
                `${PRIMARY_BASE}ielts/audios/${encodeURIComponent(title)}.mp3`,
                `${PRIMARY_BASE}ielts/audios/${encodeURIComponent(rawFileBase)}.mp3`,
                `${BACKUP_BASE}ielts/audios/${examId}.mp3`,
                `${BACKUP_BASE}ielts/audios/${encodeURIComponent(title)}.mp3`,
                `${BACKUP_BASE}ielts/audios/${encodeURIComponent(rawFileBase)}.mp3`,
                `bucket_dist/ielts/audios/${examId}.mp3`,
                `bucket_dist/ielts/audios/${title}.mp3`,
                `bucket_dist/ielts/audios/${rawFileBase}.mp3`
            ];
        } else {
            rawCandidates = [
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(title)}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(titleWithoutSet)}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(cleanTitleNoLevel)}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(cleanNoLevelNoSet)}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(cleanTitleNoLevel.replace('听力', '真题'))}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(cleanTitleNoLevel.replace('真题', '听力'))}.mp3`,
                `${PRIMARY_BASE}cet6/audios/${encodeURIComponent(examId)}.mp3`,
                `${BACKUP_BASE}cet6/audios/${encodeURIComponent(title)}.mp3`,
                `${BACKUP_BASE}cet6/audios/${encodeURIComponent(cleanTitleNoLevel)}.mp3`,
                `bucket_dist/cet6/audios/${title}.mp3`,
                `bucket_dist/cet6/audios/${cleanTitleNoLevel}.mp3`
            ];
        }
        // Deduplicate candidates so fallback never retries identical URLs
        const candidates = Array.from(new Set(rawCandidates));

        audioPlayer.onerror = null;
        audioPlayer.preload = 'metadata';
        audioPlayer.playbackRate = dictPlaybackRate;

        // Reset audio engine to active exam in on-demand streaming mode with candidates
        if (window.DictAudioEngine) {
            await window.DictAudioEngine.resetCurrentExam(title, candidates, level);
            if (myStartSeq !== _dictStartSeqId) return;
        }
    }

    const btnConfig = document.getElementById('btn-dict-audio-config');
    if (btnConfig) {
        btnConfig.classList.add('is-hidden');
        btnConfig.style.display = 'none';
    }

    const heroStageInit = document.querySelector('.dict-hero-stage');
    if (heroStageInit && heroStageInit.classList) {
        heroStageInit.classList.remove('sentence-anim-forward', 'sentence-anim-backward');
    }
    const clozeCardInit = document.getElementById('dict-cloze-card');
    if (clozeCardInit && clozeCardInit.classList) {
        clozeCardInit.classList.remove('swipe-slide-left', 'swipe-slide-right');
    }

    switchView('dictation-arena');
    renderDictationSentence(currentDictIndex, { isArenaEntry: true });
}

// 2.5 Start Daily Dictation
async function startDailyDictation(dayNum, initialIndex = 0) {
    const dayIdx = dayNum - 1;
    if (window.ToyPermissions && !window.ToyPermissions.canAccessDaily(dayIdx, initialIndex)) {
        if (typeof window.ToyPermissions.shouldAwaitInitialSync === 'function' && window.ToyPermissions.shouldAwaitInitialSync()) {
            await window.ToyPermissions.ensureSynced(1200);
        }
        if (!window.ToyPermissions.canAccessDaily(dayIdx, initialIndex)) {
            window.ToyPermissions.showUnlockModal('daily', { examIndex: dayIdx, sentenceIndex: initialIndex, dayNum: dayNum, level: 'daily' });
            return;
        }
    }

    const myStartSeq = ++_dictStartSeqId;
    const navSeq = window._navActionSeqId || 0;
    if (typeof clearDictAutoAdvance === 'function') clearDictAutoAdvance();
    if (window.DictAudioEngine && typeof window.DictAudioEngine.stop === 'function') {
        window.DictAudioEngine.stop(false);
    }

    const title = `每日英语听力（第五期）Day ${String(dayNum).padStart(2, '0')}`;

    let data = null;
    // ⚡ 0. Check bundled in-memory dataset first (0ms latency, 100% offline & instant)
    if (window.DAILY_LISTENING_ISSUE5_DATA && window.DAILY_LISTENING_ISSUE5_DATA[dayNum]) {
        data = { dictation: window.DAILY_LISTENING_ISSUE5_DATA[dayNum] };
    }

    // ⚡ 1. Check in-memory and permanent local IndexedDB cache (0-CDN repeat egress)
    const curVer = window.TOY_DATA_VERSION || 'v2.4';
    const dailyCacheKey = `toy_daily_${curVer}_issue5_day${dayNum}`;
    const legacyDailyCacheKey = `toy_daily_issue5_day${dayNum}`;

    if (!data && window.CLOZE_EXAMS_MAP && window.CLOZE_EXAMS_MAP[title]) {
        data = { dictation: window.CLOZE_EXAMS_MAP[title] };
    }

    if (!data && window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.getExamJson === 'function') {
        try {
            data = await window.ToyAudioCacheDB.getExamJson(dailyCacheKey) 
                || await window.ToyAudioCacheDB.getExamJson(legacyDailyCacheKey);
        } catch(e) {}
    }

    if (!data) {
        try {
            if (window.ToySecurity && typeof window.ToySecurity.getLocalExamJson === 'function') {
                data = window.ToySecurity.getLocalExamJson(dailyCacheKey) || window.ToySecurity.getLocalExamJson(legacyDailyCacheKey);
            } else {
                const rawStored = window.__toyLS.getItem(dailyCacheKey) || window.__toyLS.getItem(legacyDailyCacheKey);
                if (rawStored) data = JSON.parse(rawStored);
            }
        } catch(e) {}
    }

    if (!data) {
        // Load JSON data for this day from server
        const vTag = '?v=' + encodeURIComponent(curVer) + '_' + Date.now();
        const jsonUrl = `bucket_dist/daily/issue5/jsons/day${dayNum}.json`;
        const SERVER_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
            ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
            : 'https://bilibilitoyassets.top/';
        const serverJsonUrl = `${SERVER_BASE}daily/issue5/jsons/day${dayNum}.json${vTag}`;

        try {
            const res = await fetch(jsonUrl);
            if (res.ok) {
                const parsed = await res.json();
                if (parsed && Array.isArray(parsed.dictation) && parsed.dictation.length > 0) data = parsed;
            }
        } catch(e) {}

        if (!data) {
            try {
                const res = await fetch(serverJsonUrl);
                if (res.ok) {
                    const parsed = await res.json();
                    if (parsed && Array.isArray(parsed.dictation) && parsed.dictation.length > 0) data = parsed;
                }
            } catch(e) {}
        }

        if (myStartSeq !== _dictStartSeqId) return;

        if (data && data.dictation) {
            // Save to IndexedDB permanently (Encrypted TEJ1: payload); fallback to localStorage only if IDB unavailable
            let savedIdb = false;
            if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.saveExamJson === 'function') {
                try {
                    savedIdb = await window.ToyAudioCacheDB.saveExamJson(dailyCacheKey, data);
                } catch(e) {}
            }
            if (!savedIdb) {
                if (window.ToySecurity && typeof window.ToySecurity.setLocalExamJson === 'function') {
                    window.ToySecurity.setLocalExamJson(dailyCacheKey, data);
                } else {
                    try { window.__toyLS.setItem(dailyCacheKey, JSON.stringify(data)); } catch(e) {}
                }
            }
        }
    }

    if (myStartSeq !== _dictStartSeqId || (window._navActionSeqId || 0) !== navSeq) return;
    if (!data || !data.dictation || !Array.isArray(data.dictation) || data.dictation.length === 0) {
        if (typeof showToyToast === 'function') showToyToast('⚠️ 听力数据加载失败，请检查网络后重试');
        return;
    }

    window.currentExamLevel = 'daily';
    currentDictExamTitle = title;
    window.currentDictExamTitle = title;
    window._isDailyListening = true;
    window._currentDailyDay = dayNum;
    lastRenderedSentIdx = -1;
    currentSentenceChosenIndices = null;
    window.currentSentenceSolvedTokens = {};
    dictSkeletonModeActive = false;
    dictAnswerModeActive = false;

    if (!window.CLOZE_EXAMS_MAP) window.CLOZE_EXAMS_MAP = {};
    let sents = data.dictation;
    if (typeof window.deduplicateDictationSentences === 'function') {
        sents = window.deduplicateDictationSentences(sents);
    }
    window.CLOZE_EXAMS_MAP[title] = sents;
    currentDictSentences = sents;
    currentDictIndex = Math.max(0, Math.min(initialIndex, sents.length - 1));
    dictationStreak = 0;
    isDictZhVisible = false;

    // Show top-right audio settings button in arena
    const btnConfig = document.getElementById('btn-dict-audio-config');
    if (btnConfig) {
        btnConfig.classList.remove('is-hidden');
        btnConfig.style.removeProperty('display');
    }
    updateDailyAudioSettingsUI();

    const heroStageInit = document.querySelector('.dict-hero-stage');
    if (heroStageInit && heroStageInit.classList) {
        heroStageInit.classList.remove('sentence-anim-forward', 'sentence-anim-backward');
    }
    const clozeCardInit = document.getElementById('dict-cloze-card');
    if (clozeCardInit && clozeCardInit.classList) {
        clozeCardInit.classList.remove('swipe-slide-left', 'swipe-slide-right');
    }

    switchView('dictation-arena');
    renderDictationSentence(currentDictIndex, { isArenaEntry: true });
}
window.startDailyDictation = startDailyDictation;

function renderDailyLobbyGrid() {
    const grid = document.getElementById('daily-exam-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hasDailyUnlocked = !!(window.ToyPermissions && window.ToyPermissions.hasUnlockedTrack('daily'));

    const manifest = window.DAILY_LISTENING_ISSUE5_MANIFEST || [];
    manifest.forEach((item, idx) => {
        const dayNum = item.day;
        const title = item.title;
        const isDone = window.completedExams && window.completedExams[title];
        const doneCount = (isDone && isDone.dictationCompleted) ? Object.keys(isDone.dictationCompleted).length : 0;
        const isCharged = !!(window.ToyPermissions && (window.ToyPermissions.isCharged || window.ToyPermissions.isAuthor));
        let statusText = '未练习';
        let isCompleted = false;
        let isLocked = (idx > 0 && !isCharged);

        if (isLocked) {
            statusText = '包月充电解锁';
        } else if (idx === 0) {
            // Day 01
            if (hasDailyUnlocked || isCharged) {
                if (doneCount > 0) {
                    statusText = doneCount >= item.sentenceCount ? '已满分精听 🏆' : `已练 ${doneCount}/${item.sentenceCount} 句`;
                    isCompleted = true;
                } else {
                    statusText = '未练习';
                }
            } else {
                statusText = doneCount > 0 ? `已试做 ${doneCount}/2 句` : '免费试做 (前2句)';
                isCompleted = doneCount > 0;
            }
        } else if (isDone && isDone.dictationCompleted) {
            if (doneCount > 0) {
                statusText = doneCount >= item.sentenceCount ? '已满分精听 🏆' : `已练 ${doneCount}/${item.sentenceCount} 句`;
                isCompleted = true;
            }
        }

        const card = document.createElement('div');
        card.className = `exam-card ${isLocked ? 'is-locked-card' : ''}`;
        card.innerHTML = `
            <div class="exam-card-title">${item.dayTitle}</div>
            <div class="exam-card-meta">
                <span class="status-tag ${isLocked ? 'locked-tag' : (isCompleted ? 'completed' : '')}">${statusText}</span>
            </div>
        `;
        card.addEventListener('click', () => {
            const currentlyLocked = window.ToyPermissions ? !window.ToyPermissions.canAccessDaily(idx, 0) : false;
            if (currentlyLocked) {
                window.ToyPermissions.showUnlockModal('daily', { examIndex: idx, dayNum: dayNum, level: 'daily' });
                return;
            }
            if (card.classList.contains('is-activating')) return;
            card.classList.add('is-activating');
            const statusTag = card.querySelector('.status-tag');
            const oldStatusText = statusTag ? statusTag.textContent : '';
            if (statusTag) {
                statusTag.textContent = '进入中...';
            }
            setTimeout(() => {
                card.classList.remove('is-activating');
                if (statusTag && statusTag.textContent === '进入中...') {
                    statusTag.textContent = oldStatusText;
                }
            }, 1000);
            startDailyDictation(dayNum);
        });

        grid.appendChild(card);
    });
}
window.renderDailyLobbyGrid = renderDailyLobbyGrid;

// (Daily listening audio playback & pre-cache engine are modularized in js/dict_audio_engine.js)


// Lobby Year Filter Chips
function initDictationYearFilterBar(level) {
    const dictFilterBar = document.getElementById('dictation-year-filter-bar');
    if (!dictFilterBar) return;
    const curLevel = level || window.currentExamLevel || 'cet4';
    const isIelts = (curLevel === 'ielts');
    const isGaokao = (curLevel === 'gaokao');

    const hasIeltsChips = !!dictFilterBar.querySelector('.chip-year[data-range="ielts_18_21"]');
    if (isIelts && !hasIeltsChips) {
        dictFilterBar.innerHTML = `
            <span class="chip-year active" data-range="ALL">全部真题</span>
            <span class="chip-year" data-range="ielts_18_21">剑18–21</span>
            <span class="chip-year" data-range="ielts_14_17">剑14–17</span>
            <span class="chip-year" data-range="ielts_10_13">剑10–13</span>
            <span class="chip-year" data-range="ielts_4_9">剑4–9</span>
        `;
    } else if (!isIelts && (hasIeltsChips || !dictFilterBar.querySelector('.chip-year[data-range="2021-2026"]'))) {
        dictFilterBar.innerHTML = `
            <span class="chip-year active" data-range="ALL">全部年份</span>
            <span class="chip-year" data-range="2021-2026">2021–2026年</span>
            <span class="chip-year" data-range="2015-2020">2015–2020年</span>
            <span class="chip-year" data-range="2008-2014" style="display: ${isGaokao ? '' : 'none'};">2008–2014年</span>
        `;
    } else if (!isIelts) {
        const chip0814 = dictFilterBar.querySelector('.chip-year[data-range="2008-2014"]');
        if (chip0814) chip0814.style.display = isGaokao ? '' : 'none';
    }

    const chips = dictFilterBar.querySelectorAll('.chip-year');
    chips.forEach(chip => {
        const clone = chip.cloneNode(true);
        chip.parentNode.replaceChild(clone, chip);
        clone.addEventListener('click', () => {
            const nextRange = clone.dataset.range || 'ALL';
            const changed = (window.currentDictationFilter !== nextRange) || !clone.classList.contains('active');
            dictFilterBar.querySelectorAll('.chip-year').forEach(c => c.classList.remove('active'));
            clone.classList.add('active');
            window.currentDictationFilter = nextRange;
            renderDictationLobbyGrid(window.currentDictationFilter, { animateSlider: true });
            if (changed && typeof window.triggerExamGridFilterTransition === 'function') {
                window.triggerExamGridFilterTransition('dictation-exam-grid');
            }
        });
    });

    if (typeof updateSegmentedSlider === 'function') {
        updateSegmentedSlider(dictFilterBar, false);
    }
    if (window.enableHorizontalDragScroll) {
        window.enableHorizontalDragScroll(dictFilterBar);
    }
}
window.initDictationYearFilterBar = initDictationYearFilterBar;
window.renderDictationLobbyGrid = renderDictationLobbyGrid;
window.startDictationExam = startDictationExam;
window.startDailyDictation = startDailyDictation;
window.renderDailyLobbyGrid = renderDailyLobbyGrid;
