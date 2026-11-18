/* === js/written_annotations.js === */
// ==========================================================================
// Written Evidence Locator, Option Elimination & Passage Underline Engine (js/written_annotations.js)
// ==========================================================================
function clearEvidenceHighlightInPassage(passageCard) {
    const pCard = passageCard || document.getElementById('written-passage-card');
    if (!pCard) return;
    if (window.UXRoughNotation && typeof window.UXRoughNotation.clearAnnotations === 'function') {
        window.UXRoughNotation.clearAnnotations(pCard);
    }
    pCard.querySelectorAll('mark.passage-evidence-highlight').forEach(markEl => {
        markEl.querySelectorAll('.passage-evidence-badge').forEach(b => b.remove());
        const parent = markEl.parentNode;
        if (!parent) return;
        while (markEl.firstChild) {
            parent.insertBefore(markEl.firstChild, markEl);
        }
        parent.removeChild(markEl);
    });
}

function highlightEvidenceInPassage(targetQ, opts = {}) {
    const pCard = document.getElementById('written-passage-card');
    const passPane = document.querySelector('.written-split-passage');
    if (!pCard || pCard.style.display === 'none') return null;

    clearEvidenceHighlightInPassage(pCard);
    if (!targetQ) return null;

    const rawEv = (targetQ.evidence_en || '').trim();
    const rawSegments = [];
    if (rawEv) {
        const cleanedEv = rawEv
            .replace(/^\s*(?:\(Para\.?\s*\d+\)|【[^】]+】|\[[^\]]+\])\s*/gi, '')
            .replace(/^["“']+|["”']+$/g, '')
            .trim();
        cleanedEv.split(/(?:\.{3,}|…)/).map(s => s.trim()).filter(Boolean).forEach(seg => {
            rawSegments.push(seg);
        });
    }
    if (rawSegments.length === 0 && Array.isArray(targetQ.synonym_pairs)) {
        targetQ.synonym_pairs.forEach(sp => {
            if (sp && sp.orig) rawSegments.push(String(sp.orig).trim());
        });
    }
    if (rawSegments.length === 0) return null;

    const paras = Array.from(pCard.querySelectorAll('p'));
    let firstMarkEl = null;

    rawSegments.forEach((seg, segIdx) => {
        const targetWords = (seg.toLowerCase().match(/[a-z]+/g) || []);
        if (targetWords.length < 2) return;

        for (const p of paras) {
            const wordEls = Array.from(p.querySelectorAll('.dict-word')).filter(el =>
                !el.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected, .sentence-insert-square, .trans-marker-badge, .passage-evidence-badge')
            );
            if (wordEls.length === 0) continue;

            const pTokens = [];
            wordEls.forEach(el => {
                const sub = el.textContent.toLowerCase().match(/[a-z]+/g) || [];
                sub.forEach(w => pTokens.push({ word: w, el }));
            });
            if (pTokens.length < targetWords.length) continue;

            let matchStartIdx = -1;
            let matchEndIdx = -1;

            // 1. Exact contiguous sequence match
            for (let i = 0; i <= pTokens.length - targetWords.length; i++) {
                let ok = true;
                for (let k = 0; k < targetWords.length; k++) {
                    if (pTokens[i + k].word !== targetWords[k]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    matchStartIdx = i;
                    matchEndIdx = i + targetWords.length - 1;
                    break;
                }
            }

            // 2. Fuzzy prefix + suffix anchor match within same paragraph
            if (matchStartIdx === -1 && targetWords.length >= 6) {
                const headLen = 3;
                const tailLen = 3;
                for (let i = 0; i <= pTokens.length - headLen; i++) {
                    if (pTokens[i].word === targetWords[0] &&
                        pTokens[i + 1].word === targetWords[1] &&
                        pTokens[i + 2].word === targetWords[2]) {
                        const maxJ = Math.min(pTokens.length - tailLen, i + targetWords.length + 12);
                        const minJ = Math.max(i + headLen, i + targetWords.length - 12);
                        for (let j = minJ; j <= maxJ; j++) {
                            if (pTokens[j].word === targetWords[targetWords.length - 3] &&
                                pTokens[j + 1].word === targetWords[targetWords.length - 2] &&
                                pTokens[j + 2].word === targetWords[targetWords.length - 1]) {
                                matchStartIdx = i;
                                matchEndIdx = j + 2;
                                break;
                            }
                        }
                        if (matchStartIdx !== -1) break;
                    }
                }
            }

            // 3. Prefix 4-word fallback
            if (matchStartIdx === -1 && targetWords.length >= 5) {
                for (let i = 0; i <= pTokens.length - 4; i++) {
                    if (pTokens[i].word === targetWords[0] &&
                        pTokens[i + 1].word === targetWords[1] &&
                        pTokens[i + 2].word === targetWords[2] &&
                        pTokens[i + 3].word === targetWords[3]) {
                        matchStartIdx = i;
                        matchEndIdx = Math.min(pTokens.length - 1, i + targetWords.length - 1);
                        break;
                    }
                }
            }

            if (matchStartIdx !== -1 && matchEndIdx >= matchStartIdx) {
                const startEl = pTokens[matchStartIdx].el;
                const endEl = pTokens[matchEndIdx].el;
                let rangeStartNode = startEl;
                let rangeEndNode = endEl;
                if (startEl && endEl && startEl.parentNode !== endEl.parentNode) {
                    const sUnit = startEl.closest('.passage-sent-unit');
                    const eUnit = endEl.closest('.passage-sent-unit');
                    if (sUnit && eUnit && sUnit.parentNode === eUnit.parentNode) {
                        rangeStartNode = sUnit;
                        rangeEndNode = eUnit;
                    }
                }
                if (rangeStartNode && rangeEndNode && rangeStartNode.parentNode === rangeEndNode.parentNode) {
                    try {
                        const range = document.createRange();
                        range.setStartBefore(rangeStartNode);
                        range.setEndAfter(rangeEndNode);
                        const markEl = document.createElement('mark');
                        markEl.className = 'passage-evidence-highlight';
                        if (!firstMarkEl && segIdx === 0 && targetQ.id) {
                            const badge = document.createElement('span');
                            badge.className = 'passage-evidence-badge';
                            badge.textContent = `🎯 Q${targetQ.id}`;
                            markEl.appendChild(badge);
                        }
                        markEl.appendChild(range.extractContents());
                        range.insertNode(markEl);
                        if (!firstMarkEl) firstMarkEl = markEl;
                        break;
                    } catch (e) {}
                }
            }
        }
    });

    if (firstMarkEl) {
        if (window.UXRoughNotation && typeof window.UXRoughNotation.annotatePassageEvidence === 'function') {
            requestAnimationFrame(() => window.UXRoughNotation.annotatePassageEvidence(pCard));
        }
        if (opts.pulse) {
            firstMarkEl.classList.remove('evidence-pulse');
            void firstMarkEl.offsetWidth;
            firstMarkEl.classList.add('evidence-pulse');
        }
        const splitContainer = document.querySelector('.written-split-container');
        const isSheetSplit = !!(splitContainer && splitContainer.classList.contains('mobile-sheet-split-active'));
        if (opts.forceScroll) {
            if (isSheetSplit && passPane) {
                scrollElementIntoPane(firstMarkEl, passPane);
            } else if (passPane && passPane.scrollHeight > passPane.clientHeight + 10) {
                scrollElementIntoPane(firstMarkEl, passPane);
            } else {
                firstMarkEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                showBackToQuestionPill(targetQ);
            }
        } else if (opts.autoScrollSplit) {
            if (isSheetSplit || (passPane && passPane.scrollHeight > passPane.clientHeight + 10)) {
                scrollElementIntoPane(firstMarkEl, passPane);
            }
        }
    } else if (opts.forceScroll && pCard) {
        scrollElementIntoPane(pCard, passPane);
        if (!(passPane && passPane.scrollHeight > passPane.clientHeight + 10)) {
            showBackToQuestionPill(targetQ);
        }
    }

    return firstMarkEl;
}

// ==========================================================================
// ✨ 1. 极致无感排除选项系统 (横抹跟手划除 + 0.28s 长按排除 + 轻点恢复)
//    - 单击正常选项：100% 永远是选择该选项作答，绝不误触发排除
//    - 直觉 A (横向轻抹)：划动时删除线实时跟手生长，满 18px 丝滑锁定排除
//    - 直觉 B (长按 0.28s)：按住选项停顿 0.28s 直接排除（松手不误选）
//    - 直觉 C (PC 右键)：右键一点即切换排除/恢复
//    - 极简恢复：无任何多余按钮，直接轻点一下已排除的选项即刻恢复
// ==========================================================================
window._eliminatedOptionsMap = window._eliminatedOptionsMap || {};

function persistEliminatedOptions(elimStateKey) {
    if (!elimStateKey) return;
    const parts = String(elimStateKey).split('::');
    const examTitle = parts.length >= 2 ? parts[1] : (window.currentWrittenExamTitle || 'default');
    if (!examTitle || examTitle === 'default') return;
    if (!window.completedExams) window.completedExams = {};
    if (!window.completedExams[examTitle]) {
        window.completedExams[examTitle] = { timestamp: Date.now() };
    }
    if (!window.completedExams[examTitle].eliminatedOptions || typeof window.completedExams[examTitle].eliminatedOptions !== 'object') {
        window.completedExams[examTitle].eliminatedOptions = {};
    }
    const elimSet = window._eliminatedOptionsMap[elimStateKey];
    if (elimSet && elimSet.size > 0) {
        window.completedExams[examTitle].eliminatedOptions[elimStateKey] = Array.from(elimSet);
    } else {
        delete window.completedExams[examTitle].eliminatedOptions[elimStateKey];
    }
    window.completedExams[examTitle].eliminatedUpdatedAt = Date.now();
    window.completedExams[examTitle].timestamp = Date.now();
    if (typeof window.saveUserCloudData === 'function') {
        window.saveUserCloudData(examTitle, false);
    }
}

function clearOptionEliminationForKeys(elimStateKey, keys) {
    if (!elimStateKey || !Array.isArray(keys) || keys.length === 0) return;
    if (!window._eliminatedOptionsMap[elimStateKey]) {
        const parts = String(elimStateKey).split('::');
        const examTitle = parts.length >= 2 ? parts[1] : (window.currentWrittenExamTitle || 'default');
        const savedArr = window.completedExams &&
            window.completedExams[examTitle] &&
            window.completedExams[examTitle].eliminatedOptions &&
            window.completedExams[examTitle].eliminatedOptions[elimStateKey];
        if (!Array.isArray(savedArr) || savedArr.length === 0) return;
        window._eliminatedOptionsMap[elimStateKey] = new Set(savedArr.map(String));
    }
    const elimSet = window._eliminatedOptionsMap[elimStateKey];
    let changed = false;
    keys.forEach(k => {
        if (k !== undefined && k !== null && elimSet.delete(String(k))) {
            changed = true;
        }
    });
    if (changed) {
        persistEliminatedOptions(elimStateKey);
    }
}
window.clearOptionEliminationForKeys = clearOptionEliminationForKeys;

function bindOptionElimination(btn, elimStateKey, optKey) {
    if (!btn || !elimStateKey || !optKey) return;

    if (!window._eliminatedOptionsMap[elimStateKey]) {
        const parts = String(elimStateKey).split('::');
        const examTitle = parts.length >= 2 ? parts[1] : (window.currentWrittenExamTitle || 'default');
        const savedArr = window.completedExams &&
            window.completedExams[examTitle] &&
            window.completedExams[examTitle].eliminatedOptions &&
            window.completedExams[examTitle].eliminatedOptions[elimStateKey];
        window._eliminatedOptionsMap[elimStateKey] = new Set(Array.isArray(savedArr) ? savedArr.map(String) : []);
    }
    const elimSet = window._eliminatedOptionsMap[elimStateKey];
    const textEl = btn.querySelector('.opt-en-text, .word-bank-opt-text');

    const clearScratchPreview = () => {
        if (textEl) {
            textEl.style.backgroundSize = '';
            textEl.style.backgroundPosition = '';
        }
        btn.style.opacity = '';
    };

    const isLockedOrSelected = () => (
        btn.classList.contains('opt-current-pick') ||
        btn.classList.contains('correct-state') ||
        btn.classList.contains('wrong-state') ||
        btn.classList.contains('exam-selected-state')
    );

    if (elimSet.has(optKey) && !isLockedOrSelected()) {
        btn.classList.add('opt-eliminated');
    }

    const setEliminatedState = (shouldEliminate) => {
        clearScratchPreview();
        if (isLockedOrSelected()) {
            btn.classList.remove('opt-eliminated');
            if (elimSet.delete(optKey)) {
                persistEliminatedOptions(elimStateKey);
            }
            return;
        }
        if (shouldEliminate) {
            btn.classList.add('opt-eliminated');
            elimSet.add(optKey);
        } else {
            btn.classList.remove('opt-eliminated');
            elimSet.delete(optKey);
        }
        persistEliminatedOptions(elimStateKey);
        if (navigator && typeof navigator.vibrate === 'function') {
            try { navigator.vibrate(10); } catch (e) {}
        }
        if (window.FeedbackEngine && typeof window.FeedbackEngine.playTap === 'function') {
            window.FeedbackEngine.playTap();
        }
    };

    // 捕获阶段拦截点击：
    // 1. 如果是横抹或长按刚松手产生的合成 click，直接吞掉；
    // 2. 如果当前选项已处于「已排除态」，单击任意位置 = 立即恢复为正常态；
    // 3. 如果当前选项是「正常态」，单击完全放行给原有的选答案逻辑！
    btn.addEventListener('click', (e) => {
        if (window.isLookupMode) return;
        if (btn._suppressNextClickUntil && Date.now() < btn._suppressNextClickUntil) {
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }
        if (btn.classList.contains('opt-eliminated') && !isLockedOrSelected()) {
            e.stopImmediatePropagation();
            e.preventDefault();
            setEliminatedState(false);
            return;
        }
    }, true);

    // PC 端鼠标右键点击切换排除/恢复
    btn.addEventListener('contextmenu', (e) => {
        if (window.isLookupMode || isLockedOrSelected()) return;
        e.preventDefault();
        e.stopPropagation();
        setEliminatedState(!btn.classList.contains('opt-eliminated'));
    });

    // 移动端 / 平板 / 触控板：横抹跟手划除 + 0.28s 静置长按排除
    let startX = 0;
    let startY = 0;
    let isTracking = false;
    let hasTriggeredInGesture = false;
    let longPressTimer = null;

    const cancelLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    const onGestureStart = (clientX, clientY) => {
        if (window.isLookupMode || isLockedOrSelected()) return;
        startX = clientX;
        startY = clientY;
        isTracking = true;
        hasTriggeredInGesture = false;
        cancelLongPress();

        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            if (!isTracking || hasTriggeredInGesture || window.isLookupMode || isLockedOrSelected()) return;
            hasTriggeredInGesture = true;
            isTracking = false;
            btn._suppressNextClickUntil = Date.now() + 450;
            setEliminatedState(!btn.classList.contains('opt-eliminated'));
        }, 460);
    };

    const onGestureMove = (clientX, clientY, ev) => {
        if (!isTracking || hasTriggeredInGesture) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx > 7 || absDy > 7) {
            cancelLongPress();
        }

        // 垂直滚动优先放行
        if (absDy > 18 && absDy > absDx) {
            isTracking = false;
            clearScratchPreview();
            return;
        }

        // 水平轻抹跟手实时预览 (6px ~ 18px 之间删除线随手指实时生长)
        if (absDx >= 6 && absDx > absDy * 1.15) {
            if (ev && ev.cancelable) {
                try { ev.preventDefault(); } catch (err) {}
            }
            const isCurrentlyElim = btn.classList.contains('opt-eliminated');
            if (!isCurrentlyElim && textEl && absDx < 18) {
                const pct = Math.min(95, Math.round((absDx / 18) * 100));
                textEl.style.backgroundPosition = dx >= 0 ? '0% 55%' : '100% 55%';
                textEl.style.backgroundSize = `${pct}% 1.6px`;
            }

            if (absDx >= 18) {
                hasTriggeredInGesture = true;
                isTracking = false;
                btn._suppressNextClickUntil = Date.now() + 400;
                setEliminatedState(!isCurrentlyElim);
            }
        }
    };

    const onGestureEnd = () => {
        cancelLongPress();
        if (isTracking && !hasTriggeredInGesture) {
            clearScratchPreview();
        }
        isTracking = false;
    };

    btn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            onGestureStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    btn.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length === 1) {
            onGestureMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });

    btn.addEventListener('touchend', onGestureEnd, { passive: true });
    btn.addEventListener('touchcancel', onGestureEnd, { passive: true });

    btn.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            onGestureStart(e.clientX, e.clientY);
        }
    });
    btn.addEventListener('mousemove', (e) => {
        if (isTracking && (e.buttons & 1)) {
            onGestureMove(e.clientX, e.clientY, e);
        }
    });
    btn.addEventListener('mouseup', onGestureEnd);
    btn.addEventListener('mouseleave', onGestureEnd);
}
window.bindOptionElimination = bindOptionElimination;

// ==========================================================================
// ✨ 2. 原文零感画线定位引擎 (轻点智能意群画线 + 按住横抹自由选词 + 再点即擦)
//    - 默认做题态轻点原文：智能识别当前短分句/意群（标点、从句引导词、题号自然断句），墨水线平滑展开
//    - 轻点已画线处：整段相连下划线平滑回缩擦除
//    - 按住横向轻抹：想画哪几个词就精准画哪几个词（支持跨行顺滑连画，查词模式下也可直接横抹画线）
// ==========================================================================
window._passageUnderlinesMap = window._passageUnderlinesMap || {};

function syncParagraphUnderlineSeparators(paraEl) {
    if (!paraEl) return;
    const seps = paraEl.querySelectorAll('.dict-sep');
    seps.forEach(sep => {
        const prev = sep.previousElementSibling;
        const next = sep.nextElementSibling;
        const shouldConnect = !!(
            prev && next &&
            prev.classList.contains('dict-word') &&
            next.classList.contains('dict-word') &&
            prev.classList.contains('is-user-underlined') &&
            next.classList.contains('is-user-underlined')
        );
        sep.classList.toggle('is-user-underlined', shouldConnect);
    });
}

function persistPassageUnderlines(passageCard) {
    if (!passageCard) return;
    const examKey = passageCard._underlineExamKey || window.currentWrittenExamTitle || 'default';
    const set = new Set();
    passageCard.querySelectorAll('.dict-word.is-user-underlined').forEach(w => {
        if (w.dataset.uIdx !== undefined) {
            set.add(String(w.dataset.uIdx));
        }
    });
    window._passageUnderlinesMap[examKey] = set;

    const sepIdx = String(examKey).indexOf('::');
    const realExamTitle = sepIdx !== -1 ? String(examKey).slice(0, sepIdx) : String(examKey);
    const passageScope = sepIdx !== -1 ? String(examKey).slice(sepIdx + 2) : '';

    if (realExamTitle && realExamTitle !== 'default') {
        if (!window.completedExams) window.completedExams = {};
        if (!window.completedExams[realExamTitle]) {
            window.completedExams[realExamTitle] = { timestamp: Date.now() };
        }
        const existingArr = Array.isArray(window.completedExams[realExamTitle].underlines)
            ? window.completedExams[realExamTitle].underlines.map(String)
            : [];
        if (passageScope) {
            const prefix = `${passageScope}::`;
            const others = existingArr.filter(item => item.includes('::') && !item.startsWith(prefix));
            const scoped = Array.from(set).map(u => `${prefix}${u}`);
            window.completedExams[realExamTitle].underlines = others.concat(scoped);
            window._passageUnderlinesMap[realExamTitle] = new Set(window.completedExams[realExamTitle].underlines);
        } else {
            window.completedExams[realExamTitle].underlines = Array.from(set);
        }
        window.completedExams[realExamTitle].underlinesUpdatedAt = Date.now();
        window.completedExams[realExamTitle].timestamp = Date.now();
        if (typeof window.saveUserCloudData === 'function') {
            window.saveUserCloudData(realExamTitle, false);
        }
    }
}

function hydrateWrittenArenaAnnotations(targetExamTitle) {
    if (!window.completedExams || typeof window.completedExams !== 'object') return;
    window._passageUnderlinesMap = window._passageUnderlinesMap || {};
    window._eliminatedOptionsMap = window._eliminatedOptionsMap || {};

    const titles = targetExamTitle ? [targetExamTitle] : Object.keys(window.completedExams);
    titles.forEach(title => {
        const rec = window.completedExams[title];
        if (!rec || typeof rec !== 'object') return;
        if (Array.isArray(rec.underlines)) {
            const rawList = rec.underlines.map(String);
            window._passageUnderlinesMap[title] = new Set(rawList);
            rawList.forEach(item => {
                const idx = item.indexOf('::');
                if (idx !== -1) {
                    const scope = item.slice(0, idx);
                    const uIdx = item.slice(idx + 2);
                    const compositeKey = `${title}::${scope}`;
                    if (!window._passageUnderlinesMap[compositeKey]) {
                        window._passageUnderlinesMap[compositeKey] = new Set();
                    }
                    window._passageUnderlinesMap[compositeKey].add(uIdx);
                }
            });
        }
        if (rec.eliminatedOptions && typeof rec.eliminatedOptions === 'object') {
            Object.entries(rec.eliminatedOptions).forEach(([elimKey, arr]) => {
                if (Array.isArray(arr)) {
                    window._eliminatedOptionsMap[elimKey] = new Set(arr.map(String));
                }
            });
        }
    });
}
window.hydrateWrittenArenaAnnotations = hydrateWrittenArenaAnnotations;

function clearExamArenaAnnotations(targetExamTitle) {
    if (!targetExamTitle) return;
    if (window.completedExams && window.completedExams[targetExamTitle]) {
        delete window.completedExams[targetExamTitle].underlines;
        delete window.completedExams[targetExamTitle].eliminatedOptions;
    }
    if (window._passageUnderlinesMap && typeof window._passageUnderlinesMap === 'object') {
        const prefix = `${targetExamTitle}::`;
        Object.keys(window._passageUnderlinesMap).forEach(k => {
            if (k === targetExamTitle || k.indexOf(prefix) === 0) delete window._passageUnderlinesMap[k];
        });
    }
    if (window._eliminatedOptionsMap && typeof window._eliminatedOptionsMap === 'object') {
        const mid = `::${targetExamTitle}::`;
        Object.keys(window._eliminatedOptionsMap).forEach(k => {
            if (k === targetExamTitle || k.includes(mid) || k.endsWith(`::${targetExamTitle}`) || k.startsWith(`${targetExamTitle}_`)) {
                delete window._eliminatedOptionsMap[k];
            }
        });
    }
    document.querySelectorAll('.dict-word.is-user-underlined').forEach(el => el.classList.remove('is-user-underlined'));
    document.querySelectorAll('.opt-eliminated').forEach(el => el.classList.remove('opt-eliminated'));
}
window.clearExamArenaAnnotations = clearExamArenaAnnotations;

function eraseContiguousUnderlineSpan(wordEl, passageCard) {
    if (!wordEl || !passageCard) return;
    const paraEl = wordEl.closest('p') || passageCard;
    const words = Array.from(paraEl.querySelectorAll('.dict-word'));
    const pos = words.indexOf(wordEl);
    if (pos === -1) return;

    wordEl.classList.remove('is-user-underlined');
    for (let i = pos - 1; i >= 0; i--) {
        if (words[i].classList.contains('is-user-underlined')) {
            words[i].classList.remove('is-user-underlined');
        } else {
            break;
        }
    }
    for (let i = pos + 1; i < words.length; i++) {
        if (words[i].classList.contains('is-user-underlined')) {
            words[i].classList.remove('is-user-underlined');
        } else {
            break;
        }
    }

    syncParagraphUnderlineSeparators(paraEl);
    persistPassageUnderlines(passageCard);

    if (navigator && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(8); } catch (e) {}
    }
    if (window.FeedbackEngine && typeof window.FeedbackEngine.playTap === 'function') {
        window.FeedbackEngine.playTap();
    }
}
window.eraseContiguousUnderlineSpan = eraseContiguousUnderlineSpan;

const SENSE_GROUP_BREAK_WORDS = new Set([
    'that', 'which', 'who', 'whom', 'whose', 'where', 'when', 'whether',
    'while', 'whereas', 'although', 'though', 'because', 'since', 'unless',
    'until', 'before', 'after', 'if', 'but', 'yet', 'however'
]);

function toggleClauseUnderlineAroundWord(targetEl) {
    if (!targetEl) return false;
    const wordEl = targetEl.classList && targetEl.classList.contains('dict-word')
        ? targetEl
        : (targetEl.closest ? targetEl.closest('.dict-word') : null);
    if (!wordEl) return false;

    const passageCard = wordEl.closest('#written-passage-card');
    if (!passageCard) return false;

    if (wordEl.classList.contains('is-user-underlined')) {
        eraseContiguousUnderlineSpan(wordEl, passageCard);
        return false;
    }

    const paraEl = wordEl.closest('p') || passageCard;
    const clauseBreakRe = /[.!?。！？；;:：,，—()（）"“”]/;
    const leftWords = [];
    const rightWords = [];

    // 向左收集同一标点/题号内的词
    let cur = wordEl;
    while (cur.previousSibling) {
        const prev = cur.previousSibling;
        if (prev.nodeType === 1) {
            if (prev.classList.contains('dict-word')) {
                leftWords.push(prev);
            } else if (prev.classList.contains('dict-sep')) {
                if (clauseBreakRe.test(prev.textContent || '')) break;
            } else {
                break;
            }
        }
        cur = prev;
    }

    // 向右收集同一标点/题号内的词
    cur = wordEl;
    while (cur.nextSibling) {
        const next = cur.nextSibling;
        if (next.nodeType === 1) {
            if (next.classList.contains('dict-word')) {
                rightWords.push(next);
            } else if (next.classList.contains('dict-sep')) {
                if (clauseBreakRe.test(next.textContent || '')) break;
            } else {
                break;
            }
        }
        cur = next;
    }

    // 如果两个标点之间的长句超过 9 个词，按从句连词智能切分为精炼意群，避免一次画满三四行
    const clauseWords = [...leftWords.reverse(), wordEl, ...rightWords];
    let finalWords = clauseWords;
    if (clauseWords.length > 9) {
        const tapIdx = leftWords.length;
        let subStart = 0;
        let subEnd = clauseWords.length - 1;

        for (let i = tapIdx; i > 0; i--) {
            const wClean = (clauseWords[i].textContent || '').trim().toLowerCase();
            if (SENSE_GROUP_BREAK_WORDS.has(wClean) && (i >= 3)) {
                subStart = i;
                break;
            }
        }
        for (let i = tapIdx + 1; i < clauseWords.length; i++) {
            const wClean = (clauseWords[i].textContent || '').trim().toLowerCase();
            if (SENSE_GROUP_BREAK_WORDS.has(wClean) && (i - subStart >= 4)) {
                subEnd = i - 1;
                break;
            }
        }
        finalWords = clauseWords.slice(subStart, subEnd + 1);
    }

    finalWords.forEach(w => w.classList.add('is-user-underlined'));
    syncParagraphUnderlineSeparators(paraEl);
    persistPassageUnderlines(passageCard);

    if (navigator && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch (e) {}
    }
    if (window.FeedbackEngine && typeof window.FeedbackEngine.playTap === 'function') {
        window.FeedbackEngine.playTap();
    }
    return true;
}
window.toggleSentenceUnderlineElement = toggleClauseUnderlineAroundWord;

function prepareParagraphWordsForUnderline(paraEl, pIdx, counterRef, savedSet) {
    if (!paraEl || paraEl.dataset.uPrepared === '1') return;
    paraEl.dataset.uPrepared = '1';

    const childNodes = Array.from(paraEl.childNodes);
    childNodes.forEach(node => {
        if (node.nodeType === 3) {
            const text = node.nodeValue || '';
            if (text.length > 0) {
                const sep = document.createElement('span');
                sep.className = 'dict-sep';
                sep.textContent = text;
                paraEl.replaceChild(sep, node);
            }
        } else if (node.nodeType === 1 && node.classList.contains('dict-word')) {
            const idxStr = String(counterRef.val++);
            node.dataset.uIdx = idxStr;
            node.dataset.pIdx = String(pIdx);
            if (savedSet && savedSet.has(idxStr)) {
                node.classList.add('is-user-underlined');
            }
        }
    });

    syncParagraphUnderlineSeparators(paraEl);
}

function findWordNearPoint(passageCard, clientX, clientY, preferredParaEl, cachedWordRects) {
    const isInsideBlankBadge = (el) => !!(el && el.closest && el.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected, .sentence-insert-square, .trans-marker-badge, .passage-evidence-badge'));
    const hit = document.elementFromPoint(clientX, clientY);
    if (hit && passageCard.contains(hit)) {
        if (isInsideBlankBadge(hit)) return null;
        const directWord = hit.closest('.dict-word');
        if (directWord && passageCard.contains(directWord) && !isInsideBlankBadge(directWord)) return directWord;

        const sep = hit.closest('.dict-sep');
        if (sep && passageCard.contains(sep)) {
            const prev = sep.previousElementSibling;
            const next = sep.nextElementSibling;
            if (prev && prev.classList.contains('dict-word') && !isInsideBlankBadge(prev)) return prev;
            if (next && next.classList.contains('dict-word') && !isInsideBlankBadge(next)) return next;
        }
    }

    if (cachedWordRects && cachedWordRects.length > 0) {
        let bestWord = null;
        let bestDist = Infinity;
        for (let i = 0; i < cachedWordRects.length; i++) {
            const item = cachedWordRects[i];
            const rect = item.rect;
            if (clientY >= rect.top - 12 && clientY <= rect.bottom + 12) {
                const dx = clientX < rect.left
                    ? rect.left - clientX
                    : (clientX > rect.right ? clientX - rect.right : 0);
                if (dx < bestDist && dx <= 42) {
                    bestDist = dx;
                    bestWord = item.el;
                }
            }
        }
        return bestWord;
    }

    const scopeEl = preferredParaEl || passageCard;
    const words = scopeEl.querySelectorAll('.dict-word');
    let bestWord = null;
    let bestDist = Infinity;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (isInsideBlankBadge(w)) continue;
        const rect = w.getBoundingClientRect();
        if (clientY >= rect.top - 12 && clientY <= rect.bottom + 12) {
            const dx = clientX < rect.left
                ? rect.left - clientX
                : (clientX > rect.right ? clientX - rect.right : 0);
            if (dx < bestDist && dx <= 42) {
                bestDist = dx;
                bestWord = w;
            }
        }
    }
    return bestWord;
}

const GESTURE_WHISPER_STORAGE_KEY = 'toy_gesture_whisper_seen_v5';

function dismissGestureWhisperPill(markSeen = false) {
    const pill = document.getElementById('gesture-whisper-pill');
    if (markSeen) {
        window._hasShownGestureWhisper = true;
        try {
            window.__toyLS.setItem(GESTURE_WHISPER_STORAGE_KEY, '1');
        } catch (e) {}
    }
    if (!pill) return;
    pill.classList.remove('show');
    setTimeout(() => {
        if (pill.parentNode) pill.parentNode.removeChild(pill);
    }, 300);
}
window.dismissGestureWhisperPill = dismissGestureWhisperPill;

function maybeShowFirstTimeGestureWhisper(force = false) {
    if (!force) return;

    if (typeof window.closeTopMenuHint === 'function') {
        window.closeTopMenuHint(false);
    }

    let pill = document.getElementById('gesture-whisper-pill');
    if (pill) {
        pill.classList.add('show');
        return;
    }

    pill = document.createElement('div');
    pill.id = 'gesture-whisper-pill';
    pill.className = 'gesture-whisper-pill';
    pill.setAttribute('role', 'status');
    pill.innerHTML = `
        <div class="gesture-guide-header">
            <span class="gesture-guide-title">💡 快捷手势</span>
            <button type="button" class="gesture-guide-close">知道了</button>
        </div>
        <div class="gesture-guide-row">
            <span class="gesture-guide-tag">点词收藏</span>
            <span><b>轻点单词</b>加入生词本 / 充电查释义</span>
        </div>
        <div class="gesture-guide-row">
            <span class="gesture-guide-tag">原文画线</span>
            <span><b>按住横划</b>自由画线，再次横划擦除</span>
        </div>
        <div class="gesture-guide-row">
            <span class="gesture-guide-tag">排除选项</span>
            <span><b>横划 / 长按</b>划掉选项，轻点恢复</span>
        </div>
    `;
    document.body.appendChild(pill);

    const closeBtn = pill.querySelector('.gesture-guide-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismissGestureWhisperPill(true);
        });
    }

    requestAnimationFrame(() => {
        setTimeout(() => {
            if (pill.parentNode) pill.classList.add('show');
        }, 120);
    });

    const backBtn = document.getElementById('btn-top-nav-action');
    if (backBtn && !backBtn._whisperBound) {
        backBtn._whisperBound = true;
        backBtn.addEventListener('click', () => dismissGestureWhisperPill(false));
    }
}
window.showGestureWhisperPill = maybeShowFirstTimeGestureWhisper;

function initPassageUserUnderline(passageCard, examTitle) {
    if (!passageCard || passageCard.style.display === 'none') return;
    if (passageCard.querySelector('.proof-word, .corr-item')) return;

    const examKey = examTitle || window.currentWrittenExamTitle || 'default';
    passageCard._underlineExamKey = examKey;
    if (!window._passageUnderlinesMap[examKey]) {
        const sepIdx = String(examKey).indexOf('::');
        const realExamTitle = sepIdx !== -1 ? String(examKey).slice(0, sepIdx) : String(examKey);
        const passageScope = sepIdx !== -1 ? String(examKey).slice(sepIdx + 2) : '';
        const persistedArr = window.completedExams &&
            window.completedExams[realExamTitle] &&
            window.completedExams[realExamTitle].underlines;
        const extracted = [];
        if (Array.isArray(persistedArr)) {
            const prefix = passageScope ? `${passageScope}::` : '';
            persistedArr.forEach(item => {
                const s = String(item);
                if (prefix && s.startsWith(prefix)) {
                    extracted.push(s.slice(prefix.length));
                } else if (!prefix && !s.includes('::')) {
                    extracted.push(s);
                }
            });
        }
        window._passageUnderlinesMap[examKey] = new Set(extracted);
    }
    const savedSet = window._passageUnderlinesMap[examKey];

    const counterRef = { val: 0 };
    const paras = Array.from(passageCard.querySelectorAll('p'));
    paras.forEach((p, idx) => {
        prepareParagraphWordsForUnderline(p, idx, counterRef, savedSet);
    });

    if (passageCard._underlineEventsBound) return;
    passageCard._underlineEventsBound = true;

    const isInteractiveBlank = (el) => {
        if (!el || typeof el.closest !== 'function') return true;
        return !!el.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected, .sentence-insert-square, .trans-marker-badge, .passage-evidence-badge');
    };

    // 1. 手势彻底分离（方案 A）：
    //    - 轻点单词 (.dict-word) -> 交由 dictionary.js 直接查词 & 加入生词本（绝不触发整句画线！）
    //    - 仅当点击在已画线的词间空白 (.dict-sep.is-user-underlined) 或未收录于词典的已画线词上时，平滑擦除该段画线
    passageCard.addEventListener('click', (e) => {
        if (window._suppressNextLookupClickUntil && Date.now() < window._suppressNextLookupClickUntil) {
            return;
        }
        if (isInteractiveBlank(e.target)) return;

        let underlinedWord = e.target.closest('.dict-word.is-user-underlined');
        if (!underlinedWord) {
            const sep = e.target.closest('.dict-sep.is-user-underlined');
            if (sep) {
                const prev = sep.previousElementSibling;
                if (prev && prev.classList.contains('dict-word') && prev.classList.contains('is-user-underlined')) {
                    underlinedWord = prev;
                }
            }
        }
        if (underlinedWord && passageCard.contains(underlinedWord)) {
            e.stopPropagation();
            eraseContiguousUnderlineSpan(underlinedWord, passageCard);
        }
    });

    // 2. 横向笔触滑动自由选词画线 / 擦除 (Pen-Glide Range Underline，与轻点查词完全正交无冲突)
    let glideState = null;

    const startGlideCandidate = (clientX, clientY, target) => {
        if (isInteractiveBlank(target)) {
            glideState = null;
            return;
        }
        const startWord = findWordNearPoint(passageCard, clientX, clientY, null);
        if (!startWord || isInteractiveBlank(startWord)) {
            glideState = null;
            return;
        }
        const paraEl = startWord.closest('p') || passageCard;
        const paraWords = Array.from(paraEl.querySelectorAll('.dict-word')).filter(w => !isInteractiveBlank(w));
        const startPos = paraWords.indexOf(startWord);
        if (startPos === -1) {
            glideState = null;
            return;
        }

        glideState = {
            startX: clientX,
            startY: clientY,
            paraEl,
            paraWords,
            wordRects: null,
            startPos,
            lastPos: startPos,
            isGliding: false,
            mode: startWord.classList.contains('is-user-underlined') ? 'erase' : 'add',
            snapshot: paraWords.map(w => w.classList.contains('is-user-underlined'))
        };
    };

    const moveGlideCandidate = (clientX, clientY, ev) => {
        if (!glideState) {
            return;
        }
        const dx = clientX - glideState.startX;
        const dy = clientY - glideState.startY;

        if (!glideState.isGliding) {
            // 垂直滚动优先放行，绝不卡页面上下滑动
            if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx) * 1.15) {
                glideState = null;
                return;
            }
            // 水平笔触位移 >= 10px 立即进入实时自由选词画线/擦除状态
            if (Math.abs(dx) >= 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
                glideState.isGliding = true;
                glideState.wordRects = glideState.paraWords.map(w => ({ el: w, rect: w.getBoundingClientRect() }));
                window._suppressNextLookupClickUntil = Date.now() + 450;
                dismissGestureWhisperPill(true);
                if (typeof window.closeTopMenuHint === 'function') {
                    window.closeTopMenuHint(false);
                }
                const activePopover = document.getElementById('dict-popover');
                if (activePopover && activePopover.classList.contains('active')) {
                    activePopover.classList.remove('active');
                }
                const shouldUnderline = glideState.mode === 'add';
                if (glideState.paraWords[glideState.startPos]) {
                    glideState.paraWords[glideState.startPos].classList.toggle('is-user-underlined', shouldUnderline);
                    syncParagraphUnderlineSeparators(glideState.paraEl);
                }
                if (navigator && typeof navigator.vibrate === 'function') {
                    try { navigator.vibrate(8); } catch (e) {}
                }
            } else {
                return;
            }
        }

        if (ev && ev.cancelable) {
            try { ev.preventDefault(); } catch (err) {}
        }
        window._suppressNextLookupClickUntil = Date.now() + 450;

        const curWord = findWordNearPoint(passageCard, clientX, clientY, glideState.paraEl, glideState.wordRects);
        if (!curWord) return;
        const curPos = glideState.paraWords.indexOf(curWord);
        if (curPos === -1 || curPos === glideState.lastPos) return;
        glideState.lastPos = curPos;

        const minPos = Math.min(glideState.startPos, curPos);
        const maxPos = Math.max(glideState.startPos, curPos);
        const shouldUnderline = glideState.mode === 'add';

        glideState.paraWords.forEach((w, idx) => {
            const inRange = idx >= minPos && idx <= maxPos;
            const targetVal = inRange ? shouldUnderline : glideState.snapshot[idx];
            w.classList.toggle('is-user-underlined', targetVal);
        });

        syncParagraphUnderlineSeparators(glideState.paraEl);
    };

    const endGlideCandidate = () => {
        if (!glideState) return;
        if (glideState.isGliding) {
            const minPos = Math.min(glideState.startPos, glideState.lastPos);
            const maxPos = Math.max(glideState.startPos, glideState.lastPos);
            const shouldUnderline = glideState.mode === 'add';
            for (let i = minPos; i <= maxPos; i++) {
                if (glideState.paraWords[i]) {
                    glideState.paraWords[i].classList.toggle('is-user-underlined', shouldUnderline);
                }
            }
            syncParagraphUnderlineSeparators(glideState.paraEl);
            persistPassageUnderlines(passageCard);
            window._suppressNextLookupClickUntil = Date.now() + 380;
            if (window.FeedbackEngine && typeof window.FeedbackEngine.playTap === 'function') {
                window.FeedbackEngine.playTap();
            }
        }
        glideState = null;
    };

    passageCard.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            startGlideCandidate(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }
    }, { passive: true });

    passageCard.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length === 1) {
            moveGlideCandidate(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });

    passageCard.addEventListener('touchend', endGlideCandidate, { passive: true });
    passageCard.addEventListener('touchcancel', () => { glideState = null; }, { passive: true });

    passageCard.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            startGlideCandidate(e.clientX, e.clientY, e.target);
        }
    });
    passageCard.addEventListener('mousemove', (e) => {
        if (glideState && (e.buttons & 1)) {
            moveGlideCandidate(e.clientX, e.clientY, e);
        }
    });
    window.addEventListener('mouseup', () => {
        if (glideState) endGlideCandidate();
    });
}
window.initPassageUserUnderline = initPassageUserUnderline;



window.clearEvidenceHighlightInPassage = clearEvidenceHighlightInPassage;
window.highlightEvidenceInPassage = highlightEvidenceInPassage;
window.persistEliminatedOptions = persistEliminatedOptions;
