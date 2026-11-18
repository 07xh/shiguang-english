/* === js/written_lobby.js === */
/**
 * ==========================================================================
 * Written Exam System Engine (Cloze, Matching, Reading, Translation, Writing)
 * Supports: 随刷随解 (Practice Mode) & 全真模考 (Exam Mode)
 * ==========================================================================
 */

var currentWrittenFilterRange = 'ALL';
var currentWrittenExamTitle = '';
var currentWrittenQuestions = [];
var currentWrittenQIndex = 0;
var userWrittenAnswers = {};
window.showWrittenBilingual = false;
var currentWrittenModule = 'careful';
var revealedModelKeys = {};

function getWrittenExamTrackIndex(title, level) {
    const curLvl = level || ((typeof window.getExamLevelFromId === 'function' && title)
        ? window.getExamLevelFromId(title)
        : (window.currentExamLevel || 'cet4'));
    let manifestList = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest(curLvl) : [];
    if (curLvl === 'kaoyan' && title) {
        const isEng2 = title.includes('英语（二）') || title.includes('英语二') || title.toLowerCase().includes('eng2');
        manifestList = manifestList.filter(item => {
            const t = item.title || '';
            const id = item.examId || '';
            const itemIsEng2 = t.includes('英语（二）') || t.includes('英语二') || id.includes('eng2');
            return isEng2 ? itemIsEng2 : !itemIsEng2;
        });
    }
    const idx = manifestList.findIndex(m => m.title === title || m.examId === title);
    return idx >= 0 ? idx : 0;
}
window.getWrittenExamTrackIndex = getWrittenExamTrackIndex;

function initWrittenFilters() {
    const writtenYearFilterBar = document.getElementById('written-year-filter-bar');
    if (writtenYearFilterBar) {
        writtenYearFilterBar.querySelectorAll('.chip-year').forEach(chip => {
            chip.addEventListener('click', () => {
                const nextRange = chip.dataset.range || 'ALL';
                const changed = (currentWrittenFilterRange !== nextRange) || !chip.classList.contains('active');
                writtenYearFilterBar.querySelectorAll('.chip-year').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentWrittenFilterRange = nextRange;
                window.currentWrittenFilterRange = currentWrittenFilterRange;
                renderWrittenLobbyGrid(currentWrittenFilterRange, { animateSlider: true });
                if (changed && typeof window.triggerExamGridFilterTransition === 'function') {
                    window.triggerExamGridFilterTransition('written-exam-grid');
                }
            });
        });
        if (typeof updateSegmentedSlider === 'function') {
            updateSegmentedSlider(writtenYearFilterBar, false);
        }
        if (window.enableHorizontalDragScroll) {
            window.enableHorizontalDragScroll(writtenYearFilterBar);
        }
    }

    const writtenModuleTabs = document.getElementById('written-module-tabs');
    if (writtenModuleTabs) {
        writtenModuleTabs.querySelectorAll('.written-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sec = btn.dataset.sec;
                const idx = currentWrittenQuestions.findIndex(q => q.secKey === sec);
                if (idx >= 0) renderWrittenQuestion(idx);
            });
        });
        if (window.enableHorizontalDragScroll) {
            window.enableHorizontalDragScroll(writtenModuleTabs);
        }
    }

    const btnWrittenPrev = document.getElementById('btn-written-prev-q');
    const btnWrittenNext = document.getElementById('btn-written-next-q');
    const btnWrittenOpenDrawer = document.getElementById('btn-written-open-drawer');

    function handlePrevWrittenQuestion() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        if (!Array.isArray(currentWrittenQuestions)) return;
        const curQ = currentWrittenQuestions[currentWrittenQIndex];
        if (curQ && curQ.type === 'proofread') {
            const pfIndices = currentWrittenQuestions.map((it, i) => it.type === 'proofread' ? i : -1).filter(i => i !== -1);
            const firstPf = pfIndices[0];
            if (firstPf > 0) {
                renderWrittenQuestion(firstPf - 1);
                return;
            }
        }
        if (currentWrittenQIndex > 0) renderWrittenQuestion(currentWrittenQIndex - 1);
    }
    window.handlePrevWrittenQuestion = handlePrevWrittenQuestion;

    function handleNextWrittenQuestion() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        if (!Array.isArray(currentWrittenQuestions)) return;
        const curQ = currentWrittenQuestions[currentWrittenQIndex];
        if (curQ && curQ.type === 'proofread') {
            const pfIndices = currentWrittenQuestions.map((it, i) => it.type === 'proofread' ? i : -1).filter(i => i !== -1);
            const lastPf = pfIndices[pfIndices.length - 1];
            if (lastPf < currentWrittenQuestions.length - 1) {
                renderWrittenQuestion(lastPf + 1);
                return;
            } else {
                finishWrittenExam();
                return;
            }
        }
        if (currentWrittenQIndex < currentWrittenQuestions.length - 1) {
            renderWrittenQuestion(currentWrittenQIndex + 1);
        } else {
            finishWrittenExam();
        }
    }
    window.handleNextWrittenQuestion = handleNextWrittenQuestion;

    function openWrittenDrawer() {
        if (window.FeedbackEngine) window.FeedbackEngine.playTap();
        const titleText = document.getElementById('drawer-title-text');
        const drawerSecNav = document.getElementById('drawer-section-nav');
        const drawerMask = document.getElementById('drawer-mask');

        if (titleText && Array.isArray(currentWrittenQuestions)) {
            titleText.textContent = `笔试真题答题卡 (共 ${currentWrittenQuestions.length} 题)`;
        }

        // Render section jump pills in drawer (自适应动态提取)
        if (drawerSecNav && Array.isArray(currentWrittenQuestions)) {
            const currentSec = (currentWrittenQuestions && currentWrittenQuestions[currentWrittenQIndex]) ? currentWrittenQuestions[currentWrittenQIndex].secKey : '';
            const secMap = {};
            (currentWrittenQuestions || []).forEach(q => {
                const k = q.secKey || 'other';
                if (!secMap[k]) {
                    let icon = '📖';
                    let label = q.section ? q.section.split('·')[0].trim() : k;
                    if (k === 'banked_cloze') { icon = '🧩'; label = '选词填空'; }
                    else if (k === 'cloze' || k === 'cloze_choice') { icon = '🧩'; label = '完形填空'; }
                    else if (k === 'matching') { icon = '📑'; label = '长篇匹配'; }
                    else if (k === 'careful') { icon = '📖'; label = '阅读理解'; }
                    else if (k === 'seven_out_of_five') { icon = '📑'; label = q.subSection || '七选五'; }
                    else if (k === 'dialogue_completion') { icon = '💬'; label = '补全对话'; }
                    else if (k === 'phonetics') { icon = '🎯'; label = '语音知识'; }
                    else if (k === 'multiple_choice') { icon = '🎯'; label = '单项填空'; }
                    else if (k === 'grammar_fill_in' || k === 'fill_in') { icon = '✍️'; label = '语法填空'; }
                    else if (k === 'word_spelling') { icon = '✍️'; label = '单词拼写'; }
                    else if (k === 'error_correction' || k === 'proofread') { icon = '🛠️'; label = '短文改错'; }
                    else if (k === 'translation') { icon = '🌐'; label = (q.type === 'translation_en_zh') ? '英译汉' : '汉译英'; }
                    else if (k === 'writing') { icon = '📝'; label = '短文写作'; }
                    secMap[k] = { key: k, label: label, icon: icon, firstId: q.id, lastId: q.id };
                }
                secMap[k].lastId = q.id;
            });
            const curLvl = (typeof window.getExamLevelFromId === 'function' && currentWrittenExamTitle)
                ? window.getExamLevelFromId(currentWrittenExamTitle)
                : (window.currentExamLevel || 'cet4');
            const examIdx = getWrittenExamTrackIndex(currentWrittenExamTitle, curLvl);
            const sections = Object.values(secMap).map(s => {
                const targetIdx = currentWrittenQuestions.findIndex(q => q.secKey === s.key);
                const isSecLocked = window.ToyPermissions && !window.ToyPermissions.canAccessWrittenExam(examIdx >= 0 ? examIdx : 0, targetIdx >= 0 ? targetIdx : 0, curLvl);
                const baseLabel = (s.key === 'writing' && s.firstId !== s.lastId) ? '写作' : s.label;
                const rangeStr = (s.firstId === s.lastId) ? `${s.firstId}` : `${s.firstId}-${s.lastId}`;
                return {
                    key: s.key,
                    label: `${baseLabel} (${rangeStr})`,
                    icon: s.icon,
                    isSecLocked: isSecLocked
                };
            });
            drawerSecNav.innerHTML = sections.map(s => {
                const isActive = s.key === currentSec;
                return `<button class="drawer-sec-pill ${isActive ? 'active' : ''} ${s.isSecLocked ? 'is-sec-locked' : ''}" data-sec="${s.key}"><span>${s.icon}</span><span>${s.label}${s.isSecLocked ? ' 🔒' : ''}</span></button>`;
            }).join('');

            drawerSecNav.querySelectorAll('.drawer-sec-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sec = btn.dataset.sec;
                    const targetIdx = currentWrittenQuestions.findIndex(q => q.secKey === sec);
                    if (targetIdx >= 0) {
                        renderWrittenQuestion(targetIdx);
                        if (drawerMask) drawerMask.classList.remove('active');
                    }
                });
            });

            if (window.enableHorizontalDragScroll) {
                window.enableHorizontalDragScroll(drawerSecNav, document.getElementById('drawer-section-nav-wrapper'));
            }
        }

        if (typeof window.renderWrittenDrawerGrid === 'function') {
            window.renderWrittenDrawerGrid();
        }
        if (drawerMask) {
            drawerMask.style.display = '';
            drawerMask.classList.add('active');
        }
    }
    window.openWrittenDrawer = openWrittenDrawer;

    if (btnWrittenPrev) {
        btnWrittenPrev.addEventListener('click', handlePrevWrittenQuestion);
    }

    if (btnWrittenNext) {
        btnWrittenNext.addEventListener('click', handleNextWrittenQuestion);
    }

    if (btnWrittenOpenDrawer) {
        btnWrittenOpenDrawer.addEventListener('click', openWrittenDrawer);
    }

    // 顶部题号胶囊与题型胶囊点击均可直接呼出答题卡/大题切换面板
    const writtenTopBar = document.querySelector('#written-stage-card .quiz-card-top-bar');
    if (writtenTopBar) {
        const seqBadge = writtenTopBar.querySelector('.sequence-badge');
        const secBadge = document.getElementById('written-section-badge');
        [seqBadge, secBadge].forEach(el => {
            if (el) {
                el.style.cursor = 'pointer';
                el.title = '点击快速切换题号或大题模块';
                el.addEventListener('click', openWrittenDrawer);
            }
        });
    }
}

window.renderWrittenDrawerGrid = function() {
    const drawerQGrid = document.getElementById('drawer-q-grid');
    const drawerMask = document.getElementById('drawer-mask');
    if (!drawerQGrid || !Array.isArray(currentWrittenQuestions)) return;
    drawerQGrid.innerHTML = '';

    const curLvl = (typeof window.getExamLevelFromId === 'function' && currentWrittenExamTitle)
        ? window.getExamLevelFromId(currentWrittenExamTitle)
        : (window.currentExamLevel || 'cet4');
    const examIdx = getWrittenExamTrackIndex(currentWrittenExamTitle, curLvl);

    currentWrittenQuestions.forEach((q, idx) => {
        const ans = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
        const isLocked = window.ToyPermissions && !window.ToyPermissions.canAccessWrittenExam(examIdx >= 0 ? examIdx : 0, idx, curLvl);
        const isSubjectiveRevealed = (
            (q.type === 'writing' && !!(revealedModelKeys['writing_' + currentWrittenExamTitle + '_' + q.id] || revealedModelKeys['writing_' + currentWrittenExamTitle])) ||
            ((q.type === 'translation' || q.type === 'translation_en_zh') && !!(revealedModelKeys['trans_' + currentWrittenExamTitle + '_' + q.id] || revealedModelKeys['trans_' + currentWrittenExamTitle]))
        );

        const chip = document.createElement('div');
        chip.className = `q-chip ${isLocked ? 'is-locked-chip' : ''}`;
        chip.textContent = q.id;

        if (window.isExamMode) {
            if (ans || isSubjectiveRevealed) {
                chip.style.background = '#f0f6ff';
                chip.style.borderColor = '#007aff';
                chip.style.color = '#007aff';
                chip.style.fontWeight = '700';
            }
        } else {
            if (ans) {
                chip.classList.add(ans.isCorrect ? 'correct' : 'wrong');
            } else if (isSubjectiveRevealed) {
                chip.style.background = '#f0f6ff';
                chip.style.borderColor = '#007aff';
                chip.style.color = '#007aff';
                chip.style.fontWeight = '700';
            }
        }

        if (idx === currentWrittenQIndex) {
            chip.style.borderColor = '#007aff';
            chip.style.borderWidth = '2px';
            chip.style.fontWeight = '800';
            if (!ans) {
                chip.style.color = '#007aff';
            }
        }

        chip.addEventListener('click', () => {
            if (isLocked) {
                if (drawerMask) drawerMask.classList.remove('active');
                if (window.ToyPermissions) window.ToyPermissions.showUnlockModal('written', { examIndex: examIdx >= 0 ? examIdx : 0, questionIndex: idx, level: curLvl });
                return;
            }
            renderWrittenQuestion(idx);
            if (drawerMask) drawerMask.classList.remove('active');
        });
        drawerQGrid.appendChild(chip);
    });
};

function renderWrittenLobbyGrid(filterRange, options = {}) {
    const writtenExamGrid = document.getElementById('written-exam-grid');
    if (!writtenExamGrid) return;
    
    const activeLvl = window.currentExamLevel || 'cet4';
    let activeFilter = filterRange || (typeof currentWrittenFilterRange !== 'undefined' ? currentWrittenFilterRange : 'ALL');
    if (activeFilter === '2008-2014' && activeLvl !== 'gaokao' && activeLvl !== 'kaoyan') {
        activeFilter = 'ALL';
    }
    currentWrittenFilterRange = activeFilter;
    window.currentWrittenFilterRange = activeFilter;
    window.currentWrittenFilter = activeFilter;

    const writtenFilterBar = document.getElementById('written-year-filter-bar');
    if (writtenFilterBar) {
        const chips = writtenFilterBar.querySelectorAll('.chip-year');
        chips.forEach(c => {
            c.classList.toggle('active', c.dataset.range === activeFilter);
        });
        if (typeof window.updateSegmentedSlider === 'function') {
            window.updateSegmentedSlider(writtenFilterBar, !!(options && options.animateSlider));
        }
    }

    const manifestList = (typeof getActiveExamManifest === 'function')
        ? getActiveExamManifest()
        : (window.WRITTEN_EXAMS_MAP ? Object.keys(window.WRITTEN_EXAMS_MAP).map(t => ({ title: t })) : []);

    if (!manifestList || manifestList.length === 0) {
        const retryCount = (options && typeof options._retryCount === 'number') ? options._retryCount : 0;
        if (retryCount < 40) {
            setTimeout(() => renderWrittenLobbyGrid(activeFilter, Object.assign({}, options, { _retryCount: retryCount + 1 })), 50);
        } else {
            writtenExamGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; color: var(--ink-sub); font-size: 13.5px;">暂无可用笔试试卷，请检查网络后重试</div>';
        }
        return;
    }
    writtenExamGrid.innerHTML = '';

    const tier = (window.ToyPermissions && typeof window.ToyPermissions.getTier === 'function')
        ? window.ToyPermissions.getTier()
        : 2;

    const subjFilter = (window.currentExamLevel === 'kaoyan')
        ? (window.currentKaoyanSubjectFilter || 'ENG1')
        : 'ALL';

    let visibleIdx = 0;
    const unlockedVisibleTitles = [];
    manifestList.forEach((item, idx) => {
        const title = item.title;
        const yearMatch = title.match(/(\d{4})年/);
        const y = yearMatch ? parseInt(yearMatch[1]) : (item.year || 0);

        if ((activeFilter === 'ENG1' || subjFilter === 'ENG1') && !title.includes('英语（一）') && !title.includes('英语一') && !(item.examId && item.examId.includes('eng1'))) return;
        if ((activeFilter === 'ENG2' || subjFilter === 'ENG2') && !title.includes('英语（二）') && !title.includes('英语二') && !(item.examId && item.examId.includes('eng2'))) return;
        if (activeFilter === '2021-2026' && !(y >= 2021 && y <= 2026)) return;
        if (activeFilter === '2015-2020' && !(y >= 2015 && y <= 2020)) return;
        if (activeFilter === '2008-2014' && !(y >= 2008 && y <= 2014)) return;

        visibleIdx++;
        const cardIdx = getWrittenExamTrackIndex(title, activeLvl);
        const isDone = window.completedExams && window.completedExams[title];
        let statusText = '未练习';
        let isCompleted = false;

        const currentLvl = window.currentExamLevel || 'cet4';
        const isCharged = !!(window.ToyPermissions && (window.ToyPermissions.isCharged || window.ToyPermissions.isAuthor));
        const hasTrackUnlocked = !!(window.ToyPermissions && window.ToyPermissions.hasUnlockedTrack(currentLvl));
        let isLocked = (cardIdx > 0 && !isCharged);

        if (cardIdx === 0) {
            const ansCount = (isDone && isDone.writtenAnswers)
                ? Object.values(isDone.writtenAnswers).filter(v => v && !v._deleted).length
                : 0;
            if (hasTrackUnlocked || isCharged) {
                if (isDone && typeof isDone.writtenScore === 'number' && !isNaN(isDone.writtenScore)) {
                    statusText = `已测 ${isDone.writtenScore}分`;
                    isCompleted = true;
                } else if (ansCount > 0) {
                    statusText = `已做 ${ansCount} 题`;
                    isCompleted = true;
                } else {
                    statusText = '未练习';
                }
            } else {
                const qTrialRange = (currentLvl === 'gaokao') ? 'Q21-22' : (currentLvl === 'kaoyan' ? 'Q1-2' : 'Q26-27');
                statusText = ansCount > 0 ? '已试做' : `免费试做 (${qTrialRange})`;
                isCompleted = ansCount > 0;
            }
            isLocked = false;
        } else {
            if (isLocked) {
                statusText = '包月充电解锁';
            } else if (isDone) {
                if (typeof isDone.writtenScore === 'number' && !isNaN(isDone.writtenScore)) {
                    statusText = `已测 ${isDone.writtenScore}分`;
                    isCompleted = true;
                } else if (isDone.writtenAnswers) {
                    const ansCount = Object.values(isDone.writtenAnswers).filter(v => v && !v._deleted).length;
                    if (ansCount > 0) {
                        statusText = `已做 ${ansCount} 题`;
                        isCompleted = true;
                    }
                }
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
            unlockedVisibleTitles.push(title);
            if (typeof window.bindCardSpeculativePrefetch === 'function') {
                window.bindCardSpeculativePrefetch(card, title, currentLvl, 'written');
            }
        }
        card.addEventListener('contextmenu', (e) => e.preventDefault());
        card.addEventListener('click', () => {
            const currentlyLocked = window.ToyPermissions ? !window.ToyPermissions.canAccessWrittenExam(cardIdx, 0, currentLvl) : false;
            if (currentlyLocked) {
                window.ToyPermissions.showUnlockModal('written', { examIndex: cardIdx, level: currentLvl });
                return;
            }
            if (card.classList.contains('is-activating')) return;
            card.classList.add('is-activating');
            setTimeout(() => card.classList.remove('is-activating'), 900);
            startWrittenExam(title);
        });
        writtenExamGrid.appendChild(card);
    });
    if (unlockedVisibleTitles.length > 0 && typeof window.scheduleLobbyTopPrefetch === 'function') {
        window.scheduleLobbyTopPrefetch(unlockedVisibleTitles, activeLvl, 'written');
    }
}

window.updateWrittenLobbyGridState = function(filter) {
    const wFilter = filter || (typeof currentWrittenFilterRange !== 'undefined' ? currentWrittenFilterRange : 'ALL');
    renderWrittenLobbyGrid(wFilter);
};

function buildWrittenQuestionsList(examData) {
    if (!examData) return [];
    if (Array.isArray(examData.questions) && examData.questions.length > 0) {
        return examData.questions;
    }
    const list = [];

    // 1. Banked Cloze (Q26-35)
    const cloze = examData.reading?.banked_cloze;
    if (cloze && cloze.questions) {
        const wordBank = cloze.word_bank || cloze.word_bank_map || {};

        cloze.questions.forEach(q => {
            const options = {};
            ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'].forEach(l => {
                if (typeof wordBank[l] === 'string') {
                    options[l] = wordBank[l];
                } else if (wordBank[l] && wordBank[l].word) {
                    options[l] = wordBank[l].word;
                } else if (wordBank[l] && wordBank[l].en) {
                    options[l] = wordBank[l].en;
                }
            });

            list.push({
                id: q.id,
                secKey: 'cloze',
                section: '选词填空 · Section A',
                type: 'cloze',
                passage: cloze.passage || '',
                translation_zh: cloze.passage_zh || cloze.translation_zh || '',
                question_text: `Question ${q.id}. 请选择填入空格 [ ${q.id} ] 的单词：`,
                question_text_zh: '',
                options: options,
                answer: q.answer,
                word: q.word,
                evidence_en: q.evidence || q.evidence_en || '',
                evidence_zh: q.evidence_zh || '',
                analysis: q.analysis || ''
            });
        });
    }

    // 2. Matching (Q36-45)
    const matching = examData.reading?.matching;
    if (matching && matching.questions) {
        const paragraphs = matching.paragraphs || {};
        const paragraphsZh = matching.paragraphs_zh || {};
        const paraKeys = Object.keys(paragraphs);

        matching.questions.forEach(q => {
            const options = {};
            const optionsZh = {};
            paraKeys.forEach(k => {
                options[k] = paragraphs[k] || '';
                optionsZh[k] = paragraphsZh[k] || '';
            });

            list.push({
                id: q.id,
                secKey: 'matching',
                section: '长篇匹配 · Section B',
                type: 'matching',
                passage_title: matching.title || '',
                statement: q.statement || '',
                question_text: `Question ${q.id}. ${q.statement || ''}`,
                question_text_zh: q.statement_zh || q.question_text_zh || (matching.title ? `文章主题: ${matching.title}` : '段落匹配'),
                options: options,
                options_zh: optionsZh,
                answer: q.answer,
                evidence_en: q.evidence || q.evidence_en || '',
                evidence_zh: q.evidence_zh || '',
                synonym_pairs: q.synonym_pairs || [],
                analysis: q.analysis || ''
            });
        });
    }

    // 3. Careful Reading (Q46-55)
    const careful = examData.reading?.careful_reading;
    if (careful && Array.isArray(careful)) {
        careful.forEach((passageObj, pIdx) => {
            (passageObj.questions || []).forEach(q => {
                let rawQText = (q.question || q.question_text || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
                const zhText = (q.question_zh || q.question_text_zh || '').trim();
                list.push({
                    id: q.id,
                    secKey: 'careful',
                    section: `阅读理解 · Passage ${pIdx + 1}`,
                    type: q.type || 'careful',
                    insert_sentence: q.insert_sentence || q.sentence || '',
                    passage: passageObj.passage || passageObj.content || '',
                    translation_zh: passageObj.passage_zh || passageObj.translation_zh || '',
                    question_text: rawQText ? `Question ${q.id}. ${rawQText}` : `Question ${q.id}.`,
                    question_text_zh: zhText,
                    options: q.options || {},
                    options_zh: q.options_zh || {},
                    answer: q.answer,
                    evidence_en: q.evidence || q.evidence_en || '',
                    evidence_zh: q.evidence_zh || '',
                    synonym_pairs: q.synonym_pairs || [],
                    analysis: q.analysis || ''
                });
            });
        });
    }

    // 3.35 Phonetics (语音知识辨音, 2008-2010全国卷等)
    const phonetics = examData.language_use?.phonetics;
    const phoneticsQs = Array.isArray(phonetics) ? phonetics : (phonetics && Array.isArray(phonetics.questions) ? phonetics.questions : null);
    if (phoneticsQs && phoneticsQs.length > 0) {
        phoneticsQs.forEach(q => {
            let rawQText = (q.question_text || q.word || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
            list.push({
                id: q.id,
                secKey: 'phonetics',
                section: '语音知识 · Phonetics',
                type: 'multiple_choice',
                passage: '',
                question_text: rawQText ? `Question ${q.id}. 请选出划线部分发音相同的一项：${rawQText}` : `Question ${q.id}.`,
                question_text_zh: q.question_zh || '辨别划线部分发音',
                options: q.options || {},
                options_zh: q.options_zh || {},
                answer: q.answer,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.4 Multiple Choice (单项选择 / 单项填空, 2008-2013高考等)
    const mc = examData.language_use?.multiple_choice;
    const mcQuestions = Array.isArray(mc) ? mc : (mc && Array.isArray(mc.questions) ? mc.questions : null);
    if (mcQuestions && mcQuestions.length > 0) {
        mcQuestions.forEach(q => {
            let rawQText = (q.question_text || q.question || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
            list.push({
                id: q.id,
                secKey: 'multiple_choice',
                section: '单项填空',
                type: 'multiple_choice',
                passage: '',
                question_text: rawQText ? `Question ${q.id}. ${rawQText}` : `Question ${q.id}.`,
                question_text_zh: q.question_zh || '',
                options: q.options || {},
                options_zh: q.options_zh || {},
                answer: q.answer,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.5 Seven out of Five (七选五, Q36-40)
    const seven = examData.reading?.seven_out_of_five;
    if (seven && seven.questions) {
        seven.questions.forEach(q => {
            list.push({
                id: q.id,
                secKey: 'seven_out_of_five',
                section: '阅读七选五',
                type: 'seven_out_of_five',
                passage: seven.passage || seven.dialogue || seven.content || '',
                translation_zh: seven.passage_zh || seven.dialogue_zh || seven.translation_zh || '',
                question_text: `Question ${q.id}. 请选择填入空格 [ ${q.id} ] 的最佳选项：`,
                options: seven.options || {},
                options_zh: seven.options_zh || {},
                answer: q.answer,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.55 Dialogue Completion (补全对话)
    const dc = examData.reading?.dialogue_completion;
    if (dc && dc.questions && Array.isArray(dc.questions)) {
        dc.questions.forEach(q => {
            list.push({
                id: q.id,
                secKey: 'dialogue_completion',
                section: '补全对话',
                type: 'seven_out_of_five',
                passage: dc.dialogue || dc.passage || '',
                translation_zh: dc.dialogue_zh || dc.passage_zh || '',
                question_text: `Question ${q.id}. 请选择填入对话空格 [ ${q.id} ] 的最佳选项：`,
                options: dc.options || {},
                options_zh: dc.options_zh || {},
                answer: q.answer,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.6 Cloze Choice (完形填空, Q41-60)
    const clozeChoice = examData.language_use?.cloze || examData.cloze;
    if (clozeChoice && clozeChoice.questions) {
        clozeChoice.questions.forEach(q => {
            list.push({
                id: q.id,
                secKey: 'cloze',
                section: '完形填空',
                type: 'cloze_choice',
                passage: clozeChoice.passage || '',
                translation_zh: clozeChoice.passage_zh || '',
                question_text: `Question ${q.id}. 请选择填入完形空格 [ ${q.id} ] 的最佳词汇：`,
                options: q.options || {},
                options_zh: q.options_zh || {},
                answer: q.answer,
                word: q.word,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.7 Grammar Fill-in (语法填空, Q61-70)
    const grammar = examData.language_use?.grammar_fill_in || examData.grammar_fill_in;
    if (grammar && grammar.questions) {
        grammar.questions.forEach(q => {
            const pw = q.prompt_word || q.prompt || '';
            list.push({
                id: q.id,
                secKey: 'grammar_fill_in',
                section: '语法填空',
                type: 'fill_in',
                passage: grammar.passage || '',
                translation_zh: grammar.passage_zh || '',
                question_text: `Question ${q.id}.`,
                answer: q.answer || q.word || '',
                word: q.word || '',
                prompt_word: pw,
                analysis: q.analysis || ''
            });
        });
    }

    // 3.75 Word Spelling (单词拼写, 2008-2010全国卷等)
    const ws = examData.language_use?.word_spelling;
    const wsQs = Array.isArray(ws) ? ws : (ws && Array.isArray(ws.questions) ? ws.questions : null);
    if (wsQs && wsQs.length > 0) {
        wsQs.forEach(q => {
            let rawSentence = (q.question_text || q.sentence || '').replace(/^Question\s*\d*[\.:\s]*/i, '').trim();
            list.push({
                id: q.id,
                secKey: 'word_spelling',
                section: '单词拼写 · Spelling',
                type: 'fill_in',
                passage: '',
                question_text: rawSentence ? `Question ${q.id}. ${rawSentence}` : `Question ${q.id}.`,
                question_text_zh: q.question_zh || (q.prompt_zh ? `中文提示: ${q.prompt_zh}` : ''),
                answer: q.answer || q.word || '',
                word: q.word || q.answer || '',
                prompt_word: q.prompt_zh || '',
                analysis: q.analysis || ''
            });
        });
    }

    // 3.8 Error Correction (短文改错, C1-C10)
    const ec = examData.language_use?.error_correction || examData.language_use?.proofreading || examData.error_correction || examData.writing?.proofreading;
    if (ec && (ec.corrections || ec.questions || ec.lines)) {
        let ecPassage = ec.passage || ec.content || '';
        if (!ecPassage && Array.isArray(ec.lines)) {
            ecPassage = ec.lines.map(l => (typeof l === 'string' ? l : (l.text || l.line || ''))).filter(Boolean).join('\n');
        } else if (!ecPassage && Array.isArray(ec.questions)) {
            ecPassage = ec.questions.map(q => (typeof q === 'string' ? q : (q.line || q.text || ''))).filter(Boolean).join('\n');
        }

        const rawList = ec.corrections || ec.questions || [];
        const CIRC_NUMS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
        rawList.forEach((c, idx) => {
            const cid = c.id !== undefined ? c.id : (idx + 1);
            const errorIndex = idx + 1;
            const circ = (errorIndex < CIRC_NUMS.length) ? CIRC_NUMS[errorIndex] : `[${cid}]`;
            list.push({
                id: `C${cid}`,
                numId: cid,
                errorIndex: errorIndex,
                circ_num: circ,
                secKey: 'error_correction',
                section: '短文改错',
                type: 'proofread',
                passage: ecPassage,
                translation_zh: ec.passage_zh || ec.translation_zh || '',
                annotated_html: ec.annotated_html || '',
                question_text: (c.type === 'correct' || c.corr_type === 'correct') ? `第 ${errorIndex} 处判断（${c.tag || '语法考点'}）：` : `第 ${errorIndex} 处错误修改（${c.tag || '语法考点'}）：`,
                corr_type: c.type || c.corr_type || 'modify',
                original: c.original || '',
                target: c.target || '',
                sentence: c.sentence || '',
                sentence_zh: c.sentence_zh || '',
                tag: c.tag || '语法考点',
                analysis: c.analysis || ''
            });
        });
    }

    // 4. Translation - Only add if actual content exists (CET-4/6 etc.)
    const trans = examData.translation;
    const hasTransContent = trans && typeof trans === 'object' && !Array.isArray(trans) && Boolean(
        (trans.source_zh && String(trans.source_zh).trim()) ||
        (trans.prompt_zh && String(trans.prompt_zh).trim()) ||
        (trans.passage_zh && String(trans.passage_zh).trim()) ||
        (trans.content && String(trans.content).trim()) ||
        (trans.target_en && String(trans.target_en).trim()) ||
        (trans.reference && String(trans.reference).trim())
    );
    if (hasTransContent) {
        const transQId = trans.id || 56;
        list.push({
            id: transQId,
            secKey: 'translation',
            section: '段落翻译',
            type: 'translation',
            question_text: `Question ${transQId}. 汉译英：请阅读下方中文段落，并在思考后查看参考译文与考点解析。`,
            question_text_zh: '段落翻译（中译英）',
            prompt_zh: trans.source_zh || trans.prompt_zh || trans.passage_zh || trans.content || '',
            reference: trans.target_en || trans.reference || '',
            vocabulary: trans.vocabulary || [],
            analysis: trans.analysis || ''
        });
    }

    // 5. Writing (支持新高考应用文 + 读后续写双大题独立切分)
    const writing = examData.writing;
    if (writing && typeof writing === 'object' && !Array.isArray(writing)) {
        const dirs = writing.directions || '';
        const essay = writing.essay || '';
        const essayZh = writing.essay_zh || '';
        const voc = writing.vocabulary || [];

        function cleanEssayText(txt) {
            if (!txt || typeof txt !== 'string') return '';
            return txt
                .replace(/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]](?:[:：\s]*(?:中文翻译|译文|范文))?\s*/gi, '')
                .replace(/^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[：:\s]*(?:应用文写作|读后续写|应用文|续写|短文写作|写作)?[：:\s]*\n*/gi, '')
                .replace(/^(?:读后续写|应用文写作|应用文|续写)[：:\s]*\n*/gi, '')
                .trim();
        }

        function cleanDirectionsText(d) {
            if (!d || typeof d !== 'string') return '';
            return d
                .replace(/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]]\s*/gi, '')
                .replace(/^第[一二三四1234]部分\s*[^\n]*\n+/i, '')
                .replace(/^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])\s*[（\(]?(?:满分\s*\d+\s*分|共\d+小题|应用文写作|读后续写)?[）\)]?[：:\s]*\n*/gi, '')
                .replace(/^[（\(]?满分\s*\d+\s*分[）\)]?[：:\s]*\n*/gi, '')
                .replace(/^(?:应用文写作|读后续写)[（\(]?(?:满分\s*\d+\s*分)?[）\)]?[：:\s]*\n*/gi, '')
                .trim();
        }

        const subKeys = ['section_a', 'section_b', 'section_1', 'section_2', 'part_1', 'part_2', 'practical_writing', 'applied_writing', 'continuation_writing'].filter(
            k => writing[k] && typeof writing[k] === 'object'
        );

        const hasContinuation = !!(writing.continuation_writing && typeof writing.continuation_writing === 'object');

        // 识别双任务：通过 directions 分段或已有的 section 字典或 continuation_writing 或 section_2 标签
        const dirSplit = (dirs && typeof dirs === 'string')
            ? dirs.split(/\n*(?=(?:第二节|Section\s*B|Part\s*B|Part\s*2)[（\(：:\s]|\n+第二节\b|(?:【|\[)(?:continuation_writing|section_2|section_b)(?:】|\]))/i)
            : [];

        const hasSection2InEssay = /(?:【|\[)(?:continuation_writing|section_2|section_b)(?:】|\])/i.test(essay) || /(?:【|\[)(?:continuation_writing|section_2|section_b)(?:】|\])/i.test(essayZh);
        const isTwoPart = (dirSplit.length >= 2) || (subKeys.length >= 2) || hasContinuation || hasSection2InEssay;

        if (isTwoPart) {
            let d1 = '', d2 = '';
            if (dirSplit.length >= 2) {
                d1 = dirSplit[0].trim();
                d2 = dirSplit.slice(1).join('\n\n').trim();
            } else if (hasContinuation && writing.continuation_writing.directions) {
                d2 = writing.continuation_writing.directions;
                const pw = writing.practical_writing || writing.applied_writing;
                d1 = (pw && pw.directions) ? pw.directions : dirs;
            } else if (subKeys.length >= 2) {
                d1 = writing[subKeys[0]].directions || writing[subKeys[0]].prompt || dirs;
                d2 = writing[subKeys[1]].directions || writing[subKeys[1]].prompt || dirs;
            } else {
                d1 = dirs;
                d2 = dirs;
            }

            // 切分英文范文
            let e1 = '', e2 = '';
            let ez1 = '', ez2 = '';
            let v1 = voc, v2 = [];

            if (hasContinuation) {
                const cw = writing.continuation_writing;
                const pw = writing.practical_writing || writing.applied_writing;
                e2 = cw.essay || '';
                ez2 = cw.essay_zh || '';
                v2 = cw.vocabulary || [];
                e1 = (pw && pw.essay) ? pw.essay : essay;
                ez1 = (pw && pw.essay_zh) ? pw.essay_zh : essayZh;
                v1 = (pw && pw.vocabulary && pw.vocabulary.length > 0) ? pw.vocabulary : voc;
            } else if (subKeys.length >= 2 && writing[subKeys[0]].essay && writing[subKeys[1]].essay) {
                e1 = writing[subKeys[0]].essay;
                e2 = writing[subKeys[1]].essay;
                ez1 = writing[subKeys[0]].essay_zh || '';
                ez2 = writing[subKeys[1]].essay_zh || '';
                v1 = (Array.isArray(writing[subKeys[0]].vocabulary) && writing[subKeys[0]].vocabulary.length > 0) ? writing[subKeys[0]].vocabulary : voc;
                v2 = Array.isArray(writing[subKeys[1]].vocabulary) ? writing[subKeys[1]].vocabulary : [];
            } else if (essay.includes('***')) {
                const parts = essay.split('***');
                e1 = parts[0].trim();
                e2 = parts.slice(1).join('\n\n').trim();
            } else if (/(?:【(?:continuation_writing|section_2|section_b)】|\[(?:continuation_writing|section_2|section_b)\])/i.test(essay)) {
                const parts = essay.split(/(?:【(?:continuation_writing|section_2|section_b)】|\[(?:continuation_writing|section_2|section_b)\])/i);
                e1 = parts[0].trim();
                e2 = parts.slice(1).join('\n\n').trim();
            } else if (/(?=\n*(?:Paragraph\s*1:?|【第二节】|Section\s*B)\b)/i.test(essay)) {
                const parts = essay.split(/(?=\n*(?:Paragraph\s*1:?|【第二节】|Section\s*B)\b)/i);
                e1 = parts[0].trim();
                e2 = parts.slice(1).join('\n\n').trim();
            } else {
                e1 = essay;
                e2 = '';
            }

            // 切分范文中文翻译
            if (!ez1 && !ez2) {
                if (essayZh.includes('***')) {
                    const parts = essayZh.split('***');
                    ez1 = parts[0].trim();
                    ez2 = parts.slice(1).join('\n\n').trim();
                } else if (/(?:【(?:continuation_writing|section_2|section_b)】|\[(?:continuation_writing|section_2|section_b)\])/i.test(essayZh)) {
                    const parts = essayZh.split(/(?:【(?:continuation_writing|section_2|section_b)】|\[(?:continuation_writing|section_2|section_b)\])/i);
                    ez1 = parts[0].trim();
                    ez2 = parts.slice(1).join('\n\n').trim();
                } else if (/(?=\n*(?:第一段：?|段落\s*1:?|【第二节】|第二节[：:\s])\b)/i.test(essayZh)) {
                    const parts = essayZh.split(/(?=\n*(?:第一段：?|段落\s*1:?|【第二节】|第二节[：:\s])\b)/i);
                    ez1 = parts[0].trim();
                    ez2 = parts.slice(1).join('\n\n').trim();
                } else {
                    ez1 = essayZh;
                    ez2 = '';
                }
            }

            // 清洗所有范文与译文
            e1 = cleanEssayText(e1);
            ez1 = cleanEssayText(ez1);
            e2 = cleanEssayText(e2);
            ez2 = cleanEssayText(ez2);

            // 清洗题干
            d1 = cleanDirectionsText(d1);
            d2 = cleanDirectionsText(d2);

            const lastQ = list[list.length - 1];
            let baseId = 66;
            if (lastQ && typeof lastQ.id === 'number') {
                baseId = lastQ.id + 1;
            }
            const id1 = (subKeys.length >= 2 && writing[subKeys[0]].id) ? writing[subKeys[0]].id : baseId;
            const id2 = (subKeys.length >= 2 && writing[subKeys[1]].id) ? writing[subKeys[1]].id : (typeof id1 === 'number' ? id1 + 1 : `W2`);

            // 应用文写作
            list.push({
                id: id1,
                secKey: 'writing',
                section: '应用文写作',
                subSection: '应用文写作',
                score: 15,
                type: 'writing',
                question_text: `Question ${id1}. 应用文写作：请仔细阅读题目要求与提示，并在完成写作后查阅参考范文。`,
                question_text_zh: '应用文写作',
                directions: d1,
                directions_zh: (subKeys.length >= 2 && writing[subKeys[0]].directions_zh) || '',
                essay: e1,
                essay_zh: ez1,
                vocabulary: v1,
                analysis: (subKeys.length >= 2 && writing[subKeys[0]].analysis) || ''
            });

            // 读后续写
            list.push({
                id: id2,
                secKey: 'writing',
                section: '读后续写',
                subSection: '读后续写',
                score: 25,
                type: 'writing',
                question_text: `Question ${id2}. 读后续写：请仔细阅读故事材料与续写开头语，并在完成写作后查阅参考范文。`,
                question_text_zh: '读后续写',
                directions: d2,
                directions_zh: (subKeys.length >= 2 && writing[subKeys[1]].directions_zh) || '',
                essay: e2,
                essay_zh: ez2,
                vocabulary: v2,
                analysis: (subKeys.length >= 2 && writing[subKeys[1]].analysis) || ''
            });

        } else {
            const hasWritingContent = Boolean(
                (dirs && String(dirs).trim()) ||
                (essay && String(essay).trim()) ||
                (essayZh && String(essayZh).trim())
            );
            if (hasWritingContent) {
                const lastQ = list[list.length - 1];
                const defaultId = lastQ ? (typeof lastQ.id === 'number' ? lastQ.id + 1 : 57) : 57;
                const wId = writing.id || defaultId;
                list.push({
                    id: wId,
                    secKey: 'writing',
                    section: '短文写作',
                    subSection: '短文写作',
                    type: 'writing',
                    question_text: `Question ${wId}. 短文写作：请仔细阅读题目要求与提示，并在完成写作后查阅参考范文。`,
                    question_text_zh: '短文写作',
                    directions: cleanDirectionsText(dirs),
                    directions_zh: writing.directions_zh || '',
                    essay: cleanEssayText(essay),
                    essay_zh: cleanEssayText(essayZh),
                    vocabulary: voc,
                    analysis: writing.analysis || ''
                });
            }
        }
    }

    // Sort strictly by question ID to ensure chronological order across all years and exam formats
    list.sort((a, b) => {
        const idA = typeof a.id === 'number' ? a.id : parseInt(a.id, 10);
        const idB = typeof b.id === 'number' ? b.id : parseInt(b.id, 10);
        if (!isNaN(idA) && !isNaN(idB)) {
            return idA - idB;
        }
        return 0;
    });

    return list;
}

async function startWrittenExam(title, targetSecKey = 'cloze', opts = null) {
    let meta = (typeof findExamMeta === 'function') ? findExamMeta(title) : null;
    let level = meta ? meta.level : null;
    if (!level) {
        if (title.includes('雅思') || title.toLowerCase().includes('ielts')) level = 'ielts';
        else if (title.includes('考研') || title.toLowerCase().includes('kaoyan')) level = 'kaoyan';
        else if (title.includes('高考')) level = 'gaokao';
        else if (title.includes('六级')) level = 'cet6';
        else if (title.includes('四级')) level = 'cet4';
        else level = window.currentExamLevel || 'cet4';
    }
    const prevExamLevel = window.currentExamLevel;
    const prevKaoyanSubj = window.currentKaoyanSubjectFilter;
    const restoreLevelState = () => {
        window.currentExamLevel = prevExamLevel;
        if (prevKaoyanSubj) window.currentKaoyanSubjectFilter = prevKaoyanSubj;
        if (typeof window.syncLobbyLevelPillsUI === 'function') window.syncLobbyLevelPillsUI();
    };
    window.currentExamLevel = level;
    if (level === 'kaoyan' && title) {
        const isEng2 = title.includes('英语（二）') || title.includes('英语二') || title.toLowerCase().includes('eng2');
        const targetSubj = isEng2 ? 'ENG2' : 'ENG1';
        window.currentKaoyanSubjectFilter = targetSubj;
        try { window.__toyLS.setItem('toy_selected_kaoyan_subj', targetSubj); } catch(e) {}
        document.querySelectorAll('.level-tag-bind').forEach(el => {
            el.textContent = targetSubj === 'ENG2' ? '考研英语(二)' : '考研英语(一)';
        });
        if (typeof window.syncLobbyLevelPillsUI === 'function') {
            window.syncLobbyLevelPillsUI();
        }
    }
    const examIdx = getWrittenExamTrackIndex(title, level);
    const safeExamIdx = examIdx >= 0 ? examIdx : 0;
    if (window.ToyPermissions && !window.ToyPermissions.canAccessWrittenExam(safeExamIdx, 0, level)) {
        if (typeof window.ToyPermissions.shouldAwaitInitialSync === 'function' && window.ToyPermissions.shouldAwaitInitialSync()) {
            await window.ToyPermissions.ensureSynced(1200);
        }
        if (!window.ToyPermissions.canAccessWrittenExam(safeExamIdx, 0, level)) {
            restoreLevelState();
            window.ToyPermissions.showUnlockModal('written', { examIndex: safeExamIdx, questionIndex: 0, level: level });
            return;
        }
    }

    const reqId = (window._writtenStartSeqId = (window._writtenStartSeqId || 0) + 1);
    const navSeq = window._navActionSeqId || 0;

    if (typeof ensureExamDataLoaded === 'function') {
        const loaded = await ensureExamDataLoaded(title, null, 'written');
        if (!loaded) {
            restoreLevelState();
            return;
        }
        if (reqId !== window._writtenStartSeqId || (window._navActionSeqId || 0) !== navSeq) {
            restoreLevelState();
            return;
        }
    }

    currentWrittenExamTitle = title;
    window.currentWrittenExamTitle = title;
    const examData = (window.WRITTEN_EXAMS_MAP && window.WRITTEN_EXAMS_MAP[title]) ? window.WRITTEN_EXAMS_MAP[title] : null;
    currentWrittenQuestions = buildWrittenQuestionsList(examData);
    window.currentWrittenQuestions = currentWrittenQuestions;

    if (window.completedExams && window.completedExams[title] && window.completedExams[title].writtenAnswers) {
        const cleanWrittenAns = {};
        Object.entries(window.completedExams[title].writtenAnswers).forEach(([k, v]) => {
            if (v && !v._deleted) {
                cleanWrittenAns[k] = Object.assign({}, v);
            }
        });
        userWrittenAnswers[title] = cleanWrittenAns;
    } else if (!userWrittenAnswers[title]) {
        userWrittenAnswers[title] = {};
    }
    if (typeof window.hydrateWrittenArenaAnnotations === 'function') {
        window.hydrateWrittenArenaAnnotations(title);
    }

    let initialIndex = 0;
    if (opts && opts.initialQId !== undefined && opts.initialQId !== null) {
        const foundById = currentWrittenQuestions.findIndex(q => String(q.id) === String(opts.initialQId));
        if (foundById >= 0) initialIndex = foundById;
    } else if (targetSecKey && targetSecKey !== 'cloze') {
        const foundIdx = currentWrittenQuestions.findIndex(q => q.secKey === targetSecKey);
        if (foundIdx >= 0) initialIndex = foundIdx;
    }

    if (window.ToyPermissions) {
        const examIdx = getWrittenExamTrackIndex(title, level);
        const safeExamIdx = examIdx >= 0 ? examIdx : 0;
        if (!window.ToyPermissions.canAccessWrittenExam(safeExamIdx, 0, level)) {
            window.ToyPermissions.showUnlockModal('written', { examIndex: safeExamIdx, questionIndex: 0, level });
            return;
        }
        if (!window.ToyPermissions.canAccessWrittenExam(safeExamIdx, initialIndex, level)) {
            window.ToyPermissions.showUnlockModal('written', { examIndex: safeExamIdx, questionIndex: initialIndex, level });
            initialIndex = 0;
        }
    }

    const passageCardInit = document.getElementById('written-passage-card');
    if (passageCardInit) {
        passageCardInit._renderedPassageKey = '';
    }

    currentWrittenQIndex = initialIndex;
    window.currentWrittenQIndex = initialIndex;
    ['written-stage-card', 'written-q-h2', 'written-options-wrapper'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.classList) el.classList.remove('card-slide-forward', 'card-slide-backward');
    });
    const splitQuizEl = document.querySelector('.written-split-quiz');
    if (splitQuizEl && splitQuizEl.classList) {
        splitQuizEl.classList.remove('card-slide-forward', 'card-slide-backward');
    }

    switchView('written-arena');
    renderWrittenQuestion(initialIndex, { isArenaEntry: true });
}
