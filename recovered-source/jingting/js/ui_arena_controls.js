/* === js/ui_arena_controls.js === */
/**
 * ==========================================================================
 * Arena Header Popovers, Drawers, Keyboard Shortcuts & Lookup Mode (js/ui_arena_controls.js)
 * ==========================================================================
 */

let _arenaHeaderBound = false;

function initArenaHeaderAndShortcuts() {
    if (_arenaHeaderBound) return;
    _arenaHeaderBound = true;

    const btnTopNavAction = document.getElementById('btn-top-nav-action');
    const btnTopSettingsAction = document.getElementById('btn-top-settings-action');
    const popoverQuizActions = document.getElementById('popover-quiz-actions');

    const popItemRedo = document.getElementById('pop-item-redo');
    const popItemBilingual = document.getElementById('pop-item-bilingual');
    const popItemLookup = document.getElementById('pop-item-lookup');
    const popTextBilingual = document.getElementById('pop-text-bilingual');
    const popTextLookup = document.getElementById('pop-text-lookup');

    const btnPrevQ = document.getElementById('btn-prev-q');
    const btnNextQ = document.getElementById('btn-next-q');
    const btnWrittenPrev = document.getElementById('btn-written-prev-q');
    const btnWrittenNext = document.getElementById('btn-written-next-q');
    const btnOpenDrawer = document.getElementById('btn-open-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const drawerMask = document.getElementById('drawer-mask');
    const drawerQGrid = document.getElementById('drawer-q-grid');

    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const scoreModal = document.getElementById('score-modal');

    if (btnTopNavAction) {
        btnTopNavAction.addEventListener('click', () => {
            // Dismiss all open drawers, modals, or settings overlays
            document.querySelectorAll('.drawer-mask.active, .modal-mask.active, .dict-settings-mask.active').forEach(el => {
                el.classList.remove('active');
            });
            const activeDictDrawer = document.getElementById('dict-drawer-mask');
            if (activeDictDrawer) {
                activeDictDrawer.classList.remove('active');
                activeDictDrawer.style.display = '';
            }
            const activeRegularDrawer = document.getElementById('drawer-mask');
            if (activeRegularDrawer) {
                activeRegularDrawer.classList.remove('active');
                activeRegularDrawer.style.display = '';
            }
            const settingsMask = document.getElementById('dict-audio-settings-mask');
            if (settingsMask) {
                settingsMask.classList.remove('active');
                settingsMask.style.display = 'none';
            }

            // If currently in ANY lobby or ranking view, direct back to home immediately regardless of previous sub-tabs clicked
            const isLobbyOrRankView = (activeView === 'daily-lobby' || activeView === 'dictation-lobby' || activeView === 'written-lobby' || activeView === 'lobby' || activeView === 'rank');
            if (isLobbyOrRankView) {
                switchView('home');
                if (window.history && window.history.replaceState) {
                    try {
                        window.history.replaceState({ view: 'home', step: 0 }, '');
                    } catch(e) {}
                }
                if (typeof window._resetToyHistory === 'function') window._resetToyHistory();
                return;
            }

            if (activeView === 'quiz') {
                switchView('lobby', true);
            } else if (activeView === 'written-arena') {
                switchView('written-lobby', true);
            } else if (activeView === 'dictation-arena') {
                const audioPlayer = document.getElementById('dictation-audio-player');
                if (audioPlayer) audioPlayer.pause();
                if (window._isDailyListening) {
                    switchView('daily-lobby', true);
                } else {
                    switchView('dictation-lobby', true);
                }
            } else {
                switchView('home', true);
            }
            if (window.history && window.history.replaceState) {
                try {
                    window.history.replaceState({ view: activeView, step: 1 }, '');
                } catch(e) {}
            }
        });
    }

    if (btnTopSettingsAction) {
        btnTopSettingsAction.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popoverQuizActions) {
                const popItemHideQuestion = document.getElementById('pop-item-hide-question');
                if (popItemHideQuestion) {
                    popItemHideQuestion.style.display = (activeView === 'quiz') ? 'flex' : 'none';
                }
                updateHeaderControlsForView(activeView);
                popoverQuizActions.classList.toggle('show');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('[data-haptic-bridge]')) return;
        if (popoverQuizActions && popoverQuizActions.classList.contains('show')) {
            const isClickInsideBtn = btnTopSettingsAction && (e.target === btnTopSettingsAction || btnTopSettingsAction.contains(e.target));
            if (!popoverQuizActions.contains(e.target) && !isClickInsideBtn) {
                popoverQuizActions.classList.remove('show');
            }
        }
    });

    if (popItemRedo) {
        popItemRedo.addEventListener('click', () => {
            if (popoverQuizActions) popoverQuizActions.classList.remove('show');
            showConfirmModal({
                title: '确认重刷本套试卷？',
                desc: '重刷将清空当前试卷的所有作答记录，并重置至第 01 题重新开始。',
                confirmText: '确定重刷',
                cancelText: '取消',
                onConfirm: () => {
                    const nowTs = Date.now();
                    if (!window.completedExams) window.completedExams = {};
                    if (activeView === 'written-arena') {
                        userWrittenAnswers[currentWrittenExamTitle] = {};
                        const pCardRedo = document.getElementById('written-passage-card');
                        if (pCardRedo) pCardRedo._renderedPassageKey = '';
                        if (typeof window.dismissProofreadPopovers === 'function') window.dismissProofreadPopovers();
                        if (typeof window.clearExamArenaAnnotations === 'function') window.clearExamArenaAnnotations(currentWrittenExamTitle);
                        if (currentWrittenExamTitle) {
                            Object.keys(revealedModelKeys || {}).forEach(rk => {
                                if (rk.includes(currentWrittenExamTitle)) delete revealedModelKeys[rk];
                            });
                            if (!window.completedExams[currentWrittenExamTitle]) {
                                window.completedExams[currentWrittenExamTitle] = {};
                            }
                            window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                            delete window.completedExams[currentWrittenExamTitle].writtenScore;
                            delete window.completedExams[currentWrittenExamTitle].writtenScoreTimestamp;
                            window.completedExams[currentWrittenExamTitle].writtenResetAt = nowTs;
                            window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                        }
                        saveUserCloudData(currentWrittenExamTitle, true);
                        updateDashboardStats();
                        renderWrittenQuestion(0);
                    } else if (activeView === 'dictation-arena') {
                        window.currentSentenceSolvedTokens = {};
                        window.dictSkeletonModeActive = false;
                        window.dictAnswerModeActive = false;
                        window.currentSentenceChosenIndices = null;
                        window.lastRenderedSentIdx = -1;
                        if (currentDictExamTitle) {
                            if (!window.completedExams[currentDictExamTitle]) {
                                window.completedExams[currentDictExamTitle] = {};
                            }
                            window.completedExams[currentDictExamTitle].dictationCompleted = {};
                            window.completedExams[currentDictExamTitle].dictResetAt = nowTs;
                            window.completedExams[currentDictExamTitle].dictUpdatedAt = nowTs;
                            window.completedExams[currentDictExamTitle].timestamp = nowTs;
                        }
                        saveUserCloudData(currentDictExamTitle, true);
                        updateDashboardStats();
                        renderDictationSentence(0);
                        if (typeof window.syncDictKbToolButtonsState === 'function') window.syncDictKbToolButtonsState();
                    } else {
                        userAnswers = {};
                        if (typeof window.clearExamArenaAnnotations === 'function') window.clearExamArenaAnnotations(currentExamTitle);
                        if (currentExamTitle) {
                            if (!window.completedExams[currentExamTitle]) {
                                window.completedExams[currentExamTitle] = {};
                            }
                            window.completedExams[currentExamTitle].answers = {};
                            delete window.completedExams[currentExamTitle].score;
                            delete window.completedExams[currentExamTitle].scoreTimestamp;
                            window.completedExams[currentExamTitle].answersResetAt = nowTs;
                            window.completedExams[currentExamTitle].timestamp = nowTs;
                        }
                        saveUserCloudData(currentExamTitle, true);
                        updateDashboardStats();
                        renderQuestion(0);
                    }
                }
            });
        });
    }

    const tabPractice = document.getElementById('tab-mode-practice');
    const tabExam = document.getElementById('tab-mode-exam');

    function setExamMode(isExam, isUserClick = false) {
        if (!isExam && window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
            window.isExamMode = true;
            if (tabPractice && tabExam) {
                tabPractice.classList.remove('active');
                tabExam.classList.add('active');
            }
            if (isUserClick && typeof window.ToyPermissions.showUnlockModal === 'function') {
                window.ToyPermissions.showUnlockModal('practice_mode');
            }
            return false;
        }
        if (isUserClick) {
            window._userExplicitExamMode = !!isExam;
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
        }
        window.isExamMode = !!isExam;
        if (tabPractice && tabExam) {
            tabPractice.classList.toggle('active', !window.isExamMode);
            tabExam.classList.toggle('active', !!window.isExamMode);
            if (window.UXSegmentedGlider) {
                window.UXSegmentedGlider.sync('#header-mode-segmented', !!isUserClick);
            }
        }
        if (typeof window.syncWrittenModeRevealedState === 'function') {
            window.syncWrittenModeRevealedState(window.isExamMode);
        }
        if (activeView === 'quiz' && typeof renderQuestion === 'function') {
            renderQuestion(currentQIndex, { preserveScroll: true });
        }
        if (activeView === 'written-arena' && typeof renderWrittenQuestion === 'function') {
            const passageCard = document.getElementById('written-passage-card');
            if (passageCard) passageCard._renderedPassageKey = '';
            renderWrittenQuestion(currentWrittenQIndex, { preserveScroll: true });
        }
        return true;
    }
    window.setExamMode = setExamMode;

    if (tabPractice) {
        tabPractice.addEventListener('click', () => setExamMode(false, true));
    }
    if (tabExam) {
        tabExam.addEventListener('click', () => setExamMode(true, true));
    }

    const tabDictBasic = document.getElementById('tab-dict-basic');
    const tabDictAdvanced = document.getElementById('tab-dict-advanced');

    if (tabDictBasic) {
        tabDictBasic.addEventListener('click', () => {
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
            if (typeof setDictDifficultyMode === 'function') {
                setDictDifficultyMode('basic');
                if (window.UXSegmentedGlider) {
                    window.UXSegmentedGlider.sync('#header-dict-segmented', true);
                }
                if (typeof renderDictationSentence === 'function' && typeof currentDictIndex !== 'undefined') {
                    renderDictationSentence(currentDictIndex, {
                        preserveAudio: true,
                        preserveScroll: true,
                        keepModes: false
                    });
                }
            }
        });
    }

    if (tabDictAdvanced) {
        tabDictAdvanced.addEventListener('click', () => {
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
            if (typeof setDictDifficultyMode === 'function') {
                setDictDifficultyMode('advanced');
                if (window.UXSegmentedGlider) {
                    window.UXSegmentedGlider.sync('#header-dict-segmented', true);
                }
                if (typeof renderDictationSentence === 'function' && typeof currentDictIndex !== 'undefined') {
                    renderDictationSentence(currentDictIndex, {
                        preserveAudio: true,
                        preserveScroll: true,
                        keepModes: false
                    });
                }
            }
        });
    }

    const popItemHideQuestion = document.getElementById('pop-item-hide-question');
    const popTextHideQuestion = document.getElementById('pop-text-hide-question');
    if (popItemHideQuestion) {
        popItemHideQuestion.addEventListener('click', () => {
            if (popoverQuizActions) popoverQuizActions.classList.remove('show');
            window.hideListeningQuestion = !window.hideListeningQuestion;
            try {
                window.__toyLS.setItem('cet4_hide_listening_question', String(window.hideListeningQuestion));
            } catch (e) {}
            if (popTextHideQuestion) {
                popTextHideQuestion.textContent = window.hideListeningQuestion ? '隐藏题目: 开' : '隐藏题目: 关';
            }
            if (typeof saveUserCloudData === 'function') {
                saveUserCloudData();
            }
            if (activeView === 'quiz' && typeof renderQuestion === 'function') {
                renderQuestion(currentQIndex, { preserveAudio: true, preserveScroll: true });
            }
        });
    }


    if (popItemBilingual) {
        popItemBilingual.addEventListener('click', () => {
            if (popoverQuizActions) popoverQuizActions.classList.remove('show');
            if (window.ToyPermissions && !window.ToyPermissions.canUseBilingualMode()) {
                window.ToyPermissions.showUnlockModal('bilingual');
                return;
            }
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
            if (activeView === 'written-arena') {
                window.showWrittenBilingual = !window.showWrittenBilingual;
                if (popTextBilingual) popTextBilingual.textContent = window.showWrittenBilingual ? '双语对照: 开' : '双语对照: 关';
                if (typeof renderWrittenQuestion === 'function') {
                    renderWrittenQuestion(currentWrittenQIndex, { preserveScroll: true });
                }
                if (window.showWrittenBilingual && window.UXAutoAnimate && typeof window.UXAutoAnimate.smoothToggle === 'function') {
                    const wZhP = document.getElementById('written-q-zh-p');
                    const wTransCard = document.getElementById('written-translation-card');
                    if (wZhP && wZhP.style.display !== 'none') window.UXAutoAnimate.smoothToggle(wZhP, true, { forceAnimate: true });
                    if (wTransCard && wTransCard.style.display !== 'none') window.UXAutoAnimate.smoothToggle(wTransCard, true, { forceAnimate: true });
                    document.querySelectorAll('#written-options-wrapper .opt-zh-text.show').forEach(el => {
                        window.UXAutoAnimate.smoothToggle(el, true, { forceAnimate: true });
                    });
                }
            } else if (activeView === 'dictation-arena') {
                window.showDictBilingual = !window.showDictBilingual;
                if (popTextBilingual) popTextBilingual.textContent = window.showDictBilingual ? '双语对照: 开' : '双语对照: 关';
                const zhBox = document.getElementById('dict-zh-box');
                if (zhBox) {
                    zhBox.classList.toggle('show', !!window.showDictBilingual);
                    if (window.showDictBilingual && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
                        window.UXAutoAnimate.animateCardReveal(zhBox);
                    }
                }
            } else {
                window.showBilingual = !window.showBilingual;
                if (popTextBilingual) popTextBilingual.textContent = window.showBilingual ? '双语对照: 开' : '双语对照: 关';
                if (activeView === 'quiz' && typeof renderQuestion === 'function') {
                    renderQuestion(currentQIndex, { preserveAudio: true, preserveScroll: true });
                    if (window.showBilingual && window.UXAutoAnimate && typeof window.UXAutoAnimate.smoothToggle === 'function') {
                        const qZhP = document.getElementById('q-zh-p');
                        if (qZhP && qZhP.style.display !== 'none') window.UXAutoAnimate.smoothToggle(qZhP, true, { forceAnimate: true });
                        document.querySelectorAll('#options-wrapper .opt-zh-text.show').forEach(el => {
                            window.UXAutoAnimate.smoothToggle(el, true, { forceAnimate: true });
                        });
                    }
                }
            }
            if (typeof saveUserCloudData === 'function') {
                saveUserCloudData();
            }
            updateHeaderControlsForView(activeView);
        });
    }

    // Session-scoped state for Dict/Lookup Notice (prompts at most once per session unless permanently dismissed)
    // Uses module-scoped _sessionHasShownDictNotice

    if (popItemLookup) {
        popItemLookup.addEventListener('click', () => {
            if (popoverQuizActions) popoverQuizActions.classList.remove('show');
            if (window.ToyPermissions && !window.ToyPermissions.canUseLookupMode()) {
                window.ToyPermissions.showUnlockModal('lookup');
                return;
            }

            applyLookupMode(!window.isLookupMode);
        });
    }

    // Quiz Navigation & Drawer Listeners
    function handlePrevListeningQuestion() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        if (typeof currentQIndex !== 'undefined' && currentQIndex > 0) renderQuestion(currentQIndex - 1);
    }
    window.handlePrevListeningQuestion = handlePrevListeningQuestion;

    function handleNextListeningQuestion() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        if (typeof currentQIndex !== 'undefined' && Array.isArray(currentQuestions)) {
            if (currentQIndex < currentQuestions.length - 1) {
                renderQuestion(currentQIndex + 1);
            } else {
                finishExam();
            }
        }
    }
    window.handleNextListeningQuestion = handleNextListeningQuestion;

    if (btnPrevQ) {
        btnPrevQ.addEventListener('click', handlePrevListeningQuestion);
    }

    if (btnNextQ) {
        btnNextQ.addEventListener('click', handleNextListeningQuestion);
    }

    function openQuestionDrawer() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        const titleText = document.getElementById('drawer-title-text');
        const drawerSecNav = document.getElementById('drawer-section-nav');
        const drawerQGrid = document.getElementById('drawer-q-grid');
        const drawerMask = document.getElementById('drawer-mask');

        const totalQList = (typeof currentQuestions !== 'undefined' && Array.isArray(currentQuestions) && currentQuestions.length > 0) ? currentQuestions : (window.currentQuestions || []);
        const totalQCount = (totalQList && totalQList.length) ? totalQList.length : 25;
        if (titleText) titleText.textContent = `听力真题答题卡 (Q1-${totalQCount})`;

        if (drawerSecNav && Array.isArray(totalQList) && totalQList.length > 0) {
            const categories = [];
            let curCat = null;

            totalQList.forEach((q, idx) => {
                const sec = q.section || '';
                const title = q.sub_title || q.sub_title_zh || '';

                    let catKey = 'Section A';
                    let catName = 'News Reports';
                    let icon = '📻';

                    if (sec.toLowerCase().includes('dictation') || title.toLowerCase().includes('dictation') || title.includes('听写')) {
                        catKey = 'Section D';
                        catName = 'Dictation';
                        icon = '✍️';
                    } else if (sec.includes('Section C') || title.toLowerCase().includes('passage') || title.includes('篇章') || title.includes('短文')) {
                        catKey = 'Section C';
                        catName = 'Passages';
                        icon = '📜';
                    } else if (sec.includes('Section B') || title.toLowerCase().includes('long conversation') || title.includes('长对话')) {
                        catKey = 'Section B';
                        catName = 'Long Conversations';
                        icon = '💬';
                    } else {
                        catKey = 'Section A';
                        catName = (title.toLowerCase().includes('short') || title.includes('短对话')) ? 'Short Conversations' : 'News Reports';
                        icon = '📻';
                    }

                    if (!curCat || curCat.key !== catKey) {
                        if (curCat) {
                            curCat.endId = (totalQList[idx - 1]?.id || idx);
                            curCat.endIdx = idx - 1;
                            curCat.label = `${curCat.name} (${curCat.startId}-${curCat.endId})`;
                        }
                        curCat = {
                            key: catKey,
                            name: catName,
                            icon: icon,
                            startIdx: idx,
                            startId: q.id || (idx + 1),
                            endIdx: idx,
                            endId: q.id || (idx + 1)
                        };
                        categories.push(curCat);
                    } else {
                        curCat.endIdx = idx;
                        curCat.endId = q.id || (idx + 1);
                    }
                });

                if (curCat) {
                    curCat.label = `${curCat.name} (${curCat.startId}-${curCat.endId})`;
                }

                const curLvl = (typeof window.getExamLevelFromId === 'function' && currentExamTitle)
                    ? window.getExamLevelFromId(currentExamTitle)
                    : (window.currentExamLevel || 'cet4');
                const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
                const examIdx = manifestList.findIndex(m => m.title === currentExamTitle || m.examId === currentExamTitle);

                drawerSecNav.innerHTML = categories.map(c => {
                    const isActive = currentQIndex >= c.startIdx && currentQIndex <= c.endIdx;
                    const isSecLocked = window.ToyPermissions && !window.ToyPermissions.canAccessListening(examIdx >= 0 ? examIdx : 0, c.startIdx, curLvl);
                    return `<button class="drawer-sec-pill ${isActive ? 'active' : ''} ${isSecLocked ? 'is-sec-locked' : ''}" data-idx="${c.startIdx}"><span>${c.icon}</span><span>${c.label}${isSecLocked ? ' 🔒' : ''}</span></button>`;
                }).join('');

                drawerSecNav.querySelectorAll('.drawer-sec-pill').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const startIdx = parseInt(btn.dataset.idx, 10);
                        if (typeof renderQuestion === 'function') {
                            renderQuestion(startIdx);
                            if (drawerMask) drawerMask.classList.remove('active');
                        }
                    });
                });

                enableHorizontalDragScroll(drawerSecNav, document.getElementById('drawer-section-nav-wrapper'));
            }

            if (typeof window.renderListeningDrawerGrid === 'function') {
                window.renderListeningDrawerGrid();
            }
            if (drawerMask) {
                drawerMask.style.display = '';
                drawerMask.classList.add('active');
            }
        }
        window.openQuestionDrawer = openQuestionDrawer;

        if (btnOpenDrawer) {
            btnOpenDrawer.addEventListener('click', openQuestionDrawer);
        }

        const quizTopBar = document.querySelector('#quiz-stage-card .quiz-card-top-bar');
        if (quizTopBar) {
            const qSeqBadge = quizTopBar.querySelector('.sequence-badge');
            const qSecBadge = document.getElementById('section-badge');
            [qSeqBadge, qSecBadge].forEach(el => {
                if (el) {
                    el.style.cursor = 'pointer';
                    el.title = '点击快速切换题号或大题模块';
                    el.addEventListener('click', openQuestionDrawer);
                }
            });
        }

    window.renderListeningDrawerGrid = function() {
        const drawerQGrid = document.getElementById('drawer-q-grid');
        const drawerMask = document.getElementById('drawer-mask');
        const totalQList = (typeof currentQuestions !== 'undefined' && Array.isArray(currentQuestions) && currentQuestions.length > 0) ? currentQuestions : (window.currentQuestions || []);
        if (!drawerQGrid || !Array.isArray(totalQList) || totalQList.length === 0) return;
        drawerQGrid.innerHTML = '';

        const curLvl = (typeof window.getExamLevelFromId === 'function' && currentExamTitle)
            ? window.getExamLevelFromId(currentExamTitle)
            : (window.currentExamLevel || 'cet4');
        const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
        const examIdx = manifestList.findIndex(m => m.title === currentExamTitle || m.examId === currentExamTitle);

        totalQList.forEach((q, idx) => {
            const ans = userAnswers[idx];
            const isLocked = window.ToyPermissions && !window.ToyPermissions.canAccessListening(examIdx >= 0 ? examIdx : 0, idx, curLvl);

            const chip = document.createElement('div');
            chip.className = `q-chip ${isLocked ? 'is-locked-chip' : ''}`;
            chip.textContent = idx + 1;
            if (window.isExamMode) {
                if (ans) {
                    chip.style.background = '#f0f6ff';
                    chip.style.borderColor = '#007aff';
                    chip.style.color = '#007aff';
                    chip.style.fontWeight = '700';
                }
            } else {
                if (ans) {
                    chip.classList.add(ans.isCorrect ? 'correct' : 'wrong');
                }
            }
            if (idx === currentQIndex) {
                chip.style.borderColor = '#007aff';
                chip.style.borderWidth = '2px';
                chip.style.fontWeight = '800';
                if (!userAnswers[idx]) {
                    chip.style.color = '#007aff';
                }
            }
            chip.addEventListener('click', () => {
                if (isLocked) {
                    if (drawerMask) drawerMask.classList.remove('active');
                    if (window.ToyPermissions) window.ToyPermissions.showUnlockModal('listening', { examIndex: examIdx >= 0 ? examIdx : 0, questionIndex: idx, level: curLvl });
                    return;
                }
                renderQuestion(idx);
                if (drawerMask) drawerMask.classList.remove('active');
            });
            drawerQGrid.appendChild(chip);
        });
    };

    function closeQuestionDrawer() {
        if (drawerMask) drawerMask.classList.remove('active');
    }
    window.closeQuestionDrawer = closeQuestionDrawer;

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', closeQuestionDrawer);
    }
    if (drawerMask) {
        drawerMask.addEventListener('click', (e) => {
            if (e.target === drawerMask) closeQuestionDrawer();
        });
    }

    if (btnModalConfirm) {
        btnModalConfirm.addEventListener('click', () => {
            if (scoreModal) scoreModal.classList.remove('active');
            if (activeView === 'written-arena') {
                switchView('written-lobby');
            } else {
                switchView('lobby');
            }
        });
    }

    const btnModalReview = document.getElementById('btn-modal-review');
    if (btnModalReview) {
        btnModalReview.addEventListener('click', () => {
            if (scoreModal) scoreModal.classList.remove('active');
            if (window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
                if (activeView === 'written-arena' && typeof renderWrittenQuestion === 'function') {
                    const targetWIdx = (typeof window._firstWrongWrittenIdx === 'number' && window._firstWrongWrittenIdx >= 0)
                        ? window._firstWrongWrittenIdx
                        : currentWrittenQIndex;
                    renderWrittenQuestion(targetWIdx);
                } else if (activeView === 'quiz' && typeof renderQuestion === 'function') {
                    const targetLIdx = (typeof window._firstWrongListeningIdx === 'number' && window._firstWrongListeningIdx >= 0)
                        ? window._firstWrongListeningIdx
                        : currentQIndex;
                    renderQuestion(targetLIdx);
                }
                window.ToyPermissions.showUnlockModal('practice_mode');
                return;
            }
            if (typeof setExamMode === 'function' && window.isExamMode) {
                setExamMode(false);
            }
            if (activeView === 'written-arena' && typeof renderWrittenQuestion === 'function') {
                const targetWIdx = (typeof window._firstWrongWrittenIdx === 'number' && window._firstWrongWrittenIdx >= 0)
                    ? window._firstWrongWrittenIdx
                    : currentWrittenQIndex;
                renderWrittenQuestion(targetWIdx);
            } else if (activeView === 'quiz' && typeof renderQuestion === 'function') {
                const targetLIdx = (typeof window._firstWrongListeningIdx === 'number' && window._firstWrongListeningIdx >= 0)
                    ? window._firstWrongListeningIdx
                    : currentQIndex;
                renderQuestion(targetLIdx);
            }
        });
    }

    if (scoreModal) {
        scoreModal.addEventListener('click', (e) => {
            if (e.target === scoreModal) scoreModal.classList.remove('active');
        });
    }

    // --- 方案 3: 移动端左右轻扫手势 (Swipe Gestures) ---
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartTime = 0;
        if (activeView !== 'quiz' && activeView !== 'written-arena') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
        if (e.target && e.target.closest('.bottom-nav-bar, .dict-floating-island, .top-header, .dict-canvas-header, #dict-virtual-keyboard, .drawer-mask, .drawer-box, .modal-mask, .modal-content, .dict-settings-mask, .drawer-section-nav, .dict-kb-floating-pill, .header-popover-card, .opt-btn, .word-bank-opt-btn, .tfng-btn, .sentence-insertion-opt-btn, .exp-evidence-box, .exp-synonym-box, #dict-popover, .written-passage-card, .written-sheet-grabber, .is-sheet-dragging, button')) return;
        if (document.querySelector('.drawer-mask.active, .modal-mask.active, .dict-settings-mask.active, .rank-modal-overlay.is-active, .toy-perm-modal-mask.active, #dict-popover.active')) return;
        if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!touchStartTime) return;
        const startTime = touchStartTime;
        touchStartTime = 0;
        if (activeView !== 'quiz' && activeView !== 'written-arena') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON')) return;
        if (e.target && e.target.closest('.bottom-nav-bar, .dict-floating-island, .top-header, .dict-canvas-header, #dict-virtual-keyboard, .drawer-mask, .drawer-box, .modal-mask, .modal-content, .dict-settings-mask, .drawer-section-nav, .dict-kb-floating-pill, .header-popover-card, .opt-btn, .word-bank-opt-btn, .tfng-btn, .sentence-insertion-opt-btn, .exp-evidence-box, .exp-synonym-box, #dict-popover, .written-passage-card, .written-sheet-grabber, .is-sheet-dragging, button')) return;
        if (document.querySelector('.drawer-mask.active, .modal-mask.active, .dict-settings-mask.active, .rank-modal-overlay.is-active, .toy-perm-modal-mask.active, #dict-popover.active')) return;
        if (e.changedTouches && e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            const dt = Date.now() - startTime;

            // Horizontal swipe criteria: dx >= 55px, dy <= 45px, duration <= 400ms
            if (Math.abs(dx) >= 55 && Math.abs(dy) <= 45 && dt <= 400) {
                if (dx < 0) {
                    // Swipe Left -> Next
                    if (activeView === 'quiz' && btnNextQ) {
                        btnNextQ.click();
                    } else if (activeView === 'written-arena' && btnWrittenNext) {
                        btnWrittenNext.click();
                    }
                } else {
                    // Swipe Right -> Prev
                    if (activeView === 'quiz' && btnPrevQ && !btnPrevQ.disabled) {
                        btnPrevQ.click();
                    } else if (activeView === 'written-arena' && btnWrittenPrev && !btnWrittenPrev.disabled) {
                        btnWrittenPrev.click();
                    }
                }
            }
        }
    }, { passive: true });

    // --- 方案 4: PC 全键盘盲操支持 (Keyboard Shortcuts for Quiz, Written & Dictation) ---
    document.addEventListener('keydown', (e) => {
        if (activeView !== 'quiz' && activeView !== 'written-arena' && activeView !== 'dictation-arena') return;
        const target = e.target;
        const isInputTarget = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));
        if (isInputTarget && activeView !== 'dictation-arena') return;
        if (document.querySelector('.drawer-mask.active, .modal-mask.active, .dict-settings-mask.active, .toy-perm-modal-mask.active')) return;

        const key = e.key ? e.key.toUpperCase() : '';

        // In lookup mode, do not process option shortcut keys, only allow navigation when NOT typing
        if (window.isLookupMode) {
            if (isInputTarget) return;
            if (e.key === 'ArrowLeft') {
                if (activeView === 'quiz') handlePrevListeningQuestion();
                if (activeView === 'written-arena' && typeof window.handlePrevWrittenQuestion === 'function') window.handlePrevWrittenQuestion();
                if (activeView === 'dictation-arena' && typeof window.handlePrevDictSentence === 'function') window.handlePrevDictSentence();
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                if (e.key === ' ') e.preventDefault();
                if (activeView === 'quiz') {
                    handleNextListeningQuestion();
                }
                if (activeView === 'written-arena' && typeof window.handleNextWrittenQuestion === 'function') {
                    window.handleNextWrittenQuestion();
                }
                if (activeView === 'dictation-arena' && typeof window.handleNextDictSentence === 'function') {
                    window.handleNextDictSentence();
                }
            }
            return;
        }

        if (activeView === 'quiz') {
            let targetKey = '';
            if (['A', 'B', 'C', 'D'].includes(key)) {
                targetKey = key;
            } else if (['1', '2', '3', '4'].includes(key)) {
                const keys = ['A', 'B', 'C', 'D'];
                targetKey = keys[parseInt(key) - 1];
            }

            if (targetKey) {
                const allOptBtns = document.querySelectorAll('#options-wrapper .opt-btn');
                allOptBtns.forEach(btn => {
                    const optKey = btn.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                    if (optKey === targetKey) {
                        btn.click();
                    }
                });
            } else if (e.key === 'ArrowLeft') {
                if (currentQIndex > 0) renderQuestion(currentQIndex - 1);
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                if (e.key === ' ') e.preventDefault();
                if (currentQIndex < currentQuestions.length - 1) {
                    renderQuestion(currentQIndex + 1);
                } else {
                    finishExam();
                }
            }
        } else if (activeView === 'written-arena') {
            let targetKey = '';
            if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'].includes(key)) {
                targetKey = key;
            } else if (['1', '2', '3', '4'].includes(key)) {
                const keys = ['A', 'B', 'C', 'D'];
                targetKey = keys[parseInt(key) - 1];
            }

            if (targetKey) {
                const allOptBtns = document.querySelectorAll('#written-options-wrapper .opt-btn, #written-options-wrapper .word-bank-opt-btn');
                allOptBtns.forEach(btn => {
                    const optKey = (btn.querySelector('.opt-key') || btn.querySelector('.word-bank-opt-key'))?.textContent?.replace('.', '').trim();
                    if (optKey === targetKey) {
                        btn.click();
                    }
                });
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof window.handlePrevWrittenQuestion === 'function') window.handlePrevWrittenQuestion();
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                if (typeof window.handleNextWrittenQuestion === 'function') window.handleNextWrittenQuestion();
            }
        } else if (activeView === 'dictation-arena') {
            if (isInputTarget) return; // Cloze input has its own specific handler with stopPropagation
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key && /^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
                if (typeof window.handleCustomKeyboardLetter === 'function') {
                    window.handleCustomKeyboardLetter(e.key);
                }
                return;
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                if (typeof window.deleteCustomKeyboardChar === 'function') {
                    window.deleteCustomKeyboardChar();
                }
                return;
            }
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (typeof window.toggleDictationPlayPause === 'function') {
                    window.toggleDictationPlayPause();
                }
            } else if (e.key === 'Enter') {
                const uncompleted = document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])');
                if (uncompleted.length === 0) {
                    e.preventDefault();
                    if (typeof window.handleNextDictSentence === 'function') {
                        window.handleNextDictSentence();
                    }
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (typeof window.handleNextDictSentence === 'function') {
                    window.handleNextDictSentence();
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (typeof window.handlePrevDictSentence === 'function') {
                    window.handlePrevDictSentence();
                }
            }
        }
    });
}
window.initArenaHeaderAndShortcuts = initArenaHeaderAndShortcuts;

/**
 * Lookup Mode Controller & Notice Modal Handling
 */
function applyLookupMode(enable) {
    window.isLookupMode = !!enable;
    const popTextLookup = document.getElementById('pop-text-lookup');
    if (popTextLookup) popTextLookup.textContent = window.isLookupMode ? '查词模式: 开' : '查词模式: 关';
    document.body.classList.toggle('lookup-mode-active', window.isLookupMode);
    
    // Toggle floating indicator bar
    const lookupBar = document.getElementById('lookup-mode-bar');
    const writtenLookupBar = document.getElementById('written-lookup-mode-bar');
    const dictLookupBar = document.getElementById('dict-lookup-mode-bar');
    if (lookupBar) lookupBar.style.display = window.isLookupMode ? 'flex' : 'none';
    if (writtenLookupBar) writtenLookupBar.style.display = window.isLookupMode ? 'flex' : 'none';
    if (dictLookupBar) dictLookupBar.style.display = window.isLookupMode ? 'flex' : 'none';

    if (!window.isLookupMode && typeof hideContextualPopover === 'function') {
        hideContextualPopover();
    }

    if (window.isLookupMode && typeof ensureDictionaryLoaded === 'function') {
        ensureDictionaryLoaded();
    }
    if (activeView === 'quiz' && typeof renderQuestion === 'function') renderQuestion(currentQIndex, { preserveAudio: true, preserveScroll: true });
    if (activeView === 'written-arena' && typeof renderWrittenQuestion === 'function') renderWrittenQuestion(currentWrittenQIndex, { preserveScroll: true });
    if (activeView === 'dictation-arena') {
        if (window.isLookupMode && typeof collapseCustomKeyboard === 'function') {
            collapseCustomKeyboard();
        }
        if (typeof renderDictationSentence === 'function') {
            renderDictationSentence(currentDictIndex, { preserveAudio: true, preserveScroll: true, keepModes: true });
        }
    }
    if (typeof saveUserCloudData === 'function') {
        saveUserCloudData();
    }
    updateHeaderControlsForView(activeView);
}

function showDictNoticeModal() {}
function closeDictNoticeModal() {}
function confirmDictNoticeModal() { applyLookupMode(true); }

window.showDictNoticeModal = showDictNoticeModal;
window.closeDictNoticeModal = closeDictNoticeModal;
window.confirmDictNoticeModal = confirmDictNoticeModal;
window.applyLookupMode = applyLookupMode;
