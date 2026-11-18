/* === js/dict_audio_engine.js === */
// ==========================================================================
// 🎧 Dictation Audio Engine & Daily Listening Audio Pipeline (js/dict_audio_engine.js)
// ==========================================================================
// 1. Dual Audio Accent (UK/US) & Repetition (1x/2x) Configuration
// 2. On-Demand HTTP Range Streaming + IndexedDB Persistent Audio Engine
// 3. True Audio State Machine: Buffering vs Playing vs Paused
// 4. Sample-Accurate Sentence Boundary Looping & Pause Cutoff
// ==========================================================================

let dailyAudioAccent = 'uk';
try {
    const saved = window.__toyLS.getItem('toy_daily_accent');
    if (saved === 'us' || saved === 'uk') dailyAudioAccent = saved;
} catch(e) {}

let dailyAudioRepeatCount = 1;
try {
    const savedCount = parseInt(window.__toyLS.getItem('toy_daily_repeat_count'), 10);
    if (savedCount === 1 || savedCount === 2) dailyAudioRepeatCount = savedCount;
} catch(e) {}

window.dailyAudioAccent = dailyAudioAccent;
window.dailyAudioRepeatCount = dailyAudioRepeatCount;
window._dailyAccent = dailyAudioAccent;

let currentDailyTimeout = null;

function isDailyListeningActive() {
    const title = window.currentDictExamTitle || (typeof currentDictExamTitle !== 'undefined' ? currentDictExamTitle : '') || '';
    return !!(
        window._isDailyListening ||
        (title && title.includes('每日英语听力')) ||
        (window._currentDailyDay && window._currentDailyDay > 0)
    );
}
window.isDailyListeningActive = isDailyListeningActive;

window.setDailyAudioAccent = function(accent) {
    dailyAudioAccent = (accent === 'us') ? 'us' : 'uk';
    window.dailyAudioAccent = dailyAudioAccent;
    window._dailyAccent = dailyAudioAccent;
    try {
        window.__toyLS.setItem('toy_daily_accent', dailyAudioAccent);
        if (window.ToyStorage && typeof window.ToyStorage.setItem === 'function') {
            window.ToyStorage.setItem('toy_daily_accent', dailyAudioAccent);
        }
    } catch(e) {}
    updateDailyAudioSettingsUI();
    if (typeof updateDailyLobbyToggleUI === 'function') updateDailyLobbyToggleUI();
    const sents = window.currentDictSentences || [];
    if (isDailyListeningActive() && sents.length > 0) {
        playDailySentenceAudio(true);
    }
};

window.setDailyAudioRepeatCount = function(count) {
    dailyAudioRepeatCount = (count === 2) ? 2 : 1;
    window.dailyAudioRepeatCount = dailyAudioRepeatCount;
    try {
        window.__toyLS.setItem('toy_daily_repeat_count', String(dailyAudioRepeatCount));
        if (window.ToyStorage && typeof window.ToyStorage.setItem === 'function') {
            window.ToyStorage.setItem('toy_daily_repeat_count', String(dailyAudioRepeatCount));
        }
    } catch(e) {}
    updateDailyAudioSettingsUI();
};

window.openDictAudioSettingsModal = function() {
    const mask = document.getElementById('dict-audio-settings-mask');
    if (mask) {
        updateDailyAudioSettingsUI();
        mask.style.display = 'flex';
    }
};

window.closeDictAudioSettingsModal = function() {
    const mask = document.getElementById('dict-audio-settings-mask');
    if (mask) mask.style.display = 'none';
};

function updateDailyAudioSettingsUI() {
    const lbl = document.getElementById('dict-audio-config-label');
    if (lbl) {
        const accentName = dailyAudioAccent === 'us' ? '美音' : '英音';
        const rep = dailyAudioRepeatCount === 2 ? '2遍' : '1遍';
        lbl.textContent = `${accentName} · ${rep}`;
    }
    const optUk = document.getElementById('opt-accent-uk');
    const optUs = document.getElementById('opt-accent-us');
    if (optUk && optUs) {
        optUk.classList.toggle('active', dailyAudioAccent === 'uk');
        optUs.classList.toggle('active', dailyAudioAccent === 'us');
    }
    const optRep1 = document.getElementById('opt-repeat-1');
    const optRep2 = document.getElementById('opt-repeat-2');
    if (optRep1 && optRep2) {
        optRep1.classList.toggle('active', dailyAudioRepeatCount === 1);
        optRep2.classList.toggle('active', dailyAudioRepeatCount === 2);
    }
}
window.updateDailyAudioSettingsUI = updateDailyAudioSettingsUI;

function updateDailyLobbyToggleUI() {
    const btnUk = document.getElementById('daily-lobby-uk-btn');
    const btnUs = document.getElementById('daily-lobby-us-btn');
    if (btnUk && btnUs) {
        btnUk.classList.toggle('active', dailyAudioAccent === 'uk');
        btnUs.classList.toggle('active', dailyAudioAccent === 'us');
    }
}
window.updateDailyLobbyToggleUI = updateDailyLobbyToggleUI;

window.setDailyLobbyAccent = function(accent) {
    window.setDailyAudioAccent(accent);
};

function loadDailySentenceAudio(sentIdx, shouldPlay = false) {
    if (shouldPlay) {
        playDailySentenceAudio(true);
    } else {
        // Pre-cache only, never mutate audioPlayer.src directly to prevent mid-playback audio abortion
        if (window.ToyAudioCacheDB) {
            const dayNum = window._currentDailyDay || 1;
            const accent = dailyAudioAccent || 'uk';
            const sentNum = sentIdx + 1;
            const SERVER_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
                ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
                : 'https://bilibilitoyassets.top/';
            const femaleKey = window.ToyAudioCacheDB.getDailyKey(accent, dayNum, sentNum, 'female');
            const femaleUrl = `${SERVER_BASE}daily/issue5/audios/${accent}/day${dayNum}/${sentNum}_female.mp3`;
            window.ToyAudioCacheDB.fetchAndCacheDailyAudio(femaleUrl, femaleKey).catch(() => {});
        }
    }
}
window.loadDailySentenceAudio = loadDailySentenceAudio;

let activeDailyPlayingListener = null;
let activeDailyWaitingListener = null;

function clearDailyAudioListeners(audioPlayer) {
    if (!audioPlayer) return;
    if (activeDailyPlayingListener) {
        try { audioPlayer.removeEventListener('playing', activeDailyPlayingListener); } catch(e) {}
        activeDailyPlayingListener = null;
    }
    if (activeDailyWaitingListener) {
        try { audioPlayer.removeEventListener('waiting', activeDailyWaitingListener); } catch(e) {}
        activeDailyWaitingListener = null;
    }
}

async function playDailyMaleAudio(candidates, accent = 'uk', dayNum = 1, sentNum = 1, expectedToken = null) {
    const audioPlayer = document.getElementById('dictation-audio-player');
    if (!audioPlayer) return;
    if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;

    clearDailyAudioListeners(audioPlayer);

    const maleKey = window.ToyAudioCacheDB ? window.ToyAudioCacheDB.getDailyKey(accent, dayNum, sentNum, 'male') : null;
    DictAudioEngine.currentDailyVoice = 'male';
    DictAudioEngine.currentDailyKey = maleKey;

    let blob = null;
    if (maleKey && window.ToyAudioCacheDB) {
        try {
            blob = await window.ToyAudioCacheDB.getDailyAudioBlob(maleKey);
        } catch(e) {}
    }
    if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;

    let targetSrc = candidates[0];
    if (blob) {
        if (DictAudioEngine.activeDailyBlobUrl) {
            try { URL.revokeObjectURL(DictAudioEngine.activeDailyBlobUrl); } catch(e) {}
        }
        DictAudioEngine.activeDailyBlobUrl = URL.createObjectURL(blob);
        DictAudioEngine.activeDailyBlobKey = maleKey;
        targetSrc = DictAudioEngine.activeDailyBlobUrl;
    }

    audioPlayer.muted = false;
    audioPlayer.volume = 1.0;
    audioPlayer.src = targetSrc;
    audioPlayer.currentTime = 0;
    audioPlayer.playbackRate = window.dictPlaybackRate || 1.0;

    let mIdx = blob ? -1 : 0;
    audioPlayer.onerror = () => {
        if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;
        if (mIdx === -1 && DictAudioEngine.activeDailyBlobUrl) {
            try { URL.revokeObjectURL(DictAudioEngine.activeDailyBlobUrl); } catch(e) {}
            DictAudioEngine.activeDailyBlobUrl = null;
            DictAudioEngine.activeDailyBlobKey = null;
            blob = null;
            if (maleKey && window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.deleteDailyAudio === 'function') {
                window.ToyAudioCacheDB.deleteDailyAudio(maleKey).catch(() => {});
            }
        }
        mIdx++;
        if (mIdx < candidates.length) {
            audioPlayer.muted = false;
            audioPlayer.volume = 1.0;
            audioPlayer.src = candidates[mIdx];
            audioPlayer.play().catch(() => {
                if (expectedToken === null || expectedToken === DictAudioEngine.playToken) {
                    DictAudioEngine.isBuffering = false;
                    DictAudioEngine.isPlaying = false;
                    updateZenAudioPlayState(false);
                }
            });
        } else {
            clearDailyAudioListeners(audioPlayer);
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState(false);
        }
    };

    audioPlayer.onended = () => {
        if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;
        clearDailyAudioListeners(audioPlayer);
        DictAudioEngine.isBuffering = false;
        DictAudioEngine.isPlaying = false;
        updateZenAudioPlayState(false);
        if (!blob && maleKey && window.ToyAudioCacheDB) {
            window.ToyAudioCacheDB.fetchAndCacheDailyAudio(candidates[0], maleKey).catch(() => {});
        }
    };

    DictAudioEngine.isBuffering = true;
    DictAudioEngine.isPlaying = false;
    updateZenAudioPlayState('buffering');

    const maleWatchdog = setTimeout(() => {
        if ((expectedToken === null || expectedToken === DictAudioEngine.playToken) && DictAudioEngine.isBuffering) {
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState('paused');
        }
    }, 8000);

    const onMalePlaying = () => {
        clearTimeout(maleWatchdog);
        if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;
        audioPlayer.muted = false;
        audioPlayer.volume = 1.0;
        DictAudioEngine.isBuffering = false;
        DictAudioEngine.isPlaying = true;
        updateZenAudioPlayState('playing');
    };
    const onMaleWaiting = () => {
        if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;
        DictAudioEngine.isBuffering = true;
        updateZenAudioPlayState('buffering');
    };
    activeDailyPlayingListener = onMalePlaying;
    activeDailyWaitingListener = onMaleWaiting;
    audioPlayer.addEventListener('playing', onMalePlaying);
    audioPlayer.addEventListener('waiting', onMaleWaiting);

    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            clearTimeout(maleWatchdog);
            if (expectedToken !== null && expectedToken !== DictAudioEngine.playToken) return;
            clearDailyAudioListeners(audioPlayer);
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState('paused');
        });
    }
}
window.playDailyMaleAudio = playDailyMaleAudio;

async function playDailySentenceAudio(forceFromStart = false) {
    const audioPlayer = document.getElementById('dictation-audio-player');
    if (!audioPlayer) return;
    if (currentDailyTimeout) {
        clearTimeout(currentDailyTimeout);
        currentDailyTimeout = null;
    }

    clearDailyAudioListeners(audioPlayer);

    const dayNum = window._currentDailyDay || 1;
    const accent = dailyAudioAccent || 'uk';
    const curIdx = (typeof window.currentDictIndex === 'number') ? window.currentDictIndex : 0;
    const sentNum = curIdx + 1;

    const SERVER_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
        ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
        : 'https://bilibilitoyassets.top/';

    const femaleCandidates = [
        `${SERVER_BASE}daily/issue5/audios/${accent}/day${dayNum}/${sentNum}_female.mp3`,
        `bucket_dist/daily/issue5/audios/${accent}/day${dayNum}/${sentNum}_female.mp3`
    ];

    const maleCandidates = [
        `${SERVER_BASE}daily/issue5/audios/${accent}/day${dayNum}/${sentNum}_male.mp3`,
        `bucket_dist/daily/issue5/audios/${accent}/day${dayNum}/${sentNum}_male.mp3`
    ];

    const femaleKey = window.ToyAudioCacheDB ? window.ToyAudioCacheDB.getDailyKey(accent, dayNum, sentNum, 'female') : null;
    const maleKey = window.ToyAudioCacheDB ? window.ToyAudioCacheDB.getDailyKey(accent, dayNum, sentNum, 'male') : null;

    // Always ensure audio player is unmuted and at full volume before any Daily playback
    audioPlayer.muted = false;
    audioPlayer.volume = 1.0;

    // ⚡ Check if we can do an instant Breakpoint Resume
    const isSameAudio = DictAudioEngine.currentDailyKey && (
        DictAudioEngine.currentDailyKey === femaleKey ||
        DictAudioEngine.currentDailyKey === maleKey
    );

    if (!forceFromStart && isSameAudio && audioPlayer.paused && audioPlayer.currentTime > 0 && audioPlayer.currentTime < (audioPlayer.duration - 0.08)) {
        DictAudioEngine.isPlaying = true;
        updateZenAudioPlayState(true);
        audioPlayer.playbackRate = window.dictPlaybackRate || 1.0;
        audioPlayer.play().catch(() => {
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState(false);
        });
        return;
    }

    // New playback session
    const currentToken = ++DictAudioEngine.playToken;
    DictAudioEngine.currentDailyVoice = 'female';
    DictAudioEngine.currentDailyKey = femaleKey;
    DictAudioEngine.currentDailySentIdx = curIdx;

    let blob = null;
    if (femaleKey && window.ToyAudioCacheDB) {
        try {
            blob = await window.ToyAudioCacheDB.getDailyAudioBlob(femaleKey);
        } catch(e) {}
    }
    if (currentToken !== DictAudioEngine.playToken) return;

    let targetSrc = femaleCandidates[0];
    if (blob) {
        if (DictAudioEngine.activeDailyBlobUrl) {
            try { URL.revokeObjectURL(DictAudioEngine.activeDailyBlobUrl); } catch(e) {}
        }
        DictAudioEngine.activeDailyBlobUrl = URL.createObjectURL(blob);
        DictAudioEngine.activeDailyBlobKey = femaleKey;
        targetSrc = DictAudioEngine.activeDailyBlobUrl;
    }

    audioPlayer.muted = false;
    audioPlayer.volume = 1.0;
    audioPlayer.src = targetSrc;
    audioPlayer.currentTime = 0;
    audioPlayer.playbackRate = window.dictPlaybackRate || 1.0;

    let fIdx = blob ? -1 : 0;
    audioPlayer.onerror = () => {
        if (currentToken !== DictAudioEngine.playToken) return;
        if (fIdx === -1 && DictAudioEngine.activeDailyBlobUrl) {
            try { URL.revokeObjectURL(DictAudioEngine.activeDailyBlobUrl); } catch(e) {}
            DictAudioEngine.activeDailyBlobUrl = null;
            DictAudioEngine.activeDailyBlobKey = null;
            blob = null;
            if (femaleKey && window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.deleteDailyAudio === 'function') {
                window.ToyAudioCacheDB.deleteDailyAudio(femaleKey).catch(() => {});
            }
        }
        fIdx++;
        if (fIdx < femaleCandidates.length) {
            audioPlayer.muted = false;
            audioPlayer.volume = 1.0;
            audioPlayer.src = femaleCandidates[fIdx];
            audioPlayer.play().catch(() => {
                if (currentToken === DictAudioEngine.playToken) {
                    DictAudioEngine.isBuffering = false;
                    DictAudioEngine.isPlaying = false;
                    updateZenAudioPlayState(false);
                }
            });
        } else {
            clearDailyAudioListeners(audioPlayer);
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState(false);
            if (typeof showToyToast === 'function') {
                showToyToast('⚠️ 音频加载超时，轻触播放重试');
            }
        }
    };

    audioPlayer.onended = () => {
        if (currentToken !== DictAudioEngine.playToken) return;
        clearDailyAudioListeners(audioPlayer);
        if (!blob && femaleKey && window.ToyAudioCacheDB) {
            window.ToyAudioCacheDB.fetchAndCacheDailyAudio(femaleCandidates[0], femaleKey).catch(() => {});
        }
        if (dailyAudioRepeatCount === 2) {
            currentDailyTimeout = setTimeout(() => {
                if (currentToken === DictAudioEngine.playToken) {
                    playDailyMaleAudio(maleCandidates, accent, dayNum, sentNum, currentToken);
                }
            }, 1000);
        } else {
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState(false);
        }
    };

    DictAudioEngine.isBuffering = true;
    DictAudioEngine.isPlaying = false;
    updateZenAudioPlayState('buffering');

    // Watchdog to prevent endless "⏳ 加载中..." in case of network halt
    const dailyWatchdog = setTimeout(() => {
        if (currentToken === DictAudioEngine.playToken && DictAudioEngine.isBuffering) {
            console.warn('[DictAudioEngine] Daily audio buffering watchdog triggered, resetting state to paused.');
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState('paused');
        }
    }, 8000);

    const onDailyPlaying = () => {
        clearTimeout(dailyWatchdog);
        if (currentToken !== DictAudioEngine.playToken) return;
        audioPlayer.muted = false;
        audioPlayer.volume = 1.0;
        DictAudioEngine.isBuffering = false;
        DictAudioEngine.isPlaying = true;
        updateZenAudioPlayState('playing');
    };
    const onDailyWaiting = () => {
        if (currentToken !== DictAudioEngine.playToken) return;
        DictAudioEngine.isBuffering = true;
        updateZenAudioPlayState('buffering');
    };
    activeDailyPlayingListener = onDailyPlaying;
    activeDailyWaitingListener = onDailyWaiting;
    audioPlayer.addEventListener('playing', onDailyPlaying);
    audioPlayer.addEventListener('waiting', onDailyWaiting);

    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => {
            clearTimeout(dailyWatchdog);
            if (currentToken !== DictAudioEngine.playToken) return;
            clearDailyAudioListeners(audioPlayer);
            DictAudioEngine.isBuffering = false;
            DictAudioEngine.isPlaying = false;
            updateZenAudioPlayState('paused');
        });
    }

    // ⚡ Silent pre-cache next sentence audio to IndexedDB in idle time (Ensures 0 network & instant next play)
    const curSentences = window.currentDictSentences;
    if (window.ToyAudioCacheDB && curIdx + 1 < (curSentences ? curSentences.length : 30)) {
        const nextSentNum = curIdx + 2;
        const nextKey = window.ToyAudioCacheDB.getDailyKey(accent, dayNum, nextSentNum, 'female');
        const SERVER_BASE = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
            ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '') + '/'
            : 'https://bilibilitoyassets.top/';
        const nextUrl = `${SERVER_BASE}daily/issue5/audios/${accent}/day${dayNum}/${nextSentNum}_female.mp3`;
        setTimeout(() => {
            if (window.ToyAudioCacheDB) {
                window.ToyAudioCacheDB.fetchAndCacheDailyAudio(nextUrl, nextKey);
            }
        }, 1200);
    }
}
window.playDailySentenceAudio = playDailySentenceAudio;

// ==========================================================================
// 6. Audio Slicing & Playback Engine (True Audio State Machine)
// ==========================================================================
function updateZenAudioPlayState(state) {
    const isBuffering = (state === 'buffering' || state === 'loading');
    const isPlaying = (state === true || state === 'playing');
    const isPaused = (!isBuffering && !isPlaying);

    const waveBars = document.getElementById('dict-wave-bars');
    const playIcon = document.getElementById('zen-play-icon');
    const playText = document.getElementById('zen-play-text');
    const playBtn = document.getElementById('btn-dict-play');

    if (playBtn) {
        playBtn.classList.toggle('buffering', isBuffering);
        playBtn.classList.toggle('playing', isPlaying);
        playBtn.style.background = '#111113';
    }

    if (waveBars) {
        waveBars.classList.toggle('playing', isPlaying);
        waveBars.classList.toggle('buffering', isBuffering);
    }

    if (playIcon) {
        if (isBuffering) {
            playIcon.textContent = '⏳';
        } else if (isPlaying) {
            playIcon.textContent = '⏸';
        } else {
            playIcon.textContent = '▶';
        }
    }

    if (playText) {
        if (isBuffering) {
            playText.textContent = '加载中';
        } else if (isPlaying) {
            playText.textContent = '暂停';
        } else {
            playText.textContent = '播放';
        }
    }

    const kbSpaceIcon = document.getElementById('dict-kb-space-icon');
    const kbSpaceText = document.getElementById('dict-kb-space-text');
    if (kbSpaceIcon) {
        kbSpaceIcon.textContent = isBuffering ? '⏳' : (isPlaying ? '⏸' : '▶');
    }
    if (kbSpaceText) {
        kbSpaceText.textContent = isBuffering ? '加载中' : (isPlaying ? '暂停' : '播放');
    }
}
window.updateZenAudioPlayState = updateZenAudioPlayState;

let dictAudioRafId = null;
let dictAudioIntervalId = null;
let dictAudioStopTimer = null;
let dictAudioMetaTimer = null;
let dictAudioTimeupdateHandler = null;
let dictAudioPlayingHandler = null;
let dictAudioWaitingHandler = null;
let dictAudioSeekedHandler = null;
let dictAudioMetaReadyHandler = null;
let dictAudioLateMetaHandler = null;

function clearDictAudioLoop() {
    if (dictAudioRafId) {
        cancelAnimationFrame(dictAudioRafId);
        dictAudioRafId = null;
    }
    if (dictAudioIntervalId) {
        clearInterval(dictAudioIntervalId);
        dictAudioIntervalId = null;
    }
    if (dictAudioStopTimer) {
        clearTimeout(dictAudioStopTimer);
        dictAudioStopTimer = null;
    }
    if (dictAudioMetaTimer) {
        clearTimeout(dictAudioMetaTimer);
        dictAudioMetaTimer = null;
    }
    const audioPlayer = document.getElementById('dictation-audio-player');
    if (audioPlayer) {
        if (dictAudioTimeupdateHandler) {
            try { audioPlayer.removeEventListener('timeupdate', dictAudioTimeupdateHandler); } catch(e) {}
            dictAudioTimeupdateHandler = null;
        }
        if (dictAudioPlayingHandler) {
            try { audioPlayer.removeEventListener('playing', dictAudioPlayingHandler); } catch(e) {}
            dictAudioPlayingHandler = null;
        }
        if (dictAudioWaitingHandler) {
            try { audioPlayer.removeEventListener('waiting', dictAudioWaitingHandler); } catch(e) {}
            dictAudioWaitingHandler = null;
        }
        if (dictAudioSeekedHandler) {
            try { audioPlayer.removeEventListener('seeked', dictAudioSeekedHandler); } catch(e) {}
            dictAudioSeekedHandler = null;
        }
        if (dictAudioMetaReadyHandler) {
            try { audioPlayer.removeEventListener('loadedmetadata', dictAudioMetaReadyHandler); } catch(e) {}
            try { audioPlayer.removeEventListener('canplay', dictAudioMetaReadyHandler); } catch(e) {}
            dictAudioMetaReadyHandler = null;
        }
        if (dictAudioLateMetaHandler) {
            try { audioPlayer.removeEventListener('loadedmetadata', dictAudioLateMetaHandler); } catch(e) {}
            dictAudioLateMetaHandler = null;
        }
    }
}
window.clearDictAudioLoop = clearDictAudioLoop;

let sentenceRecorder = null;
let sentenceChunks = [];

function startSentenceCapture(audioPlayer, cacheKey) {
    if (!cacheKey || !window.MediaRecorder || !window.ToyAudioCacheDB) return;
    try {
        const streamFn = audioPlayer.captureStream || audioPlayer.mozCaptureStream;
        if (!streamFn) return;
        const stream = streamFn.call(audioPlayer);
        if (!stream) return;

        sentenceChunks = [];
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', ''];
        let chosenMime = '';
        for (const m of mimeTypes) {
            if (!m || MediaRecorder.isTypeSupported(m)) {
                chosenMime = m;
                break;
            }
        }

        const options = chosenMime ? { mimeType: chosenMime } : {};
        sentenceRecorder = new MediaRecorder(stream, options);
        sentenceRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                sentenceChunks.push(e.data);
            }
        };
        sentenceRecorder.onstop = () => {
            if (sentenceChunks.length > 0) {
                const blob = new Blob(sentenceChunks, { type: chosenMime || 'audio/webm' });
                if (blob.size > 512) {
                    window.ToyAudioCacheDB.saveAudioBlob(cacheKey, blob).then(() => {
                        console.log(`[ToyAudioCacheDB] 💾 Cached sentence audio (${Math.round(blob.size/1024)} KB) to IndexedDB: ${cacheKey}`);
                    });
                }
            }
            sentenceChunks = [];
            sentenceRecorder = null;
        };
        sentenceRecorder.start(100);
    } catch(e) {
        sentenceRecorder = null;
    }
}
window.startSentenceCapture = startSentenceCapture;

function stopSentenceCapture() {
    if (sentenceRecorder && sentenceRecorder.state !== 'inactive') {
        try {
            sentenceRecorder.stop();
        } catch(e) {}
    }
    sentenceRecorder = null;
}
window.stopSentenceCapture = stopSentenceCapture;

/**
 * ==========================================================================
 * On-Demand HTTP Range Streaming + IndexedDB Persistent Audio Engine
 * ==========================================================================
 */

const DictAudioEngine = {
    isPlaying: false,
    isBuffering: false,
    playToken: 0,
    currentExamTitle: '',
    currentLevel: 'cet4',
    cloudCandidates: [],
    _candIdx: 0,
    _bgCacheTimer: null,
    activeBlobUrl: null,
    activeExamBlobUrl: null,
    activeDailyBlobUrl: null,
    activeDailyBlobKey: null,
    currentDailyKey: null,
    currentDailyVoice: 'female',
    currentDailySentIdx: -1,
    currentSentenceIdx: -1,
    currentStartSec: 0,
    currentEndSec: 0,
    currentNextStartSec: null,
    currentBlobCacheKey: null,
    _finishSegmentRef: null,

    async resetCurrentExam(title, candidates = [], level = null) {
        this.stop(true);
        this.currentExamTitle = title;
        this.currentLevel = level || window.currentExamLevel || 'cet4';
        this.currentSentenceIdx = -1;
        this.currentBlobCacheKey = null;
        this.currentNextStartSec = null;
        this._finishSegmentRef = null;
        this._candIdx = 0;
        if (candidates && candidates.length > 0) {
            this.cloudCandidates = Array.from(new Set(candidates.filter(Boolean)));
        } else {
            this.cloudCandidates = [];
        }
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (audioPlayer) {
            audioPlayer.preload = 'auto';
        }

        // ⚡ Scheme 3: Check if full exam audio is already cached in local IndexedDB (0-CDN repeat egress)
        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.getExamAudioBlob === 'function') {
            try {
                const blob = await window.ToyAudioCacheDB.getExamAudioBlob(this.currentLevel, title);
                if (blob && this.currentExamTitle === title) {
                    if (this.activeExamBlobUrl) {
                        try { URL.revokeObjectURL(this.activeExamBlobUrl); } catch(e) {}
                    }
                    this.activeExamBlobUrl = URL.createObjectURL(blob);
                    if (audioPlayer) {
                        audioPlayer.src = this.activeExamBlobUrl;
                        console.log(`[DictAudioEngine] ⚡ Full exam audio loaded from local IndexedDB: ${title} (0 network)`);
                    }
                    return;
                }
            } catch(e) {}
        }
    },

    pause() {
        clearDictAudioLoop();
        this.playToken++;
        if (currentDailyTimeout) {
            clearTimeout(currentDailyTimeout);
            currentDailyTimeout = null;
        }
        const audioPlayer = document.getElementById('dictation-audio-player');
        clearDailyAudioListeners(audioPlayer);
        if (audioPlayer && !audioPlayer.paused) {
            try {
                audioPlayer.volume = 0;
                audioPlayer.pause();
            } catch(e) {}
        }
        this.isBuffering = false;
        this.isPlaying = false;
        updateZenAudioPlayState('paused');
    },

    pauseSentenceAudio() {
        this.pause();
    },

    stop(releaseMediaStream = true) {
        this.playToken++;
        if (this._bgCacheTimer) {
            clearTimeout(this._bgCacheTimer);
            this._bgCacheTimer = null;
        }
        if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.abortBackgroundExamDownloads === 'function') {
            window.ToyAudioCacheDB.abortBackgroundExamDownloads();
        }
        if (typeof stopSentenceCapture === 'function') stopSentenceCapture();
        if (currentDailyTimeout) {
            clearTimeout(currentDailyTimeout);
            currentDailyTimeout = null;
        }
        if (typeof removePauseBreathingToast === 'function') removePauseBreathingToast();
        clearDictAudioLoop();
        const audioPlayer = document.getElementById('dictation-audio-player');
        clearDailyAudioListeners(audioPlayer);
        if (audioPlayer) {
            audioPlayer.onerror = null;
            audioPlayer.onended = null;
            if (!audioPlayer.paused) {
                try {
                    audioPlayer.volume = 0;
                    audioPlayer.pause();
                } catch(e) {}
            }
            if (releaseMediaStream) {
                try {
                    audioPlayer.removeAttribute('src');
                    audioPlayer.load();
                } catch(e) {}
            }
        }
        if (this.activeBlobUrl) {
            try { URL.revokeObjectURL(this.activeBlobUrl); } catch(e) {}
            this.activeBlobUrl = null;
        }
        if (releaseMediaStream && this.activeExamBlobUrl) {
            try { URL.revokeObjectURL(this.activeExamBlobUrl); } catch(e) {}
            this.activeExamBlobUrl = null;
        }
        if (this.activeDailyBlobUrl) {
            try { URL.revokeObjectURL(this.activeDailyBlobUrl); } catch(e) {}
            this.activeDailyBlobUrl = null;
        }
        this.activeDailyBlobKey = null;
        this.currentDailyKey = null;
        this.isBuffering = false;
        this.isPlaying = false;
        this.currentSentenceIdx = -1;
        this.currentBlobCacheKey = null;
        this.currentNextStartSec = null;
        this._finishSegmentRef = null;
        updateZenAudioPlayState('paused');
    },

    resume() {
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (!audioPlayer) return;

        if (isDailyListeningActive()) {
            this.isBuffering = true;
            updateZenAudioPlayState('buffering');
            audioPlayer.playbackRate = window.dictPlaybackRate || 1.0;
            audioPlayer.volume = 1.0;
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isBuffering = false;
                    this.isPlaying = true;
                    updateZenAudioPlayState('playing');
                }).catch(() => {
                    this.isBuffering = false;
                    this.isPlaying = false;
                    updateZenAudioPlayState('paused');
                });
            }
            return;
        }

        const rate = window.dictPlaybackRate || 1.0;
        audioPlayer.playbackRate = rate;
        audioPlayer.muted = false;
        audioPlayer.volume = 1.0;

        this.isBuffering = true;
        updateZenAudioPlayState('buffering');

        clearDictAudioLoop();
        this.playToken++;
        const currentToken = this.playToken;

        const pureStart = this.currentStartSec;
        const pureEnd = this.currentEndSec;
        const nextStart = this.currentNextStartSec;

        // 🎯 方案 2：严格原始时间轴切片（Exact JSON Cutoff），毫秒不差严格按用户 JSON 标定的 pureEnd 截断
        let effectiveCutoffEnd = pureEnd;
        if (typeof nextStart === 'number' && nextStart < pureEnd) {
            effectiveCutoffEnd = nextStart;
        }

        let finishTriggered = false;

        const finishSegment = () => {
            if (finishTriggered || currentToken !== this.playToken) return;
            finishTriggered = true;
            clearDictAudioLoop();
            try { audioPlayer.pause(); } catch(e) {}
            this.isPlaying = false;
            this.isBuffering = false;
            updateZenAudioPlayState('paused');
        };
        this._finishSegmentRef = finishSegment;

        const checkSliceBoundary = () => {
            if (currentToken !== this.playToken || finishTriggered) return;
            if (audioPlayer.paused) {
                if (!this.isBuffering) {
                    this.isPlaying = false;
                    updateZenAudioPlayState('paused');
                }
                return;
            }
            if (audioPlayer.seeking) return;

            const cur = audioPlayer.currentTime;
            if (cur >= effectiveCutoffEnd) {
                finishSegment();
            }
        };

        dictAudioTimeupdateHandler = checkSliceBoundary;
        audioPlayer.addEventListener('timeupdate', checkSliceBoundary);

        const onResumePlaying = () => {
            if (currentToken !== this.playToken) return;
            this.isBuffering = false;
            this.isPlaying = true;
            updateZenAudioPlayState('playing');

            // 1. High-frequency 8ms boundary check
            if (!dictAudioIntervalId && !finishTriggered && !audioPlayer.paused) {
                dictAudioIntervalId = setInterval(checkSliceBoundary, 8);
            }

            // 2. RequestAnimationFrame monitor
            if (!dictAudioRafId && !finishTriggered && !audioPlayer.paused) {
                const monitorPlayback = () => {
                    if (currentToken !== this.playToken || finishTriggered) return;
                    checkSliceBoundary();
                    if (!finishTriggered && !audioPlayer.paused) {
                        dictAudioRafId = requestAnimationFrame(monitorPlayback);
                    } else {
                        dictAudioRafId = null;
                    }
                };
                dictAudioRafId = requestAnimationFrame(monitorPlayback);
            }
        };

        const onResumeWaiting = () => {
            if (currentToken !== this.playToken) return;
            this.isBuffering = true;
            updateZenAudioPlayState('buffering');
        };

        dictAudioPlayingHandler = onResumePlaying;
        dictAudioWaitingHandler = onResumeWaiting;
        audioPlayer.addEventListener('playing', onResumePlaying);
        audioPlayer.addEventListener('waiting', onResumeWaiting);

        // Generous safety timeout (3x duration + 4s) to prevent runaway audio without premature cutoff
        const remainingSec = Math.max(0.1, pureEnd - audioPlayer.currentTime);
        const maxSafetyMs = Math.max(8000, ((remainingSec / rate) * 1000) * 3 + 4000);
        dictAudioStopTimer = setTimeout(() => {
            if (currentToken === this.playToken && !audioPlayer.paused) {
                finishSegment();
            }
        }, maxSafetyMs);

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                if (currentToken !== this.playToken) return;
                audioPlayer.removeEventListener('playing', onResumePlaying);
                audioPlayer.removeEventListener('waiting', onResumeWaiting);
                clearDictAudioLoop();
                this.isBuffering = false;
                this.isPlaying = false;
                updateZenAudioPlayState('paused');
            });
        }
    },

    playSegment(startSec, endSec, isRetry = false, forceFromStart = false) {
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (!audioPlayer) return;

        if (isDailyListeningActive()) {
            playDailySentenceAudio(forceFromStart);
            return;
        }

        const pureStart = Math.max(0, startSec);
        const pureEnd = Math.max(pureStart + 0.05, endSec);
        const duration = pureEnd - pureStart;
        const rate = window.dictPlaybackRate || 1.0;
        const curIdx = (typeof window.currentDictIndex === 'number') ? window.currentDictIndex : 0;

        // 🎯 Next sentence detection for contiguous lead-out boundary calculation
        const sents = window.currentDictSentences || [];
        let nextStart = null;
        if (Array.isArray(sents) && curIdx >= 0 && curIdx < sents.length - 1) {
            const nextSent = sents[curIdx + 1];
            if (nextSent && typeof nextSent.start === 'number') {
                nextStart = nextSent.start;
            }
        }
        if (nextStart === null && Array.isArray(sents)) {
            const matchedIdx = sents.findIndex(s => Math.abs(s.start - pureStart) < 0.05);
            if (matchedIdx >= 0 && matchedIdx < sents.length - 1) {
                const nextSent = sents[matchedIdx + 1];
                if (nextSent && typeof nextSent.start === 'number') {
                    nextStart = nextSent.start;
                }
            }
        }

        // 🎯 方案 2：严格原始时间轴切片（Exact JSON Cutoff），毫秒不差严格按用户 JSON 标定的 pureEnd 截断
        let effectiveCutoffEnd = pureEnd;
        if (typeof nextStart === 'number' && nextStart < pureEnd) {
            effectiveCutoffEnd = nextStart;
        }

        // ⚡ Check if we can do an instant Breakpoint Resume
        if (!forceFromStart && !this.isPlaying && this.currentSentenceIdx === curIdx) {
            // For single-sentence sliced Blob, duration is only this sentence (starts at 0)
            if (this.activeBlobUrl && audioPlayer.currentTime > 0 && audioPlayer.currentTime < (audioPlayer.duration - 0.08)) {
                this.resume();
                return;
            }
            // For full exam audio (both IndexedDB Blob and Cloud streaming), position is within [pureStart, effectiveCutoffEnd]
            if (!this.activeBlobUrl && audioPlayer.currentTime >= (pureStart - 0.05) && audioPlayer.currentTime < (effectiveCutoffEnd - 0.08)) {
                this.resume();
                return;
            }
        }

        clearDictAudioLoop();
        this.playToken++;
        const currentToken = this.playToken;
        this.currentSentenceIdx = curIdx;
        this.currentStartSec = pureStart;
        this.currentEndSec = pureEnd;
        this.currentNextStartSec = nextStart;

        // Immediately silence & pause if already playing to prevent old buffer bleed
        try {
            audioPlayer.volume = 0;
            if (!audioPlayer.paused) {
                audioPlayer.pause();
            }
        } catch(e) {}

        // ⏳ UI State Machine: Enter Buffering state immediately (Zero False Playing UI)
        this.isBuffering = true;
        this.isPlaying = false;
        updateZenAudioPlayState('buffering');

        try {
            audioPlayer.preservesPitch = true;
            if ('webkitPreservesPitch' in audioPlayer) audioPlayer.webkitPreservesPitch = true;
            if ('mozPreservesPitch' in audioPlayer) audioPlayer.mozPreservesPitch = true;
            audioPlayer.playbackRate = rate;

            // Target audio source selection
            const candIdx = (typeof this._candIdx === 'number' && this._candIdx >= 0) ? this._candIdx : 0;
            let targetSrc = this.activeExamBlobUrl || this.activeBlobUrl || '';
            if (!targetSrc && this.cloudCandidates && this.cloudCandidates.length > 0) {
                targetSrc = this.cloudCandidates[Math.min(candIdx, this.cloudCandidates.length - 1)];
            }
            if (!targetSrc && audioPlayer.src) {
                targetSrc = audioPlayer.src;
            }

            let isSrcChanging = false;
            if (targetSrc) {
                try {
                    const absTarget = new URL(targetSrc, window.location.href).href;
                    isSrcChanging = (audioPlayer.src !== absTarget);
                } catch(e) {
                    isSrcChanging = (audioPlayer.src !== targetSrc);
                }
            }
            if (isSrcChanging) {
                audioPlayer.src = targetSrc;
            }

            // Defer background exam cache by 8 seconds so active streaming requests are not choked
            if (!this.activeExamBlobUrl && this.cloudCandidates && this.cloudCandidates.length > 0 && window.ToyAudioCacheDB) {
                if (this._bgCacheTimer) clearTimeout(this._bgCacheTimer);
                const expectedExamTitle = this.currentExamTitle;
                const expectedLevel = this.currentLevel;
                const expectedCands = this.cloudCandidates.slice();
                this._bgCacheTimer = setTimeout(() => {
                    this._bgCacheTimer = null;
                    if (window.ToyAudioCacheDB && !this.activeExamBlobUrl && this.currentExamTitle === expectedExamTitle && window.activeView === 'dictation-arena') {
                        try {
                            window.ToyAudioCacheDB.fetchAndCacheExamAudio(expectedCands, expectedLevel, expectedExamTitle);
                        } catch(e) {}
                    }
                }, 8000);
            }

            audioPlayer.muted = false;
            let hasEnteredSegment = false;
            let finishTriggered = false;

            audioPlayer.onerror = (err) => {
                if (currentToken !== this.playToken) return;
                clearDictAudioLoop();
                this.isBuffering = false;
                this.isPlaying = false;
                updateZenAudioPlayState('paused');
                if (this.activeExamBlobUrl) {
                    try { URL.revokeObjectURL(this.activeExamBlobUrl); } catch(e) {}
                    this.activeExamBlobUrl = null;
                    if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.deleteExamAudio === 'function') {
                        window.ToyAudioCacheDB.deleteExamAudio(this.currentLevel, this.currentExamTitle).catch(() => {});
                    }
                    if (this.cloudCandidates && this.cloudCandidates.length > 0) {
                        this._candIdx = 0;
                        audioPlayer.src = this.cloudCandidates[0];
                        this.playSegment(startSec, endSec, true, forceFromStart);
                        return;
                    }
                }
                if (this.cloudCandidates && !this.activeExamBlobUrl && (this._candIdx + 1) < this.cloudCandidates.length) {
                    this._candIdx++;
                    audioPlayer.src = this.cloudCandidates[this._candIdx];
                    this.playSegment(startSec, endSec, true, forceFromStart);
                } else {
                    this._candIdx = 0;
                    if (typeof showToyToast === 'function') {
                        showToyToast('⚠️ 音频加载超时，请轻触播放重试');
                    }
                }
            };

            const finishSegment = () => {
                if (finishTriggered || currentToken !== this.playToken) return;
                finishTriggered = true;
                clearDictAudioLoop();
                try { audioPlayer.pause(); } catch(e) {}
                this.isPlaying = false;
                this.isBuffering = false;
                updateZenAudioPlayState('paused');
            };
            this._finishSegmentRef = finishSegment;

            const checkSliceBoundary = () => {
                if (currentToken !== this.playToken || finishTriggered) return;
                if (audioPlayer.paused) {
                    if (!this.isBuffering) {
                        this.isPlaying = false;
                        updateZenAudioPlayState('paused');
                    }
                    return;
                }

                // If browser is actively seeking to target position, do not evaluate slice boundary
                if (audioPlayer.seeking) return;

                const cur = audioPlayer.currentTime;
                // Mark entered segment once currentTime is within [pureStart - 0.35, pureEnd]
                if (cur >= (pureStart - 0.35) && cur < pureEnd) {
                    hasEnteredSegment = true;
                    if (audioPlayer.volume === 0 && cur >= (pureStart - 0.05)) {
                        audioPlayer.volume = 1.0;
                    }
                }

                // Strictly cutoff once entered AND reached effectiveCutoffEnd boundary
                if (hasEnteredSegment && cur >= effectiveCutoffEnd) {
                    finishSegment();
                }
            };

            // Start playback once audio element is confirmed at pureStart
            const startPlaybackAtTarget = () => {
                if (currentToken !== this.playToken) return;

                audioPlayer.muted = false;

                const onAudioSeeked = () => {
                    if (currentToken !== this.playToken) return;
                    if (Math.abs(audioPlayer.currentTime - pureStart) <= 0.8 || audioPlayer.currentTime >= pureStart) {
                        hasEnteredSegment = true;
                        audioPlayer.volume = 1.0;
                    }
                };

                const onAudioPlaying = () => {
                    if (currentToken !== this.playToken) return;
                    this.isBuffering = false;
                    this.isPlaying = true;
                    updateZenAudioPlayState('playing');

                    // If volume was suppressed during seek, unmute once target position is verified
                    if (audioPlayer.volume === 0 && (Math.abs(audioPlayer.currentTime - pureStart) <= 0.8 || audioPlayer.currentTime >= pureStart)) {
                        audioPlayer.volume = 1.0;
                        hasEnteredSegment = true;
                    }

                    // 1. High-frequency 8ms boundary check
                    if (!dictAudioIntervalId && !finishTriggered && !audioPlayer.paused) {
                        dictAudioIntervalId = setInterval(checkSliceBoundary, 8);
                    }

                    // 2. RequestAnimationFrame monitor
                    if (!dictAudioRafId && !finishTriggered && !audioPlayer.paused) {
                        const monitorPlayback = () => {
                            if (currentToken !== this.playToken || finishTriggered) return;
                            checkSliceBoundary();
                            if (!finishTriggered && !audioPlayer.paused) {
                                dictAudioRafId = requestAnimationFrame(monitorPlayback);
                            } else {
                                dictAudioRafId = null;
                            }
                        };
                        dictAudioRafId = requestAnimationFrame(monitorPlayback);
                    }
                };

                const onAudioWaiting = () => {
                    if (currentToken !== this.playToken) return;
                    this.isBuffering = true;
                    updateZenAudioPlayState('buffering');
                };

                dictAudioSeekedHandler = onAudioSeeked;
                dictAudioPlayingHandler = onAudioPlaying;
                dictAudioWaitingHandler = onAudioWaiting;
                dictAudioTimeupdateHandler = checkSliceBoundary;

                audioPlayer.addEventListener('seeked', onAudioSeeked);
                audioPlayer.addEventListener('playing', onAudioPlaying);
                audioPlayer.addEventListener('waiting', onAudioWaiting);
                audioPlayer.addEventListener('timeupdate', checkSliceBoundary);

                // Generous safety timeout (3x duration + 4s) to catch frozen tabs without premature cutoff
                const maxSafetyMs = Math.max(10000, ((duration / rate) * 1000) * 3 + 4000);
                dictAudioStopTimer = setTimeout(() => {
                    if (currentToken === this.playToken && !audioPlayer.paused) {
                        finishSegment();
                    }
                }, maxSafetyMs);

                const playPromise = audioPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        if (currentToken !== this.playToken) return;
                        clearDictAudioLoop();
                        audioPlayer.volume = 1.0;
                        console.warn('[DictAudioEngine] play() rejected:', e);
                        this.isBuffering = false;
                        this.isPlaying = false;
                        updateZenAudioPlayState('paused');

                        if (e && e.name === 'NotAllowedError') {
                            // Autoplay blocked without direct user gesture: stay paused cleanly without burning candidate URLs
                            return;
                        }
                        if (!isRetry && e && e.name === 'AbortError') {
                            setTimeout(() => {
                                if (audioPlayer && audioPlayer.paused && currentToken === this.playToken) {
                                    this.playSegment(startSec, endSec, true, forceFromStart);
                                }
                            }, 120);
                        } else if (this.activeExamBlobUrl) {
                            try { URL.revokeObjectURL(this.activeExamBlobUrl); } catch(revErr) {}
                            this.activeExamBlobUrl = null;
                            if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.deleteExamAudio === 'function') {
                                window.ToyAudioCacheDB.deleteExamAudio(this.currentLevel, this.currentExamTitle).catch(() => {});
                            }
                            if (this.cloudCandidates && this.cloudCandidates.length > 0 && audioPlayer && currentToken === this.playToken) {
                                this._candIdx = 0;
                                audioPlayer.src = this.cloudCandidates[0];
                                this.playSegment(startSec, endSec, true, forceFromStart);
                            }
                        } else if (this.cloudCandidates && !this.activeExamBlobUrl && (this._candIdx + 1) < this.cloudCandidates.length) {
                            this._candIdx++;
                            if (audioPlayer && currentToken === this.playToken) {
                                audioPlayer.src = this.cloudCandidates[this._candIdx];
                                this.playSegment(startSec, endSec, true, forceFromStart);
                            }
                        } else {
                            this._candIdx = 0;
                        }
                    });
                }
            };

            // Seek coordination: set currentTime to pureStart and start playback
            const executeSeekAndStart = () => {
                if (currentToken !== this.playToken) return;

                const needsSeek = Math.abs(audioPlayer.currentTime - pureStart) > 0.08;
                if (needsSeek) {
                    // Suppress residual buffer bleed from previous position/0.0s during seek
                    audioPlayer.volume = 0;
                    try {
                        audioPlayer.currentTime = pureStart;
                    } catch(seekErr) {
                        console.warn('[DictAudioEngine] Seek error:', seekErr);
                    }
                } else {
                    audioPlayer.volume = 1.0;
                }
                startPlaybackAtTarget();
            };

            if (audioPlayer.readyState >= 1 && !isSrcChanging) {
                executeSeekAndStart();
            } else {
                let metaHandled = false;
                const onMetadataReady = () => {
                    if (metaHandled || currentToken !== this.playToken) return;
                    metaHandled = true;
                    if (dictAudioMetaTimer) {
                        clearTimeout(dictAudioMetaTimer);
                        dictAudioMetaTimer = null;
                    }
                    audioPlayer.removeEventListener('loadedmetadata', onMetadataReady);
                    audioPlayer.removeEventListener('canplay', onMetadataReady);
                    dictAudioMetaReadyHandler = null;
                    executeSeekAndStart();
                };

                const onLateMetadata = () => {
                    dictAudioLateMetaHandler = null;
                    if (currentToken === this.playToken && Math.abs(audioPlayer.currentTime - pureStart) > 0.08) {
                        try { audioPlayer.currentTime = pureStart; } catch(e) {}
                    }
                };

                dictAudioMetaReadyHandler = onMetadataReady;
                dictAudioLateMetaHandler = onLateMetadata;

                audioPlayer.addEventListener('loadedmetadata', onMetadataReady, { once: true });
                audioPlayer.addEventListener('canplay', onMetadataReady, { once: true });
                audioPlayer.addEventListener('loadedmetadata', onLateMetadata, { once: true });

                // Metadata safety fallback timeout (2500ms for initial network stream handshake)
                dictAudioMetaTimer = setTimeout(() => {
                    dictAudioMetaTimer = null;
                    if (!metaHandled && currentToken === this.playToken) {
                        onMetadataReady();
                    }
                }, 2500);
            }
        } catch(e) {
            console.error('[DictAudioEngine] playSegment error:', e);
            audioPlayer.muted = false;
            this.isBuffering = false;
            this.isPlaying = false;
            updateZenAudioPlayState('paused');
        }
    },

    updatePlaybackRate(newRate) {
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (!audioPlayer) return;
        audioPlayer.playbackRate = newRate;
    },

    replay(startSec, endSec) {
        this.playSegment(startSec, endSec, false, true);
    }
};

if (typeof window !== 'undefined') {
    window.DictAudioEngine = DictAudioEngine;

    // ⚡ Listen for background exam audio caching completion
    window.addEventListener('exam-audio-cached', (e) => {
        try {
            if (e.detail && e.detail.examTitle === DictAudioEngine.currentExamTitle && !DictAudioEngine.activeExamBlobUrl) {
                if (window.ToyAudioCacheDB && typeof window.ToyAudioCacheDB.getExamAudioBlob === 'function') {
                    window.ToyAudioCacheDB.getExamAudioBlob(DictAudioEngine.currentLevel, DictAudioEngine.currentExamTitle).then(blob => {
                        if (blob && !DictAudioEngine.activeExamBlobUrl && DictAudioEngine.currentExamTitle === e.detail.examTitle) {
                            if (DictAudioEngine.activeExamBlobUrl) {
                                try { URL.revokeObjectURL(DictAudioEngine.activeExamBlobUrl); } catch(revErr) {}
                            }
                            DictAudioEngine.activeExamBlobUrl = URL.createObjectURL(blob);
                            console.log(`[DictAudioEngine] ⚡ Background cache completed for ${e.detail.examTitle}`);
                            // Intentionally do not swap player.src mid-session to avoid interrupting user's active session
                        }
                    });
                }
            }
        } catch(err) {}
    });
}

function playDictationAudioSegment(startSec, endSec, isRetry = false, forceFromStart = false) {
    DictAudioEngine.playSegment(startSec, endSec, isRetry, forceFromStart);
}
window.playDictationAudioSegment = playDictationAudioSegment;

function toggleDictationPlayPause() {
    if (typeof clearDictAutoAdvance === 'function') {
        clearDictAutoAdvance();
    }
    const sents = window.currentDictSentences || (typeof currentDictSentences !== 'undefined' ? currentDictSentences : null);
    if (!sents || sents.length === 0 || !window.DictAudioEngine) return;
    const curIdx = (typeof window.currentDictIndex === 'number')
        ? window.currentDictIndex
        : ((typeof currentDictIndex === 'number') ? currentDictIndex : 0);
    const sent = sents[curIdx];
    if (!sent) return;
    if (DictAudioEngine.isPlaying || DictAudioEngine.isBuffering) {
        DictAudioEngine.pause();
    } else {
        DictAudioEngine.playSegment(sent.start, sent.end, false, false);
    }
}
window.toggleDictationPlayPause = toggleDictationPlayPause;

// ==========================================================================
// 🛡️ Automatic Audio Interruption Management (Background / Lockscreen / Hidden)
// ==========================================================================
function pauseAllActiveAppAudios() {
    try {
        if (window.DictAudioEngine && (window.DictAudioEngine.isPlaying || window.DictAudioEngine.isBuffering)) {
            window.DictAudioEngine.pause();
            console.log('[DictAudioEngine] ⏸️ Audio safely paused on app background/visibility change');
        }
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (audioPlayer && !audioPlayer.paused) {
            audioPlayer.pause();
        }
        if (typeof window.clearDictAutoAdvance === 'function') {
            window.clearDictAutoAdvance();
        }
    } catch(e) {}
}
window.pauseAllActiveAppAudios = pauseAllActiveAppAudios;

document.addEventListener('visibilitychange', () => {
    if (document.hidden || document.visibilityState === 'hidden') {
        pauseAllActiveAppAudios();
    }
});

window.addEventListener('pagehide', pauseAllActiveAppAudios);
window.addEventListener('freeze', pauseAllActiveAppAudios);
