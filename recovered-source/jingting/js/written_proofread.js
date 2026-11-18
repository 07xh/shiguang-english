/* === js/written_proofread.js === */
function showProofreadToast() {
    const toast = document.getElementById('proofread-toast');
    if (toast) {
        clearTimeout(toast._timer);
        toast.style.display = 'none';
    }
}

function getProofreadCircNum(cid, idx) {
    const CIRC_NUMS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
    const ord = (idx !== undefined && idx >= 0) ? idx + 1 : parseInt(cid);
    return (ord >= 1 && ord < CIRC_NUMS.length) ? CIRC_NUMS[ord] : `[${cid}]`;
}

function cleanProofreadRawPassage(p) {
    if (!p || typeof p !== 'string') return '';
    // 将行尾带的 [76], (76), 76. ______ 等题号标注与纯换行连接为自然英语段落
    let text = p.replace(/\s*(?:\[\d+\]|\(\d+\)|\b\d+[\.、]\s*_{2,}|\b\d+\.\s*_{2,})\s*(\r?\n|$)/g, ' ');
    // 清除正文中可能残留的孤立 [76] 或 (76)
    text = text.replace(/\[\d+\]|\(\d+\)/g, '');
    return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
}

function computeProofreadSlices(passage, allProofread) {
    const sorted = [...allProofread].sort((a, b) => (parseInt(a.numId || a.id) || 0) - (parseInt(b.numId || b.id) || 0));
    let slices = [];
    let cursor = 0;

    sorted.forEach((item, idx) => {
        const cid = item.numId || parseInt(String(item.id).replace(/\D/g, '')) || 1;
        const ctype = item.corr_type || item.type || 'modify';
        const orig = item.original || '';
        const targ = item.target || '';
        const anal = item.analysis || '';
        const badge = getProofreadCircNum(cid, idx);

        if (ctype === 'add') {
            const mBetween = anal.match(/([a-zA-Z]+)\s*(?:与|和)\s*([a-zA-Z]+)\s*之间/);
            const mBefore = anal.match(/([a-zA-Z]+)\s*前/);
            const mAfter = anal.match(/([a-zA-Z]+)\s*后/);

            let insertPos = -1;
            if (mBetween) {
                const pat = new RegExp(`\\b${mBetween[1]}\\b\\s+\\b${mBetween[2]}\\b`, 'i');
                const sub = passage.slice(cursor);
                const m = sub.match(pat);
                if (m) insertPos = cursor + m.index + m[0].indexOf(' ') + 1;
            } else if (mBefore) {
                const pat = new RegExp(`\\b${mBefore[1]}\\b`, 'i');
                const sub = passage.slice(cursor);
                const m = sub.match(pat);
                if (m) insertPos = cursor + m.index;
            } else if (mAfter) {
                const pat = new RegExp(`\\b${mAfter[1]}\\b`, 'i');
                const sub = passage.slice(cursor);
                const m = sub.match(pat);
                if (m) insertPos = cursor + m.index + m[0].length;
            }
            if (insertPos === -1) insertPos = cursor;
            slices.push({ item, cid, ctype, start: insertPos, end: insertPos, orig: '', targ, badge });
            cursor = insertPos;
        } else if (ctype === 'delete' || ctype === 'modify') {
            const esc = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pat = new RegExp(`\\b${esc}\\b`, 'i');
            const sub = passage.slice(cursor);
            let m = sub.match(pat);
            let start, end;
            if (m) {
                start = cursor + m.index;
                end = start + m[0].length;
                cursor = end;
                slices.push({ item, cid, ctype, start, end, orig, targ, badge });
            }
        } else if (ctype === 'correct') {
            const rawSent = item.sentence || item.evidence || '';
            const sent = cleanProofreadRawPassage(rawSent).trim();
            if (sent) {
                const esc = sent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                const pat = new RegExp(esc, 'i');
                const sub = passage.slice(cursor);
                let m = sub.match(pat);
                if (m) {
                    const start = cursor + m.index;
                    const end = start + m[0].length;
                    cursor = end;
                    slices.push({ item, cid, ctype: 'correct', start, end, orig: '', targ: '', badge });
                }
            }
        }
    });
    return slices;
}

function generateAnnotatedPassageClient(rawPassage, allProofread) {
    const passage = cleanProofreadRawPassage(rawPassage);
    if (!passage) return '';
    const slices = computeProofreadSlices(passage, allProofread);

    let htmlSlices = [];
    slices.forEach(sl => {
        if (sl.ctype === 'add') {
            const snippet = `<ruby class="corr-item corr-add" data-id="${sl.cid}"><span class="corr-caret">∧</span><rt class="corr-sub">${makeTextClickable(sl.targ)}</rt></ruby><sup class="corr-badge" data-id="${sl.cid}">${sl.badge}</sup> `;
            htmlSlices.push({ start: sl.start, end: sl.end, snippet });
        } else if (sl.ctype === 'delete') {
            const matched = passage.slice(sl.start, sl.end);
            const snippet = `<span class="corr-item corr-del" data-id="${sl.cid}"><del>${makeTextClickable(matched)}</del></span><sup class="corr-badge" data-id="${sl.cid}">${sl.badge}</sup>`;
            htmlSlices.push({ start: sl.start, end: sl.end, snippet });
        } else if (sl.ctype === 'modify') {
            const matched = passage.slice(sl.start, sl.end);
            const snippet = `<ruby class="corr-item corr-mod" data-id="${sl.cid}"><span class="corr-orig">${makeTextClickable(matched)}</span><rt class="corr-sub">${makeTextClickable(sl.targ)}</rt></ruby><sup class="corr-badge" data-id="${sl.cid}">${sl.badge}</sup>`;
            htmlSlices.push({ start: sl.start, end: sl.end, snippet });
        } else if (sl.ctype === 'correct') {
            const matched = passage.slice(sl.start, sl.end);
            const snippet = `<span class="corr-item corr-correct" data-id="${sl.cid}"><span class="corr-correct-text">${makeTextClickable(matched)}</span><sup class="corr-badge corr-badge-cor" data-id="${sl.cid}" title="正确行（原句无错）">${sl.badge} √</sup></span>`;
            htmlSlices.push({ start: sl.start, end: sl.end, snippet });
        }
    });

    htmlSlices.sort((a, b) => a.start - b.start || a.end - b.end);
    let result = '';
    let lastIdx = 0;
    for (const sl of htmlSlices) {
        result += makeTextClickable(passage.slice(lastIdx, sl.start));
        result += sl.snippet;
        lastIdx = sl.end;
    }
    result += makeTextClickable(passage.slice(lastIdx));
    return result;
}

function getProofreadStats(userAns, slices) {
    const editKeys = Object.keys(userAns || {}).filter(k =>
        (k.startsWith('C') || k.startsWith('custom_') || k.startsWith('add_')) &&
        userAns[k] && !userAns[k]._deleted
    );
    const total = editKeys.length;
    let correct = 0;

    editKeys.forEach(k => {
        const item = userAns[k];
        if (!item || item._deleted) return;
        if (k.startsWith('add_')) {
            const pos = (item.pos !== undefined) ? item.pos : parseInt(k.replace('add_', ''));
            const matched = slices.find(s => s.ctype === 'add' && Math.abs(s.start - pos) <= 4);
            if (matched && (item.selected || '').trim().toLowerCase() === (matched.targ || '').trim().toLowerCase()) {
                correct++;
            }
        } else if (k.startsWith('custom_')) {
            const pos = parseInt(k.replace('custom_', ''));
            const matched = slices.find(s => (s.ctype === 'modify' || s.ctype === 'delete') && Math.abs(s.start - pos) <= 1);
            if (matched) {
                if (item.userType === 'delete' && matched.ctype === 'delete') correct++;
                else if (item.userType === 'modify' && matched.ctype === 'modify' && (item.selected || '').trim().toLowerCase() === (matched.targ || '').trim().toLowerCase()) correct++;
            }
        } else {
            const matched = slices.find(s => s.item.id === k || `C${s.cid}` === k);
            if (matched) {
                if (item.userType === 'delete' && matched.ctype === 'delete') correct++;
                else if (item.userType === 'modify' && matched.ctype === 'modify' && (item.selected || '').trim().toLowerCase() === (matched.targ || '').trim().toLowerCase()) correct++;
                else if (item.userType === 'add' && matched.ctype === 'add' && (item.selected || '').trim().toLowerCase() === (matched.targ || '').trim().toLowerCase()) correct++;
            }
        }
    });

    return {
        total,
        correct,
        wrong: Math.max(0, total - correct)
    };
}

function buildActivePracticePassageHtml(passage, slices, userAns) {
    const isExam = !!window.isExamMode;

    // 收集所有补词项（包含匹配到考点题目的补词与自定义位置补词）
    const userAdds = [];
    slices.filter(s => s.ctype === 'add').forEach(s => {
        const key = `C${s.cid}`;
        const rawAns = userAns[key] || userAns[s.item.id];
        const ans = (rawAns && !rawAns._deleted) ? rawAns : null;
        if (ans && ans.userType === 'add' && ans.selected) {
            const isCor = (ans.selected || '').trim().toLowerCase() === (s.targ || '').trim().toLowerCase();
            userAdds.push({
                pos: s.start,
                key: s.item.id || key,
                selected: ans.selected,
                isCorrect: isCor
            });
        }
    });
    Object.keys(userAns).forEach(k => {
        if (k.startsWith('add_') && userAns[k] && !userAns[k]._deleted && userAns[k].selected) {
            const pos = (userAns[k].pos !== undefined) ? userAns[k].pos : parseInt(k.replace('add_', ''));
            const matchedAdd = slices.find(s => s.ctype === 'add' && Math.abs(s.start - pos) <= 4);
            const isCor = !!(matchedAdd && (userAns[k].selected || '').trim().toLowerCase() === (matchedAdd.targ || '').trim().toLowerCase());
            userAdds.push({
                pos: pos,
                key: k,
                selected: userAns[k].selected,
                isCorrect: isCor
            });
        }
    });

    let parts = [];
    let cur = 0;
    const wordRegex = /([a-zA-Z]+(?:['’\-][a-zA-Z]+)*)/g;
    let m;

    while ((m = wordRegex.exec(passage)) !== null) {
        if (m.index > cur) {
            parts.push({ type: 'text', content: passage.slice(cur, m.index) });
        }
        const wStart = m.index;
        const wEnd = m.index + m[0].length;
        const wText = m[0];

        // 检查当前词前是否有补词 (pos 在上个词末与当前词首之间)
        const addsBefore = userAdds.filter(a => a.pos >= cur && a.pos <= wStart);
        addsBefore.forEach(a => {
            if (!parts.some(p => p.type === 'user-add' && p.key === a.key)) {
                parts.push({
                    type: 'user-add',
                    key: a.key,
                    selected: a.selected,
                    isCorrect: a.isCorrect
                });
            }
        });

        // 检查该词是否匹配到参考考点
        const matchedSlice = slices.find(s => s.start === wStart && s.end === wEnd);
        const editKey = matchedSlice ? (matchedSlice.item.id || `C${matchedSlice.cid}`) : `custom_${wStart}`;
        const rawUserEdit = userAns[editKey];
        const userEdit = (rawUserEdit && !rawUserEdit._deleted) ? rawUserEdit : null;

        if (userEdit) {
            if (userEdit.userType === 'delete' || userEdit.selected === '') {
                const isCor = !!(matchedSlice && matchedSlice.ctype === 'delete');
                parts.push({
                    type: 'user-del',
                    key: editKey,
                    orig: wText,
                    isCorrect: isCor
                });
            } else {
                const isCor = !!(matchedSlice && matchedSlice.ctype === 'modify' && (userEdit.selected || '').trim().toLowerCase() === (matchedSlice.targ || '').trim().toLowerCase());
                parts.push({
                    type: 'user-mod',
                    key: editKey,
                    orig: wText,
                    selected: userEdit.selected,
                    isCorrect: isCor
                });
            }
        } else {
            parts.push({
                type: 'word',
                start: wStart,
                end: wEnd,
                word: wText,
                slice: matchedSlice
            });
        }

        // 检查当前词后紧随的补词 (pos 在当前词末附近)
        const addsAfter = userAdds.filter(a => a.pos > wStart && a.pos <= wEnd + 2);
        addsAfter.forEach(a => {
            if (!parts.some(p => p.type === 'user-add' && p.key === a.key)) {
                parts.push({
                    type: 'user-add',
                    key: a.key,
                    selected: a.selected,
                    isCorrect: a.isCorrect
                });
            }
        });

        cur = wEnd;
    }

    if (cur < passage.length) {
        parts.push({ type: 'text', content: passage.slice(cur) });
    }

    // 检查短文末尾是否有遗漏的补词
    const remainingAdds = userAdds.filter(a => a.pos >= cur);
    remainingAdds.forEach(a => {
        if (!parts.some(p => p.type === 'user-add' && p.key === a.key)) {
            parts.push({
                type: 'user-add',
                key: a.key,
                selected: a.selected,
                isCorrect: a.isCorrect
            });
        }
    });

    const escProof = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let out = '';
    for (const p of parts) {
        if (p.type === 'text') {
            out += p.content.split('\n\n').map(para => para.split('\n').join('<br/>')).join('</p><p class="proofread-para">');
        } else if (p.type === 'word') {
            const errAttr = p.slice ? `data-error-id="${escProof(p.slice.item.id || `C${p.slice.cid}`)}"` : '';
            out += `<span class="proof-word dict-word" data-start="${p.start}" data-end="${p.end}" data-word="${escProof(p.word)}" ${errAttr}>${escProof(p.word)}</span>`;
        } else if (p.type === 'user-mod') {
            const safeKey = escProof(p.key);
            const safeOrig = escProof(p.orig);
            const safeSel = escProof(p.selected);
            if (isExam) {
                out += `<ruby class="proof-user-item proof-mod-word proof-exam-blue" data-edit-key="${safeKey}" data-orig="${safeOrig}" data-selected="${safeSel}"><span class="proof-orig-del">${safeOrig}</span><rt class="proof-sub-input">${safeSel}</rt></ruby>`;
            } else if (p.isCorrect) {
                out += `<ruby class="proof-user-item proof-mod-word proof-correct" data-edit-key="${safeKey}" data-orig="${safeOrig}" data-selected="${safeSel}"><span class="proof-orig-del">${safeOrig}</span><rt class="proof-sub-input">${safeSel} <span class="proof-sub-mark ok">✓</span></rt></ruby>`;
            } else {
                out += `<ruby class="proof-user-item proof-mod-word proof-wrong" data-edit-key="${safeKey}" data-orig="${safeOrig}" data-selected="${safeSel}"><span class="proof-orig-del">${safeOrig}</span><rt class="proof-sub-input">${safeSel} <span class="proof-sub-mark err">✕</span></rt></ruby>`;
            }
        } else if (p.type === 'user-del') {
            const safeKey = escProof(p.key);
            const safeOrig = escProof(p.orig);
            if (isExam) {
                out += `<span class="proof-user-item proof-del-word proof-exam-blue" data-edit-key="${safeKey}" data-orig="${safeOrig}"><del>${safeOrig}</del></span>`;
            } else if (p.isCorrect) {
                out += `<ruby class="proof-user-item proof-del-word proof-correct" data-edit-key="${safeKey}" data-orig="${safeOrig}"><del>${safeOrig}</del><rt class="proof-sub-input"><span class="proof-sub-mark ok">✓</span></rt></ruby>`;
            } else {
                out += `<ruby class="proof-user-item proof-del-word proof-wrong" data-edit-key="${safeKey}" data-orig="${safeOrig}"><del>${safeOrig}</del><rt class="proof-sub-input"><span class="proof-sub-mark err">✕</span></rt></ruby>`;
            }
        } else if (p.type === 'user-add') {
            const safeKey = escProof(p.key);
            const safeSel = escProof(p.selected);
            if (isExam) {
                out += `<ruby class="proof-user-item proof-add-word proof-exam-blue" data-edit-key="${safeKey}" data-selected="${safeSel}"><span class="proof-caret">∧</span><rt class="proof-sub-input">${safeSel}</rt></ruby> `;
            } else if (p.isCorrect) {
                out += `<ruby class="proof-user-item proof-add-word proof-correct" data-edit-key="${safeKey}" data-selected="${safeSel}"><span class="proof-caret">∧</span><rt class="proof-sub-input">${safeSel} <span class="proof-sub-mark ok">✓</span></rt></ruby> `;
            } else {
                out += `<ruby class="proof-user-item proof-add-word proof-wrong" data-edit-key="${safeKey}" data-selected="${safeSel}"><span class="proof-caret">∧</span><rt class="proof-sub-input">${safeSel} <span class="proof-sub-mark err">✕</span></rt></ruby> `;
            }
        }
    }
    return `<p class="proofread-para">${out}</p>`;
}

function dismissProofreadPopovers() {
    document.querySelectorAll('.word-action-popover').forEach(el => el.remove());
    document.querySelectorAll('.proof-word.proof-word-selected, .proof-user-item.selected').forEach(el => el.classList.remove('proof-word-selected', 'selected'));
}
window.dismissProofreadPopovers = dismissProofreadPopovers;

function bindProofreadWordInteractions(passageCard, passage, slices, allProofread, index) {
    if (!window._proofreadGlobalClickBound) {
        window._proofreadGlobalClickBound = true;
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.word-action-popover') && !e.target.closest('.proof-word') && !e.target.closest('.proof-user-item')) {
                dismissProofreadPopovers();
            }
        });
    }

    const showPopoverAt = (targetEl, htmlContent) => {
        dismissProofreadPopovers();

        targetEl.classList.add('proof-word-selected');
        const popover = document.createElement('div');
        popover.className = 'word-action-popover';
        popover.innerHTML = htmlContent;
        document.body.appendChild(popover);

        const rect = targetEl.getBoundingClientRect();
        let top;
        if (rect.top < 120) {
            popover.classList.add('popover-flip-below');
            top = rect.bottom + window.scrollY;
        } else {
            top = rect.top + window.scrollY - 10;
        }
        let left = rect.left + window.scrollX + (rect.width / 2);
        const minLeft = 140;
        const maxLeft = (window.innerWidth || 360) - 140;
        left = Math.max(minLeft, Math.min(maxLeft, left));
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
        return popover;
    };

    // 1. 点击文中普通单词
    passageCard.querySelectorAll('.proof-word').forEach(wordEl => {
        wordEl.addEventListener('click', (e) => {
            if (window.isLookupMode) return;
            e.stopPropagation();

            const wStart = parseInt(wordEl.dataset.start);
            const wEnd = parseInt(wordEl.dataset.end);
            const wText = wordEl.dataset.word;

            const popover = showPopoverAt(wordEl, `
                <div class="popover-main-view">
                    <div class="popover-word-title">单词: <strong>${wText}</strong></div>
                    <div class="popover-actions-row">
                        <button type="button" class="popover-btn btn-mod" data-action="modify">✏️ 修改此词</button>
                        <button type="button" class="popover-btn btn-del" data-action="delete">✂️ 划除多余词</button>
                        <button type="button" class="popover-btn btn-add" data-action="add-after">∧ 词后补词</button>
                    </div>
                </div>
                <div class="popover-input-view" style="display:none;"></div>
            `);

            const mainView = popover.querySelector('.popover-main-view');
            const inputView = popover.querySelector('.popover-input-view');

            // ✏️ 修改此词
            popover.querySelector('.btn-mod').addEventListener('click', (ev) => {
                ev.stopPropagation();
                mainView.style.display = 'none';
                inputView.style.display = 'block';
                inputView.innerHTML = `
                    <div class="popover-input-header">将 “<strong>${wText}</strong>” 修改为：</div>
                    <div class="popover-input-box">
                        <input type="text" class="popover-text-input" placeholder="输入修改后的单词..." autofocus />
                        <button type="button" class="popover-submit-btn">确定</button>
                        <button type="button" class="popover-cancel-btn">取消</button>
                    </div>
                `;
                const inp = inputView.querySelector('.popover-text-input');
                const btnSub = inputView.querySelector('.popover-submit-btn');
                const btnCancel = inputView.querySelector('.popover-cancel-btn');
                inp.focus();
                inp.addEventListener('focus', () => {
                    setTimeout(() => {
                        popover.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 220);
                });
                setTimeout(() => {
                    popover.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);

                const submitMod = () => {
                    const val = (inp.value || '').trim();
                    if (!val) return;
                    popover.remove();
                    const matchedSlice = slices.find(s => s.start === wStart && s.end === wEnd);
                    if (matchedSlice) {
                        const targetQ = matchedSlice.item;
                        const isCor = (matchedSlice.ctype === 'modify') && checkIsCorrect(val, targetQ.target);
                        selectWrittenOption(targetQ.id, val, targetQ.target, { userType: 'modify', isCorrect: isCor });
                    } else {
                        if (!window.isExamMode && window.FeedbackEngine) window.FeedbackEngine.playWrong();
                        if (!userWrittenAnswers[currentWrittenExamTitle]) userWrittenAnswers[currentWrittenExamTitle] = {};
                        const nowTs = Date.now();
                        const customKey = `custom_${wStart}`;
                        userWrittenAnswers[currentWrittenExamTitle][customKey] = {
                            selected: val,
                            orig: wText,
                            userType: 'modify',
                            isCorrect: false,
                            ts: nowTs
                        };
                        if (currentWrittenExamTitle) {
                            if (!window.completedExams[currentWrittenExamTitle]) window.completedExams[currentWrittenExamTitle] = {};
                            window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                            if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
                                window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                            }
                            Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
                            window.completedExams[currentWrittenExamTitle].writtenAnswers[customKey] = Object.assign({}, userWrittenAnswers[currentWrittenExamTitle][customKey]);
                            saveUserCloudData(currentWrittenExamTitle);
                        }
                    }
                    showProofreadToast(`✏️ 已修改：“${wText}” ➔ “${val}”`);
                    renderWrittenQuestion(index, { preserveScroll: true });
                };

                btnSub.addEventListener('click', submitMod);
                inp.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter') submitMod();
                    if (ke.key === 'Escape') popover.remove();
                });
                btnCancel.addEventListener('click', () => popover.remove());
            });

            // ✂️ 划除多余词
            popover.querySelector('.btn-del').addEventListener('click', (ev) => {
                ev.stopPropagation();
                popover.remove();
                const matchedSlice = slices.find(s => s.start === wStart && s.end === wEnd);
                if (matchedSlice) {
                    const targetQ = matchedSlice.item;
                    const isCor = (matchedSlice.ctype === 'delete');
                    selectWrittenOption(targetQ.id, '', targetQ.target, { userType: 'delete', isCorrect: isCor });
                } else {
                    if (!window.isExamMode && window.FeedbackEngine) window.FeedbackEngine.playWrong();
                    if (!userWrittenAnswers[currentWrittenExamTitle]) userWrittenAnswers[currentWrittenExamTitle] = {};
                    const nowTs = Date.now();
                    const customKey = `custom_${wStart}`;
                    userWrittenAnswers[currentWrittenExamTitle][customKey] = {
                        selected: '',
                        orig: wText,
                        userType: 'delete',
                        isCorrect: false,
                        ts: nowTs
                    };
                    if (currentWrittenExamTitle) {
                        if (!window.completedExams[currentWrittenExamTitle]) window.completedExams[currentWrittenExamTitle] = {};
                        window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                        if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
                            window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                        }
                        Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
                        window.completedExams[currentWrittenExamTitle].writtenAnswers[customKey] = Object.assign({}, userWrittenAnswers[currentWrittenExamTitle][customKey]);
                        saveUserCloudData(currentWrittenExamTitle);
                    }
                }
                showProofreadToast(`✂️ 已划除多余词 “${wText}”`);
                renderWrittenQuestion(index, { preserveScroll: true });
            });

            // ∧ 词后补词
            popover.querySelector('.btn-add').addEventListener('click', (ev) => {
                ev.stopPropagation();
                mainView.style.display = 'none';
                inputView.style.display = 'block';
                inputView.innerHTML = `
                    <div class="popover-input-header">在 “<strong>${wText}</strong>” 后补入单词：</div>
                    <div class="popover-input-box">
                        <input type="text" class="popover-text-input" placeholder="输入补入单词..." autofocus />
                        <button type="button" class="popover-submit-btn">确定</button>
                        <button type="button" class="popover-cancel-btn">取消</button>
                    </div>
                `;
                const inp = inputView.querySelector('.popover-text-input');
                const btnSub = inputView.querySelector('.popover-submit-btn');
                const btnCancel = inputView.querySelector('.popover-cancel-btn');
                inp.focus();
                inp.addEventListener('focus', () => {
                    setTimeout(() => {
                        popover.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 220);
                });
                setTimeout(() => {
                    popover.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);

                const submitAdd = () => {
                    const val = (inp.value || '').trim();
                    if (!val) return;
                    popover.remove();
                    const matchedAdd = slices.find(s => s.ctype === 'add' && Math.abs(s.start - wEnd) <= 2);
                    if (matchedAdd) {
                        const targetQ = matchedAdd.item;
                        const isCor = (matchedAdd.ctype === 'add') && checkIsCorrect(val, targetQ.target);
                        selectWrittenOption(targetQ.id, val, targetQ.target, { userType: 'add', pos: matchedAdd.start, isCorrect: isCor });
                    } else {
                        if (!window.isExamMode && window.FeedbackEngine) window.FeedbackEngine.playWrong();
                        if (!userWrittenAnswers[currentWrittenExamTitle]) userWrittenAnswers[currentWrittenExamTitle] = {};
                        const nowTs = Date.now();
                        const addKey = `add_${wEnd}`;
                        userWrittenAnswers[currentWrittenExamTitle][addKey] = {
                            selected: val,
                            userType: 'add',
                            pos: wEnd,
                            isCorrect: false,
                            ts: nowTs
                        };
                        if (currentWrittenExamTitle) {
                            if (!window.completedExams[currentWrittenExamTitle]) window.completedExams[currentWrittenExamTitle] = {};
                            window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                            if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
                                window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                            }
                            Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
                            window.completedExams[currentWrittenExamTitle].writtenAnswers[addKey] = Object.assign({}, userWrittenAnswers[currentWrittenExamTitle][addKey]);
                            saveUserCloudData(currentWrittenExamTitle);
                        }
                    }
                    showProofreadToast(`🎉 成功在此补入：“${val}”`);
                    renderWrittenQuestion(index, { preserveScroll: true });
                };

                btnSub.addEventListener('click', submitAdd);
                inp.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter') submitAdd();
                    if (ke.key === 'Escape') popover.remove();
                });
                btnCancel.addEventListener('click', () => popover.remove());
            });
        });
    });

    // 2. 点击已修改/已划除/已补词项 (允许撤回还原或再次编辑)
    passageCard.querySelectorAll('.proof-user-item').forEach(userEl => {
        userEl.addEventListener('click', (e) => {
            if (window.isLookupMode) return;
            e.stopPropagation();

            const editKey = userEl.dataset.editKey;
            const orig = userEl.dataset.orig || '';
            const selected = userEl.dataset.selected || '';

            let desc = '';
            if (userEl.classList.contains('proof-mod-word')) {
                desc = `“${orig}” ➔ “${selected}”`;
            } else if (userEl.classList.contains('proof-del-word')) {
                desc = `已划除 “${orig}”`;
            } else {
                desc = `已插入 “${selected}”`;
            }

            const popover = showPopoverAt(userEl, `
                <div class="popover-main-view">
                    <div class="popover-word-title">当前修改: <strong>${desc}</strong></div>
                    <div class="popover-actions-row">
                        <button type="button" class="popover-btn btn-revert" style="color:#ef4444; border-color:#fca5a5;">↺ 还原为原文</button>
                    </div>
                </div>
            `);

            popover.querySelector('.btn-revert').addEventListener('click', (ev) => {
                ev.stopPropagation();
                popover.remove();
                if (userWrittenAnswers[currentWrittenExamTitle] && userWrittenAnswers[currentWrittenExamTitle][editKey]) {
                    delete userWrittenAnswers[currentWrittenExamTitle][editKey];
                    if (currentWrittenExamTitle) {
                        const nowTs = Date.now();
                        if (!window.completedExams[currentWrittenExamTitle]) window.completedExams[currentWrittenExamTitle] = {};
                        window.completedExams[currentWrittenExamTitle].timestamp = nowTs;
                        if (!window.completedExams[currentWrittenExamTitle].writtenAnswers) {
                            window.completedExams[currentWrittenExamTitle].writtenAnswers = {};
                        }
                        Object.assign(window.completedExams[currentWrittenExamTitle].writtenAnswers, userWrittenAnswers[currentWrittenExamTitle]);
                        window.completedExams[currentWrittenExamTitle].writtenAnswers[editKey] = {
                            _deleted: true,
                            ts: nowTs
                        };
                        saveUserCloudData(currentWrittenExamTitle);
                    }
                    updateDashboardStats();
                    submitUserScore();
                }
                showProofreadToast('↺ 已撤销修改，恢复为原文');
                renderWrittenQuestion(index, { preserveScroll: true });
            });
        });
    });

    passageCard.querySelectorAll('.proof-mark-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            const prev = tag.previousElementSibling || tag.closest('.proof-user-item');
            if (prev && (prev.classList.contains('proof-user-item') || prev.closest('.proof-user-item'))) {
                const target = prev.classList.contains('proof-user-item') ? prev : prev.closest('.proof-user-item');
                target.click();
            }
        });
    });
}

function renderActiveProofreadPassage(passageCard, q, index) {
    const allProofread = (currentWrittenQuestions || []).filter(item => item.type === 'proofread');
    const cleanedPassage = cleanProofreadRawPassage(q.passage);
    const slices = computeProofreadSlices(cleanedPassage, allProofread);
    const userAns = userWrittenAnswers[currentWrittenExamTitle] || {};

    const activeHtml = buildActivePracticePassageHtml(cleanedPassage, slices, userAns);

    const isExam = !!window.isExamMode;
    passageCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:12.5px; font-weight:700; color:#0284c7; letter-spacing:0.02em;">
                📄 短文改错（点击文中单词即可修改）
            </div>
        </div>
        <div class="proofread-interactive-body">
            ${activeHtml}
        </div>
    `;

    bindProofreadWordInteractions(passageCard, cleanedPassage, slices, allProofread, index);
}

function renderRevealedProofreadPassage(passageCard, q, index) {
    const allProofread = (currentWrittenQuestions || []).filter(item => item.type === 'proofread');
    const annotatedHtml = generateAnnotatedPassageClient(q.passage, allProofread);

    const activeNumId = q.numId || parseInt(String(q.id).replace(/\D/g, '')) || 1;

    let streamCardsHtml = '';
    allProofread.forEach((item, idx) => {
        const itemNum = item.numId || parseInt(String(item.id).replace(/\D/g, '')) || 1;
        const circ = item.circ_num || getProofreadCircNum(itemNum, idx);
        const ctype = item.corr_type || 'modify';
        const typeClass = ctype === 'modify' ? 'mod' : (ctype === 'delete' ? 'del' : (ctype === 'correct' ? 'cor' : 'add'));
        const typeText = ctype === 'modify' ? '修改' : (ctype === 'delete' ? '删除' : (ctype === 'correct' ? '正确行' : '增加'));
        const diff = item.diff_display || (
            ctype === 'correct'
                ? '✔️ 原文正确（无需修改）'
                : (ctype === 'delete' 
                    ? `${item.original} ➔ ＼` 
                    : (ctype === 'add' 
                        ? `∧ ➔ ${item.target}` 
                        : `${item.original} ➔ ${item.target}`))
        );
        const isActive = (itemNum === activeNumId);

        streamCardsHtml += `
            <div class="proofread-stream-card ${isActive ? 'active-stream-card' : ''}" id="proofread-card-${itemNum}" data-num="${itemNum}">
                <div class="stream-card-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="stream-circ-tag">${circ}</span>
                        <span class="stream-diff-badge">${diff}</span>
                        <span class="stream-type-tag ${typeClass}">${typeText}</span>
                    </div>
                    <span style="font-size:12px; font-weight:700; color:#0284c7; background:#e0f2fe; padding:3px 10px; border-radius:8px;">🏷️ ${item.tag || '语法考点'}</span>
                </div>
                <div class="stream-card-body">
                    ${typeof formatInlineAnalysisMarkdown === 'function' ? formatInlineAnalysisMarkdown(item.analysis || '暂无详细学术解析。', true) : (item.analysis || '暂无详细学术解析。')}
                </div>
            </div>
        `;
    });

    passageCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="font-size:12px; font-weight:700; color:var(--accent-gold); text-transform:uppercase; letter-spacing:0.04em;">
                    🛠️ 短文改错 (点击单词可联动下方全题精析)
                </div>
                <span style="font-size:11.5px; font-weight:700; color:#10b981; background:#dcfce7; padding:2px 8px; border-radius:6px;">已呈现参考标准答案</span>
            </div>
        </div>
        <div class="proofread-manuscript-body">
            <p class="proofread-para">${annotatedHtml.split(/\n\n+/).join('</p><p class="proofread-para">')}</p>
        </div>
        <div class="proofread-analysis-section">
            <div class="proofread-analysis-header">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="proofread-analysis-title">🔍 全题 10 处考点逐题精析</span>
                    <span class="proofread-analysis-hint">点击卡片联动正文对应位置</span>
                </div>
            </div>
            <div class="proofread-stream-container">
                ${streamCardsHtml}
            </div>
        </div>
    `;

    // 绑定考点卡片点击事件
    passageCard.querySelectorAll('.proofread-stream-card').forEach(card => {
        card.addEventListener('click', () => {
            const itemNum = parseInt(card.dataset.num);
            if (itemNum) highlightProofreadItem(itemNum);
        });
    });

    const activeItemEl = passageCard.querySelector(`.corr-item[data-id="${activeNumId}"]`);
    if (activeItemEl) {
        activeItemEl.classList.add('corr-flash-focus');
    }

    passageCard.querySelectorAll('.corr-item, .corr-badge').forEach(el => {
        el.addEventListener('click', (e) => {
            if (window.isLookupMode) return;
            e.stopPropagation();
            const targetId = parseInt(el.dataset.id);
            if (targetId) {
                highlightProofreadItem(targetId);
            }
        });
    });
}

function highlightProofreadItem(itemNum) {
    if (!itemNum) return;

    // 1. 下方卡片激活与平滑滚动
    const passPaneEl = document.querySelector('.written-split-passage');
    document.querySelectorAll('.proofread-stream-card').forEach(c => {
        if (parseInt(c.dataset.num) === itemNum) {
            c.classList.add('active-stream-card');
            scrollElementIntoPane(c, passPaneEl);
        } else {
            c.classList.remove('active-stream-card');
        }
    });

    // 2. 上方文章对应单词动画闪烁
    document.querySelectorAll('.corr-item').forEach(el => {
        if (parseInt(el.dataset.id) === itemNum) {
            el.classList.add('corr-flash-focus');
            setTimeout(() => el.classList.remove('corr-flash-focus'), 1600);
        } else {
            el.classList.remove('corr-flash-focus');
        }
    });
}
window.highlightProofreadItem = highlightProofreadItem;
