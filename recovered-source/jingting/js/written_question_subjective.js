/* === js/written_question_subjective.js === */
// ==========================================================================
// Written Translation, Essay & Explanation Card Renderers (js/written_question_subjective.js)
// ==========================================================================
function renderWrittenExplanationCard(targetQ, explanationCard) {
    if (!explanationCard) return;
    const expBodyP = document.getElementById('written-exp-body-p');
    const expEvidContainer = document.getElementById('written-exp-evidence-container');
    const expSynContainer = document.getElementById('written-exp-synonym-container');
        const expTitleEl = explanationCard.querySelector('.exp-title-lbl');
        if (expTitleEl) {
            if (targetQ.type === 'fill_in') {
                const promptHtml = targetQ.prompt ? `<span style="font-size:12px; font-weight:600; color:#475569; background:#f1f5f9; padding:2px 8px; border-radius:6px; margin-left:6px;">提示词: <strong>${targetQ.prompt}</strong></span>` : '';
                const ansVal = targetQ.answer || targetQ.word || '';
                const ansHtml = ansVal ? `<span style="font-size:12px; font-weight:700; color:#0369a1; background:#e0f2fe; padding:2px 8px; border-radius:6px; margin-left:6px;">标准答案: <strong>${ansVal}</strong></span>` : '';
                expTitleEl.innerHTML = `💡 Question ${targetQ.id} 语法考点精析 ${promptHtml} ${ansHtml}`;
            } else {
                expTitleEl.textContent = '💡 笔试考点精析与思路剖析';
            }
        }

        const curAnsRecord = userWrittenAnswers[currentWrittenExamTitle]?.[targetQ.id];
        let fillInStatusHtml = '';
        if (targetQ.type === 'fill_in' && curAnsRecord) {
            const isRight = curAnsRecord.isCorrect;
            fillInStatusHtml = isRight
                ? `<div style="display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-size:12px; font-weight:700; padding:4px 10px; border-radius:8px; margin-bottom:10px;"><span>✅ 你的作答: <strong>${curAnsRecord.selected}</strong> (回答正确)</span></div>`
                : `<div style="display:inline-flex; align-items:center; gap:6px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:12px; font-weight:700; padding:4px 10px; border-radius:8px; margin-bottom:10px;"><span>❌ 你的作答: <strong>${curAnsRecord.selected}</strong> ➔ 标准答案: <strong>${targetQ.answer || targetQ.word}</strong></span></div>`;
        }

        if (expBodyP) {
            expBodyP.innerHTML = (fillInStatusHtml ? fillInStatusHtml + '<div style="height:6px;"></div>' : '') + formatObjectiveAnalysisHtml(targetQ.analysis);
        }
        if (expEvidContainer) {
            if (targetQ.evidence_en) {
                expEvidContainer.innerHTML = `
                    <div class="exp-evidence-box" style="cursor:pointer;" title="点击可定位原文">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div class="exp-evidence-lbl">🎯 原文定位证据句</div>
                            <span style="font-size:11px; color:#0284c7; font-weight:700;">点击回看原文 ➔</span>
                        </div>
                        <div class="exp-evidence-en">${makeTextClickable(targetQ.evidence_en)}</div>
                        ${targetQ.evidence_zh ? `<div class="exp-evidence-zh">${targetQ.evidence_zh}</div>` : ''}
                    </div>
                `;
                const evidBox = expEvidContainer.querySelector('.exp-evidence-box');
                if (evidBox) {
                    evidBox.addEventListener('click', () => {
                        if (window.isLookupMode) return;
                        if (window.UXReadingSplitSheet && typeof window.UXReadingSplitSheet.ensureHalfForInteraction === 'function') {
                            window.UXReadingSplitSheet.ensureHalfForInteraction('evidence');
                        }
                        highlightEvidenceInPassage(targetQ, { forceScroll: true, pulse: true });
                    });
                }
            } else {
                expEvidContainer.innerHTML = '';
            }
        }
        if (expSynContainer) {
            if (targetQ.synonym_pairs && Array.isArray(targetQ.synonym_pairs) && targetQ.synonym_pairs.length > 0) {
                expSynContainer.innerHTML = `
                    <div class="exp-synonym-box" style="cursor:pointer;" title="点击可定位原文">
                        <div class="exp-synonym-lbl">🔄 核心同义替换词对</div>
                        ${targetQ.synonym_pairs.map(p => `
                            <div class="synonym-pair-item">
                                <div class="syn-line"><span class="syn-tag syn-tag-q">题干</span><span class="syn-text-q">${makeTextClickable(p.q || '')}</span></div>
                                <div class="syn-line"><span class="syn-tag syn-tag-orig">原文</span><span class="syn-text-orig">${makeTextClickable(p.orig || '')}</span></div>
                            </div>
                        `).join('')}
                    </div>
                `;
                const synBox = expSynContainer.querySelector('.exp-synonym-box');
                if (synBox) {
                    synBox.addEventListener('click', () => {
                        if (window.isLookupMode) return;
                        if (window.UXReadingSplitSheet && typeof window.UXReadingSplitSheet.ensureHalfForInteraction === 'function') {
                            window.UXReadingSplitSheet.ensureHalfForInteraction('evidence');
                        }
                        highlightEvidenceInPassage(targetQ, { forceScroll: true, pulse: true });
                    });
                }
            } else {
                expSynContainer.innerHTML = '';
            }
        }
        const wasShowingExp = explanationCard.classList.contains('show');
        explanationCard.classList.add('show');
        if (!wasShowingExp && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
            window.UXAutoAnimate.animateCardReveal(explanationCard);
        }
        if (explanationCard._highlightTimer) {
            clearTimeout(explanationCard._highlightTimer);
        }
        explanationCard._highlightTimer = setTimeout(() => {
            if (window.isExamMode || !Array.isArray(currentWrittenQuestions) || currentWrittenQuestions[currentWrittenQIndex] !== targetQ) return;
            highlightEvidenceInPassage(targetQ, { autoScrollSplit: true });
        }, 20);
}
window.renderWrittenExplanationCard = renderWrittenExplanationCard;

function renderWrittenSubjectiveQuestion(ctx) {
    const { index, q, isExam, optionsWrapper } = ctx;
    if (!optionsWrapper) return false;
        if (q.type === 'translation' || q.type === 'translation_en_zh') {
            const transKey = (q.type === 'translation_en_zh')
                ? ('trans_' + currentWrittenExamTitle + '_' + q.id)
                : ('trans_' + currentWrittenExamTitle);
            const globalTransKey = 'trans_' + currentWrittenExamTitle;
            const canPracticeNow = (!window.ToyPermissions || typeof window.ToyPermissions.canUsePracticeMode !== 'function' || window.ToyPermissions.canUsePracticeMode());
            const isRevealed = canPracticeNow && ((revealedModelKeys[transKey] !== undefined)
                ? !!revealedModelKeys[transKey]
                : (revealedModelKeys[globalTransKey] !== undefined ? !!revealedModelKeys[globalTransKey] : !isExam));

            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';

            // 1. Source Passage / Underlined Sentence Card (Clean White Card with Accent Header & Ruled Lines)
            if (q.prompt_zh || q.source_en) {
                const topStack = document.createElement('div');
                topStack.className = 'ios-subj-stack';
                const isEnToZh = (q.type === 'translation_en_zh');
                const enParas = isEnToZh ? (q.source_en || '').split(/\n+/).map(p => p.trim()).filter(Boolean) : [];
                const promptBodyHtml = isEnToZh
                    ? (enParas.length > 1
                        ? enParas.map(p => `<p style="margin-bottom:10px; text-indent:2em;">${makeTextClickable(p)}</p>`).join('')
                        : makeTextClickable(q.source_en || ''))
                    : q.prompt_zh;
                const headerLeft = isEnToZh ? (enParas.length > 1 || (q.source_en || '').length > 260 ? '待译段落' : `划线原句 (${q.id})`) : '待译原文';

                topStack.innerHTML = `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar"></span>
                                <span class="ios-subj-header-title">${headerLeft}</span>
                            </div>
                        </div>
                        <div class="ios-subj-card-body">
                            ${promptBodyHtml}
                        </div>
                    </div>
                `;
                wrapper.appendChild(topStack);
            }

            const btnBar = document.createElement('div');
            btnBar.style.cssText = 'display:flex; justify-content:center; margin:6px 0 16px 0;';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ios-subj-toggle-btn';
            toggleBtn.innerHTML = isRevealed ? '收起参考译文与解析 ↑' : '✨ 查看参考译文与解析';

            toggleBtn.addEventListener('click', () => {
                if (!isRevealed && window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
                    window.ToyPermissions.showUnlockModal('practice_mode');
                    return;
                }
                if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                    window.FeedbackEngine.triggerHaptic('selection');
                }
                window._animateNextSubjReveal = !isRevealed;
                revealedModelKeys[transKey] = !isRevealed;
                renderWrittenQuestion(index, { preserveScroll: true });
            });

            btnBar.appendChild(toggleBtn);
            wrapper.appendChild(btnBar);

            if (isRevealed) {
                const solStack = document.createElement('div');
                solStack.className = 'ios-subj-stack';
                solStack.style.marginBottom = '20px';

                const refText = q.reference || q.official_reference_zh || '';
                const refCardHtml = `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar emerald"></span>
                                <span class="ios-subj-header-title">参考译文</span>
                            </div>
                        </div>
                        <div class="ios-subj-card-body">
                            ${refText.split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p style="margin-bottom:8px; text-indent:0 !important;">${q.type === 'translation_en_zh' ? p : makeTextClickable(p)}</p>`).join('')}
                        </div>
                    </div>
                `;

                const analysisCardHtml = q.analysis ? `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar amber"></span>
                                <span class="ios-subj-header-title">考点解析</span>
                            </div>
                        </div>
                        <div class="ios-subj-list-container">
                            ${formatAnalysisRows(q.analysis)}
                        </div>
                    </div>
                ` : '';

                let vocabCardHtml = '';
                if (q.vocabulary && q.vocabulary.length > 0) {
                    vocabCardHtml = `
                        <div class="ios-subj-white-card">
                            <div class="ios-subj-card-header">
                                <div class="ios-subj-header-left">
                                    <span class="ios-subj-accent-bar indigo"></span>
                                    <span class="ios-subj-header-title">重点词汇</span>
                                </div>
                            </div>
                            <div class="ios-subj-vocab-container">
                                ${q.vocabulary.map(v => {
                                    const enWord = v.word || v.en || v.term || '';
                                    const zhMeaning = v.meaning || v.cn || v.zh || v.def || '';
                                    return `
                                        <div class="ios-subj-vocab-row">
                                            <span class="ios-subj-vocab-en">${makeTextClickable(enWord)}</span>
                                            <span class="ios-subj-vocab-zh">${zhMeaning}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                solStack.innerHTML = `
                    ${refCardHtml}
                    ${analysisCardHtml}
                    ${vocabCardHtml}
                `;
                wrapper.appendChild(solStack);
                if (window._animateNextSubjReveal && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
                    window._animateNextSubjReveal = false;
                    requestAnimationFrame(() => window.UXAutoAnimate.animateCardReveal(solStack));
                }
            }
            optionsWrapper.appendChild(wrapper);

        } else if (q.type === 'writing') {
            const writingKey = 'writing_' + currentWrittenExamTitle + '_' + q.id;
            const globalWritingKey = 'writing_' + currentWrittenExamTitle;
            const canPracticeNow = (!window.ToyPermissions || typeof window.ToyPermissions.canUsePracticeMode !== 'function' || window.ToyPermissions.canUsePracticeMode());
            const isRevealed = canPracticeNow && ((revealedModelKeys[writingKey] !== undefined)
                ? !!revealedModelKeys[writingKey]
                : (revealedModelKeys[globalWritingKey] !== undefined ? !!revealedModelKeys[globalWritingKey] : !isExam));

            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';

            // 1. Writing Directions & Embedded Cartoon/Chart + Answer Sheet (Direct White Cards without Gray Wrapper)
            if (q.directions || q.image_url) {
                const parsed = parseWritingDirections(q.directions || '', q);
                const topStack = document.createElement('div');
                topStack.className = 'ios-subj-stack';

                const ossBaseUrl = (window.EXAM_OSS_CONFIG && window.EXAM_OSS_CONFIG.baseUrl)
                    ? window.EXAM_OSS_CONFIG.baseUrl.replace(/\/$/, '')
                    : 'https://bilibilitoyassets.top';
                const isLocalHost = (typeof window !== 'undefined' && window.location && (
                    window.location.protocol === 'file:' ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'
                ));
                const cleanRelImg = (q.image_url || '').replace(/^\//, '');
                const remoteImgUrl = cleanRelImg.startsWith('http') ? cleanRelImg : `${ossBaseUrl}/${cleanRelImg}`;
                const remoteAltUrl = cleanRelImg.startsWith('http') ? cleanRelImg : `${ossBaseUrl}/${cleanRelImg.replace(/^input\//, '')}`;
                const primaryImgSrc = isLocalHost ? q.image_url : remoteImgUrl;

                const visualHtml = q.image_url ? `
                    <div class="writing-visual-container" style="padding:16px 18px; border-top:1px solid rgba(15, 23, 42, 0.08); text-align:center; background:#FFFFFF;">
                        <img src="${primaryImgSrc}" decoding="async" data-remote-src="${remoteImgUrl}" data-remote-alt="${remoteAltUrl}" data-local-src="${q.image_url}" alt="${q.subSection || 'Writing Part B Visual'}"
                             style="max-width:100%; height:auto; max-height:420px; border-radius:12px; display:block; margin:0 auto; cursor:zoom-in; background:#FFFFFF; border:1px solid rgba(15, 23, 42, 0.08);"
                             onclick="window.open(this.src, '_blank')"
                             onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.remoteSrc;}else if(this.dataset.retried==='1'){this.dataset.retried='2';this.src=this.dataset.remoteAlt;}else if(this.dataset.retried==='2'){this.dataset.retried='3';this.src=this.dataset.localSrc.replace(/^input\//,'assets/');}" />
                        ${q.image_description ? `
                            <div style="margin-top:12px; padding-top:10px; border-top:1px dashed rgba(15, 23, 42, 0.09); text-align:left; font-size:13.5px; line-height:1.68; color:#475569;">
                                <span class="ios-subj-inline-tag">图画/图表解读</span>${q.image_description}
                            </div>
                        ` : ''}
                    </div>
                ` : '';

                const cleanZhDirections = (q.directions_zh || '')
                    .replace(/^(?:审题译文|审题指南|审题要求|写作要求)[：:\s]*/g, '')
                    .replace(/^(?:审题译文|审题指南|审题要求|写作要求)[：:\s]*/g, '')
                    .trim();

                topStack.innerHTML = `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar"></span>
                                <span class="ios-subj-header-title">写作要求</span>
                            </div>
                        </div>
                        <div class="ios-subj-card-body">
                            ${parsed.instructionsHtml}
                        </div>
                        ${cleanZhDirections ? `
                            <div class="ios-subj-card-subbody">
                                <span class="ios-subj-inline-tag">审题译文</span>${cleanZhDirections}
                            </div>
                        ` : ''}
                        ${visualHtml}
                    </div>
                    ${parsed.answerSheetHtml}
                `;
                wrapper.appendChild(topStack);
            }

            const btnBar = document.createElement('div');
            btnBar.style.cssText = 'display:flex; justify-content:center; margin:6px 0 16px 0;';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ios-subj-toggle-btn';
            toggleBtn.innerHTML = isRevealed ? '收起参考范文与解析 ↑' : '✨ 查看参考范文与解析';

            toggleBtn.addEventListener('click', () => {
                if (!isRevealed && window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
                    window.ToyPermissions.showUnlockModal('practice_mode');
                    return;
                }
                if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                    window.FeedbackEngine.triggerHaptic('selection');
                }
                window._animateNextSubjReveal = !isRevealed;
                revealedModelKeys[writingKey] = !isRevealed;
                renderWrittenQuestion(index, { preserveScroll: true });
            });

            btnBar.appendChild(toggleBtn);
            wrapper.appendChild(btnBar);

            if (isRevealed) {
                const solStack = document.createElement('div');
                solStack.className = 'ios-subj-stack';
                solStack.style.marginBottom = '20px';

                const essayCardHtml = `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar emerald"></span>
                                <span class="ios-subj-header-title">高分参考范文</span>
                            </div>
                        </div>
                        <div class="ios-subj-card-body">
                            ${formatModelEssayHtml(q.essay || '')}
                        </div>
                        ${q.essay_zh ? `
                            <div class="ios-subj-essay-trans-divider">
                                <div class="ios-subj-sub-header">
                                    <span class="ios-subj-sub-badge">全文参考译文</span>
                                </div>
                                <div style="font-size:14.2px; line-height:1.76; color:#334155;">
                                    ${formatModelEssayZhHtml(q.essay_zh)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;

                const analysisCardHtml = q.analysis ? `
                    <div class="ios-subj-white-card">
                        <div class="ios-subj-card-header">
                            <div class="ios-subj-header-left">
                                <span class="ios-subj-accent-bar amber"></span>
                                <span class="ios-subj-header-title">审题构思与行文拆解</span>
                            </div>
                        </div>
                        <div class="ios-subj-list-container">
                            ${formatAnalysisRows(q.analysis)}
                        </div>
                    </div>
                ` : '';

                let vocabCardHtml = '';
                if (q.vocabulary && q.vocabulary.length > 0) {
                    vocabCardHtml = `
                        <div class="ios-subj-white-card">
                            <div class="ios-subj-card-header">
                                <div class="ios-subj-header-left">
                                    <span class="ios-subj-accent-bar indigo"></span>
                                    <span class="ios-subj-header-title">亮点词汇与闪光表达</span>
                                </div>
                            </div>
                            <div class="ios-subj-vocab-container">
                                ${q.vocabulary.map(v => {
                                    const enWord = v.word || v.en || v.term || '';
                                    const zhMeaning = v.meaning || v.cn || v.zh || v.def || '';
                                    return `
                                        <div class="ios-subj-vocab-row">
                                            <span class="ios-subj-vocab-en">${makeTextClickable(enWord)}</span>
                                            <span class="ios-subj-vocab-zh">${zhMeaning}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                solStack.innerHTML = `
                    ${essayCardHtml}
                    ${analysisCardHtml}
                    ${vocabCardHtml}
                `;
                wrapper.appendChild(solStack);
                if (window._animateNextSubjReveal && window.UXAutoAnimate && typeof window.UXAutoAnimate.animateCardReveal === 'function') {
                    window._animateNextSubjReveal = false;
                    requestAnimationFrame(() => window.UXAutoAnimate.animateCardReveal(solStack));
                }
            }
            optionsWrapper.appendChild(wrapper);
        } else {
            return false;
        }
    return true;
}
window.renderWrittenSubjectiveQuestion = renderWrittenSubjectiveQuestion;
