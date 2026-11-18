/* === js/dictation_controls.js === */
// ==========================================================================
// Dictation Transport Controls, Swipe Gestures & Sentence Drawer (js/dictation_controls.js)
// ==========================================================================

// 7. Initialize Dictation Control Listeners
function initDictationEventListeners() {
    if (window._dictControlsBound) return;
    window._dictControlsBound = true;
    const playBtn = document.getElementById('btn-dict-play') || document.getElementById('btn-zen-play-pause');
    const replayBtn = document.getElementById('btn-dict-replay');
    const speedBtn = document.getElementById('btn-dict-speed');
    const btnModeToggle = document.getElementById('btn-dict-mode-toggle');

    const btnPrev = document.getElementById('btn-dict-prev');
    const btnNext = document.getElementById('btn-dict-next');
    const btnCardPrev = document.getElementById('btn-dict-card-prev');
    const btnCardNext = document.getElementById('btn-dict-card-next');

    const btnHintFirst = document.getElementById('btn-dict-hint-first');
    const btnHintZh = document.getElementById('btn-dict-hint-zh');
    const btnRevealAnswer = document.getElementById('btn-dict-reveal-answer');

    const btnOpenDrawer = document.getElementById('btn-dict-drawer');
    const btnCardDrawer = document.getElementById('btn-dict-card-drawer');
    const drawerMask = document.getElementById('dict-drawer-mask');
    const btnCloseDrawer = document.getElementById('btn-dict-close-drawer');

    updateDictModeButtonUI();

    // Global Dictation Action Handlers
    function replayDictationAudio() {
        const sent = currentDictSentences[currentDictIndex];
        if (sent && window.DictAudioEngine) {
            DictAudioEngine.replay(sent.start, sent.end);
        }
    }
    window.replayDictationAudio = replayDictationAudio;
    window.replayDictSentence = replayDictationAudio;

    function cycleDictPlaybackSpeed() {
        const speedBtn = document.getElementById('btn-dict-speed');
        if (dictPlaybackRate === 1.0) {
            dictPlaybackRate = 1.25;
            if (speedBtn) speedBtn.textContent = '1.25X';
        } else if (dictPlaybackRate === 1.25) {
            dictPlaybackRate = 1.5;
            if (speedBtn) speedBtn.textContent = '1.5X';
        } else if (dictPlaybackRate === 1.5) {
            dictPlaybackRate = 0.75;
            if (speedBtn) speedBtn.textContent = '0.75X';
        } else {
            dictPlaybackRate = 1.0;
            if (speedBtn) speedBtn.textContent = '1.0X';
        }

        const audioPlayer = document.getElementById('dictation-audio-player');
        if (audioPlayer) {
            audioPlayer.preservesPitch = true;
            if ('webkitPreservesPitch' in audioPlayer) audioPlayer.webkitPreservesPitch = true;
            if ('mozPreservesPitch' in audioPlayer) audioPlayer.mozPreservesPitch = true;
            audioPlayer.playbackRate = dictPlaybackRate;
        }

        if (DictAudioEngine && typeof DictAudioEngine.updatePlaybackRate === 'function') {
            DictAudioEngine.updatePlaybackRate(dictPlaybackRate);
        }
    }
    window.cycleDictPlaybackSpeed = cycleDictPlaybackSpeed;
    window.cycleDictSpeed = cycleDictPlaybackSpeed;

    function toggleDictHint() {
        dictAnswerModeActive = false; // Mutually exclusive: close answer mode
        dictSkeletonModeActive = !dictSkeletonModeActive;

        renderDictationSentence(currentDictIndex, {
            preserveAudio: true,
            preserveScroll: true,
            keepModes: true
        });
    }
    window.toggleDictHint = toggleDictHint;

    function toggleDictAnswer() {
        dictSkeletonModeActive = false; // Mutually exclusive: close skeleton mode
        dictAnswerModeActive = !dictAnswerModeActive;

        renderDictationSentence(currentDictIndex, {
            preserveAudio: true,
            preserveScroll: true,
            keepModes: true
        });
    }
    window.toggleDictAnswer = toggleDictAnswer;

    function openDictationDrawer() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        const drawerMask = document.getElementById('dict-drawer-mask');
        if (drawerMask) {
            drawerMask.style.display = 'flex';
            void drawerMask.offsetWidth;
            drawerMask.classList.add('active');
        }
        renderSentenceDrawer();
    }
    window.openDictationDrawer = openDictationDrawer;

    function closeDictationDrawer() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        const drawerMask = document.getElementById('dict-drawer-mask');
        if (drawerMask) {
            drawerMask.classList.remove('active');
            setTimeout(() => {
                if (!drawerMask.classList.contains('active')) {
                    drawerMask.style.display = 'none';
                }
            }, 250);
        }
    }
    window.closeDictationDrawer = closeDictationDrawer;

    function handlePrevSentence() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        clearDictAutoAdvance();
        if (currentDictIndex > 0) {
            renderDictationSentence(currentDictIndex - 1, { slideDirection: 'right' });
        }
    }

    function handleNextSentence() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        clearDictAutoAdvance();
        if (currentDictIndex < currentDictSentences.length - 1) {
            const nextIdx = currentDictIndex + 1;
            if (isDailyListeningActive()) {
                const dayIdx = (window._currentDailyDay || 1) - 1;
                if (window.ToyPermissions && !window.ToyPermissions.canAccessDaily(dayIdx, nextIdx)) {
                    window.ToyPermissions.showUnlockModal('daily', { examIndex: dayIdx, sentenceIndex: nextIdx, dayNum: window._currentDailyDay, level: 'daily' });
                    return;
                }
            } else {
                const curLvl = getActiveDictExamLevel();
                const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
                const examIdx = manifestList.findIndex(m => m.title === currentDictExamTitle || m.examId === currentDictExamTitle);
                if (window.ToyPermissions && !window.ToyPermissions.canAccessDictation(examIdx >= 0 ? examIdx : 0, nextIdx, curLvl, currentDictExamTitle)) {
                    window.ToyPermissions.showUnlockModal('dictation', { examIndex: examIdx >= 0 ? examIdx : 0, sentenceIndex: nextIdx, examTitle: currentDictExamTitle, level: curLvl });
                    return;
                }
            }
            renderDictationSentence(nextIdx, { slideDirection: 'left' });
        } else {
            if (typeof launchGrandConfettiShow === 'function') launchGrandConfettiShow();
            if (isDailyListeningActive()) {
                switchView('daily-lobby');
            } else {
                switchView('dictation-lobby');
            }
        }
    }

    window.handleNextDictSentence = handleNextSentence;
    window.handlePrevDictSentence = handlePrevSentence;
    window.handleNextSentence = handleNextSentence;
    window.handlePrevSentence = handlePrevSentence;

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (typeof window.toggleDictationPlayPause === 'function') {
                window.toggleDictationPlayPause();
            }
        });
    }

    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            clearDictAutoAdvance();
            replayDictationAudio();
        });
    }
    if (speedBtn) speedBtn.addEventListener('click', cycleDictPlaybackSpeed);

    if (btnPrev) btnPrev.addEventListener('click', handlePrevSentence);
    if (btnCardPrev) btnCardPrev.addEventListener('click', handlePrevSentence);
    if (btnNext) btnNext.addEventListener('click', handleNextSentence);
    if (btnCardNext) btnCardNext.addEventListener('click', handleNextSentence);

    if (btnHintFirst) btnHintFirst.addEventListener('click', toggleDictHint);
    if (btnRevealAnswer) btnRevealAnswer.addEventListener('click', toggleDictAnswer);

    if (btnOpenDrawer) {
        btnOpenDrawer.addEventListener('click', openDictationDrawer);
        btnOpenDrawer.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    }
    if (btnCardDrawer) {
        btnCardDrawer.addEventListener('click', openDictationDrawer);
        btnCardDrawer.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    }

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', closeDictationDrawer);
    }
    if (drawerMask) {
        drawerMask.addEventListener('click', (e) => {
            if (e.target === drawerMask) closeDictationDrawer();
        });
    }

    // 📱 Swipe Gesture for Switching Sentences (Swipe Left = Next, Swipe Right = Prev)
    const stageBody = document.getElementById('dict-stage-body') || document.getElementById('dict-canvas-main') || document.querySelector('#view-dictation-arena .dict-zen-canvas') || document.getElementById('view-dictation-arena');
    if (stageBody) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        stageBody.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });

        stageBody.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches.length === 1) {
                const target = e.target;
                if (target && target.closest && (target.closest('#dict-virtual-keyboard') || target.closest('.drawer-panel') || target.closest('.dict-settings-modal') || target.closest('.dict-canvas-header') || target.closest('.btn-canvas-drawer'))) {
                    return;
                }

                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                const dt = Date.now() - touchStartTime;

                // Threshold: swipe duration < 500ms, dx >= 42px, horizontal dominant (|dx| > 1.35 * |dy|)
                if (dt < 500 && Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.35) {
                    if (target && target.tagName === 'INPUT' && Math.abs(dx) < 70) {
                        return;
                    }
                    if (navigator.vibrate) try { navigator.vibrate(10); } catch(err) {}
                    if (dx < 0) {
                        handleNextSentence();
                    } else {
                        handlePrevSentence();
                    }
                }
            }
        }, { passive: true });

        // Tapping on card / sentence clears pending auto-advance timer
        stageBody.addEventListener('pointerdown', () => {
            clearDictAutoAdvance();
        }, { passive: true });
    }


    if (typeof initDictationYearFilterBar === 'function') {
        initDictationYearFilterBar(window.currentExamLevel);
    }

    if (typeof initCustomVirtualKeyboard === 'function') {
        initCustomVirtualKeyboard();
    }
}

// 8. Render Drawer for Quick Sentence Navigation
function renderSentenceDrawer() {
    try {
        const drawerGrid = document.getElementById('dict-drawer-grid') || document.getElementById('dict-drawer-sentence-grid');
        const drawerSecNav = document.getElementById('dict-drawer-section-nav');
        const drawerTitle = document.getElementById('dict-drawer-title');
        const drawerMask = document.getElementById('dict-drawer-mask');

        if (drawerTitle) {
            drawerTitle.textContent = currentDictExamTitle || '逐句精听索引';
        }

        if (!currentDictSentences || currentDictSentences.length === 0) {
            if (drawerGrid) drawerGrid.innerHTML = '<div style="color: #8e8e93; font-size: 13px; text-align: center; padding: 20px;">暂无句子索引</div>';
            return;
        }

        // 1. Group sentences into Categories/Sections
        const categories = [];
        let curCat = null;

        currentDictSentences.forEach((s, idx) => {
            const sec = s.sec || s.group || 'Section';
            let catKey = sec;
            let icon = '📝';

            if (/news/i.test(sec)) {
                icon = '📻';
            } else if (/conversation/i.test(sec)) {
                icon = '💬';
            } else if (/passage/i.test(sec)) {
                icon = '📜';
            } else if (/monologue/i.test(sec)) {
                icon = '🎙️';
            } else if (/discussion/i.test(sec)) {
                icon = '👥';
            } else if (/lecture/i.test(sec)) {
                icon = '🎓';
            } else if (/dictation|听写/i.test(sec)) {
                icon = '✍️';
            }

            if (!curCat || curCat.rawSec !== catKey) {
                if (curCat) {
                    curCat.endSeq = idx;
                    curCat.endIdx = idx - 1;
                    curCat.label = `${curCat.name} (${curCat.startSeq}-${curCat.endSeq})`;
                }
                curCat = {
                    key: `cat_${categories.length}`,
                    rawSec: catKey,
                    name: sec,
                    icon: icon,
                    startIdx: idx,
                    startSeq: idx + 1,
                    endIdx: idx,
                    endSeq: idx + 1
                };
                categories.push(curCat);
            } else {
                curCat.endIdx = idx;
                curCat.endSeq = idx + 1;
            }
        });

        if (curCat) {
            curCat.label = `${curCat.name} (${curCat.startSeq}-${curCat.endSeq})`;
        }

        // Determine currently active category (matches currentDictIndex)
        let activeCat = categories.find(c => currentDictIndex >= c.startIdx && currentDictIndex <= c.endIdx) || categories[0];

        // 2. Render only the chips belonging to the active category
        const renderCategoryChips = (cat) => {
            if (!drawerGrid) return;
            drawerGrid.innerHTML = '';
            const doneMap = window.completedExams?.[currentDictExamTitle]?.dictationCompleted || {};
            const curLvl = getActiveDictExamLevel();
            const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
            const examIdx = manifestList.findIndex(m => m.title === currentDictExamTitle || m.examId === currentDictExamTitle);

            for (let idx = cat.startIdx; idx <= cat.endIdx; idx++) {
                let isSentLocked = false;
                if (isDailyListeningActive()) {
                    const dayIdx = (window._currentDailyDay || 1) - 1;
                    isSentLocked = window.ToyPermissions && !window.ToyPermissions.canAccessDaily(dayIdx, idx);
                } else {
                    isSentLocked = window.ToyPermissions && !window.ToyPermissions.canAccessDictation(examIdx >= 0 ? examIdx : 0, idx, curLvl, currentDictExamTitle);
                }
                const chip = document.createElement('div');
                chip.className = `q-chip ${isSentLocked ? 'is-locked-chip' : ''}`;
                chip.textContent = String(idx + 1);

                // Strictly turn green ONLY if the whole sentence was completed
                if (doneMap[idx]) {
                    chip.classList.add('correct');
                }

                if (idx === currentDictIndex) {
                    chip.style.borderColor = '#111113';
                    chip.style.borderWidth = '2px';
                    chip.style.fontWeight = '800';
                    chip.style.color = '#111113';
                    chip.style.background = '#f5f5f7';
                }

                chip.addEventListener('click', () => {
                    if (isSentLocked) {
                        if (typeof window.closeDictationDrawer === 'function') {
                            window.closeDictationDrawer();
                        } else if (drawerMask) {
                            drawerMask.classList.remove('active');
                            drawerMask.style.display = 'none';
                        }
                        if (window.ToyPermissions) {
                            if (isDailyListeningActive()) {
                                const dayIdx = (window._currentDailyDay || 1) - 1;
                                window.ToyPermissions.showUnlockModal('daily', { examIndex: dayIdx, sentenceIndex: idx, dayNum: window._currentDailyDay, level: 'daily' });
                            } else {
                                window.ToyPermissions.showUnlockModal('dictation', { examIndex: examIdx >= 0 ? examIdx : 0, sentenceIndex: idx, examTitle: currentDictExamTitle, level: curLvl });
                            }
                        }
                        return;
                    }
                    renderDictationSentence(idx);
                    if (typeof window.closeDictationDrawer === 'function') {
                        window.closeDictationDrawer();
                    } else if (drawerMask) {
                        drawerMask.classList.remove('active');
                        drawerMask.style.display = 'none';
                    }
                });
                drawerGrid.appendChild(chip);
            }
        };

        // 3. Render Section Jump Pills in Dictation Drawer
        if (drawerSecNav) {
            const curLvl = getActiveDictExamLevel();
            const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
            const examIdx = manifestList.findIndex(m => m.title === currentDictExamTitle || m.examId === currentDictExamTitle);
            drawerSecNav.innerHTML = categories.map(c => {
                const isActive = (c.key === activeCat.key);
                const isSecLocked = isDailyListeningActive()
                    ? (window.ToyPermissions && !window.ToyPermissions.canAccessDaily((window._currentDailyDay || 1) - 1, c.startIdx))
                    : (window.ToyPermissions && !window.ToyPermissions.canAccessDictation(examIdx >= 0 ? examIdx : 0, c.startIdx, curLvl, currentDictExamTitle));
                return `<button class="drawer-sec-pill ${isActive ? 'active' : ''} ${isSecLocked ? 'is-sec-locked' : ''}" data-cat-key="${c.key}"><span>${c.icon}</span><span>${c.label}${isSecLocked ? ' 🔒' : ''}</span></button>`;
            }).join('');

            drawerSecNav.querySelectorAll('.drawer-sec-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    const catKey = btn.dataset.catKey;
                    const foundCat = categories.find(c => c.key === catKey);
                    if (foundCat) {
                        activeCat = foundCat;
                        drawerSecNav.querySelectorAll('.drawer-sec-pill').forEach(b => {
                            b.classList.toggle('active', b.dataset.catKey === catKey);
                        });
                        renderCategoryChips(activeCat);
                    }
                });
            });

            if (window.enableHorizontalDragScroll) {
                window.enableHorizontalDragScroll(drawerSecNav, document.getElementById('dict-drawer-section-nav-wrapper'));
            }
        }

        // 4. Initial render of the active category chips
        renderCategoryChips(activeCat);

        if (drawerMask) {
            drawerMask.style.display = '';
            drawerMask.classList.add('active');
        }
    } catch(err) {
        console.error('[Dictation] renderSentenceDrawer error:', err);
    }
}
window.renderSentenceDrawer = renderSentenceDrawer;

// Auto init event listeners when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDictationEventListeners);
} else {
    initDictationEventListeners();
}
window.initDictationEventListeners = initDictationEventListeners;
