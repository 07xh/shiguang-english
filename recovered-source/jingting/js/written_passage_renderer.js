/* === js/written_passage_renderer.js === */
// ==========================================================================
// Written Reading Passage & Bilingual Translation Pane Renderer (js/written_passage_renderer.js)
// ==========================================================================
function renderWrittenPassagePane(ctx) {
    const { index, q, isExam, canUseB, passPane, passageCard, transCard } = ctx;
    const isFullPassageTrans = Boolean(
        q.type === 'translation_en_zh' &&
        q.passage &&
        q.source_en &&
        q.passage.trim() === q.source_en.trim()
    );

    if (passageCard) {
        if (!passageCard._interactiveBlankDelegateBound) {
            passageCard._interactiveBlankDelegateBound = true;
            passageCard.addEventListener('click', (e) => {
                const blankEl = e.target && e.target.closest
                    ? e.target.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected')
                    : null;
                if (blankEl) {
                    e.stopPropagation();
                    if (window.UXReadingSplitSheet && typeof window.UXReadingSplitSheet.ensureHalfForInteraction === 'function') {
                        window.UXReadingSplitSheet.ensureHalfForInteraction('blank');
                    }
                    const targetBlankId = parseInt(blankEl.dataset.blankId, 10);
                    if (!isNaN(targetBlankId)) {
                        const targetIdx = (currentWrittenQuestions || []).findIndex(item => item.id === targetBlankId || parseInt(item.id, 10) === targetBlankId);
                        if (targetIdx >= 0) {
                            renderWrittenQuestion(targetIdx, { preserveScroll: true });
                            setTimeout(() => {
                                const nextInput = document.getElementById(`grammar-input-${targetBlankId}`);
                                if (nextInput) {
                                    nextInput.focus();
                                    const nLen = (nextInput.value || '').length;
                                    try { nextInput.setSelectionRange(nLen, nLen); } catch (err) {}
                                }
                            }, 80);
                        }
                    }
                    return;
                }

                const sqEl = e.target && e.target.closest ? e.target.closest('.sentence-insert-square') : null;
                if (sqEl) {
                    e.stopPropagation();
                    const curIdx = (typeof currentWrittenQIndex === 'number') ? currentWrittenQIndex : 0;
                    const curQ = (currentWrittenQuestions || [])[curIdx];
                    if (curQ) {
                        const sq = sqEl.dataset.square;
                        selectWrittenOption(curQ.id, sq, curQ.answer);
                        renderWrittenQuestion(curIdx, { preserveScroll: true });
                    }
                    return;
                }

                const transBadgeEl = e.target && e.target.closest ? e.target.closest('.trans-marker-badge') : null;
                if (transBadgeEl) {
                    e.stopPropagation();
                    const targetId = parseInt(transBadgeEl.dataset.transId, 10);
                    if (!isNaN(targetId)) {
                        const targetIdx = (currentWrittenQuestions || []).findIndex(item => parseInt(item.id, 10) === targetId);
                        if (targetIdx >= 0) {
                            renderWrittenQuestion(targetIdx, { preserveScroll: true });
                        }
                    }
                }
            });
        }

        if (typeof clearEvidenceHighlightInPassage === 'function') {
            clearEvidenceHighlightInPassage(passageCard);
        }

        if (q.type === 'matching' || q.type === 'translation' || q.type === 'writing' || isFullPassageTrans || !q.passage || !q.passage.trim()) {
            passageCard.style.display = 'none';
            passageCard._renderedPassageKey = '';
        } else {
            passageCard.style.display = 'block';
            const currentPassageKey = `${currentWrittenExamTitle}::${q.type}::${q.sub_type === 'info_matching' ? q.id : ''}::${isExam}::${(q.passage || '').trim().slice(0, 64)}::${(q.passage || '').length}`;
            const canPatchClozeInPlace = (
                (q.type === 'cloze' || q.type === 'banked_cloze' || q.type === 'cloze_choice') &&
                passageCard._renderedPassageKey === currentPassageKey &&
                passageCard.querySelectorAll('.written-cloze-blank').length > 0
            );
            const canReuseCarefulInPlace = (
                q.type === 'careful' &&
                passageCard._renderedPassageKey === currentPassageKey &&
                passageCard.children.length > 0
            );

            if (canPatchClozeInPlace) {
                passageCard.querySelectorAll('.written-cloze-blank').forEach(el => {
                    const blankId = parseInt(el.dataset.blankId);
                    const filled = userWrittenAnswers[currentWrittenExamTitle]?.[blankId];
                    const isCurrentBlank = (blankId === q.id || blankId === parseInt(q.id));
                    const targetQ = currentWrittenQuestions.find(it => it.id === blankId || parseInt(it.id) === blankId) || q;
                    const rawWord = (filled && targetQ.options && targetQ.options[filled.selected]) ? targetQ.options[filled.selected] : (filled ? filled.selected : '');
                    const wordVal = filled ? (rawWord && rawWord !== filled.selected ? rawWord : filled.selected) : '';

                    if (filled) {
                        const isRight = filled.isCorrect;
                        const fillClass = isExam ? 'filled-exam' : (isRight ? 'filled-correct' : 'filled-wrong');
                        const badgeColor = isExam ? '#007AFF' : (isRight ? '#15803D' : '#DC2626');
                        const badgeBg = isExam ? 'rgba(0, 122, 255, 0.12)' : (isRight ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.13)');
                        el.className = `written-cloze-blank ${isCurrentBlank ? 'active ' : ''}${fillClass}`;
                        el.style.background = badgeBg;
                        el.style.color = badgeColor;
                        el.style.padding = '1px 9px';
                        el.style.fontSize = '13.5px';
                        el.textContent = `${blankId}. ${wordVal}`;
                    } else if (isCurrentBlank) {
                        el.className = 'written-cloze-blank active';
                        el.style.background = '#007AFF';
                        el.style.color = '#FFFFFF';
                        el.style.padding = '1px 10px';
                        el.style.fontSize = '13.5px';
                        el.textContent = `${blankId}`;
                    } else {
                        el.className = 'written-cloze-blank';
                        el.style.background = 'rgba(0, 122, 255, 0.09)';
                        el.style.color = '#007AFF';
                        el.style.padding = '1px 9px';
                        el.style.fontSize = '13px';
                        el.textContent = `${blankId}`;
                    }
                });
                const activeBlankEl = passageCard.querySelector('.written-cloze-blank.active');
                if (activeBlankEl) {
                    scrollElementIntoPane(activeBlankEl, passPane);
                }
            } else if (canReuseCarefulInPlace) {
                // 同一篇阅读理解切换小题（如 Q21 -> Q22）时直接复用已渲染 DOM，零重排、零闪烁
            } else if (q.type === 'proofread') {
                passageCard._renderedPassageKey = '';
                const proofreadKey = 'proofread_' + currentWrittenExamTitle;
                const canPracticeNow = (!window.ToyPermissions || typeof window.ToyPermissions.canUsePracticeMode !== 'function' || window.ToyPermissions.canUsePracticeMode());
                const isRevealed = canPracticeNow && ((revealedModelKeys[proofreadKey] !== undefined)
                    ? !!revealedModelKeys[proofreadKey]
                    : false);

                if (!isRevealed) {
                    renderActiveProofreadPassage(passageCard, q, index);
                } else {
                    renderRevealedProofreadPassage(passageCard, q, index);
                }
            } else if (q.type === 'cloze' || q.type === 'banked_cloze' || q.type === 'cloze_choice' || q.type === 'seven_out_of_five' || q.type === 'fill_in' || q.type === 'sentence_insertion') {
                passageCard._renderedPassageKey = currentPassageKey;
                let pText = q.passage || '';
                pText = makeTextClickable(pText);

                // 1. 七选五空格动态展开
                if (q.type === 'seven_out_of_five') {
                    pText = pText.replace(/(?:_{2,}\s*(\d+)\s*_{2,}|\[\s*(\d+)\s*\]|【\s*(\d+)\s*】|\(\s*(\d+)\s*\))/g, (match, b1, b2, b3, b4) => {
                        const blankId = parseInt(b1 || b2 || b3 || b4);
                        if (isNaN(blankId) || blankId < 31 || blankId > 50) return match;
                        const filled = userWrittenAnswers[currentWrittenExamTitle]?.[blankId];
                        const isCurrentBlank = (blankId === q.id || blankId === parseInt(q.id));
                        const targetQ = currentWrittenQuestions.find(it => it.id === blankId || parseInt(it.id) === blankId) || q;
                        const optText = (filled && targetQ.options && targetQ.options[filled.selected]) ? targetQ.options[filled.selected] : '';

                        if (filled) {
                            const optDisplay = optText ? `<span>${makeTextClickable(optText)}</span>` : `<span>选项 ${filled.selected}</span>`;
                            const isRight = filled.isCorrect;
                            const badgeClass = isExam ? 'filled exam' : (isRight ? 'filled correct' : 'filled wrong');
                            const color = isExam ? '#0284c7' : (isRight ? 'var(--correct-green)' : 'var(--wrong-red)');
                            const bg = isExam ? '#f8fafc' : (isRight ? 'var(--correct-bg)' : 'var(--wrong-bg)');
                            const border = isExam ? '#0284c7' : (isRight ? 'var(--correct-green)' : 'var(--wrong-red)');
                            return `<span class="seven-blank-reflected ${badgeClass} ${isCurrentBlank ? 'active' : ''}" data-blank-id="${blankId}" style="background:${bg}; border-color:${border};"><span style="color:${color}; font-weight:800; margin-right:8px;">[${blankId}. ${filled.selected}]</span>${optDisplay}</span>`;
                        } else {
                            return `<span class="seven-blank-reflected unfilled ${isCurrentBlank ? 'active' : ''}" data-blank-id="${blankId}"><span style="font-weight:700;">[ 📑 空格 ${blankId} · 点击此处作答 ]</span></span>`;
                        }
                    });
                } else if (q.type === 'fill_in') {
                    // 2. 语法填空空格动态回填
                    pText = pText.replace(/(?:_{2,}\s*(\d+)\s*_{2,}|\[\s*(\d+)\s*\]|【\s*(\d+)\s*】|\(\s*(\d+)\s*\))/g, (match, b1, b2, b3, b4) => {
                        const blankId = parseInt(b1 || b2 || b3 || b4);
                        const filled = userWrittenAnswers[currentWrittenExamTitle]?.[blankId];
                        const isCurrentBlank = (blankId === q.id || blankId === parseInt(q.id));
                        const targetQ = currentWrittenQuestions.find(it => it.id === blankId || parseInt(it.id) === blankId) || q;

                        if (filled) {
                            const isRight = filled.isCorrect;
                            const badgeClass = isExam ? 'filled-exam' : (isRight ? 'correct' : 'wrong');
                            const valText = isExam ? filled.selected : (isRight ? `${filled.selected} ✓` : `${filled.selected} ➔ ${targetQ.answer || targetQ.word || ''}`);
                            return `<span class="fill-blank-reflected ${badgeClass} ${isCurrentBlank ? 'active' : ''}" data-blank-id="${blankId}">[${blankId}. ${valText}]</span>`;
                        } else {
                            return `<span class="fill-blank-reflected unfilled ${isCurrentBlank ? 'active' : ''}" data-blank-id="${blankId}">[${blankId}]</span>`;
                        }
                    });
                } else if (q.type === 'sentence_insertion') {
                    // 3. 托福黑方块插句
                    pText = pText.replace(/(?:\[■\s*([A-D])\]|■\s*\[?([A-D])\]?|\[([A-D])\])/gi, (match, s1, s2, s3) => {
                        const sq = (s1 || s2 || s3).toUpperCase();
                        const filled = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
                        const isChosen = (filled && filled.selected === sq);
                        if (isChosen) {
                            const isRight = filled.isCorrect;
                            const cls = isExam ? 'exam' : (isRight ? 'correct' : 'wrong');
                            return `<span class="sentence-inserted-content ${cls}">【■ ${sq}】${makeTextClickable(q.insert_sentence || q.sentence || '')}</span>`;
                        }
                        return ` <span class="sentence-insert-square" data-square="${sq}">■ ${sq}</span> `;
                    });
                } else {
                    // 4. 完形填空 / 选词填空 (iOS 极简扁平胶囊风格，无括号、无双层发光边框)
                    pText = pText.replace(/(?:_{2,}\s*(\d+)\s*_{2,}|\[\s*(\d+)\s*\]|【\s*(\d+)\s*】|\(\s*(\d+)\s*\))/g, (match, b1, b2, b3, b4) => {
                        const blankId = parseInt(b1 || b2 || b3 || b4);
                        const filled = userWrittenAnswers[currentWrittenExamTitle]?.[blankId];
                        const isCurrentBlank = (blankId === q.id || blankId === parseInt(q.id));
                        const targetQ = currentWrittenQuestions.find(it => it.id === blankId || parseInt(it.id) === blankId) || q;
                        const rawWord = (filled && targetQ.options && targetQ.options[filled.selected]) ? targetQ.options[filled.selected] : (filled ? filled.selected : '');
                        const wordVal = filled ? (rawWord && rawWord !== filled.selected ? rawWord : filled.selected) : '';
                        let badgeHtml = '';

                        if (filled) {
                            const isRight = filled.isCorrect;
                            const fillClass = isExam ? 'filled-exam' : (isRight ? 'filled-correct' : 'filled-wrong');
                            const badgeColor = isExam ? '#007AFF' : (isRight ? '#15803D' : '#DC2626');
                            const badgeBg = isExam ? 'rgba(0, 122, 255, 0.12)' : (isRight ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.13)');
                            const activeClass = isCurrentBlank ? 'active' : '';
                            badgeHtml = `<span class="written-cloze-blank ${activeClass} ${fillClass}" data-blank-id="${blankId}" style="text-indent:0 !important; display:inline-block; vertical-align:baseline; text-align:center; padding:1px 9px; font-size:13.5px; background:${badgeBg}; color:${badgeColor}; border-radius:6px; border:none; box-shadow:none; font-weight:600; cursor:pointer;">${blankId}. ${wordVal}</span>`;
                        } else if (isCurrentBlank) {
                            badgeHtml = `<span class="written-cloze-blank active" data-blank-id="${blankId}" style="text-indent:0 !important; display:inline-block; vertical-align:baseline; text-align:center; padding:1px 10px; font-size:13.5px; background:#007AFF; color:#FFFFFF; border-radius:6px; border:none; box-shadow:none; font-weight:600; cursor:pointer;">${blankId}</span>`;
                        } else {
                            badgeHtml = `<span class="written-cloze-blank" data-blank-id="${blankId}" style="text-indent:0 !important; display:inline-block; vertical-align:baseline; text-align:center; padding:1px 9px; font-size:13px; background:rgba(0, 122, 255, 0.09); color:#007AFF; border-radius:6px; border:none; box-shadow:none; font-weight:600; cursor:pointer;">${blankId}</span>`;
                        }
                        return ` ${badgeHtml} `;
                    });
                }

                const dirsBannerHtml = (q.type === 'seven_out_of_five' && q.directions)
                    ? `<div style="font-size:13px; color:#3A3A3C; background:rgba(0,0,0,0.03); border-radius:10px; padding:10px 14px; margin-bottom:12px; line-height:1.6;"><strong style="color:#007AFF;">题型说明：</strong>${makeTextClickable(q.directions)}</div>`
                    : '';

                passageCard.innerHTML = `
                    ${dirsBannerHtml}
                    ${pText.split(/\n+/).map(p => p.trim()).filter(Boolean).map(para => `<p>${para}</p>`).join('')}
                `;

                if (q.type === 'seven_out_of_five' && q.sub_type === 'info_matching') {
                    const mEntity = (q.question_text || '').match(/【([^】]+)】/);
                    if (mEntity && mEntity[1]) {
                        const cleanEntity = mEntity[1].replace(/\s+(?:held|argued|believed|pointed\s+out|claimed|suggested|stated|noted)\s+that$/i, '').trim();
                        const tokens = cleanEntity.split(/\s+/).filter(Boolean);
                        const lastToken = tokens.length > 0 ? tokens[tokens.length - 1].toLowerCase() : '';
                        const paras = Array.from(passageCard.querySelectorAll('p'));
                        let matchedPara = paras.find(p => p.textContent.toLowerCase().includes(cleanEntity.toLowerCase()));
                        if (!matchedPara && lastToken && lastToken.length >= 3) {
                            matchedPara = paras.find(p => p.textContent.toLowerCase().includes(lastToken));
                        }
                        if (matchedPara) {
                            matchedPara.classList.add('active-info-match-para');
                            matchedPara.style.cssText = 'background:rgba(0, 122, 255, 0.06); border-left:3px solid #007AFF; padding:8px 12px; border-radius:8px; transition:background 0.2s ease;';
                        }
                    }
                }

                // 自动将当前题号对应的空格或匹配段落平滑滚动至左栏可视区域中心（不抖动外层窗口）
                setTimeout(() => {
                    const activeBlankEl = passageCard.querySelector(`.written-cloze-blank.active, .seven-blank-reflected.active, .fill-blank-reflected.active, .active-info-match-para`);
                    if (activeBlankEl) {
                        scrollElementIntoPane(activeBlankEl, passPane);
                    }
                }, 30);
            } else if (q.type === 'careful' || q.type === 'translation_en_zh') {
                passageCard._renderedPassageKey = (q.type === 'careful') ? currentPassageKey : '';
                let rawP = (q.passage || '');
                let renderedParas = rawP.split(/\n+/).map(p => p.trim()).filter(Boolean).map(para => {
                    let clicked = makeTextClickable(para);
                    if (q.type === 'translation_en_zh') {
                        clicked = clicked.replace(/\((\d{2})\)/g, (m, numStr) => {
                            const numId = parseInt(numStr, 10);
                            const isCurrent = (numId === parseInt(q.id, 10));
                            const bg = isCurrent ? '#007AFF' : 'rgba(0, 122, 255, 0.10)';
                            const fg = isCurrent ? '#FFFFFF' : '#007AFF';
                            const cls = isCurrent ? 'active-trans-marker trans-marker-badge' : 'trans-marker-badge';
                            return `<strong class="${cls}" data-trans-id="${numId}" style="color:${fg}; background:${bg}; padding:1px 8px; border-radius:6px; font-weight:600; cursor:pointer; margin-right:3px;">(${numId})</strong>`;
                        });
                    }
                    return `<p>${clicked}</p>`;
                }).join('');
                passageCard.innerHTML = `
                    ${renderedParas}
                `;
                if (q.type === 'translation_en_zh') {
                    setTimeout(() => {
                        const marked = q.source_en
                            ? highlightEvidenceInPassage({ id: '', evidence_en: q.source_en }, { autoScrollSplit: true })
                            : null;
                        if (!marked) {
                            const markerEl = passageCard.querySelector('.active-trans-marker');
                            if (markerEl) scrollElementIntoPane(markerEl, passPane);
                        }
                    }, 30);
                }
            }
            if (q.type !== 'proofread' && typeof window.initPassageUserUnderline === 'function') {
                window.initPassageUserUnderline(passageCard, `${currentWrittenExamTitle || 'default'}::${(q.passage || '').trim().slice(0, 48)}`);
            }
        }
    }

    if (transCard) {
        const canShowTrans = canUseB && !isFullPassageTrans && q.translation_zh && (q.type === 'cloze' || q.type === 'careful' || q.type === 'seven_out_of_five' || q.type === 'cloze_choice' || q.type === 'fill_in' || q.type === 'banked_cloze' || q.type === 'translation_en_zh');
        transCard.style.display = (window.showWrittenBilingual && canShowTrans) ? 'block' : 'none';
        if (canShowTrans) {
            transCard.innerHTML = `
                <div style="font-size:12.5px; font-weight:700; color:var(--accent-gold); margin-bottom:12px;">📜 全文参考译文</div>
                ${q.translation_zh.split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p style="font-size:14.5px; color:#3f3f46; line-height:1.76; margin-bottom:14px; text-indent:2em;">${p}</p>`).join('')}
            `;
        }
    }

    // 3.5 Determine if split container should be in single-column full-width mode (no reading passage)
    const splitContainer = document.querySelector('.written-split-container');
    const passageCol = document.querySelector('.written-split-passage');
    const hasPassage = !!(passageCard && passageCard.style.display !== 'none' && passageCard.innerHTML.trim().length > 0);
    const hasTrans = !!(transCard && transCard.style.display !== 'none' && transCard.innerHTML.trim().length > 0);
    const hasLeftContent = hasPassage || hasTrans;

    if (splitContainer) {
        splitContainer.classList.toggle('no-passage-mode', !hasLeftContent);
    }
    if (passageCol) {
        passageCol.style.display = hasLeftContent ? '' : 'none';
    }

    return { hasPassage, hasTrans, hasLeftContent };
}
window.renderWrittenPassagePane = renderWrittenPassagePane;
