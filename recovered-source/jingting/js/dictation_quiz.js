/* === js/dictation_quiz.js === */
// ==========================================================================
// Dictation Sentence Renderer, Cloze Input Engine & Auto-Advance (js/dictation_quiz.js)
// ==========================================================================

// 3. Render Sentence & Smart Cloze Blanks
function renderDictationSentence(index, options = {}) {
    const isDaily = (typeof isDailyListeningActive === 'function' && isDailyListeningActive()) || !!window._isDailyListening;
    if (isDaily) {
        const dayIdx = (typeof window._currentDailyDay === 'number' && window._currentDailyDay > 0) ? (window._currentDailyDay - 1) : 0;
        if (window.ToyPermissions && !window.ToyPermissions.canAccessDaily(dayIdx, index)) {
            if (window.DictAudioEngine && typeof window.DictAudioEngine.pauseSentenceAudio === 'function') {
                window.DictAudioEngine.pauseSentenceAudio();
            }
            window.ToyPermissions.showUnlockModal('daily', { examIndex: dayIdx, sentenceIndex: index, dayNum: window._currentDailyDay || (dayIdx + 1), level: 'daily' });
            return;
        }
    } else {
        const curLvl = getActiveDictExamLevel();
        window.currentExamLevel = curLvl;
        const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
        const examIdx = manifestList.findIndex(m => m.title === currentDictExamTitle || m.examId === currentDictExamTitle);
        if (window.ToyPermissions && !window.ToyPermissions.canAccessDictation(examIdx >= 0 ? examIdx : 0, index, curLvl, currentDictExamTitle)) {
            if (window.DictAudioEngine && typeof window.DictAudioEngine.pauseSentenceAudio === 'function') {
                window.DictAudioEngine.pauseSentenceAudio();
            }
            window.ToyPermissions.showUnlockModal('dictation', { examIndex: examIdx >= 0 ? examIdx : 0, sentenceIndex: index, level: curLvl, examTitle: currentDictExamTitle });
            return;
        }
    }

    const isArenaEntry = !!(options && options.isArenaEntry);
    currentDictIndex = index;
    if (typeof hideContextualPopover === 'function') hideContextualPopover();
    if (typeof window.closeEnterNextHint === 'function') window.closeEnterNextHint(false);
    if (!options.preserveScroll && !isArenaEntry) {
        try {
            window.scrollTo({ top: 0, behavior: 'instant' });
        } catch (_) {
            try { window.scrollTo(0, 0); } catch (e) {}
        }
    }

    // Trigger smooth slide transition (never on initial arena entry, and auto-cleaned so it never replays on display:flex)
    const heroStage = document.querySelector('.dict-hero-stage');
    if (heroStage && !isArenaEntry && lastRenderedSentIdx !== -1 && lastRenderedSentIdx !== index && !options.preserveAudio && !options.preserveScroll) {
        heroStage.classList.remove('sentence-anim-forward', 'sentence-anim-backward');
        void heroStage.offsetWidth; // trigger reflow
        if (index > lastRenderedSentIdx) {
            heroStage.classList.add('sentence-anim-forward');
        } else {
            heroStage.classList.add('sentence-anim-backward');
        }
        if (typeof heroStage.addEventListener === 'function' && !heroStage._sentAnimEndBound) {
            heroStage._sentAnimEndBound = true;
            heroStage.addEventListener('animationend', (ev) => {
                if (!ev || ev.target === heroStage) {
                    heroStage.classList.remove('sentence-anim-forward', 'sentence-anim-backward');
                }
            });
        }
    }

    if (!currentDictSentences || currentDictSentences.length === 0) return;
    index = Math.max(0, Math.min(index, currentDictSentences.length - 1));
    const sent = currentDictSentences[index];
    if (!sent) return;

    // Pause any playing audio from previous sentence & release memory Blob URL (only when NOT preserving audio)
    if (!options.preserveAudio) {
        if (currentDailyTimeout) {
            clearTimeout(currentDailyTimeout);
            currentDailyTimeout = null;
        }
        removePauseBreathingToast();
        if (window.DictAudioEngine) {
            DictAudioEngine.playToken++;
            DictAudioEngine.isPlaying = false;
            DictAudioEngine.isBuffering = false;
        }
        updateZenAudioPlayState(false);

        const audioPlayer = document.getElementById('dictation-audio-player');
        if (audioPlayer) {
            if (!audioPlayer.paused) {
                try { audioPlayer.pause(); } catch(e) {}
            }
            if (isDaily) {
                audioPlayer.currentTime = 0;
            }
        }
        if (window.DictAudioEngine) {
            if (window.DictAudioEngine.activeBlobUrl) {
                try { URL.revokeObjectURL(window.DictAudioEngine.activeBlobUrl); } catch(e) {}
                window.DictAudioEngine.activeBlobUrl = null;
                window.DictAudioEngine.currentBlobCacheKey = null;
            }
            if (window.DictAudioEngine.activeDailyBlobUrl) {
                try { URL.revokeObjectURL(window.DictAudioEngine.activeDailyBlobUrl); } catch(e) {}
                window.DictAudioEngine.activeDailyBlobUrl = null;
                window.DictAudioEngine.activeDailyBlobKey = null;
            }
            window.DictAudioEngine.currentDailyKey = null;
        }
        clearDictAudioLoop();
    }

    // Update Difficulty Mode button text & styling
    updateDictModeButtonUI();

    // Top badges
    const seqBadge = document.getElementById('dict-seq-val');
    const secBadge = document.getElementById('dict-section-badge');
    const zhBox = document.getElementById('dict-zh-box');
    const btnZhHint = document.getElementById('btn-dict-hint-zh');
    const btnConfig = document.getElementById('btn-dict-audio-config');

    if (btnConfig) {
        if (isDaily) {
            btnConfig.classList.remove('is-hidden');
            btnConfig.style.removeProperty('display');
            updateDailyAudioSettingsUI();
        } else {
            btnConfig.classList.add('is-hidden');
            btnConfig.style.display = 'none';
        }
    }

    if (seqBadge) seqBadge.textContent = `${String(index + 1).padStart(2, '0')} / ${String(currentDictSentences.length).padStart(2, '0')}`;
    if (secBadge) {
        if (isDaily) {
            secBadge.textContent = `Day ${String(window._currentDailyDay || 1).padStart(2, '0')} · 第 ${index + 1} 句`;
        } else {
            secBadge.textContent = sent.group || sent.sec || ((window.currentExamLevel === 'cet6') ? 'Conversations 1' : 'News Report 1');
        }
    }

    // Cleaned Chinese text with proper punctuation
    let cleanZh = (sent.zh || '').trim().replace(/[,，、]$/, '。');
    if (cleanZh && !/[。？！…]$/.test(cleanZh)) cleanZh += '。';

    if (zhBox) {
        const canUseB = (window.ToyPermissions && typeof window.ToyPermissions.canUseBilingualMode === 'function')
            ? window.ToyPermissions.canUseBilingualMode()
            : false;
        zhBox.textContent = cleanZh || '原声听力例句精读';
        zhBox.classList.toggle('show', !!((canUseB && window.showDictBilingual) || dictAnswerModeActive));
    }
    if (!options.keepSkeleton && !options.keepModes) {
        dictSkeletonModeActive = false;
        dictAnswerModeActive = false;
    }

    const btnHintFirst = document.getElementById('btn-dict-hint-first');
    if (btnHintFirst) {
        btnHintFirst.innerHTML = dictSkeletonModeActive ? '💡 关闭' : '💡 提示';
        btnHintFirst.classList.toggle('active-toggle', !!dictSkeletonModeActive);
    }

    const btnRevealAnswer = document.getElementById('btn-dict-reveal-answer');
    if (btnRevealAnswer) {
        btnRevealAnswer.innerHTML = dictAnswerModeActive ? '📖 关闭' : '📖 答案';
        btnRevealAnswer.classList.toggle('active-toggle', !!dictAnswerModeActive);
    }

    if (typeof syncDictKbToolButtonsState === 'function') {
        syncDictKbToolButtonsState();
    }

    // Check if whole sentence was already fully completed previously
    const isAlreadyDone = !!window.completedExams?.[currentDictExamTitle]?.dictationCompleted?.[index];

    // Select Smart Target Blank Words (Proportional ~30% in basic, ~60% in advanced)
    const rawText = sent.text || '';
    if (index !== lastRenderedSentIdx || !options.keepModes || !currentSentenceChosenIndices) {
        lastRenderedSentIdx = index;
        currentSentenceChosenIndices = selectSmartBlankTokenIndices(rawText, dictDifficultyMode, true);
        if (!options.keepModes) {
            // Reset temporary partial inputs when navigating across different sentences
            if (!window.currentSentenceSolvedTokens) window.currentSentenceSolvedTokens = {};
            window.currentSentenceSolvedTokens[index] = new Set();
        }
    }
    const chosenIndices = currentSentenceChosenIndices;

    // Word completion state
    if (!window.currentSentenceSolvedTokens) window.currentSentenceSolvedTokens = {};
    if (!window.currentSentenceSolvedTokens[index]) window.currentSentenceSolvedTokens[index] = new Set();
    const sentenceDoneSet = window.currentSentenceSolvedTokens[index];
    const existingInputValues = {};

    const clozeCard = document.getElementById('dict-cloze-card');
    if (clozeCard) {
        if (options && (options.slideDirection === 'left' || options.slideDirection === 'right')) {
            if (clozeCard._swipeCleanTimer) {
                clearTimeout(clozeCard._swipeCleanTimer);
                clozeCard._swipeCleanTimer = null;
            }
            clozeCard.classList.remove('swipe-slide-left', 'swipe-slide-right');
            void clozeCard.offsetWidth;
            clozeCard.classList.add(options.slideDirection === 'left' ? 'swipe-slide-left' : 'swipe-slide-right');
            clozeCard._swipeCleanTimer = setTimeout(() => {
                clozeCard.classList.remove('swipe-slide-left', 'swipe-slide-right');
                clozeCard._swipeCleanTimer = null;
            }, 230);
        }

        if (options.keepModes) {
            clozeCard.querySelectorAll('.cloze-word-done, .cloze-input[disabled]').forEach(el => {
                const tIdx = parseInt(el.dataset.tokenIdx);
                if (!isNaN(tIdx)) sentenceDoneSet.add(tIdx);
            });
            clozeCard.querySelectorAll('.cloze-input:not([disabled])').forEach(inp => {
                const tIdx = parseInt(inp.dataset.tokenIdx);
                if (!isNaN(tIdx) && inp.value) {
                    existingInputValues[tIdx] = inp.value;
                }
            });
        }

        clozeCard.innerHTML = '';
        const tokens = rawText.split(/([a-zA-Z]+(?:[\'\-][a-zA-Z]+)*)/);

        tokens.forEach((token, idx) => {
            const lower = token.toLowerCase();
            if (chosenIndices.has(idx)) {
                // 🌟 Detect and bind trailing punctuation to prevent orphan punctuation or gaps
                let trailingPunct = '';
                if (idx + 1 < tokens.length && typeof tokens[idx + 1] === 'string') {
                    const punctMatch = tokens[idx + 1].match(/^([,\.?!;:\)\]\'\"”’—–…]+)([\s\S]*)$/);
                    if (punctMatch) {
                        trailingPunct = punctMatch[1];
                        tokens[idx + 1] = punctMatch[2]; // Consume punctuation so it won't be repeated
                    }
                }

                const isWordDone = isAlreadyDone || sentenceDoneSet.has(idx);
                if (isWordDone) {
                    const doneSpan = document.createElement('span');
                    doneSpan.className = 'cloze-word-done';
                    doneSpan.dataset.tokenIdx = String(idx);
                    doneSpan.dataset.sentIdx = String(index);
                    doneSpan.style.minWidth = `${measureClozeWordWidth(token)}px`;
                    doneSpan.style.width = 'auto';
                    doneSpan.style.whiteSpace = 'nowrap';
                    if (typeof makeTextClickable === 'function') {
                        doneSpan.innerHTML = makeTextClickable(token);
                    } else {
                        doneSpan.textContent = token;
                    }

                    if (trailingPunct) {
                        const atom = document.createElement('span');
                        atom.className = 'cloze-atom';
                        doneSpan.classList.add('cloze-has-punct');
                        atom.appendChild(doneSpan);
                        const pSpan = document.createElement('span');
                        pSpan.className = 'cloze-punct';
                        pSpan.textContent = trailingPunct;
                        atom.appendChild(pSpan);
                        clozeCard.appendChild(atom);
                    } else {
                        clozeCard.appendChild(doneSpan);
                    }
                } else {
                    const wrap = document.createElement('span');
                    wrap.className = 'cloze-input-wrap';
                    wrap.style.width = `${measureClozeWordWidth(token)}px`;

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'cloze-input';
                    input.dataset.sentIdx = String(index);
                    input.dataset.tokenIdx = String(idx);
                    input.dataset.target = token;
                    input.dataset.targetLower = lower;

                    // 🌟 User-specified length limit: e.g. 6 letters allows max 8 letters (token.length + 2)
                    const maxAllowedChars = Math.max(3, token.length + 2);
                    input.maxLength = maxAllowedChars;

                    input.setAttribute('autocomplete', 'off');
                    input.setAttribute('autocorrect', 'off');
                    input.setAttribute('autocapitalize', 'none');
                    const useVirtualKb = (typeof isCustomKeyboardEnabled === 'function') ? isCustomKeyboardEnabled() : true;
                    if (useVirtualKb) {
                        input.setAttribute('inputmode', 'none'); // 'none' prevents mobile OS virtual IME popup
                    } else {
                        input.removeAttribute('inputmode'); // PC desktop: standard native input for physical keyboard
                    }
                    input.setAttribute('lang', 'en-US');

                    if (dictAnswerModeActive) {
                        input.placeholder = token;
                        input.classList.add('ghost-answer-mode');
                    } else if (dictSkeletonModeActive) {
                        if (token.length === 1) {
                            const ghostStart = document.createElement('span');
                            ghostStart.className = 'hint-ghost-start';
                            ghostStart.textContent = token[0];
                            wrap.appendChild(ghostStart);
                        } else {
                            const ghostStart = document.createElement('span');
                            ghostStart.className = 'hint-ghost-start';
                            ghostStart.textContent = token[0];
                            wrap.appendChild(ghostStart);

                            const ghostEnd = document.createElement('span');
                            ghostEnd.className = 'hint-ghost-end';
                            ghostEnd.textContent = token[token.length - 1];
                            wrap.appendChild(ghostEnd);
                        }
                    }

                    const updateValueState = () => {
                        const val = input.value || '';
                        if (val.trim().length > 0) {
                            wrap.classList.add('has-value');
                        } else {
                            wrap.classList.remove('has-value');
                        }

                        // 🌟 Dynamic Elastic Capsule ("随打随长"): accommodates maxAllowedChars with full visibility
                        const baseWidth = measureClozeWordWidth(token);
                        if (!val) {
                            wrap.style.width = `${baseWidth}px`;
                        } else {
                            const typedWidth = measureClozeWordWidth(val);
                            wrap.style.width = `${Math.max(baseWidth, typedWidth)}px`;
                        }
                    };

                    if (existingInputValues[idx]) {
                        input.value = existingInputValues[idx];
                        updateValueState();
                    }

                    const sanitizeAndProcess = () => {
                        const rawVal = String(input.value || '')
                            .replace(/[\u2018\u2019\u201B\u02BC\uFF07`]/g, "'")
                            .replace(/[\u2013\u2014\u2212\uFF0D]/g, '-');
                        let cleanVal = rawVal.replace(/[^a-zA-Z\'-]/g, '');
                        const maxLimit = input.maxLength || maxAllowedChars;
                        if (cleanVal.length > maxLimit) {
                            cleanVal = cleanVal.slice(0, maxLimit);
                        }
                        if (input.value !== cleanVal) {
                            input.value = cleanVal;
                        }
                        input._virtualCaretPos = input.value.length;
                        updateValueState();
                        handleClozeInput(input, token);
                        if (typeof updateCustomKeyboardStatus === 'function') {
                            updateCustomKeyboardStatus();
                        }
                    };

                    const moveCursorToEnd = () => {
                        try {
                            if (!input.disabled) {
                                const len = input.value.length;
                                input.setSelectionRange(len, len);
                                input._virtualCaretPos = len;
                                input._userExplicitlyAtZero = false;
                            }
                        } catch(e) {}
                    };

                    const activateBlank = (e) => {
                        if (window.isLookupMode) {
                            if ((dictAnswerModeActive || (input.value && input.value.trim())) && typeof showContextualPopover === 'function') {
                                const lookupWord = (input.value && input.value.trim()) ? input.value.trim() : (input.dataset.target || '');
                                if (lookupWord) {
                                    showContextualPopover(lookupWord, wrap);
                                }
                            }
                            return;
                        }
                        if (e && e.type === 'focus' && input._isProgrammaticFocus) {
                            return;
                        }
                        document.querySelectorAll('.cloze-input-wrap.has-focus').forEach(w => {
                            if (w !== wrap) w.classList.remove('has-focus');
                        });
                        wrap.classList.add('has-focus');
                        moveCursorToEnd();
                        if (typeof setActiveInputForCustomKeyboard === 'function') {
                            setActiveInputForCustomKeyboard(input, true);
                        }
                    };

                    input.addEventListener('focus', activateBlank);
                    input.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        if (window.isLookupMode) {
                            e.preventDefault();
                            activateBlank(e);
                            return;
                        }
                        activateBlank(e);
                    });
                    input.addEventListener('touchstart', (e) => {
                        e.stopPropagation();
                        activateBlank(e);
                    }, { passive: true });
                    input.addEventListener('click', (e) => {
                        e.stopPropagation();
                        activateBlank(e);
                    });
                    input.addEventListener('select', () => {
                        if (typeof input.selectionStart === 'number') {
                            input._virtualCaretPos = input.selectionStart;
                        }
                    });
                    input.addEventListener('keyup', (e) => {
                        if (typeof input.selectionStart === 'number') {
                            input._virtualCaretPos = input.selectionStart;
                            if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
                                input._userExplicitlyAtZero = true;
                            } else if (input.selectionStart > 0) {
                                input._userExplicitlyAtZero = false;
                            }
                        }
                    });
                    input.addEventListener('blur', () => {
                        if (typeof isCustomKeyboardEnabled === 'function' && isCustomKeyboardEnabled() && !window.dictKeyboardCollapsed && window.activeCustomKeyboardInput === input) {
                            return;
                        }
                        wrap.classList.remove('has-focus');
                    });
                    wrap.addEventListener('pointerdown', (e) => {
                        if (window.isLookupMode) {
                            e.stopPropagation();
                            e.preventDefault();
                            activateBlank(e);
                            return;
                        }
                        if (!input.disabled) {
                            e.stopPropagation();
                            input.focus();
                            activateBlank(e);
                            moveCursorToEnd();
                        }
                    });
                    wrap.addEventListener('touchstart', (e) => {
                        if (window.isLookupMode) {
                            e.stopPropagation();
                            activateBlank(e);
                            return;
                        }
                        if (!input.disabled) {
                            e.stopPropagation();
                            input.focus();
                            activateBlank(e);
                            moveCursorToEnd();
                        }
                    }, { passive: true });
                    wrap.addEventListener('click', (e) => {
                        if (window.isLookupMode) {
                            e.stopPropagation();
                            activateBlank(e);
                            return;
                        }
                        if (!input.disabled) {
                            e.stopPropagation();
                            input.focus();
                            activateBlank(e);
                            moveCursorToEnd();
                        }
                    });
                    wrap.addEventListener('dblclick', (e) => {
                        if (!input.disabled) {
                            e.stopPropagation();
                            input.focus();
                            input.select();
                            input.setSelectionRange(0, input.value.length);
                        }
                    });
                    input.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        input.select();
                        input.setSelectionRange(0, input.value.length);
                    });
                    input.addEventListener('beforeinput', (e) => {
                        if (e.isComposing) return;
                        if (e.data && e.data.length === 1) {
                            const normChar = e.data
                                .replace(/[\u2018\u2019\u201B\u02BC\uFF07`]/g, "'")
                                .replace(/[\u2013\u2014\u2212\uFF0D]/g, '-');
                            if (/[^a-zA-Z\'-]/.test(normChar) && normChar !== ' ') {
                                e.preventDefault();
                                return;
                            }
                            const curLen = input.value.length;
                            const selLen = (input.selectionEnd || curLen) - (input.selectionStart || curLen);
                            if ((curLen - selLen + normChar.length) > input.maxLength) {
                                e.preventDefault();
                            }
                        }
                    });
                    input.addEventListener('input', sanitizeAndProcess);
                    input.addEventListener('compositionend', sanitizeAndProcess);
                    input.addEventListener('paste', () => {
                        setTimeout(sanitizeAndProcess, 10);
                    });
                    input.addEventListener('keydown', (e) => {
                        // 🌟 0. If user is using Chinese/Pinyin IME composition, DO NOT intercept anything!
                        if (e.isComposing || e.keyCode === 229) {
                            return;
                        }

                        // 🌟 1. Ctrl+A / Cmd+A 全选当前空里的所有已输入字母
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                            e.preventDefault();
                            e.stopPropagation();
                            input.select();
                            input.setSelectionRange(0, input.value.length);
                            return;
                        }

                        const inputs = Array.from(document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])'));
                        const i = inputs.indexOf(input);

                        if (e.key === ' ' || e.code === 'Space') {
                            if (token.includes(' ') && !input.value.endsWith(' ')) {
                                // Allow typing space character if target phrase contains a space
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            if (typeof window.handleCustomKeyboardNextBlank === 'function') {
                                window.handleCustomKeyboardNextBlank();
                            }
                        } else if (e.key === 'ArrowLeft') {
                            e.stopPropagation();
                            if (input.selectionStart === 0 && input.selectionEnd === 0) {
                                if (i > 0) {
                                    e.preventDefault();
                                    inputs[i - 1].focus();
                                    const prevLen = inputs[i - 1].value.length;
                                    inputs[i - 1].setSelectionRange(prevLen, prevLen);
                                    inputs[i - 1]._virtualCaretPos = prevLen;
                                    inputs[i - 1]._userExplicitlyAtZero = false;
                                    if (typeof setActiveInputForCustomKeyboard === 'function') {
                                        setActiveInputForCustomKeyboard(inputs[i - 1], true);
                                    }
                                } else {
                                    input._userExplicitlyAtZero = true;
                                }
                            }
                        } else if (e.key === 'ArrowRight') {
                            if (input.selectionEnd === input.value.length && input.selectionStart === input.value.length) {
                                if (i < inputs.length - 1) {
                                    e.preventDefault();
                                    inputs[i + 1].focus();
                                    const nextLen = inputs[i + 1].value.length;
                                    inputs[i + 1].setSelectionRange(nextLen, nextLen);
                                    inputs[i + 1]._virtualCaretPos = nextLen;
                                    inputs[i + 1]._userExplicitlyAtZero = false;
                                    if (typeof setActiveInputForCustomKeyboard === 'function') {
                                        setActiveInputForCustomKeyboard(inputs[i + 1], true);
                                    }
                                }
                            }
                        } else if (e.key === 'Backspace' && input.value.length === 0) {
                            if (i > 0) {
                                e.preventDefault();
                                inputs[i - 1].focus();
                                const prevLen = inputs[i - 1].value.length;
                                inputs[i - 1].setSelectionRange(prevLen, prevLen);
                                inputs[i - 1]._virtualCaretPos = prevLen;
                                inputs[i - 1]._userExplicitlyAtZero = false;
                                if (typeof setActiveInputForCustomKeyboard === 'function') {
                                    setActiveInputForCustomKeyboard(inputs[i - 1], true);
                                }
                            }
                        } else if (e.key === 'Enter') {
                            const nextUnsolved = inputs.slice(i + 1).find(inp => !inp.disabled);
                            if (nextUnsolved) {
                                e.preventDefault();
                                nextUnsolved.focus();
                                const nextLen = nextUnsolved.value.length;
                                try { nextUnsolved.setSelectionRange(nextLen, nextLen); } catch(err) {}
                                nextUnsolved._virtualCaretPos = nextLen;
                                nextUnsolved._userExplicitlyAtZero = false;
                                if (typeof setActiveInputForCustomKeyboard === 'function') {
                                    setActiveInputForCustomKeyboard(nextUnsolved, true);
                                }
                            } else {
                                const allUnsolved = document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])');
                                if (allUnsolved.length <= 1) {
                                    e.preventDefault();
                                    if (typeof window.handleNextDictSentence === 'function') {
                                        window.handleNextDictSentence();
                                    } else if (typeof handleNextSentence === 'function') {
                                        handleNextSentence();
                                    }
                                }
                            }
                        }
                    });

                    wrap.appendChild(input);

                    if (trailingPunct) {
                        const atom = document.createElement('span');
                        atom.className = 'cloze-atom';
                        wrap.classList.add('cloze-has-punct');
                        atom.appendChild(wrap);
                        const pSpan = document.createElement('span');
                        pSpan.className = 'cloze-punct';
                        pSpan.textContent = trailingPunct;
                        atom.appendChild(pSpan);
                        atom.addEventListener('click', (e) => {
                            if (!input.disabled && e.target !== input) {
                                input.focus();
                                activateBlank(e);
                                moveCursorToEnd();
                            }
                        });
                        clozeCard.appendChild(atom);
                    } else {
                        clozeCard.appendChild(wrap);
                    }
                }
            } else {
                if (typeof makeTextClickable === 'function') {
                    const temp = document.createElement('span');
                    temp.innerHTML = makeTextClickable(token);
                    while (temp.firstChild) {
                        clozeCard.appendChild(temp.firstChild);
                    }
                } else {
                    clozeCard.appendChild(document.createTextNode(token));
                }
            }
        });

        // Sync capsule widths after DOM layout (and after webfont readiness) so long words like "six-year-old" never clip
        const syncAllClozeInputWidths = () => {
            const cardEl = document.getElementById('dict-cloze-card');
            if (!cardEl) return;
            cardEl.querySelectorAll('.cloze-input-wrap').forEach(w => {
                const inp = w.querySelector('.cloze-input');
                if (!inp) return;
                const targetText = inp.dataset.target || inp.placeholder || '';
                const curVal = inp.value || '';
                const baseW = measureClozeWordWidth(targetText);
                const valW = curVal ? measureClozeWordWidth(curVal) : 0;
                w.style.width = `${Math.max(baseW, valW)}px`;
            });
        };
        window.syncAllClozeInputWidths = syncAllClozeInputWidths;
        if (!window._clozeResizeWidthBound) {
            window._clozeResizeWidthBound = true;
            window.addEventListener('resize', () => {
                if (typeof window.syncAllClozeInputWidths === 'function') {
                    window.syncAllClozeInputWidths();
                }
            }, { passive: true });
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    if (typeof window.syncAllClozeInputWidths === 'function') {
                        window.syncAllClozeInputWidths();
                    }
                }, 120);
            }, { passive: true });
        }
        syncAllClozeInputWidths();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(syncAllClozeInputWidths);
        }
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
            document.fonts.ready.then(syncAllClozeInputWidths).catch(() => {});
        }
    }

    // Sync Navigation Buttons State (both inside card and footer bar)
    const isFirst = (index === 0);
    const isLast = (index === currentDictSentences.length - 1);
    const nextBtnText = isLast ? '🎉 完成精听特训' : '下一句 →';

    const btnPrev = document.getElementById('btn-dict-prev');
    const btnNext = document.getElementById('btn-dict-next');
    const btnCardPrev = document.getElementById('btn-dict-card-prev');
    const btnCardNext = document.getElementById('btn-dict-card-next');
    const btnKbPrev = document.getElementById('btn-dict-kb-prev');
    const btnKbNext = document.getElementById('btn-dict-kb-next');

    if (btnPrev) { btnPrev.disabled = isFirst; }
    if (btnCardPrev) { btnCardPrev.disabled = isFirst; }
    if (btnKbPrev) { btnKbPrev.disabled = isFirst; }
    if (btnNext) {
        btnNext.textContent = nextBtnText;
        btnNext.classList.remove('pulse-next-guide');
    }
    if (btnCardNext) {
        btnCardNext.textContent = nextBtnText;
        btnCardNext.classList.remove('pulse-next-guide');
    }
    if (btnKbNext) {
        const kbNextText = document.getElementById('dict-kb-next-text');
        if (kbNextText) kbNextText.textContent = isLast ? '🎉 完成' : '下句 ➔';
        btnKbNext.classList.remove('pulse-next-guide');
    }

    // Audio Playback: If preserveAudio is true, do not interrupt playing audio or restart paused audio
    if (!options.preserveAudio) {
        playDictationAudioSegment(sent.start, sent.end);
    }

    // Set active input pointer to first unsolved blank
    if (clozeCard && !isAlreadyDone) {
        const firstUnsolvedInput = clozeCard.querySelector('.cloze-input:not([disabled])');
        if (firstUnsolvedInput) {
            setTimeout(() => {
                try {
                    // Do not override if user has already actively selected/focused a blank!
                    if (window.activeCustomKeyboardInput && 
                        !window.activeCustomKeyboardInput.disabled && 
                        document.body.contains(window.activeCustomKeyboardInput) && 
                        window.activeCustomKeyboardInput.closest('#dict-cloze-card')) {
                        return;
                    }
                    const isInPlaceRefresh = !!(options.keepModes || options.preserveScroll);
                    const shouldExpandKb = window.isLookupMode
                        ? false
                        : (isInPlaceRefresh
                            ? !window.dictKeyboardCollapsed
                            : ((typeof isPCDesktopDevice === 'function') ? !isPCDesktopDevice() : true));
                    if (typeof setActiveInputForCustomKeyboard === 'function' && !window.isLookupMode) {
                        setActiveInputForCustomKeyboard(firstUnsolvedInput, shouldExpandKb);
                    }
                    const len = firstUnsolvedInput.value.length;
                    firstUnsolvedInput.setSelectionRange(len, len);
                    firstUnsolvedInput._virtualCaretPos = len;
                    firstUnsolvedInput._userExplicitlyAtZero = false;
                } catch(e) {}
            }, 60);
        }
    }

    // Render candidate chips if Word Bank mode is active
    if (typeof renderWordBankChips === 'function') {
        renderWordBankChips();
    }

    if (typeof updateCustomKeyboardNextBtnState === 'function') {
        updateCustomKeyboardNextBtnState(isAlreadyDone);
    }
    if (typeof syncCustomVirtualKeyboardUI === 'function') {
        syncCustomVirtualKeyboardUI();
    }
    if (typeof syncDictKeyboardPreferenceUI === 'function') {
        syncDictKeyboardPreferenceUI();
    }
    if (typeof window.kickLiquidGlass === 'function') setTimeout(window.kickLiquidGlass, 60);
}

// 4. Handle Input Typing & Verification
function handleClozeInput(input, targetWord) {
    const wrap = input.closest('.cloze-input-wrap');
    const rawVal = input.value;
    const normalizedVal = String(rawVal || '')
        .replace(/[\u2018\u2019\u201B\u02BC\uFF07`]/g, "'")
        .replace(/[\u2013\u2014\u2212\uFF0D]/g, '-');
    const cleanVal = normalizedVal.replace(/[^a-zA-Z\'-]/g, '');
    if (rawVal !== cleanVal) {
        input.value = cleanVal;
    }
    const val = cleanVal.trim();
    const valLower = val.toLowerCase();
    const targetLower = targetWord.toLowerCase();

    const normVal = valLower.replace(/[\'-]/g, '');
    const normTarget = targetLower.replace(/[\'-]/g, '');

    const isMatch = (valLower === targetLower) || (normVal.length > 0 && normVal === normTarget);

    if (isMatch) {
        input.disabled = true;

        if (window.FeedbackEngine) {
            window.FeedbackEngine.playCorrect();
        }

        // Auto-format displayed value immediately to canonical targetWord (e.g. 'year-old', 'don\'t')
        input.value = targetWord;
        input.style.width = `${measureClozeWordWidth(targetWord)}px`;

        // Query all inputs in card and determine next forward unsolved blank
        const allCardInputs = Array.from(document.querySelectorAll('#dict-cloze-card .cloze-input'));
        const curIdx = allCardInputs.indexOf(input);
        const remainingInputs = allCardInputs.filter(inp => inp !== input && !inp.disabled);

        let nextInput = null;
        if (remainingInputs.length > 0) {
            nextInput = allCardInputs.slice(curIdx + 1).find(inp => !inp.disabled) || remainingInputs[0];
        }

        // 1. Immediately focus next input synchronously within user gesture event loop
        if (nextInput) {
            nextInput.focus();
            const nextWrap = nextInput.closest('.cloze-input-wrap');
            if (nextWrap) nextWrap.classList.add('has-focus');
            const nextLen = nextInput.value.length;
            try { nextInput.setSelectionRange(nextLen, nextLen); } catch(err) {}
            nextInput._virtualCaretPos = nextLen;
            nextInput._userExplicitlyAtZero = false;
            if (typeof setActiveInputForCustomKeyboard === 'function') {
                setActiveInputForCustomKeyboard(nextInput, true);
            }
        }

        // 2. Add green success pulse on current word
        if (wrap) {
            wrap.classList.add('correct-flash');
        }

        // 3. Smooth instantaneous transition to fuse into green done badge
        setTimeout(() => {
            if (!document.body.contains(input)) return;
            fuseClozeInputIntoText(input, targetWord);

            // Double check if any unsolved blanks remain in the current sentence
            const stillRemaining = document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])');
            if (stillRemaining.length === 0) {
                triggerDictationSentenceSuccess();
            } else if (nextInput && !nextInput.disabled) {
                nextInput.focus();
                const nextLen = nextInput.value.length;
                try { nextInput.setSelectionRange(nextLen, nextLen); } catch(err) {}
                nextInput._virtualCaretPos = nextLen;
                nextInput._userExplicitlyAtZero = false;
                if (typeof setActiveInputForCustomKeyboard === 'function') {
                    setActiveInputForCustomKeyboard(nextInput, true);
                }
            }
        }, 60);
    }
}

// 5. Success Celebration & Continuous Auto-Advance Loop
let dictAutoAdvanceTimer = null;

function clearDictAutoAdvance() {
    if (dictAutoAdvanceTimer) {
        clearTimeout(dictAutoAdvanceTimer);
        dictAutoAdvanceTimer = null;
    }
    const btnNext = document.getElementById('btn-dict-next');
    if (btnNext) btnNext.classList.remove('auto-advancing');
    const btnKbNext = document.getElementById('btn-dict-kb-next');
    if (btnKbNext) btnKbNext.classList.remove('auto-advancing');
}
window.clearDictAutoAdvance = clearDictAutoAdvance;

function triggerDictationSentenceSuccess() {
    clearDictAutoAdvance();
    if (typeof playSuccessBellChime === 'function') {
        playSuccessBellChime();
    }

    // Save Progress
    if (currentDictExamTitle) {
        if (!window.completedExams[currentDictExamTitle]) {
            window.completedExams[currentDictExamTitle] = {};
        }
        if (!window.completedExams[currentDictExamTitle].dictationCompleted) {
            window.completedExams[currentDictExamTitle].dictationCompleted = {};
        }
        const nowDictTs = Date.now();
        window.completedExams[currentDictExamTitle].timestamp = nowDictTs;
        window.completedExams[currentDictExamTitle].dictUpdatedAt = nowDictTs;
        window.completedExams[currentDictExamTitle].dictationCompleted[currentDictIndex] = true;
        saveUserCloudData(currentDictExamTitle);

        if (typeof recordTodayQuestionAnswer === 'function') {
            recordTodayQuestionAnswer(currentDictExamTitle, 'dict_' + currentDictIndex, true);
        }
    }

    // Replay full audio slice once for complete listening immersion
    const sent = currentDictSentences[currentDictIndex];
    if (sent) {
        playDictationAudioSegment(sent.start, sent.end);
    }

    // Guide user with animated next button (No banner popup, no automatic jump)
    const isLast = (currentDictIndex === currentDictSentences.length - 1);
    const btnNext = document.getElementById('btn-dict-next');
    const btnCardNext = document.getElementById('btn-dict-card-next');
    if (btnNext) btnNext.classList.add('pulse-next-guide');
    if (btnCardNext) btnCardNext.classList.add('pulse-next-guide');
    if (typeof updateCustomKeyboardNextBtnState === 'function') {
        updateCustomKeyboardNextBtnState(true);
    }

    if (isLast) {
        if (typeof launchGrandConfettiShow === 'function') {
            launchGrandConfettiShow();
        }
    } else {
        // Continuous auto-advance loop: after audio segment completes, seamlessly glide to next sentence
        const audioPlayer = document.getElementById('dictation-audio-player');
        const hasValidSlice = sent && typeof sent.end === 'number' && typeof sent.start === 'number' && sent.end > sent.start;
        const rawDur = hasValidSlice
            ? (sent.end - sent.start)
            : ((audioPlayer && Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) ? audioPlayer.duration : 2.8);
        const audioDurationSec = Math.max(1.8, Math.min(8.0, rawDur / (window.dictPlaybackRate || 1.0)));
        const autoAdvanceDelay = Math.round((audioDurationSec + 0.8) * 1000);
        const thisSentenceIdx = currentDictIndex;

        if (btnNext) btnNext.classList.add('auto-advancing');
        const btnKbNext = document.getElementById('btn-dict-kb-next');
        if (btnKbNext) btnKbNext.classList.add('auto-advancing');

        dictAutoAdvanceTimer = setTimeout(() => {
            dictAutoAdvanceTimer = null;
            if (window.activeView !== 'dictation-arena' || currentDictIndex !== thisSentenceIdx) return;
            const nextFn = window.handleNextDictSentence || window.handleNextSentence;
            if (typeof nextFn === 'function') {
                nextFn();
            }
        }, autoAdvanceDelay);
    }
}

window.showEnterNextHint = function() {
    const popover = document.getElementById('enter-next-popover');
    if (popover) {
        popover.style.display = 'none';
    }
};

window.closeEnterNextHint = function(isNever = false) {
    if (isNever) {
        try {
            window.__toyLS.setItem('toy_never_show_enter_hint', 'true');
            if (window.ToyStorage && typeof window.ToyStorage.setItem === 'function') {
                window.ToyStorage.setItem('toy_never_show_enter_hint', 'true');
            }
        } catch(e) {}
    }
    const popover = document.getElementById('enter-next-popover');
    if (popover) {
        popover.style.display = 'none';
    }
};


window.renderDictationSentence = renderDictationSentence;
window.handleClozeInput = handleClozeInput;
window.clearDictAutoAdvance = clearDictAutoAdvance;
window.triggerDictationSentenceSuccess = triggerDictationSentenceSuccess;
