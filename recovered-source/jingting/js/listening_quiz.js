/* === js/listening_quiz.js === */
/**
 * ==========================================================================
 * Listening Exam Engine (Q1-25 · News / Conversations / Passages)
 * ==========================================================================
 */

var currentExamTitle = '';
var currentQuestions = [];
var currentQIndex = 0;
var userAnswers = {};
var isExamMode = false;
try {
    const savedMode = window.__toyLS.getItem('toy_exam_mode');
    if (savedMode !== null) {
        isExamMode = (savedMode === 'true');
    }
} catch(e) {}
if (window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
    isExamMode = true;
}
window.isExamMode = isExamMode;
window.hideListeningQuestion = false;
try {
    window.hideListeningQuestion = (window.__toyLS.getItem('cet4_hide_listening_question') === 'true');
} catch(e) {}
window.showBilingual = false;

function initYearFilters(retryCount = 0) {
    const yearFilterBar = document.getElementById('year-filter-bar');
    if (!yearFilterBar) return;
    if (!window.EXAMS_MAP && (!window.EXAMS_MANIFEST_BY_LEVEL || Object.keys(window.EXAMS_MANIFEST_BY_LEVEL).length === 0)) {
        if (retryCount < 40) {
            setTimeout(() => initYearFilters(retryCount + 1), 50);
        }
        return;
    }
    const isGaokao = (window.currentExamLevel === 'gaokao');
    yearFilterBar.innerHTML = `
        <span class="chip-year active" data-range="ALL">全部年份</span>
        <span class="chip-year" data-range="2021-2026">2021–2026年</span>
        <span class="chip-year" data-range="2015-2020">2015–2020年</span>
        <span class="chip-year" data-range="2008-2014" style="display: ${isGaokao ? '' : 'none'};">2008–2014年</span>
    `;

    yearFilterBar.querySelectorAll('.chip-year').forEach(chip => {
        chip.addEventListener('click', () => {
            const nextRange = chip.dataset.range || 'ALL';
            const changed = (window.currentListeningFilter !== nextRange) || !chip.classList.contains('active');
            yearFilterBar.querySelectorAll('.chip-year').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            window.currentListeningFilter = nextRange;
            renderLobbyGrid(window.currentListeningFilter, { animateSlider: true });
            if (changed && typeof window.triggerExamGridFilterTransition === 'function') {
                window.triggerExamGridFilterTransition('exam-grid');
            }
        });
    });

    if (typeof updateSegmentedSlider === 'function') {
        updateSegmentedSlider(yearFilterBar, false);
    }

    if (window.enableHorizontalDragScroll) {
        window.enableHorizontalDragScroll(yearFilterBar);
    }
}

function renderLobbyGrid(filterRange, options = {}) {
    const examGrid = document.getElementById('exam-grid');
    if (!examGrid) return;
    
    const curLvlCheck = window.currentExamLevel || 'cet4';
    let activeFilter = filterRange || window.currentListeningFilter || 'ALL';
    if (curLvlCheck !== 'gaokao' && activeFilter === '2008-2014') {
        activeFilter = 'ALL';
    }
    window.currentListeningFilter = activeFilter;

    const filterBar = document.getElementById('year-filter-bar');
    if (filterBar) {
        const chips = filterBar.querySelectorAll('.chip-year');
        chips.forEach(c => {
            c.classList.toggle('active', c.dataset.range === activeFilter);
        });
        if (typeof window.updateSegmentedSlider === 'function') {
            window.updateSegmentedSlider(filterBar, !!(options && options.animateSlider));
        }
    }
    
    const manifestList = (typeof getActiveExamManifest === 'function')
        ? getActiveExamManifest()
        : (window.EXAMS_MAP ? Object.keys(window.EXAMS_MAP).map(t => ({ title: t })) : []);
        
    if (!manifestList || manifestList.length === 0) {
        const retryCount = (options && typeof options._retryCount === 'number') ? options._retryCount : 0;
        if (retryCount < 40) {
            setTimeout(() => renderLobbyGrid(activeFilter, Object.assign({}, options, { _retryCount: retryCount + 1 })), 50);
        } else {
            examGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; color: var(--ink-sub); font-size: 13.5px;">暂无可用听力试卷，请检查网络后重试</div>';
        }
        return;
    }
    examGrid.innerHTML = '';

    const tier = (window.ToyPermissions && typeof window.ToyPermissions.getTier === 'function')
        ? window.ToyPermissions.getTier()
        : 2;

    const unlockedListeningTitles = [];
    const activeListeningLvl = window.currentExamLevel || 'cet4';
    manifestList.forEach((item, idx) => {
        if (!item || item.isWrittenOnly || item.listeningCount === 0 || item.examId === '2024_12_cet4_set3') return;
        const title = item.title;
        const yearMatch = title.match(/(\d{4})年/);
        const y = yearMatch ? parseInt(yearMatch[1]) : (item.year || 0);

        if (activeFilter === '2021-2026' && !(y >= 2021 && y <= 2026)) return;
        if (activeFilter === '2015-2020' && !(y >= 2015 && y <= 2020)) return;
        if (activeFilter === '2008-2014' && !(y >= 2008 && y <= 2014)) return;

        const isDone = window.completedExams && window.completedExams[title];
        const curLvl = window.currentExamLevel || 'cet4';
        const canEnter = window.ToyPermissions ? window.ToyPermissions.canAccessListening(idx, 0, curLvl) : true;
        const isFullAccessible = window.ToyPermissions ? window.ToyPermissions.canAccessListening(idx, 2, curLvl) : true;
        const isLocked = !canEnter;
        let statusText = '未练习';
        let isCompleted = false;

        if (idx === 0) {
            const ansCount = (isDone && isDone.answers) ? Object.keys(isDone.answers).length : 0;
            if (isFullAccessible) {
                if (typeof isDone?.score === 'number' && !isNaN(isDone.score)) {
                    statusText = `已测 ${isDone.score}分`;
                    isCompleted = true;
                } else if (ansCount > 0) {
                    statusText = `已做 ${ansCount} 题`;
                    isCompleted = true;
                } else {
                    statusText = '未练习';
                }
            } else {
                statusText = ansCount > 0 ? '已试做' : '免费试做 (Q1-2)';
                isCompleted = ansCount > 0;
            }
        } else if (isLocked) {
            statusText = '关注+投币解锁';
        } else if (isDone) {
            const ansCount = isDone.answers ? Object.keys(isDone.answers).length : 0;
            if (typeof isDone.score === 'number' && !isNaN(isDone.score)) {
                statusText = `已测 ${isDone.score}分`;
                isCompleted = true;
            } else if (ansCount > 0) {
                statusText = `已做 ${ansCount} 题`;
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
            unlockedListeningTitles.push(title);
            if (typeof window.bindCardSpeculativePrefetch === 'function') {
                window.bindCardSpeculativePrefetch(card, title, curLvl, 'listening');
            }
        }
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        card.addEventListener('click', () => {
            const currentlyLocked = window.ToyPermissions ? !window.ToyPermissions.canAccessListening(idx, 0, curLvl) : false;
            if (currentlyLocked) {
                window.ToyPermissions.showUnlockModal('listening', { examIndex: idx, level: curLvl });
                return;
            }
            if (card.classList.contains('is-activating')) return;
            card.classList.add('is-activating');
            setTimeout(() => card.classList.remove('is-activating'), 900);
            startExam(title);
        });
        examGrid.appendChild(card);
    });
    if (unlockedListeningTitles.length > 0 && typeof window.scheduleLobbyTopPrefetch === 'function') {
        window.scheduleLobbyTopPrefetch(unlockedListeningTitles, activeListeningLvl, 'listening');
    }
}

async function startExam(title, opts = null) {
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
    if (window.ToyPermissions && !window.ToyPermissions.canAccessListening(safeExamIdx, 0, level)) {
        if (typeof window.ToyPermissions.shouldAwaitInitialSync === 'function' && window.ToyPermissions.shouldAwaitInitialSync()) {
            await window.ToyPermissions.ensureSynced(1200);
        }
        if (!window.ToyPermissions.canAccessListening(safeExamIdx, 0, level)) {
            window.ToyPermissions.showUnlockModal('listening', { examIndex: safeExamIdx, questionIndex: 0, level: level });
            return;
        }
    }

    const reqId = (window._listeningStartSeqId = (window._listeningStartSeqId || 0) + 1);
    const navSeq = window._navActionSeqId || 0;

    if (typeof ensureExamDataLoaded === 'function') {
        const loaded = await ensureExamDataLoaded(title, null, 'listening');
        if (!loaded) return;
        if (reqId !== window._listeningStartSeqId || (window._navActionSeqId || 0) !== navSeq) return;
    }

    const qList = (window.EXAMS_MAP && window.EXAMS_MAP[title]) ? window.EXAMS_MAP[title] : [];
    if (!qList || qList.length === 0) {
        if (typeof showToyToast === 'function') {
            showToyToast('ℹ️ 该套真题与同场次共用听力，请练习第一/二套');
        }
        return;
    }

    currentExamTitle = title;
    window.currentExamTitle = title;
    currentQuestions = qList;
    window.currentQuestions = currentQuestions;
    const startIdx = (opts && typeof opts.initialQIndex === 'number')
        ? Math.max(0, Math.min(opts.initialQIndex, qList.length - 1))
        : 0;
    currentQIndex = startIdx;
    window.currentQIndex = startIdx;

    if (window.completedExams && window.completedExams[title] && window.completedExams[title].answers) {
        userAnswers = Object.assign({}, window.completedExams[title].answers);
    } else {
        userAnswers = {};
    }

    const quizStageCardInit = document.getElementById('quiz-stage-card');
    if (quizStageCardInit && quizStageCardInit.classList) {
        quizStageCardInit.classList.remove('card-slide-forward', 'card-slide-backward');
    }

    switchView('quiz');
    renderQuestion(startIdx, { isArenaEntry: true });
}

function renderQuestion(index, options = {}) {
    if (!currentQuestions || currentQuestions.length === 0) return;
    index = Math.max(0, Math.min(Number(index) || 0, currentQuestions.length - 1));
    let curLvl = null;
    if (currentExamTitle) {
        let meta = (typeof findExamMeta === 'function') ? findExamMeta(currentExamTitle) : null;
        curLvl = meta ? meta.level : null;
        if (!curLvl) {
            if (currentExamTitle.includes('雅思') || currentExamTitle.toLowerCase().includes('ielts')) curLvl = 'ielts';
            else if (currentExamTitle.includes('高考')) curLvl = 'gaokao';
            else if (currentExamTitle.includes('六级')) curLvl = 'cet6';
            else if (currentExamTitle.includes('四级')) curLvl = 'cet4';
        }
    }
    curLvl = curLvl || window.currentExamLevel || 'cet4';
    window.currentExamLevel = curLvl;

    const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
    const examIdx = manifestList.findIndex(m => m.title === currentExamTitle || m.examId === currentExamTitle);
    if (window.ToyPermissions && !window.ToyPermissions.canAccessListening(examIdx >= 0 ? examIdx : 0, index, curLvl)) {
        if (typeof pauseAudio === 'function') pauseAudio();
        window.ToyPermissions.showUnlockModal('listening', { examIndex: examIdx >= 0 ? examIdx : 0, questionIndex: index, level: curLvl });
        return;
    }

    const prevIndex = (typeof currentQIndex === 'number') ? currentQIndex : 0;
    const isArenaEntry = !!(options && options.isArenaEntry);
    currentQIndex = index;
    window.currentQIndex = index;
    hideContextualPopover();
    if (!options.preserveScroll && !isArenaEntry) {
        try {
            window.scrollTo({ top: 0, behavior: 'instant' });
        } catch (_) {
            try { window.scrollTo(0, 0); } catch (e) {}
        }
    }
    const quizStageCard = document.getElementById('quiz-stage-card');
    if (quizStageCard && !options.preserveScroll && !isArenaEntry && index !== prevIndex) {
        quizStageCard.classList.remove('card-slide-forward', 'card-slide-backward');
        void quizStageCard.offsetWidth;
        if (index > prevIndex) {
            quizStageCard.classList.add('card-slide-forward');
        } else if (index < prevIndex) {
            quizStageCard.classList.add('card-slide-backward');
        }
        if (typeof quizStageCard.addEventListener === 'function' && !quizStageCard._cardSlideEndBound) {
            quizStageCard._cardSlideEndBound = true;
            quizStageCard.addEventListener('animationend', (ev) => {
                if (!ev || ev.target === quizStageCard) {
                    quizStageCard.classList.remove('card-slide-forward', 'card-slide-backward');
                }
            });
        }
    }
    if (!currentQuestions || currentQuestions.length === 0) return;
    const q = currentQuestions[index];

    const seqVal = document.getElementById('seq-val');
    const sectionBadge = document.getElementById('section-badge');
    const qH2 = document.getElementById('q-h2');
    const qZhP = document.getElementById('q-zh-p');
    const optionsWrapper = document.getElementById('options-wrapper');
    const explanationCard = document.getElementById('explanation-card');
    const expBodyP = document.getElementById('exp-body-p');
    const expEvidContainer = document.getElementById('exp-evidence-container');
    const expSynContainer = document.getElementById('exp-synonym-container');
    const btnPrevQ = document.getElementById('btn-prev-q');
    const btnNextQ = document.getElementById('btn-next-q');
    const ansProgress = document.getElementById('ans-progress');

    if (seqVal) seqVal.textContent = String(index + 1).padStart(2, '0');

    const defaultSec = (window.currentExamLevel === 'cet6') ? 'Conversations 1' : ((window.currentExamLevel === 'gaokao') ? 'Short Conversation 1' : 'News Report 1');
    let badgeTitle = (q.sub_title && q.sub_title.trim()) ? q.sub_title.trim() : (q.section || defaultSec);
    badgeTitle = badgeTitle.replace(/Section\s+[A-Z]\s*/gi, '').trim();
    if (!badgeTitle) badgeTitle = defaultSec;
    if (sectionBadge) sectionBadge.textContent = `${badgeTitle} · ${String(index + 1).padStart(2, '0')}`;

    let lisRawText = (q.question || q.question_text || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
    const shouldHideQ = !!window.hideListeningQuestion;
    if (qH2) {
        qH2.style.display = shouldHideQ ? 'none' : 'block';
        if (lisRawText) {
            qH2.innerHTML = `Question ${index + 1}. ` + makeTextClickable(lisRawText);
        } else if (q.question_zh || q.question_text_zh) {
            qH2.innerHTML = `Question ${index + 1}. <span style="font-size: 15px; font-weight: 500; color: #475569;">${q.question_zh || q.question_text_zh}</span>`;
        } else {
            qH2.innerHTML = `Question ${index + 1}.`;
        }
    }
    const canUseB = (window.ToyPermissions && typeof window.ToyPermissions.canUseBilingualMode === 'function')
        ? window.ToyPermissions.canUseBilingualMode()
        : false;
    if (qZhP) {
        const zhText = q.question_zh || q.question_text_zh || '';
        qZhP.style.display = (shouldHideQ || !canUseB || !window.showBilingual || !zhText) ? 'none' : 'block';
        qZhP.textContent = zhText;
        qZhP.classList.toggle('show', canUseB && window.showBilingual && !shouldHideQ && !!zhText);
    }

    if (optionsWrapper) optionsWrapper.innerHTML = '';
    const record = userAnswers[index];
    const isAnswered = !!record;
    if (window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
        window.isExamMode = true;
        const tabPractice = document.getElementById('tab-mode-practice');
        const tabExam = document.getElementById('tab-mode-exam');
        if (tabPractice && tabExam) {
            tabPractice.classList.remove('active');
            tabExam.classList.add('active');
            if (window.UXSegmentedGlider) {
                window.UXSegmentedGlider.sync('#header-mode-segmented', false);
            }
        }
    }
    const isExam = !!window.isExamMode;

    if (quizStageCard) quizStageCard.classList.toggle('answered-state', isAnswered && !isExam);

    if (q.options && optionsWrapper) {
        Object.entries(q.options).forEach(([key, val]) => {
            const btn = document.createElement('div');
            btn.className = 'opt-btn';

            if (isExam) {
                if (isAnswered && record.selected === key) {
                    btn.classList.add('exam-selected-state');
                }
            } else {
                if (isAnswered) {
                    if (key === record.selected) btn.classList.add('opt-current-pick');
                    if (key === q.answer) btn.classList.add('correct-state');
                    else if (key === record.selected) btn.classList.add('wrong-state');
                }
            }

            const zhVal = (q.options_zh && q.options_zh[key]) ? q.options_zh[key] : '';
            const zhClass = (canUseB && window.showBilingual) ? 'opt-zh-text show' : 'opt-zh-text';

            btn.innerHTML = `
                <span class="opt-key">${key}.</span>
                <div class="opt-text-col">
                    <span class="opt-en-text">${makeTextClickable(val)}</span>
                    ${zhVal ? `<div class="${zhClass}">${zhVal}</div>` : ''}
                </div>
            `;

            const elimStateKey = `lis::${currentExamTitle || 'default'}::${index}`;
            if (typeof window.bindOptionElimination === 'function') {
                window.bindOptionElimination(btn, elimStateKey, key);
            }

            btn.addEventListener('click', () => {
                if (window.isLookupMode) {
                    // In lookup mode, preserve mode for exploring words freely
                    return;
                }

                // 1. Instant 0ms Visual Tactile Response
                const isExamNow = !!window.isExamMode;
                if (!isExamNow && btn.classList.contains('opt-current-pick')) {
                    return;
                }
                const allOptBtns = optionsWrapper.querySelectorAll('.opt-btn');

                if (isExamNow) {
                    allOptBtns.forEach(b => b.classList.remove('exam-selected-state'));
                    btn.classList.remove('opt-eliminated');
                    btn.classList.add('exam-selected-state');
                    if (typeof window.clearOptionEliminationForKeys === 'function') {
                        window.clearOptionEliminationForKeys(elimStateKey, [key]);
                    }
                } else {
                    allOptBtns.forEach(b => {
                        b.classList.remove('correct-state', 'wrong-state', 'opt-current-pick');
                        const k = b.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                        if (k === q.answer || k === key) {
                            b.classList.remove('opt-eliminated');
                        }
                        if (k === q.answer) {
                            b.classList.add('correct-state');
                        } else if (k === key) {
                            b.classList.add('wrong-state');
                        }
                        if (k === key) {
                            b.classList.add('opt-current-pick');
                        }
                    });
                    if (typeof window.clearOptionEliminationForKeys === 'function') {
                        window.clearOptionEliminationForKeys(elimStateKey, [key, q.answer]);
                    }

                    if (explanationCard) {
                        if (expBodyP) {
                            expBodyP.innerHTML = (typeof formatObjectiveAnalysisHtml === 'function')
                                ? formatObjectiveAnalysisHtml(q.analysis)
                                : (q.analysis || '暂无详细题目解析。');
                        }
                        if (expEvidContainer) {
                            const evidEn = q.evidence || q.evidence_en;
                            if (evidEn) {
                                expEvidContainer.innerHTML = `
                                    <div class="exp-evidence-box">
                                        <div class="exp-evidence-lbl">📍 听力原文定位关键句</div>
                                        <p class="exp-evidence-en">${makeTextClickable(evidEn)}</p>
                                        ${q.evidence_zh ? `<p class="exp-evidence-zh">${q.evidence_zh}</p>` : ''}
                                    </div>
                                `;
                            } else {
                                expEvidContainer.innerHTML = '';
                            }
                        }
                        if (expSynContainer) {
                            if (q.synonym_pairs && Array.isArray(q.synonym_pairs) && q.synonym_pairs.length > 0) {
                                expSynContainer.innerHTML = `
                                    <div class="exp-synonym-box">
                                        <div class="exp-synonym-lbl">🔄 核心考点同义替换</div>
                                        ${q.synonym_pairs.map(p => `
                                            <div class="synonym-pair-row">
                                                <div class="syn-line"><span class="syn-tag syn-tag-q">题干</span><span class="syn-text-q">${makeTextClickable(p.q || '')}</span></div>
                                                <div class="syn-line"><span class="syn-tag syn-tag-orig">原文</span><span class="syn-text-orig">${makeTextClickable(p.orig || '')}</span></div>
                                            </div>
                                        `).join('')}
                                    </div>
                                `;
                            } else {
                                expSynContainer.innerHTML = '';
                            }
                        }
                        const wasShowingLiveExp = explanationCard.classList.contains('show');
                        explanationCard.classList.add('show');
                        if (!wasShowingLiveExp && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
                            window.UXAutoAnimate.animateCardReveal(explanationCard);
                        }
                    }
                    if (quizStageCard) quizStageCard.classList.add('answered-state');
                }

                // 2. Persist State & Sync Data in background
                selectOption(index, key, q.answer);
            });

            optionsWrapper.appendChild(btn);
        });
    }

    // Explanation Box Rendering (STRICTLY HIDDEN IN EXAM MODE)
    if (isAnswered && !isExam && explanationCard) {
        if (expBodyP) {
            expBodyP.innerHTML = (typeof formatObjectiveAnalysisHtml === 'function')
                ? formatObjectiveAnalysisHtml(q.analysis)
                : (q.analysis || '暂无详细题目解析。');
        }
        if (expEvidContainer) {
            const evidEn = q.evidence || q.evidence_en;
            if (evidEn) {
                expEvidContainer.innerHTML = `
                    <div class="exp-evidence-box">
                        <div class="exp-evidence-lbl">📍 听力原文定位关键句</div>
                        <p class="exp-evidence-en">${makeTextClickable(evidEn)}</p>
                        ${q.evidence_zh ? `<p class="exp-evidence-zh">${q.evidence_zh}</p>` : ''}
                    </div>
                `;
            } else {
                expEvidContainer.innerHTML = '';
            }
        }
        if (expSynContainer) {
            if (q.synonym_pairs && Array.isArray(q.synonym_pairs) && q.synonym_pairs.length > 0) {
                expSynContainer.innerHTML = `
                    <div class="exp-synonym-box">
                        <div class="exp-synonym-lbl">🔄 核心考点同义替换</div>
                        ${q.synonym_pairs.map(p => `
                            <div class="synonym-pair-row">
                                <div class="syn-line"><span class="syn-tag syn-tag-q">题干</span><span class="syn-text-q">${makeTextClickable(p.q || '')}</span></div>
                                <div class="syn-line"><span class="syn-tag syn-tag-orig">原文</span><span class="syn-text-orig">${makeTextClickable(p.orig || '')}</span></div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                expSynContainer.innerHTML = '';
            }
        }
        const wasShowingExp = explanationCard.classList.contains('show');
        explanationCard.classList.add('show');
        if (!wasShowingExp && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
            window.UXAutoAnimate.animateCardReveal(explanationCard);
        }
    } else if (explanationCard) {
        explanationCard.classList.remove('show');
    }

    if (btnPrevQ) btnPrevQ.disabled = index === 0;
    if (btnNextQ) btnNextQ.textContent = index === currentQuestions.length - 1 ? '查看报告 🏆' : '下一题 →';
    const totalQCount = (currentQuestions && currentQuestions.length) ? currentQuestions.length : 25;
    if (ansProgress) ansProgress.textContent = `${index + 1}/${totalQCount}`;
    if (typeof window.kickLiquidGlass === 'function') setTimeout(window.kickLiquidGlass, 60);
}

function selectOption(qIndex, selectedKey, correctKey) {
    const isCorrect = (selectedKey === correctKey);
    const nowTs = Date.now();
    const prevRec = (userAnswers && userAnswers[qIndex] && typeof userAnswers[qIndex] === 'object' && !userAnswers[qIndex]._deleted) ? userAnswers[qIndex] : null;
    const firstCorrect = (prevRec && typeof prevRec.firstCorrect === 'boolean')
        ? prevRec.firstCorrect
        : ((prevRec && typeof prevRec.isCorrect === 'boolean') ? prevRec.isCorrect : isCorrect);
    const firstTs = (prevRec && typeof prevRec.firstTs === 'number')
        ? prevRec.firstTs
        : ((prevRec && typeof prevRec.ts === 'number') ? prevRec.ts : nowTs);
    const attempts = (prevRec && typeof prevRec.attempts === 'number') ? (prevRec.attempts + 1) : (prevRec ? 2 : 1);
    userAnswers[qIndex] = {
        selected: selectedKey,
        isCorrect,
        ts: nowTs,
        firstCorrect,
        firstTs,
        attempts,
        mode: window.isExamMode ? 'exam' : 'practice'
    };

    // Multi-sensory Feedback (Audio + Haptics + Combo)
    if (!window.isExamMode) {
        if (isCorrect) {
            if (window.FeedbackEngine) window.FeedbackEngine.playCorrect();
        } else {
            if (window.FeedbackEngine) window.FeedbackEngine.playWrong();
        }
    } else {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
    }

    if (currentExamTitle) {
        if (!window.completedExams[currentExamTitle]) {
            window.completedExams[currentExamTitle] = {};
        }
        window.completedExams[currentExamTitle].timestamp = nowTs;
        if (!window.completedExams[currentExamTitle].answers) {
            window.completedExams[currentExamTitle].answers = {};
        }
        Object.assign(window.completedExams[currentExamTitle].answers, userAnswers);
        saveUserCloudData(currentExamTitle);
        if (typeof recordTodayQuestionAnswer === 'function') {
            recordTodayQuestionAnswer(currentExamTitle, qIndex, isCorrect);
        }
    }

    updateDashboardStats();
    submitUserScore();
    if (typeof window.kickLiquidGlass === 'function') setTimeout(window.kickLiquidGlass, 60);
}

function finishExam() {
    let correctCount = 0;
    Object.values(userAnswers).forEach(item => {
        if (item && item.isCorrect) correctCount++;
    });

    const totalQ = (currentQuestions && currentQuestions.length > 0) ? currentQuestions.length : 1;
    const score = Math.round((correctCount / totalQ) * 100);

    if (currentExamTitle) {
        const nowTs = Date.now();
        if (!window.completedExams[currentExamTitle]) {
            window.completedExams[currentExamTitle] = {};
        }
        window.completedExams[currentExamTitle].score = score;
        window.completedExams[currentExamTitle].scoreTimestamp = nowTs;
        window.completedExams[currentExamTitle].timestamp = nowTs;
        if (!window.completedExams[currentExamTitle].answers) {
            window.completedExams[currentExamTitle].answers = {};
        }
        Object.assign(window.completedExams[currentExamTitle].answers, userAnswers);
        saveUserCloudData(currentExamTitle, true);
    }

    const modalExamName = document.getElementById('modal-exam-name');
    const modalScoreNum = document.getElementById('modal-score-num');
    const modalScoreDetail = document.getElementById('modal-score-detail');
    const scoreModal = document.getElementById('score-modal');
    const btnModalReview = document.getElementById('btn-modal-review');

    const curLvl = (typeof window.getExamLevelFromId === 'function' && currentExamTitle)
        ? window.getExamLevelFromId(currentExamTitle)
        : (window.currentExamLevel || 'cet4');
    const manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
    const curExamIdx = manifestList.findIndex(m => m.title === currentExamTitle || m.examId === currentExamTitle);
    const safeExamIdx = curExamIdx >= 0 ? curExamIdx : 0;

    let firstWrongIdx = -1;
    if (Array.isArray(currentQuestions)) {
        for (let i = 0; i < currentQuestions.length; i++) {
            const canAccessQ = window.ToyPermissions ? window.ToyPermissions.canAccessListening(safeExamIdx, i, curLvl) : true;
            if (!canAccessQ) continue;
            const ans = userAnswers[i];
            if (!ans || !ans.isCorrect) {
                firstWrongIdx = i;
                break;
            }
        }
    }
    window._firstWrongListeningIdx = firstWrongIdx;

    if (modalExamName) modalExamName.textContent = currentExamTitle || '精听特训';
    if (modalScoreNum) modalScoreNum.textContent = `${score}分`;
    if (modalScoreDetail) modalScoreDetail.textContent = `共 ${currentQuestions.length || 0} 题，答对 ${correctCount} 题`;
    if (btnModalReview) {
        btnModalReview.textContent = firstWrongIdx >= 0
            ? `🎯 复盘错题与全卷解析 (从 Q${firstWrongIdx + 1} 开始)`
            : '📋 回顾整卷与解析';
    }
    if (scoreModal) scoreModal.classList.add('active');

    if (window.FeedbackEngine) {
        window.FeedbackEngine.playComplete();
    }
    launchGrandConfettiShow();
    updateDashboardStats();
    submitUserScore();
}

window.startExam = startExam;
