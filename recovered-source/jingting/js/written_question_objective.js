/* === js/written_question_objective.js === */
// ==========================================================================
// Written Objective, Proofread & Fill-in Question Renderers (js/written_question_objective.js)
// ==========================================================================
function renderWrittenObjectiveQuestion(ctx) {
    const {
        index, q, isExam, canUseB, ansRecord, isAnswered,
        writtenStageCard, passPane, passageCard, optionsWrapper,
        explanationCard, showWrittenExplanation
    } = ctx;
    if (!optionsWrapper) return false;
        if (q.type === 'proofread') {
            const proofreadKey = 'proofread_' + currentWrittenExamTitle;
            const canPracticeNow = (!window.ToyPermissions || typeof window.ToyPermissions.canUsePracticeMode !== 'function' || window.ToyPermissions.canUsePracticeMode());
            const isRevealed = canPracticeNow && ((revealedModelKeys[proofreadKey] !== undefined)
                ? !!revealedModelKeys[proofreadKey]
                : false);

            const allProofread = currentWrittenQuestions.filter(item => item.type === 'proofread');
            const cleanedPassageForStats = cleanProofreadRawPassage(q.passage);
            const slicesForStats = computeProofreadSlices(cleanedPassageForStats, allProofread);
            const userAns = userWrittenAnswers[currentWrittenExamTitle] || {};
            const stats = getProofreadStats(userAns, slicesForStats);

            let badgeHtml = '';
            if (isRevealed) {
                badgeHtml = '✅ 参考批改与考点精析';
            } else {
                badgeHtml = `已修改 <b id="proofread-done-count">${stats.total}</b>/10 处`;
            }

            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';

            const compactBar = document.createElement('div');
            compactBar.className = `proofread-compact-bar ${isRevealed ? 'revealed' : ''}`;
            compactBar.innerHTML = `
                <div class="proofread-status-info">
                    <span class="proofread-status-title">${isRevealed ? '🛠️ 参考订正' : '📝 短文改错'}</span>
                    <span class="proofread-status-badge ${isRevealed ? 'success' : ''}">
                        ${badgeHtml}
                    </span>
                </div>
                <div class="proofread-bar-buttons">
                    ${!isRevealed ? '<button type="button" class="btn-proofread-clear" id="btn-proofread-clear">↺ 一键清空作答</button>' : ''}
                    <button type="button" class="btn-proofread-toggle" id="btn-proofread-toggle-mode">
                        ${isRevealed ? '返回自主改错作答' : '查看参考批改与全题解析'}
                    </button>
                </div>
            `;

            wrapper.appendChild(compactBar);

            if (!isRevealed) {
                const btnClear = compactBar.querySelector('#btn-proofread-clear');
                if (btnClear) {
                    btnClear.addEventListener('click', () => {
                        if (!userWrittenAnswers[currentWrittenExamTitle]) return;
                        const nowTs = Date.now();
                        const keysToDelete = Object.keys(userWrittenAnswers[currentWrittenExamTitle]).filter(k => k.startsWith('C') || k.startsWith('custom_') || k.startsWith('add_'));
                        if (currentWrittenExamTitle) {
                            if (!window.completedExams[currentWrittenExamTitle]) window.completedExams[currentWrittenExamTitle] = {};
                            if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
                                window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                            }
                            window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                        }
                        keysToDelete.forEach(k => {
                            delete userWrittenAnswers[currentWrittenExamTitle][k];
                            if (currentWrittenExamTitle) {
                                window.completedExams[currentWrittenExamTitle].writtenAnswers[k] = {
                                    _deleted: true,
                                    ts: nowTs
                                };
                            }
                        });
                        saveUserCloudData(currentWrittenExamTitle);
                        updateDashboardStats();
                        submitUserScore();
                        renderWrittenQuestion(index, { preserveScroll: true });
                    });
                }
            }

            const btnToggle = compactBar.querySelector('#btn-proofread-toggle-mode');
            if (btnToggle) {
                btnToggle.addEventListener('click', () => {
                    if (!isRevealed && window.ToyPermissions && typeof window.ToyPermissions.canUsePracticeMode === 'function' && !window.ToyPermissions.canUsePracticeMode()) {
                        window.ToyPermissions.showUnlockModal('practice_mode');
                        return;
                    }
                    revealedModelKeys[proofreadKey] = !isRevealed;
                    renderWrittenQuestion(index, { preserveScroll: true });
                });
            }

            optionsWrapper.appendChild(wrapper);

            if (explanationCard) {
                explanationCard.classList.remove('show');
            }
            if (writtenStageCard) writtenStageCard.classList.add('answered-state');

        } else if (q.type === 'fill_in') {
            const fillWrapper = document.createElement('div');
            fillWrapper.className = 'grammar-container';

            const curAns = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
            const inputVal = curAns ? curAns.selected : '';

            const allFillIn = (currentWrittenQuestions || []).filter(item => item.type === 'fill_in');
            const isLastBlank = (allFillIn.length > 0 && (allFillIn[allFillIn.length - 1].id === q.id || parseInt(allFillIn[allFillIn.length - 1].id) === parseInt(q.id)));
            const btnLabel = isLastBlank ? '完成 ✓' : '下一空 ➔';

            // 即时反馈文案 (随刷随解模式)
            const escGrammarHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            let feedbackHtml = '';
            if (curAns && !isExam) {
                feedbackHtml = curAns.isCorrect 
                    ? '<div class="grammar-feedback-msg correct">✅ 回答正确！</div>' 
                    : `<div class="grammar-feedback-msg wrong">❌ 标准答案: <strong>${escGrammarHtml(q.answer || q.word)}</strong></div>`;
            }

            fillWrapper.innerHTML = `
                <div class="grammar-ios-bar">
                    <span class="grammar-stem-text">Question ${q.id}.</span>
                    <input 
                        type="text" 
                        class="grammar-fill-input" 
                        id="grammar-input-${q.id}" 
                        placeholder="输入英文单词..." 
                        value=""
                        autocapitalize="none" 
                        autocomplete="off" 
                        autocorrect="off" 
                        spellcheck="false"
                    />
                    <button type="button" class="grammar-btn-next" id="btn-grammar-next-${q.id}">
                        ${btnLabel}
                    </button>
                </div>
                <div id="grammar-feedback-${q.id}" class="grammar-feedback-box" style="${feedbackHtml ? 'display:block;' : 'display:none;'}">
                    ${feedbackHtml}
                </div>
            `;
            optionsWrapper.appendChild(fillWrapper);

            const inputEl = fillWrapper.querySelector(`#grammar-input-${q.id}`);
            if (inputEl && inputVal) inputEl.value = inputVal;
            const btnNext = fillWrapper.querySelector(`#btn-grammar-next-${q.id}`);
            const feedbackEl = fillWrapper.querySelector(`#grammar-feedback-${q.id}`);

            // 移动端软键盘弹出防遮挡 (Auto-center on mobile keyboard show)
            inputEl.addEventListener('focus', () => {
                setTimeout(() => {
                    fillWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 220);
            });

            // 实时字符级动态回填 (Live Reflection)
            inputEl.addEventListener('input', () => {
                const val = (inputEl.value || '').trim();
                const reflected = passageCard ? passageCard.querySelector(`.fill-blank-reflected[data-blank-id="${q.id}"]`) : null;
                if (reflected) {
                    if (val) {
                        const badgeClass = isExam ? 'filled-exam active' : 'active';
                        reflected.className = `fill-blank-reflected ${badgeClass}`;
                        reflected.textContent = `[${q.id}. ${val}]`;
                    } else {
                        reflected.className = 'fill-blank-reflected unfilled active';
                        reflected.textContent = `[${q.id}]`;
                    }
                }
            });

            // 提交并自动流转至下一空 (Auto-advance on Enter / Click Next)
            const handleGrammarSubmitAndNext = () => {
                const val = (inputEl.value || '').trim();
                const targetAns = (q.answer || q.word || '').trim();

                if (val) {
                    const isRight = checkIsCorrect(val, targetAns);
                    selectWrittenOption(q.id, val, targetAns);

                    if (feedbackEl && !isExam) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.innerHTML = isRight 
                            ? '<div class="grammar-feedback-msg correct">✅ 回答正确！</div>' 
                            : `<div class="grammar-feedback-msg wrong">❌ 标准答案: <strong>${targetAns}</strong></div>`;
                    }

                    const reflected = passageCard ? passageCard.querySelector(`.fill-blank-reflected[data-blank-id="${q.id}"]`) : null;
                    if (reflected) {
                        const badgeClass = isExam ? 'filled-exam' : (isRight ? 'correct' : 'wrong');
                        const valText = isExam ? val : (isRight ? `${val} ✓` : `${val} ➔ ${targetAns}`);
                        reflected.className = `fill-blank-reflected ${badgeClass}`;
                        reflected.textContent = `[${q.id}. ${valText}]`;
                    }

                    if (explanationCard && !isExam) {
                        showWrittenExplanation(q);
                    }
                    if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                }

                // 自动跳下一空
                const nextFillInIdx = currentWrittenQuestions.findIndex((item, i) => i > index && item.type === 'fill_in');
                if (nextFillInIdx >= 0) {
                    renderWrittenQuestion(nextFillInIdx, { preserveScroll: true });
                    setTimeout(() => {
                        const nextQ = currentWrittenQuestions[nextFillInIdx];
                        const nextInp = document.getElementById(`grammar-input-${nextQ.id}`);
                        if (nextInp) {
                            nextInp.focus();
                            const nLen = (nextInp.value || '').length;
                            try { nextInp.setSelectionRange(nLen, nLen); } catch(e) {}
                        }
                        const nextBlankEl = document.querySelector(`.fill-blank-reflected[data-blank-id="${nextQ.id}"]`);
                        if (nextBlankEl) {
                            scrollElementIntoPane(nextBlankEl, passPane);
                        }
                    }, 80);
                } else {
                    // 已是最后一空
                    renderWrittenQuestion(index, { preserveScroll: true });
                }
            };

            btnNext.addEventListener('click', handleGrammarSubmitAndNext);
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGrammarSubmitAndNext();
                }
            });

            if (explanationCard && !isExam) {
                showWrittenExplanation(q);
                if (curAns && writtenStageCard) writtenStageCard.classList.add('answered-state');
            }

            // 确保当前空格平滑滚动可见
            setTimeout(() => {
                const curBlank = passageCard ? passageCard.querySelector(`.fill-blank-reflected[data-blank-id="${q.id}"]`) : null;
                if (curBlank) {
                    scrollElementIntoPane(curBlank, passPane);
                }
            }, 60);

        } else if (q.type === 'tfng' || q.type === 'true_false_not_given' || q.type === 'yes_no_not_given') {
            const isYNNG = (q.type === 'yes_no_not_given' || (q.answer && ['YES', 'NO'].includes(q.answer.toUpperCase())));
            const tfngOptions = isYNNG 
                ? [{ key: 'YES', label: 'YES' }, { key: 'NO', label: 'NO' }, { key: 'NOT GIVEN', label: 'NOT GIVEN' }]
                : [{ key: 'TRUE', label: 'TRUE' }, { key: 'FALSE', label: 'FALSE' }, { key: 'NOT GIVEN', label: 'NOT GIVEN' }];

            const grid = document.createElement('div');
            grid.className = 'tfng-grid';

            tfngOptions.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'tfng-btn';
                btn.textContent = opt.label;

                if (isExam) {
                    if (isAnswered && ansRecord.selected === opt.key) {
                        btn.classList.add('selected');
                    }
                } else {
                    if (isAnswered) {
                        if (opt.key === q.answer?.toUpperCase()) btn.classList.add('correct');
                        else if (opt.key === ansRecord.selected?.toUpperCase()) btn.classList.add('wrong');
                    }
                }

                btn.addEventListener('click', () => {
                    if (window.isLookupMode) return;
                    const isExamNow = !!window.isExamMode;
                    const prevRec = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
                    if (!isExamNow && prevRec && String(prevRec.selected || '').toUpperCase() === opt.key) return;
                    const allBtns = grid.querySelectorAll('.tfng-btn');
                    if (isExamNow) {
                        allBtns.forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    } else {
                        allBtns.forEach(b => {
                            b.classList.remove('correct', 'wrong');
                            if (b.textContent.trim().toUpperCase() === q.answer?.toUpperCase()) b.classList.add('correct');
                            else if (b.textContent.trim().toUpperCase() === opt.key) b.classList.add('wrong');
                        });
                        if (explanationCard) {
                            showWrittenExplanation(q);
                        }
                        if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                    }
                    selectWrittenOption(q.id, opt.key, q.answer);
                });

                grid.appendChild(btn);
            });
            optionsWrapper.appendChild(grid);

        } else if (q.type === 'sentence_insertion') {
            const insertWrapper = document.createElement('div');
            insertWrapper.style.cssText = 'display:flex; flex-direction:column; gap:14px; width:100%; margin-top:6px;';

            const insertSentenceText = q.insert_sentence || q.sentence || '';
            insertWrapper.innerHTML = `
                <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:14px; padding:16px 20px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                    <div style="font-size:12px; font-weight:700; color:#007aff; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em;">
                        📌 待插入句子 (Sentence to Insert)
                    </div>
                    <div style="font-size:15.5px; font-weight:600; color:#0f172a; line-height:1.65;">
                        "${makeTextClickable(insertSentenceText)}"
                    </div>
                </div>
                <div style="font-size:13px; font-weight:700; color:#64748b; margin-top:2px;">
                    请点击下方或短文中的黑方块 [ ■ A ~ D ] 选择最佳插入位置：
                </div>
                <div class="sentence-insertion-grid">
                    ${['A', 'B', 'C', 'D'].map(sq => `
                        <button class="sentence-insertion-opt-btn" data-square="${sq}">
                            <span style="font-size:14px;">■</span> 方块 ${sq}
                        </button>
                    `).join('')}
                </div>
            `;

            const allBtns = insertWrapper.querySelectorAll('.sentence-insertion-opt-btn');
            allBtns.forEach(btn => {
                const sq = btn.dataset.square;
                if (isExam) {
                    if (isAnswered && ansRecord.selected === sq) {
                        btn.classList.add('selected');
                    }
                } else {
                    if (isAnswered) {
                        if (sq === q.answer?.toUpperCase()) btn.classList.add('correct');
                        else if (sq === ansRecord.selected?.toUpperCase()) btn.classList.add('wrong');
                    }
                }

                btn.addEventListener('click', () => {
                    if (window.isLookupMode) return;
                    const isExamNow = !!window.isExamMode;
                    const prevRec = userWrittenAnswers[currentWrittenExamTitle]?.[q.id];
                    if (!isExamNow && prevRec && String(prevRec.selected || '').toUpperCase() === sq) return;
                    if (isExamNow) {
                        allBtns.forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    } else {
                        allBtns.forEach(b => {
                            b.classList.remove('correct', 'wrong');
                            if (b.dataset.square === q.answer?.toUpperCase()) b.classList.add('correct');
                            else if (b.dataset.square === sq) b.classList.add('wrong');
                        });
                        if (explanationCard) {
                            showWrittenExplanation(q);
                        }
                        if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                    }
                    selectWrittenOption(q.id, sq, q.answer);
                    renderWrittenQuestion(index, { preserveScroll: true });
                });
            });

            optionsWrapper.appendChild(insertWrapper);

        } else if (q.type === 'banked_cloze' || (q.type === 'cloze' && q.options && Object.keys(q.options).length > 7)) {
            const grid = document.createElement('div');
            grid.className = 'word-bank-options-grid';
            const elimStateKey = `wri::${currentWrittenExamTitle || 'default'}::${q.id}`;

            const usedElsewhereMap = {};
            const allExamAns = userWrittenAnswers[currentWrittenExamTitle] || {};
            (currentWrittenQuestions || []).forEach(sib => {
                if (!sib || sib.id === q.id) return;
                if (sib.type === q.type && sib.passage === q.passage) {
                    const sibRec = allExamAns[sib.id];
                    if (sibRec && !sibRec._deleted && sibRec.selected) {
                        const usedKey = sibRec.selected;
                        if (usedKey) {
                            if (!usedElsewhereMap[usedKey]) usedElsewhereMap[usedKey] = [];
                            usedElsewhereMap[usedKey].push(sib.id);
                        }
                    }
                }
            });

            Object.entries(q.options).forEach(([key, val]) => {
                const btn = document.createElement('div');
                btn.className = 'word-bank-opt-btn';

                if (isExam) {
                    if (isAnswered && ansRecord.selected === key) {
                        btn.classList.add('exam-selected-state');
                    }
                } else {
                    if (isAnswered) {
                        if (key === ansRecord.selected) btn.classList.add('opt-current-pick');
                        if (key === q.answer) btn.classList.add('correct-state');
                        else if (key === ansRecord.selected) btn.classList.add('wrong-state');
                    }
                }

                const usedIds = usedElsewhereMap[key];
                const hasUsedElsewhere = Array.isArray(usedIds) && usedIds.length > 0;
                const usedLabel = hasUsedElsewhere ? usedIds.map(id => `#${id}`).join(' ') : '';
                const usedTitle = hasUsedElsewhere ? `已在第 ${usedIds.join('、')} 空选过` : '';
                const isSelectedHere = isAnswered && ansRecord && ansRecord.selected === key;
                const hideBadgeNow = isSelectedHere || (!isExam && isAnswered && key === q.answer);
                if (hasUsedElsewhere && !hideBadgeNow && !btn.classList.contains('correct-state') && !btn.classList.contains('wrong-state')) {
                    btn.classList.add('opt-used-elsewhere');
                }

                btn.innerHTML = `
                    <span class="word-bank-opt-key">${key}.</span>
                    <span class="word-bank-opt-text">${makeTextClickable(val)}</span>
                    ${hasUsedElsewhere ? `<span class="opt-used-badge" data-used-blank="${usedIds[0]}" title="${usedTitle}" style="${hideBadgeNow ? 'display:none;' : ''}">${usedLabel}</span>` : ''}
                `;

                if (typeof window.bindOptionElimination === 'function') {
                    window.bindOptionElimination(btn, elimStateKey, key);
                }

                btn.addEventListener('click', () => {
                    if (window.isLookupMode) {
                        return;
                    }
                    const isExamNow = !!window.isExamMode;
                    // 随刷随解：作答后仍可随时改选其他选项（仅重复点击当前已选项时不重复判分）
                    if (!isExamNow && btn.classList.contains('opt-current-pick')) {
                        return;
                    }
                    const allBtns = grid.querySelectorAll('.word-bank-opt-btn');
                    if (isExamNow) {
                        allBtns.forEach(b => {
                            b.classList.remove('exam-selected-state');
                            const k = b.querySelector('.word-bank-opt-key')?.textContent?.replace('.', '').trim();
                            const hasUsed = !!(k && usedElsewhereMap[k] && usedElsewhereMap[k].length > 0);
                            b.classList.toggle('opt-used-elsewhere', hasUsed && k !== key);
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key) ? 'none' : '';
                        });
                        btn.classList.remove('opt-eliminated', 'opt-used-elsewhere');
                        btn.classList.add('exam-selected-state');
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key]);
                        }
                    } else {
                        allBtns.forEach(b => {
                            b.classList.remove('correct-state', 'wrong-state', 'opt-current-pick', 'opt-used-elsewhere');
                            const k = b.querySelector('.word-bank-opt-key')?.textContent?.replace('.', '').trim();
                            const hasUsed = !!(k && usedElsewhereMap[k] && usedElsewhereMap[k].length > 0);
                            if (k === q.answer || k === key) {
                                b.classList.remove('opt-eliminated');
                            }
                            if (k === q.answer) b.classList.add('correct-state');
                            else if (k === key) b.classList.add('wrong-state');
                            else if (hasUsed) b.classList.add('opt-used-elsewhere');
                            if (k === key) b.classList.add('opt-current-pick');
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key || k === q.answer) ? 'none' : '';
                        });
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key, q.answer]);
                        }
                        if (explanationCard) {
                            showWrittenExplanation(q);
                        }
                        if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                    }
                    selectWrittenOption(q.id, key, q.answer);
                    if (passageCard) {
                        const reflectedCloze = passageCard.querySelector(`.written-cloze-blank[data-blank-id="${q.id}"]`);
                        if (reflectedCloze) {
                            const rawWord = (q.options && q.options[key]) ? q.options[key] : key;
                            const wordVal = rawWord && rawWord !== key ? rawWord : key;
                            const isRight = (key === q.answer);
                            const badgeColor = isExamNow ? '#007AFF' : (isRight ? '#15803D' : '#DC2626');
                            const badgeBg = isExamNow ? 'rgba(0, 122, 255, 0.12)' : (isRight ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.13)');
                            const fillClass = isExamNow ? 'filled-exam' : (isRight ? 'filled-correct' : 'filled-wrong');
                            reflectedCloze.className = `written-cloze-blank active just-filled ${fillClass}`;
                            reflectedCloze.style.background = badgeBg;
                            reflectedCloze.style.color = badgeColor;
                            reflectedCloze.style.border = 'none';
                            reflectedCloze.style.boxShadow = 'none';
                            reflectedCloze.textContent = `${q.id}. ${wordVal}`;
                        }
                    }
                });

                grid.appendChild(btn);
            });
            optionsWrapper.appendChild(grid);

        } else if (q.type === 'matching') {
            const elimStateKey = `wri::${currentWrittenExamTitle || 'default'}::${q.id}`;
            const usedElsewhereMap = {};
            const allExamAns = userWrittenAnswers[currentWrittenExamTitle] || {};
            (currentWrittenQuestions || []).forEach(sib => {
                if (!sib || sib.id === q.id) return;
                if (sib.type === 'matching' && sib.section === q.section) {
                    const sibRec = allExamAns[sib.id];
                    if (sibRec && !sibRec._deleted && sibRec.selected) {
                        const usedKey = sibRec.selected;
                        if (usedKey) {
                            if (!usedElsewhereMap[usedKey]) usedElsewhereMap[usedKey] = [];
                            usedElsewhereMap[usedKey].push(sib.id);
                        }
                    }
                }
            });

            Object.entries(q.options).forEach(([key, val]) => {
                const btn = document.createElement('div');
                btn.className = 'opt-btn';

                if (isExam) {
                    if (isAnswered && ansRecord.selected === key) {
                        btn.classList.add('exam-selected-state');
                    }
                } else {
                    if (isAnswered) {
                        if (key === ansRecord.selected) btn.classList.add('opt-current-pick');
                        if (key === q.answer) btn.classList.add('correct-state');
                        else if (key === ansRecord.selected) btn.classList.add('wrong-state');
                    }
                }

                // 长篇段落匹配官方允许同一段落被多题重复选用，因此仅展示 #题号 轻提示，不加 .opt-used-elsewhere 删除线
                const usedIds = usedElsewhereMap[key];
                const hasUsedElsewhere = Array.isArray(usedIds) && usedIds.length > 0;
                const usedLabel = hasUsedElsewhere ? usedIds.map(id => `#${id}`).join(' ') : '';
                const usedTitle = hasUsedElsewhere ? `已在第 ${usedIds.join('、')} 题选过（长篇匹配允许重复选同一段）` : '';
                const isSelectedHere = isAnswered && ansRecord && ansRecord.selected === key;
                const hideBadgeNow = isSelectedHere || (!isExam && isAnswered && key === q.answer);

                const zhVal = (q.options_zh && q.options_zh[key]) ? q.options_zh[key] : '';
                const zhClass = (canUseB && window.showWrittenBilingual) ? 'opt-zh-text show' : 'opt-zh-text';

                btn.innerHTML = `
                    <span class="opt-key">${key}.</span>
                    <div class="opt-text-col">
                        <span class="opt-en-text">${makeTextClickable(val)}</span>
                        ${zhVal ? `<div class="${zhClass}">${zhVal}</div>` : ''}
                    </div>
                    ${hasUsedElsewhere ? `<span class="opt-used-badge" data-used-blank="${usedIds[0]}" title="${usedTitle}" style="${hideBadgeNow ? 'display:none;' : ''}">${usedLabel}</span>` : ''}
                `;

                if (typeof window.bindOptionElimination === 'function') {
                    window.bindOptionElimination(btn, elimStateKey, key);
                }

                btn.addEventListener('click', () => {
                    if (window.isLookupMode) {
                        return;
                    }
                    const isExamNow = !!window.isExamMode;
                    // 随刷随解：作答后仍可随时改选其他选项（仅重复点击当前已选项时不重复判分）
                    if (!isExamNow && btn.classList.contains('opt-current-pick')) {
                        return;
                    }
                    const allBtns = optionsWrapper.querySelectorAll('.opt-btn');
                    if (isExamNow) {
                        allBtns.forEach(b => {
                            b.classList.remove('exam-selected-state', 'opt-used-elsewhere');
                            const k = b.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key) ? 'none' : '';
                        });
                        btn.classList.remove('opt-eliminated');
                        btn.classList.add('exam-selected-state');
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key]);
                        }
                    } else {
                        allBtns.forEach(b => {
                            b.classList.remove('correct-state', 'wrong-state', 'opt-current-pick', 'opt-used-elsewhere');
                            const k = b.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                            if (k === q.answer || k === key) {
                                b.classList.remove('opt-eliminated');
                            }
                            if (k === q.answer) b.classList.add('correct-state');
                            else if (k === key) b.classList.add('wrong-state');
                            if (k === key) b.classList.add('opt-current-pick');
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key || k === q.answer) ? 'none' : '';
                        });
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key, q.answer]);
                        }
                        if (explanationCard) {
                            showWrittenExplanation(q);
                        }
                        if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                    }
                    selectWrittenOption(q.id, key, q.answer);
                });

                optionsWrapper.appendChild(btn);
            });

        } else if (q.type === 'careful' || q.type === 'seven_out_of_five' || q.type === 'cloze_choice' || (q.options && typeof q.options === 'object' && Object.keys(q.options).length > 0)) {
            const elimStateKey = `wri::${currentWrittenExamTitle || 'default'}::${q.id}`;
            const usedElsewhereMap = {};
            if (q.type === 'seven_out_of_five') {
                const allExamAns = userWrittenAnswers[currentWrittenExamTitle] || {};
                (currentWrittenQuestions || []).forEach(sib => {
                    if (!sib || sib.id === q.id) return;
                    if (sib.type === 'seven_out_of_five' && sib.passage === q.passage) {
                        const sibRec = allExamAns[sib.id];
                        if (sibRec && !sibRec._deleted && sibRec.selected) {
                            const usedKey = sibRec.selected;
                            if (usedKey) {
                                if (!usedElsewhereMap[usedKey]) usedElsewhereMap[usedKey] = [];
                                usedElsewhereMap[usedKey].push(sib.id);
                            }
                        }
                    }
                });
            }

            Object.entries(q.options).forEach(([key, val]) => {
                const btn = document.createElement('div');
                btn.className = 'opt-btn';

                if (isExam) {
                    if (isAnswered && ansRecord.selected === key) {
                        btn.classList.add('exam-selected-state');
                    }
                } else {
                    if (isAnswered) {
                        if (key === ansRecord.selected) btn.classList.add('opt-current-pick');
                        if (key === q.answer) btn.classList.add('correct-state');
                        else if (key === ansRecord.selected) btn.classList.add('wrong-state');
                    }
                }

                const usedIds = usedElsewhereMap[key];
                const hasUsedElsewhere = Array.isArray(usedIds) && usedIds.length > 0;
                const usedLabel = hasUsedElsewhere ? usedIds.map(id => `#${id}`).join(' ') : '';
                const usedTitle = hasUsedElsewhere ? `已在第 ${usedIds.join('、')} 空选过` : '';
                const isSelectedHere = isAnswered && ansRecord && ansRecord.selected === key;
                const hideBadgeNow = isSelectedHere || (!isExam && isAnswered && key === q.answer);
                if (hasUsedElsewhere && !hideBadgeNow && !btn.classList.contains('correct-state') && !btn.classList.contains('wrong-state')) {
                    btn.classList.add('opt-used-elsewhere');
                }

                const zhVal = (q.options_zh && q.options_zh[key]) ? q.options_zh[key] : '';
                const zhClass = (canUseB && window.showWrittenBilingual) ? 'opt-zh-text show' : 'opt-zh-text';

                btn.innerHTML = `
                    <span class="opt-key">${key}.</span>
                    <div class="opt-text-col">
                        <span class="opt-en-text">${makeTextClickable(val)}</span>
                        ${zhVal ? `<div class="${zhClass}">${zhVal}</div>` : ''}
                    </div>
                    ${hasUsedElsewhere ? `<span class="opt-used-badge" data-used-blank="${usedIds[0]}" title="${usedTitle}" style="${hideBadgeNow ? 'display:none;' : ''}">${usedLabel}</span>` : ''}
                `;

                if (typeof window.bindOptionElimination === 'function') {
                    window.bindOptionElimination(btn, elimStateKey, key);
                }

                btn.addEventListener('click', () => {
                    if (window.isLookupMode) {
                        return;
                    }
                    const isExamNow = !!window.isExamMode;
                    // 随刷随解：作答后仍可随时改选其他选项（仅重复点击当前已选项时不重复判分）
                    if (!isExamNow && btn.classList.contains('opt-current-pick')) {
                        return;
                    }
                    const allBtns = optionsWrapper.querySelectorAll('.opt-btn');
                    if (isExamNow) {
                        allBtns.forEach(b => {
                            b.classList.remove('exam-selected-state');
                            const k = b.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                            const hasUsed = !!(k && usedElsewhereMap[k] && usedElsewhereMap[k].length > 0);
                            b.classList.toggle('opt-used-elsewhere', hasUsed && k !== key);
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key) ? 'none' : '';
                        });
                        btn.classList.remove('opt-eliminated', 'opt-used-elsewhere');
                        btn.classList.add('exam-selected-state');
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key]);
                        }
                    } else {
                        allBtns.forEach(b => {
                            b.classList.remove('correct-state', 'wrong-state', 'opt-current-pick', 'opt-used-elsewhere');
                            const k = b.querySelector('.opt-key')?.textContent?.replace('.', '').trim();
                            const hasUsed = !!(k && usedElsewhereMap[k] && usedElsewhereMap[k].length > 0);
                            if (k === q.answer || k === key) {
                                b.classList.remove('opt-eliminated');
                            }
                            if (k === q.answer) b.classList.add('correct-state');
                            else if (k === key) b.classList.add('wrong-state');
                            else if (hasUsed) b.classList.add('opt-used-elsewhere');
                            if (k === key) b.classList.add('opt-current-pick');
                            const badgeEl = b.querySelector('.opt-used-badge');
                            if (badgeEl) badgeEl.style.display = (k === key || k === q.answer) ? 'none' : '';
                        });
                        if (typeof window.clearOptionEliminationForKeys === 'function') {
                            window.clearOptionEliminationForKeys(elimStateKey, [key, q.answer]);
                        }
                        if (explanationCard) {
                            showWrittenExplanation(q);
                        }
                        if (writtenStageCard) writtenStageCard.classList.add('answered-state');
                    }
                    selectWrittenOption(q.id, key, q.answer);
                    if (q.type === 'seven_out_of_five' && passageCard) {
                        const reflectedSeven = passageCard.querySelector(`.seven-blank-reflected[data-blank-id="${q.id}"]`);
                        if (reflectedSeven) {
                            const optText = (q.options && q.options[key]) ? q.options[key] : '';
                            const optDisplay = optText ? `<span>${makeTextClickable(optText)}</span>` : `<span>选项 ${key}</span>`;
                            const isRight = (key === q.answer);
                            const badgeClass = isExamNow ? 'filled active exam' : (isRight ? 'filled active correct' : 'filled active wrong');
                            const color = isExamNow ? '#0284c7' : (isRight ? 'var(--correct-green)' : 'var(--wrong-red)');
                            const bg = isExamNow ? '#f8fafc' : (isRight ? 'var(--correct-bg)' : 'var(--wrong-bg)');
                            const border = isExamNow ? '#0284c7' : (isRight ? 'var(--correct-green)' : 'var(--wrong-red)');
                            reflectedSeven.className = `seven-blank-reflected just-filled ${badgeClass}`;
                            reflectedSeven.style.background = bg;
                            reflectedSeven.style.borderColor = border;
                            reflectedSeven.style.borderWidth = '1.5px';
                            reflectedSeven.style.borderStyle = 'solid';
                            reflectedSeven.innerHTML = `<span style="color:${color}; font-weight:800; margin-right:8px;">[${q.id}. ${key}]</span>${optDisplay}`;
                        }
                    } else if ((q.type === 'cloze_choice' || q.type === 'cloze' || q.type === 'banked_cloze') && passageCard) {
                        const reflectedCloze = passageCard.querySelector(`.written-cloze-blank[data-blank-id="${q.id}"]`);
                        if (reflectedCloze) {
                            const rawWord = (q.options && q.options[key]) ? q.options[key] : key;
                            const wordVal = rawWord && rawWord !== key ? rawWord : key;
                            const isRight = (key === q.answer);
                            const badgeColor = isExamNow ? '#007AFF' : (isRight ? '#15803D' : '#DC2626');
                            const badgeBg = isExamNow ? 'rgba(0, 122, 255, 0.12)' : (isRight ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.13)');
                            const fillClass = isExamNow ? 'filled-exam' : (isRight ? 'filled-correct' : 'filled-wrong');
                            reflectedCloze.className = `written-cloze-blank active just-filled ${fillClass}`;
                            reflectedCloze.style.background = badgeBg;
                            reflectedCloze.style.color = badgeColor;
                            reflectedCloze.style.border = 'none';
                            reflectedCloze.style.boxShadow = 'none';
                            reflectedCloze.textContent = `${q.id}. ${wordVal}`;
                        }
                    }
                });

                optionsWrapper.appendChild(btn);
            });

        } else {
            return false;
        }
    return true;
}
window.renderWrittenObjectiveQuestion = renderWrittenObjectiveQuestion;
