/* === js/written_exam.js === */
// ==========================================================================
// Written Exam Arena Orchestrator, Scoring & Report Engine (js/written_exam.js)
// ==========================================================================
function renderWrittenQuestion(index, options = {}) {
    let curLvl = null;
    if (currentWrittenExamTitle) {
        let meta = (typeof findExamMeta === 'function') ? findExamMeta(currentWrittenExamTitle) : null;
        curLvl = meta ? meta.level : null;
        if (!curLvl) {
            if (currentWrittenExamTitle.includes('考研')) curLvl = 'kaoyan';
            else if (currentWrittenExamTitle.includes('高考')) curLvl = 'gaokao';
            else if (currentWrittenExamTitle.includes('六级')) curLvl = 'cet6';
            else if (currentWrittenExamTitle.includes('四级')) curLvl = 'cet4';
        }
    }
    curLvl = curLvl || window.currentExamLevel || 'cet4';
    window.currentExamLevel = curLvl;

    const examIdx = getWrittenExamTrackIndex(currentWrittenExamTitle, curLvl);
    if (window.ToyPermissions && !window.ToyPermissions.canAccessWrittenExam(examIdx >= 0 ? examIdx : 0, index, curLvl)) {
        window.ToyPermissions.showUnlockModal('written', { examIndex: examIdx >= 0 ? examIdx : 0, questionIndex: index, level: curLvl });
        return;
    }

    if (!currentWrittenQuestions || currentWrittenQuestions.length === 0) return;
    index = Math.max(0, Math.min(Number(index) || 0, currentWrittenQuestions.length - 1));
    const prevWIndex = (typeof currentWrittenQIndex === 'number') ? currentWrittenQIndex : 0;
    const prevQ = currentWrittenQuestions[prevWIndex];
    const q = currentWrittenQuestions[index];
    currentWrittenQIndex = index;
    window.currentWrittenQIndex = currentWrittenQIndex;
    hideContextualPopover();
    if (typeof window.dismissProofreadPopovers === 'function') {
        window.dismissProofreadPopovers();
    }
    hideBackToQuestionPill();

    const isSamePassage = Boolean(
        prevQ && q &&
        prevQ.type === q.type &&
        q.passage && q.passage.trim() &&
        prevQ.passage && prevQ.passage.trim() === q.passage.trim()
    );

    const quizPane = document.querySelector('.written-split-quiz');
    const passPane = document.querySelector('.written-split-passage');
    const isArenaEntry = !!(options && options.isArenaEntry);

    if (isArenaEntry) {
        if (quizPane) quizPane.scrollTop = 0;
        if (passPane) passPane.scrollTop = 0;
    } else {
        if (quizPane && index !== prevWIndex) {
            quizPane.scrollTop = 0;
        }
        if (!options.preserveScroll) {
            if (!isSamePassage) {
                try {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                } catch (_) {
                    try { window.scrollTo(0, 0); } catch (e) {}
                }
            }
            if (quizPane) quizPane.scrollTop = 0;
            if (passPane && index !== prevWIndex && !isSamePassage) {
                passPane.scrollTop = 0;
            }
        }
    }
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

    const writtenStageCard = document.getElementById('written-stage-card');
    const splitCont = writtenStageCard ? writtenStageCard.querySelector('.written-split-container') : null;
    const isSheetSplitActive = (window.UXReadingSplitSheet && typeof window.UXReadingSplitSheet.isViewportEligible === 'function')
        ? window.UXReadingSplitSheet.isViewportEligible(q)
        : !!(splitCont && splitCont.classList.contains('mobile-sheet-split-active'));
    const qH2ForSlide = document.getElementById('written-q-h2');
    const optsWrapForSlide = document.getElementById('written-options-wrapper');
    const slideTargets = isSheetSplitActive
        ? [qH2ForSlide, optsWrapForSlide].filter(Boolean)
        : [((isSamePassage && quizPane) ? quizPane : writtenStageCard)].filter(Boolean);
    if (writtenStageCard && isSheetSplitActive) {
        writtenStageCard.classList.remove('card-slide-forward', 'card-slide-backward');
    }
    if (!isSheetSplitActive) {
        if (qH2ForSlide) qH2ForSlide.classList.remove('card-slide-forward', 'card-slide-backward');
        if (optsWrapForSlide) optsWrapForSlide.classList.remove('card-slide-forward', 'card-slide-backward');
    }
    if (slideTargets.length > 0 && !options.preserveScroll && !isArenaEntry && index !== prevWIndex) {
        if (writtenStageCard) writtenStageCard.classList.remove('card-slide-forward', 'card-slide-backward');
        if (quizPane) quizPane.classList.remove('card-slide-forward', 'card-slide-backward');
        slideTargets.forEach(el => {
            el.classList.remove('card-slide-forward', 'card-slide-backward');
            void el.offsetWidth;
            if (index > prevWIndex) {
                el.classList.add('card-slide-forward');
            } else if (index < prevWIndex) {
                el.classList.add('card-slide-backward');
            }
            if (typeof el.addEventListener === 'function' && !el._cardSlideEndBound) {
                el._cardSlideEndBound = true;
                el.addEventListener('animationend', (ev) => {
                    if (!ev || ev.target === el) {
                        el.classList.remove('card-slide-forward', 'card-slide-backward');
                    }
                });
            }
        });
    }
    if (writtenStageCard) {
        if (q.type === 'fill_in') {
            writtenStageCard.classList.add('grammar-fillin-mode');
            writtenStageCard.classList.remove('proofread-mode');
        } else if (q.type === 'proofread') {
            writtenStageCard.classList.remove('grammar-fillin-mode');
            writtenStageCard.classList.add('proofread-mode');
        } else {
            writtenStageCard.classList.remove('grammar-fillin-mode');
            writtenStageCard.classList.remove('proofread-mode');
        }
    }
    const explanationCard = document.getElementById('written-explanation-card');
    const expCard = explanationCard;
    function showWrittenExplanation(targetQ) {
        renderWrittenExplanationCard(targetQ, explanationCard);
    }

    // 2. Top Badges (Unified Section · Question ID Pill)
    const seqVal = document.getElementById('written-seq-val');
    const secBadge = document.getElementById('written-section-badge');
    if (seqVal) seqVal.textContent = q.id;
    if (secBadge) {
        const secText = (q.section || '').trim();
        const qIdStr = (q.id !== undefined && q.id !== null) ? String(q.id).trim() : '';
        secBadge.textContent = (secText && qIdStr) ? `${secText} · ${qIdStr}` : (secText || qIdStr);
    }

    // 3. Render Passage & Translation Card
    const passageCard = document.getElementById('written-passage-card');
    const transCard = document.getElementById('written-translation-card');
    const canUseB = (window.ToyPermissions && typeof window.ToyPermissions.canUseBilingualMode === 'function')
        ? window.ToyPermissions.canUseBilingualMode()
        : false;

    const qH2 = document.getElementById('written-q-h2');
    const qZhP = document.getElementById('written-q-zh-p');
    const optionsWrapper = document.getElementById('written-options-wrapper');
    const rawAnsRecord = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
    const ansRecord = (rawAnsRecord && !rawAnsRecord._deleted) ? rawAnsRecord : undefined;
    const isAnswered = !!ansRecord;

    const renderCtx = {
        index, q, prevQ, prevWIndex, options, curLvl, isExam, canUseB,
        isSamePassage, isArenaEntry, isSheetSplitActive, ansRecord, isAnswered,
        writtenStageCard, quizPane, passPane, passageCard, transCard,
        optionsWrapper, explanationCard, showWrittenExplanation
    };

    renderWrittenPassagePane(renderCtx);

    // 4. Update Question Statement & Options
    if ((q.type === 'fill_in' && q.passage) || q.type === 'proofread' || q.type === 'writing' || (q.type === 'translation_en_zh' && q.source_en)) {
        if (qH2) qH2.style.display = 'none';
        if (qZhP) {
            qZhP.style.display = 'none';
            qZhP.classList.remove('show');
        }
    } else {
        if (qH2) qH2.style.display = '';
        let rawText = (q.question_text || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
        if (!rawText) {
            rawText = (q.question_text_zh || q.question_zh || q.statement || '').trim();
        }
        if (qH2) qH2.innerHTML = makeTextClickable(rawText ? `Question ${q.id}. ${rawText}` : `Question ${q.id}.`);
        if (qZhP) {
            const hasDiffZh = q.question_text_zh && q.question_text_zh.trim() !== rawText;
            qZhP.textContent = q.question_text_zh || '';
            if (hasDiffZh && canUseB && window.showWrittenBilingual && q.type !== 'translation' && q.type !== 'writing') {
                qZhP.style.display = 'block';
                qZhP.classList.add('show');
            } else {
                qZhP.style.display = 'none';
                qZhP.classList.remove('show');
            }
        }
    }

    if (writtenStageCard) {
        if (isAnswered) {
            writtenStageCard.classList.add('answered-state');
        } else {
            writtenStageCard.classList.remove('answered-state');
        }
    }

    if (optionsWrapper) {
        optionsWrapper.innerHTML = '';
        if (!renderWrittenObjectiveQuestion(renderCtx)) {
            renderWrittenSubjectiveQuestion(renderCtx);
        }
    }

    // 5. Explanation Box (STRICTLY HIDDEN IN EXAM MODE)
    if (explanationCard) {
        // In Practice Mode (随刷随解), grammar fill-in always displays immediate explanation for current blank
        const shouldShowExp = !isExam && (isAnswered || q.type === 'fill_in') && q.type !== 'writing' && q.type !== 'translation' && q.type !== 'translation_en_zh' && q.type !== 'proofread';
        if (shouldShowExp) {
            showWrittenExplanation(q);
        } else {
            if (explanationCard._highlightTimer) {
                clearTimeout(explanationCard._highlightTimer);
                explanationCard._highlightTimer = null;
            }
            explanationCard.classList.remove('show');
            clearEvidenceHighlightInPassage(passageCard);
        }
    }

    // 5.5 Sync Mobile/Tablet Reading Split Sheet (Free-Stop Persistent Split Ratio)
    if (window.UXReadingSplitSheet && typeof window.UXReadingSplitSheet.syncSheetState === 'function') {
        window.UXReadingSplitSheet.syncSheetState({ animate: false });
    }

    // 6. Navigation Buttons
    const btnWrittenPrev = document.getElementById('btn-written-prev-q');
    const btnWrittenNext = document.getElementById('btn-written-next-q');
    const ansProgress = document.getElementById('written-ans-progress');

    if (q.type === 'proofread') {
        const pfIndices = currentWrittenQuestions.map((it, i) => it.type === 'proofread' ? i : -1).filter(i => i !== -1);
        const firstPf = pfIndices[0];
        const lastPf = pfIndices[pfIndices.length - 1];
        if (ansProgress) ansProgress.textContent = '短文改错';
        if (btnWrittenPrev) btnWrittenPrev.disabled = firstPf === 0;
        if (btnWrittenNext) btnWrittenNext.textContent = (lastPf === currentWrittenQuestions.length - 1) ? '交卷 / 查看报告 🏆' : '下一大题 →';
    } else {
        if (btnWrittenPrev) btnWrittenPrev.disabled = index === 0;
        if (btnWrittenNext) btnWrittenNext.textContent = index === currentWrittenQuestions.length - 1 ? '交卷 / 查看报告 🏆' : '下一题 →';
        if (ansProgress) ansProgress.textContent = `${index + 1}/${currentWrittenQuestions.length}`;
    }
    if (typeof window.kickLiquidGlass === 'function') setTimeout(window.kickLiquidGlass, 60);
}

function showPassageSwitchBanner() {
    const pill = document.getElementById('passage-switch-pill');
    if (pill) {
        if (pill._hideTimer) clearTimeout(pill._hideTimer);
        pill.classList.remove('show');
        if (pill.parentNode) pill.parentNode.removeChild(pill);
    }
}

function checkIsCorrect(selectedKey, correctKey) {
    if (selectedKey === undefined || selectedKey === null || correctKey === undefined || correctKey === null) return false;
    const s = String(selectedKey).trim().toLowerCase();
    const rawC = String(correctKey).trim().toLowerCase();
    if (!s) return false;
    if (s === rawC) return true;
    const alts = rawC.split(/\/|\s+or\s+/).map(it => it.trim()).filter(Boolean);
    return alts.includes(s);
}

function selectWrittenOption(qId, selectedKey, correctKey, extraFields) {
    const isCorrect = (extraFields && typeof extraFields.isCorrect === 'boolean')
        ? extraFields.isCorrect
        : checkIsCorrect(selectedKey, correctKey);

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

    if (!userWrittenAnswers[currentWrittenExamTitle]) {
        userWrittenAnswers[currentWrittenExamTitle] = {};
    }
    const nowTs = Date.now();
    const prevW = (userWrittenAnswers[currentWrittenExamTitle] && typeof userWrittenAnswers[currentWrittenExamTitle][qId] === 'object' && !userWrittenAnswers[currentWrittenExamTitle][qId]._deleted)
        ? userWrittenAnswers[currentWrittenExamTitle][qId]
        : null;
    const firstCorrect = (prevW && typeof prevW.firstCorrect === 'boolean')
        ? prevW.firstCorrect
        : ((prevW && typeof prevW.isCorrect === 'boolean') ? prevW.isCorrect : isCorrect);
    const firstTs = (prevW && typeof prevW.firstTs === 'number')
        ? prevW.firstTs
        : ((prevW && typeof prevW.ts === 'number') ? prevW.ts : nowTs);
    const attempts = (prevW && typeof prevW.attempts === 'number') ? (prevW.attempts + 1) : (prevW ? 2 : 1);
    userWrittenAnswers[currentWrittenExamTitle][qId] = Object.assign({
        selected: selectedKey,
        isCorrect,
        ts: nowTs,
        firstCorrect,
        firstTs,
        attempts,
        mode: window.isExamMode ? 'exam' : 'practice'
    }, extraFields || {}, { isCorrect, ts: nowTs });

    if (currentWrittenExamTitle) {
        if (!window.completedExams[currentWrittenExamTitle]) {
            window.completedExams[currentWrittenExamTitle] = {};
        }
        window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
        if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
            window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
        }
        Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
        window.completedExams[currentWrittenExamTitle].writtenAnswers[qId] = Object.assign({}, userWrittenAnswers[currentWrittenExamTitle][qId]);
        saveUserCloudData(currentWrittenExamTitle);
        if (typeof recordTodayQuestionAnswer === 'function') {
            recordTodayQuestionAnswer(currentWrittenExamTitle, qId, isCorrect);
        }
    }

    updateDashboardStats();
    submitUserScore();
    if (typeof window.kickLiquidGlass === 'function') setTimeout(window.kickLiquidGlass, 60);
}

function finishWrittenExam() {
    let readingCorrect = 0;
    // 动态统计所有客观题（有标准答案的题目，自适应涵盖单选、完形、语法填空、改错等）
    const objectiveQuestions = (currentWrittenQuestions || []).filter(q => 
        (q.answer !== undefined && q.answer !== '') || 
        (q.target !== undefined) || 
        (q.corr_type !== undefined)
    );
    const readingTotal = objectiveQuestions.length || 1;

    const secStatsMap = {};
    let firstWrongIdx = -1;

    const curLvl = window.currentExamLevel || 'cet4';
    const curExamIdx = getWrittenExamTrackIndex(currentWrittenExamTitle, curLvl);
    const safeExamIdx = curExamIdx >= 0 ? curExamIdx : 0;

    (currentWrittenQuestions || []).forEach((q, idx) => {
        const isObj = (q.answer !== undefined && q.answer !== '') || (q.target !== undefined) || (q.corr_type !== undefined);
        if (!isObj) return;
        const canAccessQ = window.ToyPermissions ? window.ToyPermissions.canAccessWrittenExam(safeExamIdx, idx, curLvl) : true;
        const record = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
        const isRight = (q.corr_type === 'correct') ? (!record || record._deleted || !!record.isCorrect) : !!(record && !record._deleted && record.isCorrect);
        if (isRight) {
            readingCorrect++;
        } else if (firstWrongIdx === -1 && canAccessQ) {
            firstWrongIdx = idx;
        }
        const rawSec = (q.section || '客观题').split('·')[0].trim();
        if (!secStatsMap[rawSec]) {
            secStatsMap[rawSec] = { label: rawSec, correct: 0, total: 0 };
        }
        secStatsMap[rawSec].total++;
        if (isRight) secStatsMap[rawSec].correct++;
    });

    window._firstWrongWrittenIdx = firstWrongIdx;
    const score = Math.round((readingCorrect / readingTotal) * 100);

    if (currentWrittenExamTitle) {
        const nowTs = Date.now();
        if (!window.completedExams[currentWrittenExamTitle]) {
            window.completedExams[currentWrittenExamTitle] = {};
        }
        window.completedExams[currentWrittenExamTitle].writtenScore = score;
        window.completedExams[currentWrittenExamTitle].writtenScoreTimestamp = nowTs;
        window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
        if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
            window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
        }
        Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
        saveUserCloudData(currentWrittenExamTitle, true);

        // 仅在拥有对应试题权限且已关注 UP 主（可使用随刷随解）时，交卷后自动解锁并呈现改错、写作与翻译答案精析
        const lastQIdx = Math.max(0, (currentWrittenQuestions || []).length - 1);
        const canAccessFullExam = window.ToyPermissions ? window.ToyPermissions.canAccessWrittenExam(safeExamIdx, lastQIdx, curLvl) : true;
        const canPractice = (!window.ToyPermissions || typeof window.ToyPermissions.canUsePracticeMode !== 'function' || window.ToyPermissions.canUsePracticeMode());
        if (canAccessFullExam && canPractice) {
            revealedModelKeys['trans_' + currentWrittenExamTitle] = true;
            revealedModelKeys['writing_' + currentWrittenExamTitle] = true;
            revealedModelKeys['proofread_' + currentWrittenExamTitle] = true;
            (currentWrittenQuestions || []).filter(q => q.type === 'writing').forEach(wq => {
                revealedModelKeys['writing_' + currentWrittenExamTitle + '_' + wq.id] = true;
            });
            (currentWrittenQuestions || []).filter(q => q.type === 'translation_en_zh' || q.type === 'translation').forEach(tq => {
                revealedModelKeys['trans_' + currentWrittenExamTitle + '_' + tq.id] = true;
            });
        }
    }

    const modalExamName = document.getElementById('modal-exam-name');
    const modalScoreNum = document.getElementById('modal-score-num');
    const modalScoreDetail = document.getElementById('modal-score-detail');
    const scoreModal = document.getElementById('score-modal');
    const btnModalReview = document.getElementById('btn-modal-review');

    if (modalExamName) modalExamName.textContent = `${currentWrittenExamTitle} · 笔试真题`;
    if (modalScoreNum) modalScoreNum.textContent = `${score}分`;
    if (modalScoreDetail) {
        const secEntries = Object.values(secStatsMap);
        const secBadgesHtml = secEntries.length > 1
            ? `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-top:10px;">` +
              secEntries.map(s => `<span style="font-size:12px; font-weight:600; color:#475569; background:#f1f5f9; padding:3px 9px; border-radius:6px;">${s.label} ${s.correct}/${s.total}</span>`).join('') +
              `</div>`
            : '';
        modalScoreDetail.innerHTML = `<div>全卷客观题共 ${readingTotal} 题，答对 ${readingCorrect} 题</div>${secBadgesHtml}`;
    }
    if (btnModalReview) {
        if (firstWrongIdx >= 0 && currentWrittenQuestions[firstWrongIdx]) {
            btnModalReview.textContent = `🎯 复盘错题与全卷解析 (从 Q${currentWrittenQuestions[firstWrongIdx].id} 开始)`;
        } else {
            btnModalReview.textContent = '📋 回顾整卷与解析范文';
        }
    }
    if (scoreModal) scoreModal.classList.add('active');

    if (window.FeedbackEngine) {
        window.FeedbackEngine.playComplete();
    }
    launchGrandConfettiShow();
    updateDashboardStats();
    submitUserScore();
}

window.syncWrittenModeRevealedState = function(isExam) {
    if (isExam && window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
        Object.keys(revealedModelKeys).forEach(k => delete revealedModelKeys[k]);
    }
    if (!currentWrittenExamTitle) return;
    const prefixTrans = 'trans_' + currentWrittenExamTitle;
    const prefixWriting = 'writing_' + currentWrittenExamTitle;
    const prefixProof = 'proofread_' + currentWrittenExamTitle;
    Object.keys(revealedModelKeys).forEach(k => {
        if (k.startsWith(prefixTrans) || k.startsWith(prefixWriting) || k.startsWith(prefixProof)) {
            if (isExam) {
                delete revealedModelKeys[k];
            } else if (revealedModelKeys[k] === false) {
                delete revealedModelKeys[k];
            }
        }
    });
    const passageCard = document.getElementById('written-passage-card');
    if (passageCard) passageCard._renderedPassageKey = '';
};

window.startWrittenExam = startWrittenExam;


window.renderWrittenQuestion = renderWrittenQuestion;
window.showPassageSwitchBanner = showPassageSwitchBanner;
window.checkIsCorrect = checkIsCorrect;
window.selectWrittenOption = selectWrittenOption;
window.finishWrittenExam = finishWrittenExam;
