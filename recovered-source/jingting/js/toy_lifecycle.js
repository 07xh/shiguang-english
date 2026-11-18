/* === js/toy_lifecycle.js === */
/**
 * ==========================================================================
 * Toy Permissions Initialization, Active View Re-hydration & SDK Lifecycle
 * ==========================================================================
 */

window.reRenderActiveLobbies = function() {
    const active = window.activeView || (document.body ? document.body.dataset.view : null);

    if (typeof renderLobbyGrid === 'function' && document.getElementById('exam-grid')) {
        const filter = window.currentListeningFilter || (typeof currentFilter !== 'undefined' ? currentFilter : 'ALL');
        renderLobbyGrid(filter);
    }
    if (typeof renderWrittenLobbyGrid === 'function' && document.getElementById('written-exam-grid')) {
        const wFilter = (typeof currentWrittenFilterRange !== 'undefined') ? currentWrittenFilterRange : ((typeof currentWrittenFilter !== 'undefined') ? currentWrittenFilter : 'ALL');
        renderWrittenLobbyGrid(wFilter);
    }
    if (typeof renderDictationLobbyGrid === 'function' && document.getElementById('dictation-exam-grid')) {
        const dFilter = window.currentDictationFilter || 'ALL';
        renderDictationLobbyGrid(dFilter);
    }
    if (typeof renderDailyLobbyGrid === 'function' && document.getElementById('daily-exam-grid')) {
        renderDailyLobbyGrid();
    }

    // Refresh active arena answer-sheet drawers and active question state when permissions change
    const p = window.ToyPermissions;
    if (typeof window.updateHeaderControlsForView === 'function' && active) {
        window.updateHeaderControlsForView(active);
    }

    if (active === 'quiz') {
        const curTitle = window.currentExamTitle || (typeof currentExamTitle !== 'undefined' ? currentExamTitle : '');
        const curLvl = (typeof window.getExamLevelFromId === 'function' && curTitle)
            ? window.getExamLevelFromId(curTitle)
            : (window.currentExamLevel || 'cet4');
        const mList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
        const examIdx = Math.max(0, mList.findIndex(m => m.title === curTitle || m.examId === curTitle));
        const curIdx = (typeof currentQIndex === 'number') ? currentQIndex : 0;

        if (p && !p.canAccessListening(examIdx, 0, curLvl)) {
            if (typeof switchView === 'function') switchView('lobby', false, true);
        } else if (p && !p.canAccessListening(examIdx, curIdx, curLvl)) {
            if (typeof renderQuestion === 'function') renderQuestion(0, { preserveScroll: true });
        } else if (typeof renderQuestion === 'function') {
            renderQuestion(curIdx, { preserveAudio: true, preserveScroll: true });
        }
        const drawerMask = document.getElementById('drawer-mask');
        if (drawerMask && drawerMask.classList.contains('active') && typeof window.openQuestionDrawer === 'function') {
            window.openQuestionDrawer();
        } else if (typeof window.renderListeningDrawerGrid === 'function') {
            window.renderListeningDrawerGrid();
        }
    } else if (active === 'written-arena') {
        const curTitle = window.currentWrittenExamTitle || (typeof currentWrittenExamTitle !== 'undefined' ? currentWrittenExamTitle : '');
        const curLvl = (typeof window.getExamLevelFromId === 'function' && curTitle)
            ? window.getExamLevelFromId(curTitle)
            : (window.currentExamLevel || 'cet4');
        const examIdx = (typeof getWrittenExamTrackIndex === 'function')
            ? Math.max(0, getWrittenExamTrackIndex(curTitle, curLvl))
            : 0;
        const curIdx = (typeof currentWrittenQIndex === 'number') ? currentWrittenQIndex : 0;

        if (p && !p.canAccessWrittenExam(examIdx, 0, curLvl)) {
            if (typeof switchView === 'function') switchView('written-lobby', false, true);
        } else if (p && !p.canAccessWrittenExam(examIdx, curIdx, curLvl)) {
            if (typeof renderWrittenQuestion === 'function') renderWrittenQuestion(0, { preserveScroll: true });
        } else if (typeof renderWrittenQuestion === 'function') {
            const passageCard = document.getElementById('written-passage-card');
            if (passageCard) passageCard._renderedPassageKey = '';
            renderWrittenQuestion(curIdx, { preserveScroll: true });
        }
        const drawerMask = document.getElementById('drawer-mask');
        if (drawerMask && drawerMask.classList.contains('active') && typeof window.openWrittenDrawer === 'function') {
            window.openWrittenDrawer();
        } else if (typeof window.renderWrittenDrawerGrid === 'function') {
            window.renderWrittenDrawerGrid();
        }
    } else if (active === 'dictation-arena') {
        const curIdx = (typeof currentDictIndex === 'number') ? currentDictIndex : 0;
        if (window._isDailyListening) {
            const dayIdx = Math.max(0, (window._currentDailyDay || 1) - 1);
            if (p && !p.canAccessDaily(dayIdx, 0)) {
                if (typeof switchView === 'function') switchView('daily-lobby', false, true);
            } else if (p && !p.canAccessDaily(dayIdx, curIdx)) {
                if (typeof renderDictationSentence === 'function') renderDictationSentence(0, { preserveScroll: true });
            } else if (typeof renderDictationSentence === 'function') {
                renderDictationSentence(curIdx, { preserveAudio: true, preserveScroll: true, keepModes: true });
            }
        } else {
            const curTitle = window.currentDictExamTitle || (typeof currentDictExamTitle !== 'undefined' ? currentDictExamTitle : '');
            const curLvl = (typeof window.getExamLevelFromId === 'function' && curTitle)
                ? window.getExamLevelFromId(curTitle)
                : (window.currentExamLevel || 'cet4');
            const mList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
            const examIdx = Math.max(0, mList.findIndex(m => m.title === curTitle || m.examId === curTitle));
            if (p && !p.canAccessDictation(examIdx, 0, curLvl, curTitle)) {
                if (typeof switchView === 'function') switchView('dictation-lobby', false, true);
            } else if (p && !p.canAccessDictation(examIdx, curIdx, curLvl, curTitle)) {
                if (typeof renderDictationSentence === 'function') renderDictationSentence(0, { preserveScroll: true });
            } else if (typeof renderDictationSentence === 'function') {
                renderDictationSentence(curIdx, { preserveAudio: true, preserveScroll: true, keepModes: true });
            }
        }
        const dictDrawerMask = document.getElementById('dict-drawer-mask');
        if (dictDrawerMask && dictDrawerMask.classList.contains('active') && typeof window.openDictationDrawer === 'function') {
            window.openDictationDrawer();
        }
    }

    const homeName = document.getElementById('home-user-name');
    if (homeName && window.currentUserProfile) homeName.textContent = window.currentUserProfile.nickname;
    if (window.HomeTabs && typeof window.HomeTabs.refreshActivePage === 'function') {
        window.HomeTabs.refreshActivePage();
    }
};

// Synchronously load cached permissions immediately on load
if (window.ToyPermissions && typeof window.ToyPermissions.init === 'function') {
    window.ToyPermissions.init();
}

/**
 * Real-time Lifecycle Event Listeners (visibilitychange, pageshow, focus — zero interval polling to prevent 307044)
 */
function initToySdkRealtimeMonitoring() {
    let _wasPageHidden = false;
    let _lastLifecycleSyncAt = 0;

    const triggerReturnSync = (forceFromBFCache = false) => {
        if (!forceFromBFCache && !_wasPageHidden) return;
        const now = Date.now();
        if (now - _lastLifecycleSyncAt < 2500) return;
        _lastLifecycleSyncAt = now;
        _wasPageHidden = false;

        if (window.ToyPermissions && !window.ToyPermissions.isTestOverridden) {
            window.ToyPermissions.syncSdkStatus(false).catch(() => {});
            if (typeof fetchUserProfile === 'function' && !window._profileRequiresUserGesture) {
                fetchUserProfile(false).catch(() => {});
            }
        }
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            _wasPageHidden = true;
        } else if (document.visibilityState === 'visible') {
            triggerReturnSync(false);
        }
    });

    window.addEventListener('pagehide', () => {
        _wasPageHidden = true;
    });

    window.addEventListener('focus', () => {
        triggerReturnSync(false);
    });

    window.addEventListener('pageshow', (e) => {
        if (e && e.persisted) {
            triggerReturnSync(true);
        } else {
            triggerReturnSync(false);
        }
    });
}

initToySdkRealtimeMonitoring();

/**
 * Dynamic Container & Safe Area Adapter (toy.onContainerChange / getContainerState)
 * Conforms to Toy JS SDK 2026-09-18 Official Specification.
 * Restores standard native container mode (immersive: false) to retain the native bottom comment & interaction bar.
 */
function initToyContainerAdapter() {
    let _containerAttached = false;
    const callSdkBounded = (fn, ms) => {
        if (typeof window.callToySdkWithTimeout === 'function') {
            return window.callToySdkWithTimeout(fn, ms);
        }
        return Promise.resolve().then(fn);
    };

    const restoreStandardMode = async () => {
        if (!window.toy) return;
        try {
            if (typeof window.toy.isSupport === 'function') {
                const supported = await callSdkBounded(() => window.toy.isSupport('setContainerMode'), 1500).catch(() => false);
                if (!supported) return;
            }
            if (typeof window.toy.setContainerMode === 'function') {
                await callSdkBounded(
                    () => window.toy.setContainerMode({ orientation: 'portrait', immersive: false }),
                    2500
                );
                console.log('[ToySDK] Confirmed standard non-immersive portrait container mode (immersive: false, native top & bottom bars visible)');
            }
        } catch (e) {
            console.log('[ToySDK] setContainerMode notice:', e);
        }
    };

    const attach = () => {
        if (_containerAttached) return true;
        if (!window.toy) return false;
        _containerAttached = true;

        const applyState = (state) => {
            if (!state) return;
            const root = document.documentElement;
            if (state.safeArea) {
                if (typeof state.safeArea.top === 'number') {
                    root.style.setProperty('--toy-safe-top', `${state.safeArea.top}px`);
                }
                if (typeof state.safeArea.bottom === 'number') {
                    root.style.setProperty('--toy-safe-bottom', `${state.safeArea.bottom}px`);
                }
                if (typeof state.safeArea.left === 'number') {
                    root.style.setProperty('--toy-safe-left', `${state.safeArea.left}px`);
                }
                if (typeof state.safeArea.right === 'number') {
                    root.style.setProperty('--toy-safe-right', `${state.safeArea.right}px`);
                }
            }
            if (state.orientation) {
                root.setAttribute('data-toy-orientation', state.orientation);
            }
            if (typeof state.immersive === 'boolean') {
                root.setAttribute('data-toy-immersive', String(state.immersive));
            }
            if (state.deviceType) {
                root.setAttribute('data-toy-device', state.deviceType);
                window._toyDeviceType = state.deviceType;
            }
        };

        const bindContainerListeners = () => {
            try {
                if (typeof window.toy.onContainerChange === 'function') {
                    window._toyContainerOff = window.toy.onContainerChange((state) => {
                        applyState(state);
                    });
                    restoreStandardMode();
                } else if (typeof window.toy.getContainerState === 'function') {
                    callSdkBounded(() => window.toy.getContainerState(), 2500).then((state) => {
                        applyState(state);
                        restoreStandardMode();
                    }).catch(() => {});
                }
            } catch (e) {}
        };

        try {
            if (window.toy.isSupport && typeof window.toy.isSupport === 'function') {
                callSdkBounded(() => window.toy.isSupport('onContainerChange'), 1500).then((ok) => {
                    if (ok) bindContainerListeners();
                }).catch(() => {});
                return true;
            }
            bindContainerListeners();
            return true;
        } catch (e) {
            return true;
        }
    };

    // Hook invoked (once) if toy-sdk.js becomes available only after bundle.js booted
    window.__onToySdkReady = function() {
        if (window.__toySdkReadyRan) return;
        window.__toySdkReadyRan = true;
        attach();
        if (window.ToyPermissions && !window.ToyPermissions.isTestOverridden) {
            window.ToyPermissions.syncSdkStatus(false).then(() => {
                if (window.ToyPermissions.updateUI) window.ToyPermissions.updateUI();
            }).catch(() => {});
        }
        if (typeof fetchUserProfile === 'function' && !window._profileRequiresUserGesture) {
            fetchUserProfile(false).catch(() => {});
        }
        if (typeof loadFromBilibiliCloudStorage === 'function' && !window._initialBootCloudLoadDone) {
            window._initialBootCloudLoadDone = true;
            loadFromBilibiliCloudStorage().catch(() => {});
        }
        if (typeof fetchAndRenderRankList === 'function' && !window._initialRankFetchTriggered) {
            fetchAndRenderRankList().catch(() => {});
        }
    };

    if (!attach()) {
        const timer = setInterval(() => {
            if (attach()) {
                clearInterval(timer);
                if (typeof window.__onToySdkReady === 'function') {
                    window.__onToySdkReady();
                }
            }
        }, 120);
        if (timer && typeof timer.unref === 'function') timer.unref();
        const stopTimer = setTimeout(() => clearInterval(timer), 4000);
        if (stopTimer && typeof stopTimer.unref === 'function') stopTimer.unref();
    }
}

initToyContainerAdapter();
