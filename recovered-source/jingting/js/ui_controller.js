/* === js/ui_controller.js === */
/**
 * ==========================================================================
 * UI Controller & View Routing Engine (Navigation, Popover Menus, Shortcuts)
 * ==========================================================================
 */


let activeView = 'home';
try {
    Object.defineProperty(window, 'activeView', {
        get() { return activeView; },
        set(v) { activeView = v; },
        configurable: true
    });
} catch (e) {
    window.activeView = activeView;
}

window.enableHorizontalDragScroll = function(el, wrapperEl) {
    if (!el) return;
    const wrap = wrapperEl || el.parentElement || el;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    function updateIndicators() {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 2) {
            wrap.classList.remove('can-scroll-left', 'can-scroll-right');
            return;
        }
        wrap.classList.toggle('can-scroll-left', el.scrollLeft > 4);
        wrap.classList.toggle('can-scroll-right', el.scrollLeft < (maxScroll - 4));
    }

    if (!el.dataset) el.dataset = {};
    if (!el.dataset.dragInit) {
        el.dataset.dragInit = 'true';

        el.addEventListener('mousedown', (e) => {
            isDown = true;
            isDragging = false;
            el.style.cursor = 'grabbing';
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                isDown = false;
                el.style.cursor = 'grab';
                setTimeout(() => { isDragging = false; }, 60);
            }
        });

        el.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 1.5;
            if (Math.abs(walk) > 3) {
                isDragging = true;
            }
            el.scrollLeft = scrollLeft - walk;
            updateIndicators();
        });

        el.addEventListener('click', (e) => {
            if (isDragging) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);

        el.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                updateIndicators();
            }
        }, { passive: false });

        el.addEventListener('scroll', updateIndicators, { passive: true });
    }

    setTimeout(() => {
        updateIndicators();
        const activePill = el.querySelector('.active');
        if (activePill && el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
            const pillCenter = activePill.offsetLeft + activePill.offsetWidth / 2;
            const targetScroll = Math.max(0, pillCenter - el.clientWidth / 2);
            el.scrollLeft = targetScroll;
            updateIndicators();
        }
    }, 40);
};

// History State Management for Android Physical Back & iOS Swipe Back
(function initHistoryNavigation() {
    try {
        if (window.history && window.history.replaceState) {
            window.history.replaceState({ view: 'home', step: 0 }, '');
            window.history.pushState({ view: 'home', step: 1 }, '');
        }
    } catch(e) {}

    let historyStep = 1;
    window._pushToyHistory = function(viewName) {
        try {
            if (!window.history || !window.history.pushState) return;
            historyStep++;
            window.history.pushState({ view: viewName, step: historyStep }, '');
        } catch(e) {}
    };
    window._replaceToyHistory = function(viewName) {
        try {
            if (!window.history || !window.history.replaceState) return;
            window.history.replaceState({ view: viewName, step: Math.max(1, historyStep) }, '');
        } catch(e) {}
    };
    window._resetToyHistory = function() {
        historyStep = 1;
    };
    window._getToyHistoryStep = function() {
        return historyStep;
    };

    window.addEventListener('popstate', (e) => {
        if (historyStep > 0) historyStep--;

        // 1. Check and dismiss any open drawers, modals, popovers, or audio settings masks
        let dismissedOverlay = false;
        const openOverlays = document.querySelectorAll('.drawer-mask.active, .modal-mask.active, .dict-settings-mask.active');
        if (openOverlays.length > 0) {
            openOverlays.forEach(el => el.classList.remove('active'));
            dismissedOverlay = true;
        }
        const activeDictDrawer = document.getElementById('dict-drawer-mask');
        if (activeDictDrawer && (activeDictDrawer.classList.contains('active') || activeDictDrawer.style.display === 'block' || activeDictDrawer.style.display === 'flex')) {
            if (typeof window.closeDictationDrawer === 'function') {
                window.closeDictationDrawer();
            } else {
                activeDictDrawer.classList.remove('active');
                activeDictDrawer.style.display = 'none';
            }
            dismissedOverlay = true;
        }
        const activeRegularDrawer = document.getElementById('drawer-mask');
        if (activeRegularDrawer && (activeRegularDrawer.classList.contains('active') || activeRegularDrawer.style.display === 'block')) {
            activeRegularDrawer.classList.remove('active');
            activeRegularDrawer.style.display = 'none';
            dismissedOverlay = true;
        }
        const settingsMask = document.getElementById('dict-audio-settings-mask');
        if (settingsMask && (settingsMask.classList.contains('active') || settingsMask.style.display === 'block')) {
            settingsMask.classList.remove('active');
            settingsMask.style.display = 'none';
            dismissedOverlay = true;
        }
        const popover = document.getElementById('popover-quiz-actions');
        if (popover && popover.classList.contains('show')) {
            popover.classList.remove('show');
            dismissedOverlay = true;
        }
        const rankModalOverlay = document.getElementById('rank-modal-overlay');
        if (rankModalOverlay && (rankModalOverlay.classList.contains('is-active') || rankModalOverlay.style.display === 'block')) {
            if (typeof window.closeRankModal === 'function') {
                window.closeRankModal();
            } else {
                rankModalOverlay.classList.remove('is-active');
                document.body.classList.remove('rank-modal-open');
            }
            dismissedOverlay = true;
        }
        if (!dismissedOverlay && window.HomeTabs && typeof window.HomeTabs.handleBack === 'function' && window.HomeTabs.handleBack()) {
            dismissedOverlay = true;
        }

        // If Back was pressed while a modal/drawer was open, only close the overlay and keep current view!
        if (dismissedOverlay) {
            try {
                historyStep++;
                window.history.pushState({ view: activeView, step: historyStep }, '');
            } catch(err) {}
            return;
        }

        // 2. Check if state specifies target view
        if (e.state && e.state.view && e.state.view !== activeView) {
            switchView(e.state.view, true);
            return;
        }

        // 3. Hierarchical backward navigation fallback
        if (activeView === 'quiz') {
            switchView('lobby', true);
        } else if (activeView === 'written-arena') {
            switchView('written-lobby', true);
        } else if (activeView === 'dictation-arena') {
            if (window._isDailyListening) switchView('daily-lobby', true);
            else switchView('dictation-lobby', true);
        } else if (activeView === 'lobby' || activeView === 'written-lobby' || activeView === 'dictation-lobby' || activeView === 'daily-lobby' || activeView === 'rank') {
            switchView('home', true);
        } else if (activeView === 'home') {
            // 4. Double-back exit guard on Home portal
            const now = Date.now();
            if (window._lastToyBackExitTime && (now - window._lastToyBackExitTime < 2500)) {
                if (window.toy && typeof window.toy.closeBrowser === 'function') {
                    window.toy.closeBrowser().catch(() => {});
                }
                return;
            }
            window._lastToyBackExitTime = now;
            try {
                historyStep++;
                window.history.pushState({ view: 'home', step: historyStep }, '');
            } catch(err) {}
            if (typeof showToyToast === 'function') {
                showToyToast('再次返回退出应用');
            }
        }
    });
})();

function switchView(viewName, isPopstate = false, isReplace = false) {
    window._navActionSeqId = (window._navActionSeqId || 0) + 1;
    if (!isPopstate && viewName !== activeView) {
        if (isReplace && typeof window._replaceToyHistory === 'function') {
            window._replaceToyHistory(viewName);
        } else if (typeof window._pushToyHistory === 'function') {
            window._pushToyHistory(viewName);
        }
    }

    // If navigating away from listening quiz arena, pause audio player
    if (activeView === 'quiz' && viewName !== 'quiz') {
        if (typeof pauseAudio === 'function') {
            pauseAudio();
        }
    }

    // If navigating away from dictation arena, pause audio player
    if (activeView === 'dictation-arena' && viewName !== 'dictation-arena') {
        if (typeof window.clearDictAutoAdvance === 'function') {
            window.clearDictAutoAdvance();
        }
        if (window.DictAudioEngine && typeof window.DictAudioEngine.stop === 'function') {
            window.DictAudioEngine.stop();
        }
        const audioPlayer = document.getElementById('dictation-audio-player');
        if (audioPlayer) audioPlayer.pause();
        if (viewName !== 'daily-lobby') {
            window._isDailyListening = false;
            window._currentDailyDay = 0;
        }
    }

    const previousView = activeView;
    const isLeavingArena = (
        (previousView === 'quiz' || previousView === 'written-arena' || previousView === 'dictation-arena') &&
        viewName !== previousView
    );
    if (isLeavingArena && typeof window.saveUserCloudData === 'function') {
        window.saveUserCloudData(null, true);
    }

    activeView = viewName;
    window.activeView = viewName;
    hideContextualPopover();
    if (typeof window.dismissProofreadPopovers === 'function') {
        window.dismissProofreadPopovers();
    }

    const viewHome = document.getElementById('view-home');
    const viewLobby = document.getElementById('view-lobby');
    const viewWrittenLobby = document.getElementById('view-written-lobby');
    const viewDictationLobby = document.getElementById('view-dictation-lobby');
    const viewDailyLobby = document.getElementById('view-daily-lobby');
    const viewQuiz = document.getElementById('view-quiz');
    const viewWrittenArena = document.getElementById('view-written-arena');
    const viewDictationArena = document.getElementById('view-dictation-arena');
    const viewRank = document.getElementById('view-rank');
    const viewsContainer = document.querySelector('.views-container');

    const VIEW_MAP = {
        'home': viewHome,
        'lobby': viewLobby,
        'written-lobby': viewWrittenLobby,
        'dictation-lobby': viewDictationLobby,
        'daily-lobby': viewDailyLobby,
        'quiz': viewQuiz,
        'written-arena': viewWrittenArena,
        'dictation-arena': viewDictationArena,
        'rank': viewRank
    };
    const LOBBY_GRID_IDS = {
        'lobby': 'exam-grid',
        'written-lobby': 'written-exam-grid',
        'dictation-lobby': 'dictation-exam-grid',
        'daily-lobby': 'daily-exam-grid'
    };
    if (!window._lobbyScrollMemory) window._lobbyScrollMemory = Object.create(null);

    const quizNavGroup = document.getElementById('quiz-nav-group');
    const writtenNavGroup = document.getElementById('written-nav-group');
    const dictationNavGroup = document.getElementById('dictation-nav-group');
    const bottomNavBar = document.querySelector('.bottom-nav-bar');

    const VIEW_DEPTH = {
        'home': 0,
        'lobby': 1,
        'written-lobby': 1,
        'dictation-lobby': 1,
        'daily-lobby': 1,
        'rank': 1,
        'quiz': 2,
        'written-arena': 2,
        'dictation-arena': 2
    };

    const prevView = previousView;
    const isSameView = (prevView === viewName);
    const oldDepth = (typeof prevView === 'string' && typeof VIEW_DEPTH[prevView] === 'number') ? VIEW_DEPTH[prevView] : 0;
    const newDepth = (typeof VIEW_DEPTH[viewName] === 'number') ? VIEW_DEPTH[viewName] : 0;

    // Capture outgoing scroll metrics BEFORE switching DOM or resetting scroll
    const prevWinY = (typeof window.scrollY === 'number') ? window.scrollY : (window.pageYOffset || 0);
    if (!isSameView && LOBBY_GRID_IDS[prevView] && newDepth > oldDepth) {
        const prevGridEl = document.getElementById(LOBBY_GRID_IDS[prevView]);
        window._lobbyScrollMemory[prevView] = {
            winY: prevWinY,
            gridY: prevGridEl ? prevGridEl.scrollTop : 0
        };
    } else if (!isSameView && LOBBY_GRID_IDS[viewName] && oldDepth === 0) {
        delete window._lobbyScrollMemory[viewName];
    }

    // Cancel any in-flight dual-layer or view transition classes cleanly
    if (window._dualTransCleanTimer) {
        clearTimeout(window._dualTransCleanTimer);
        window._dualTransCleanTimer = null;
    }
    if (viewsContainer && viewsContainer.classList) {
        viewsContainer.classList.remove('is-dual-transitioning');
    }
    const allViewEls = [viewHome, viewLobby, viewWrittenLobby, viewDictationLobby, viewDailyLobby, viewQuiz, viewWrittenArena, viewDictationArena, viewRank];
    allViewEls.forEach(v => {
        if (!v) return;
        if (v._viewAnimCleanTimer) {
            clearTimeout(v._viewAnimCleanTimer);
            v._viewAnimCleanTimer = null;
        }
        v.classList.remove(
            'active',
            'is-view-leaving',
            'view-leave-push',
            'view-leave-pop',
            'view-leave-fade',
            'view-anim-push',
            'view-anim-push-over',
            'view-anim-pop',
            'view-anim-pop-under',
            'view-anim-fade',
            'view-split-enter'
        );
        if (v.style && typeof v.style.removeProperty === 'function') {
            v.style.removeProperty('--leave-offset-top');
        }
    });

    // Determine single-layer transition direction (instant outgoing unmount prevents any cross-height ghosting)
    const isDesktopPhoneShellCross = Boolean(
        !isSameView &&
        (oldDepth === 0 || newDepth === 0) &&
        typeof window.innerWidth === 'number' &&
        window.innerWidth >= 640 &&
        document.body &&
        document.body.classList &&
        !document.body.classList.contains('is-landscape') &&
        !document.body.classList.contains('is-tablet-device')
    );

    let transitionClass = '';
    if (!isSameView) {
        if (isDesktopPhoneShellCross) {
            transitionClass = 'view-anim-fade';
        } else if (newDepth > oldDepth) {
            transitionClass = 'view-anim-push';
        } else if (newDepth < oldDepth) {
            transitionClass = 'view-anim-pop';
        } else {
            transitionClass = 'view-anim-fade';
        }
    }

    updateHeaderControlsForView(viewName);

    if (quizNavGroup) quizNavGroup.style.display = 'none';
    if (writtenNavGroup) writtenNavGroup.style.display = 'none';
    if (dictationNavGroup) dictationNavGroup.style.display = 'none';
    if (bottomNavBar) {
        const showNav = (viewName === 'quiz' || viewName === 'written-arena' || viewName === 'dictation-arena');
        bottomNavBar.style.display = showNav ? 'flex' : 'none';
        if (showNav && typeof window.kickLiquidGlass === 'function') {
            setTimeout(() => window.kickLiquidGlass(), 60);
        }
    }

    // Trigger or stop practice duration tracking
    if (viewName === 'quiz' || viewName === 'written-arena' || viewName === 'dictation-arena') {
        if (typeof startPracticeTimer === 'function') startPracticeTimer();
    } else {
        if (typeof stopPracticeTimer === 'function') stopPracticeTimer();
    }
    
    // Stop any playing dictation audio when leaving dictation arena
    if (viewName !== 'dictation-arena') {
        if (window.DictAudioEngine && typeof window.DictAudioEngine.stop === 'function') {
            window.DictAudioEngine.stop();
        }
        const dictAudio = document.getElementById('dictation-audio-player');
        if (dictAudio && !dictAudio.paused) {
            dictAudio.pause();
        }
        if (typeof updateZenAudioPlayState === 'function') {
            updateZenAudioPlayState(false);
        }
        if (typeof window.hideCustomVirtualKeyboard === 'function') {
            window.hideCustomVirtualKeyboard();
        }
    }
    
    document.body.dataset.view = viewName;

    const addActiveWithAnim = (el) => {
        if (!el) return;
        el.classList.add('active');
        if (transitionClass) el.classList.add(transitionClass);
    };

    if (viewName === 'home') {
        document.querySelectorAll('.exam-card.is-activating').forEach(c => c.classList.remove('is-activating'));
        document.body.classList.add('view-home-active');
        document.body.classList.remove('view-functional-active');
        addActiveWithAnim(viewHome);
        updateDashboardStats();
        if (window.HomeTabs && typeof window.HomeTabs.refreshActivePage === 'function') {
            setTimeout(() => window.HomeTabs.refreshActivePage(), 30);
        }
    } else {
        document.body.classList.remove('view-home-active');
        document.body.classList.add('view-functional-active');
    }
    
    if (viewName === 'lobby') {
        addActiveWithAnim(viewLobby);
        if (window.currentExamLevel === 'daily' || window.currentExamLevel === 'ielts' || window.currentExamLevel === 'kaoyan') {
            window.currentExamLevel = 'cet4';
        }
        let text = '四级';
        if (window.currentExamLevel === 'cet6') text = '六级';
        else if (window.currentExamLevel === 'gaokao') text = '高考';
        document.querySelectorAll('.level-tag-bind').forEach(el => el.textContent = text);

        if (typeof updateYearFilterVisibility === 'function') updateYearFilterVisibility(window.currentExamLevel);
        if (typeof syncLobbyLevelPillsUI === 'function') syncLobbyLevelPillsUI(false);
        renderLobbyGrid(window.currentListeningFilter || 'ALL');
        updateDashboardStats();
        const b = document.getElementById('year-filter-bar');
        if (b) updateSegmentedSlider(b, false);
    } else if (viewName === 'written-lobby') {
        addActiveWithAnim(viewWrittenLobby);
        if (window.currentExamLevel === 'daily' || window.currentExamLevel === 'ielts') {
            window.currentExamLevel = 'cet4';
        }
        let text = '四级';
        if (window.currentExamLevel === 'cet6') text = '六级';
        else if (window.currentExamLevel === 'gaokao') text = '高考';
        else if (window.currentExamLevel === 'kaoyan') text = (window.currentKaoyanSubjectFilter === 'ENG2') ? '考研英语(二)' : '考研英语(一)';
        document.querySelectorAll('.level-tag-bind').forEach(el => el.textContent = text);

        if (typeof updateYearFilterVisibility === 'function') updateYearFilterVisibility(window.currentExamLevel);
        if (typeof syncLobbyLevelPillsUI === 'function') syncLobbyLevelPillsUI(false);
        renderWrittenLobbyGrid(window.currentWrittenFilterRange || 'ALL');
        updateDashboardStats();
        const b = document.getElementById('written-year-filter-bar');
        if (b) updateSegmentedSlider(b, false);
    } else if (viewName === 'dictation-lobby') {
        document.querySelectorAll('.exam-card.is-activating').forEach(c => c.classList.remove('is-activating'));
        addActiveWithAnim(viewDictationLobby);
        if (window.currentExamLevel === 'daily' || window.currentExamLevel === 'kaoyan') {
            window.currentExamLevel = 'cet4';
        }
        let text = '四级';
        if (window.currentExamLevel === 'cet6') text = '六级';
        else if (window.currentExamLevel === 'gaokao') text = '高考';
        else if (window.currentExamLevel === 'ielts') text = '雅思';
        document.querySelectorAll('.level-tag-bind').forEach(el => el.textContent = text);
        if (typeof updateYearFilterVisibility === 'function') updateYearFilterVisibility(window.currentExamLevel);
        if (typeof syncLobbyLevelPillsUI === 'function') syncLobbyLevelPillsUI(false);
        if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid(window.currentDictationFilter || 'ALL');
        updateDashboardStats();
        const b = document.getElementById('dictation-year-filter-bar');
        if (b) updateSegmentedSlider(b, false);
    } else if (viewName === 'daily-lobby') {
        document.querySelectorAll('.exam-card.is-activating').forEach(c => c.classList.remove('is-activating'));
        addActiveWithAnim(viewDailyLobby);
        window.currentExamLevel = 'daily';
        if (typeof syncLobbyLevelPillsUI === 'function') syncLobbyLevelPillsUI(false);
        if (typeof renderDailyLobbyGrid === 'function') renderDailyLobbyGrid();
        if (typeof updateDailyLobbyToggleUI === 'function') updateDailyLobbyToggleUI();
        updateDashboardStats();
    } else if (viewName === 'quiz') {
        addActiveWithAnim(viewQuiz);
        if (quizNavGroup) quizNavGroup.style.display = 'flex';
        if (writtenNavGroup) writtenNavGroup.style.display = 'none';
        if (dictationNavGroup) dictationNavGroup.style.display = 'none';
    } else if (viewName === 'written-arena') {
        addActiveWithAnim(viewWrittenArena);
        if (viewWrittenArena) viewWrittenArena.classList.add('view-split-enter');
        if (writtenNavGroup) writtenNavGroup.style.display = 'flex';
        if (quizNavGroup) quizNavGroup.style.display = 'none';
        if (dictationNavGroup) dictationNavGroup.style.display = 'none';
    } else if (viewName === 'dictation-arena') {
        addActiveWithAnim(viewDictationArena);
        if (quizNavGroup) quizNavGroup.style.display = 'none';
        if (writtenNavGroup) writtenNavGroup.style.display = 'none';
        if (typeof window.syncCustomVirtualKeyboardState === 'function') {
            window.syncCustomVirtualKeyboardState();
        } else if (dictationNavGroup) {
            dictationNavGroup.style.display = 'flex';
        }
    } else if (viewName === 'rank') {
        if (typeof window.openRankModal === 'function') {
            window.openRankModal();
            return;
        }
        addActiveWithAnim(viewRank);
        fetchAndRenderRankList();
    }

    const layoutSwitcher = document.getElementById('card-layout-switcher');
    if (layoutSwitcher) {
        layoutSwitcher.style.display = (viewName === 'home') ? 'flex' : 'none';
    }

    // Restore saved lobby scroll on back-pop, or reset cleanly to top on fresh navigation
    let targetWinY = 0;
    const savedLobbyScroll = (newDepth < oldDepth && LOBBY_GRID_IDS[viewName])
        ? window._lobbyScrollMemory[viewName]
        : null;
    if (LOBBY_GRID_IDS[viewName]) {
        const targetGridEl = document.getElementById(LOBBY_GRID_IDS[viewName]);
        if (targetGridEl) {
            const desiredGridY = savedLobbyScroll ? (savedLobbyScroll.gridY || 0) : 0;
            if (targetGridEl.style) targetGridEl.style.scrollBehavior = 'auto';
            targetGridEl.scrollTop = desiredGridY;
            if (targetGridEl.style) targetGridEl.style.scrollBehavior = '';
        }
    }
    if (savedLobbyScroll && typeof savedLobbyScroll.winY === 'number') {
        targetWinY = savedLobbyScroll.winY;
    }
    if (!isSameView) {
        try {
            window.scrollTo({ top: targetWinY, left: 0, behavior: 'instant' });
            const layoutEl = document.getElementById('app-layout');
            if (layoutEl) layoutEl.scrollTop = 0;
        } catch(e) {
            try { window.scrollTo(0, targetWinY); } catch (_) {}
        }
    }

    const activeViewEl = allViewEls.find(v => v && v.classList && v.classList.contains('active'));
    if (activeViewEl && (transitionClass || viewName === 'written-arena')) {
        const cleanViewAnim = () => {
            activeViewEl.classList.remove(
                'view-anim-push',
                'view-anim-push-over',
                'view-anim-pop',
                'view-anim-pop-under',
                'view-anim-fade',
                'view-split-enter'
            );
            activeViewEl._viewAnimCleanTimer = null;
        };
        if (typeof activeViewEl.addEventListener === 'function' && transitionClass) {
            activeViewEl.addEventListener('animationend', (ev) => {
                if (!ev || ev.target === activeViewEl) cleanViewAnim();
            }, { once: true });
        }
        activeViewEl._viewAnimCleanTimer = setTimeout(cleanViewAnim, 200);
    }
    if (viewName === 'home' && window.UXSegmentedGlider) {
        window.UXSegmentedGlider.sync('#home-training-mode-switcher', false);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => window.UXSegmentedGlider.sync('#home-training-mode-switcher', false));
        }
    }
}
window.switchView = switchView;

function triggerExamGridFilterTransition(gridOrId) {
    const grid = (typeof gridOrId === 'string') ? document.getElementById(gridOrId) : gridOrId;
    if (!grid || !grid.classList) return;
    if (grid._filterAnimTimer) clearTimeout(grid._filterAnimTimer);
    grid.classList.remove('grid-filter-switching');
    void grid.offsetWidth;
    grid.classList.add('grid-filter-switching');
    grid._filterAnimTimer = setTimeout(() => {
        grid.classList.remove('grid-filter-switching');
        grid._filterAnimTimer = null;
    }, 280);
}
window.triggerExamGridFilterTransition = triggerExamGridFilterTransition;

function checkAndShowTopMenuHint() {
    const popover = document.getElementById('top-menu-hint-popover');
    if (popover) {
        popover.style.display = 'none';
    }
}

function closeTopMenuHint(neverAgain = false) {
    const popover = document.getElementById('top-menu-hint-popover');
    if (popover) {
        popover.style.display = 'none';
    }
    if (neverAgain) {
        try {
            window.__toyLS.setItem('toy_top_menu_hint_dismissed', 'true');
        } catch(e) {}
    }
}
window.closeTopMenuHint = closeTopMenuHint;

function updateHeaderControlsForView(viewName) {
    const popoverQuizActions = document.getElementById('popover-quiz-actions');
    const btnTopNavAction = document.getElementById('btn-top-nav-action');
    const btnTopSettingsAction = document.getElementById('btn-top-settings-action');
    const headerModeSegmented = document.getElementById('header-mode-segmented');
    const headerDictSegmented = document.getElementById('header-dict-segmented');
    const tabPractice = document.getElementById('tab-mode-practice');
    const tabExam = document.getElementById('tab-mode-exam');
    const tabDictBasic = document.getElementById('tab-dict-basic');
    const tabDictAdvanced = document.getElementById('tab-dict-advanced');
    const popTextBilingual = document.getElementById('pop-text-bilingual');
    const popTextLookup = document.getElementById('pop-text-lookup');

    const topHeader = document.querySelector('.top-header');
    if (topHeader) {
        topHeader.style.display = (viewName === 'home') ? 'none' : 'flex';
    }

    if (viewName !== 'written-arena' && typeof window.dismissGestureWhisperPill === 'function') {
        window.dismissGestureWhisperPill(false);
    }

    if (viewName === 'home') {
        if (btnTopNavAction) btnTopNavAction.style.display = 'none';
        if (btnTopSettingsAction) btnTopSettingsAction.style.display = 'none';
        if (headerModeSegmented) headerModeSegmented.style.display = 'none';
        if (headerDictSegmented) headerDictSegmented.style.display = 'none';
        closeTopMenuHint(false);
    } else {
        if (btnTopNavAction) btnTopNavAction.style.display = 'flex';
        const isArena = (viewName === 'quiz' || viewName === 'written-arena' || viewName === 'dictation-arena');
        if (btnTopSettingsAction) {
            btnTopSettingsAction.style.display = isArena ? 'flex' : 'none';
        }
        if (headerModeSegmented) {
            headerModeSegmented.style.display = (viewName === 'quiz' || viewName === 'written-arena') ? 'inline-flex' : 'none';
        }
        if (headerDictSegmented) {
            headerDictSegmented.style.display = (viewName === 'dictation-arena') ? 'inline-flex' : 'none';
        }
        closeTopMenuHint(false);
    }

    if (window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
        window.isExamMode = true;
    }
    if (tabPractice && tabExam) {
        tabPractice.classList.toggle('active', !window.isExamMode);
        tabExam.classList.toggle('active', !!window.isExamMode);
    }

    if (tabDictBasic && tabDictAdvanced) {
        const curMode = (typeof dictDifficultyMode !== 'undefined') ? dictDifficultyMode : (window.__toyLS.getItem('toy_dict_difficulty_mode') || 'basic');
        tabDictBasic.classList.toggle('active', curMode === 'basic');
        tabDictAdvanced.classList.toggle('active', curMode === 'advanced');
    }

    if (window.UXSegmentedGlider) {
        const syncHeaderGliders = () => {
            if (headerModeSegmented && headerModeSegmented.style.display !== 'none') {
                window.UXSegmentedGlider.sync(headerModeSegmented, false);
            }
            if (headerDictSegmented && headerDictSegmented.style.display !== 'none') {
                window.UXSegmentedGlider.sync(headerDictSegmented, false);
            }
        };
        syncHeaderGliders();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(syncHeaderGliders);
        }
    }

    if (popTextBilingual) {
        const canB = (window.ToyPermissions && typeof window.ToyPermissions.canUseBilingualMode === 'function')
            ? window.ToyPermissions.canUseBilingualMode()
            : false;
        const bState = canB ? ((viewName === 'dictation-arena') ? !!window.showDictBilingual : ((viewName === 'written-arena') ? !!window.showWrittenBilingual : !!window.showBilingual)) : false;
        popTextBilingual.textContent = bState ? '双语对照: 开' : '双语对照: 关';
    }
    const popItemLookupEl = document.getElementById('pop-item-lookup');
    if (popItemLookupEl) {
        popItemLookupEl.style.display = 'none';
    }

    const popItemHideQuestion = document.getElementById('pop-item-hide-question');
    const popTextHideQuestion = document.getElementById('pop-text-hide-question');
    if (popItemHideQuestion) {
        popItemHideQuestion.style.display = (viewName === 'quiz') ? 'flex' : 'none';
        if (popTextHideQuestion) {
            popTextHideQuestion.textContent = window.hideListeningQuestion ? '隐藏题目: 开' : '隐藏题目: 关';
        }
    }

    const popItemDictKeyboard = document.getElementById('pop-item-dict-keyboard');
    if (popItemDictKeyboard) {
        // Strictly only present in Dictation Arena, NEVER in Written Exam or Listening Quiz
        if (viewName === 'dictation-arena') {
            popItemDictKeyboard.style.removeProperty('display');
            popItemDictKeyboard.style.display = 'flex';
            if (typeof syncDictKeyboardPreferenceUI === 'function') {
                syncDictKeyboardPreferenceUI();
            }
        } else {
            popItemDictKeyboard.style.display = 'none';
            popItemDictKeyboard.style.setProperty('display', 'none', 'important');
        }
    }
}
window.updateHeaderControlsForView = updateHeaderControlsForView;

window.switchView = switchView;

function initNavigationEvents() {
    if (typeof initHomePortalEvents === 'function') initHomePortalEvents();
    if (typeof initArenaHeaderAndShortcuts === 'function') initArenaHeaderAndShortcuts();
}
window.initNavigationEvents = initNavigationEvents;

/**
 * 🏷️ iOS Native-style Segmented Control Slider for Year Filter Bars
 */
function updateSegmentedSlider(bar, animate = false) {
    if (!bar) return;
    const shouldAnimate = (animate === true);
    let thumb = bar.querySelector('.year-slider-pill');
    if (!thumb) {
        thumb = document.createElement('div');
        thumb.className = 'year-slider-pill';
        bar.prepend(thumb);
    }
    const activeChip = bar.querySelector('.chip-year.active') || bar.querySelector('.chip-year');
    if (!activeChip) return;

    const applyThumbGeometry = (left, width, anim) => {
        if (!anim || !bar._sliderReady) {
            thumb.style.transition = 'none';
            thumb.style.transform = `translate3d(${left}px, 0, 0)`;
            thumb.style.width = `${width}px`;
            void thumb.offsetWidth;
            thumb.style.transition = '';
            bar._sliderReady = true;
        } else {
            thumb.style.transform = `translate3d(${left}px, 0, 0)`;
            thumb.style.width = `${width}px`;
        }
    };

    const left = activeChip.offsetLeft;
    const width = activeChip.offsetWidth;

    if (width === 0) {
        bar._sliderReady = false;
        return;
    }

    applyThumbGeometry(left, width, shouldAnimate);

    // Auto-scroll the filter bar so the active chip stays in view on small screens
    const barWidth = bar.clientWidth;
    if (barWidth > 0 && bar.scrollWidth > barWidth) {
        const chipCenter = left + width / 2;
        const targetScroll = Math.max(0, chipCenter - barWidth / 2);
        if (Math.abs(bar.scrollLeft - targetScroll) > 6) {
            if (shouldAnimate && typeof bar.scrollTo === 'function') {
                bar.scrollTo({ left: targetScroll, behavior: 'smooth' });
            } else {
                bar.scrollLeft = targetScroll;
            }
        }
    }
}

window.updateSegmentedSlider = updateSegmentedSlider;

window.addEventListener('resize', () => {
    document.querySelectorAll('.year-filter-bar').forEach(bar => updateSegmentedSlider(bar, false));
});

/**
 * 💧 Liquid Glass Bottom Nav Bar Adaptive Background Sensor (1:1 单词Toy 规范)
 * Samples points beneath .bottom-nav-bar on scroll/resize to toggle .lg-busy / .lg-white
 */
(function initLiquidGlassNavSensor() {
    let lgRaf = 0;
    let lastSenseTime = 0;
    let settleTimer = null;

    function hitText(el, x, y) {
        if (!el || !el.childNodes) return false;
        for (let i = 0; i < el.childNodes.length; i++) {
            const n = el.childNodes[i];
            if (n.nodeType === 3 && n.textContent && n.textContent.trim()) {
                try {
                    const r = document.createRange();
                    r.selectNodeContents(n);
                    const b = r.getBoundingClientRect();
                    if (b.width > 1 && b.height > 1 && x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 6 && y <= b.bottom + 6) {
                        return true;
                    }
                } catch (e) {}
            }
        }
        return false;
    }

    function senseLiquidGlass() {
        lgRaf = 0;
        lastSenseTime = Date.now();
        const nav = document.querySelector('.bottom-nav-bar');
        if (!nav || nav.style.display === 'none' || typeof document.elementsFromPoint !== 'function') return;
        const rect = nav.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const y = rect.top + rect.height / 2;
        const sampleFractions = [0.2, 0.5, 0.8];
        let busyHits = 0;

        for (let s = 0; s < sampleFractions.length; s++) {
            const x = rect.left + rect.width * sampleFractions[s];
            const stack = document.elementsFromPoint(x, y);
            for (let i = 0; i < stack.length; i++) {
                const el = stack[i];
                if (nav.contains(el)) continue;
                if (el.closest && el.closest('.opt-btn, .word-bank-opt-btn, .written-passage-card, .explanation-card, .ios-subj-white-card, .writing-answer-sheet')) {
                    busyHits++;
                    break;
                }
                if (hitText(el, x, y)) {
                    busyHits++;
                    break;
                }
            }
            if (busyHits >= 1) break;
        }

        const isBusy = busyHits >= 1;
        nav.classList.toggle('lg-busy', isBusy);
        nav.classList.toggle('lg-white', !isBusy);
    }

    function kickLiquidGlass() {
        const now = Date.now();
        if (now - lastSenseTime < 80) {
            if (!settleTimer) {
                settleTimer = setTimeout(() => {
                    settleTimer = null;
                    if (!lgRaf && typeof requestAnimationFrame === 'function') {
                        lgRaf = requestAnimationFrame(senseLiquidGlass);
                    }
                }, 120);
            }
            return;
        }
        if (!lgRaf && typeof requestAnimationFrame === 'function') {
            lgRaf = requestAnimationFrame(senseLiquidGlass);
        }
    }

    window.addEventListener('scroll', kickLiquidGlass, { passive: true, capture: true });
    window.addEventListener('resize', kickLiquidGlass, { passive: true });
    document.addEventListener('DOMContentLoaded', kickLiquidGlass);
    window.kickLiquidGlass = kickLiquidGlass;
})();
