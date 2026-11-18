/* === js/written_subjective.js === */
// ==========================================================================
// Written Subjective Formatting & Analysis Markdown Engine (js/written_subjective.js)
// ==========================================================================
function formatWritingInstructions(text) {
    if (!text || typeof text !== 'string') return '';
    // 过滤纯下划线占位行
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l && !/^_{3,}$/.test(l));
    let html = '';

    lines.forEach((line) => {
        // 1. Section Header / Leaked Paper Header / Standalone "Directions:"
        if (/^Directions\s*:?\s*$/i.test(line) ||
            /^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]]/i.test(line) ||
            /^第[一二三四1234]部分[^\n]*$/i.test(line) ||
            /^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[^\n]*(?:满分\s*\d+\s*分|共\d+小题|应用文写作|读后续写|短文写作|短文改错|语法填空|完形填空)/i.test(line) ||
            /^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[（\(]?(?:满分\s*\d+\s*分)?[）\)]?[：:\s]*$/i.test(line) ||
            /^[（\(]?满分\s*\d+\s*分[）\)]?[：:\s]*$/i.test(line) ||
            /^(?:应用文写作|读后续写)[（\(]?(?:满分\s*\d+\s*分)?[）\)]?[：:\s]*$/i.test(line)) {
            return;
        }
        line = line.replace(/^Directions\s*:\s*/i, '').trim();
        if (!line) return;

        // 2. Caution / Note (注意：, Note:, etc.)
        if (/^(?:注意[：:]?|Note[：:]?)/i.test(line)) {
            html += `<div class="writing-note-title">${makeTextClickable(line)}</div>`;
            return;
        }

        // 3. List item (1. ..., 1) ..., (1) ..., 1、...)
        const listPrefixMatch = line.match(/^((?:\(\d+\)|\d+[\.\)、]|\([a-zA-Z]\)|[a-zA-Z]\))\s*)(.*)$/);
        if (listPrefixMatch) {
            html += `<div class="writing-list-item"><span style="color:#007AFF; font-weight:700; margin-right:5px;">${listPrefixMatch[1].trim()}</span>${makeTextClickable(listPrefixMatch[2])}</div>`;
            return;
        }

        // 4. English story narrative paragraphs (e.g. story in Section B)
        if (/^[A-Za-z“"']/.test(line)) {
            html += `<p class="writing-en-para">${makeTextClickable(line)}</p>`;
            return;
        }

        // 5. Regular Chinese paragraph (prompts, requirements)
        html += `<p class="writing-zh-para">${makeTextClickable(line)}</p>`;
    });

    return html;
}

function parseWritingDirections(text, q) {
    if (!text || typeof text !== 'string') {
        return { instructionsHtml: '', answerSheetHtml: '' };
    }

    // 1. Continuation writing (Paragraph 1 & 2)
    const para1Match = text.match(/(?:^|\n)\s*(Paragraph\s*1:?[^\n]*)/i);
    const para2Match = text.match(/(?:^|\n)\s*(Paragraph\s*2:?[^\n]*)/i);
    if (para1Match && para2Match) {
        const splitIdx = text.indexOf(para1Match[0]);
        const instrText = text.substring(0, splitIdx).trim();
        const p1Text = para1Match[1].trim();
        const p2Text = para2Match[1].trim();

        const instructionsHtml = formatWritingInstructions(instrText);
        const answerSheetHtml = `
            <div class="writing-answer-sheet">
                <div class="sheet-header-badge"><div class="ios-subj-header-left"><span class="ios-subj-accent-bar"></span><span class="ios-subj-header-title">考场答题纸</span></div></div>
                <div class="sheet-continuation-block">
                    <div class="sheet-para-tag">第一段作答区 · PARAGRAPH 1</div>
                    <div class="sheet-starter-line">${makeTextClickable(p1Text)}</div>
                    <div class="sheet-ruled-lines">
                        <div class="sheet-ruled-line"></div>
                        <div class="sheet-ruled-line"></div>
                        <div class="sheet-ruled-line"></div>
                    </div>
                </div>
                <div class="sheet-continuation-block">
                    <div class="sheet-para-tag">第二段作答区 · PARAGRAPH 2</div>
                    <div class="sheet-starter-line">${makeTextClickable(p2Text)}</div>
                    <div class="sheet-ruled-lines">
                        <div class="sheet-ruled-line"></div>
                        <div class="sheet-ruled-line"></div>
                        <div class="sheet-ruled-line"></div>
                    </div>
                </div>
            </div>
        `;
        return { instructionsHtml, answerSheetHtml };
    }

    // 2. Letter / Email format (Dear ..., optionally preceded by Date e.g. June 8, 2008)
    const dearMatch = text.match(/(?:^|\n)\s*(?:([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s*\n+)?\s*(Dear[^\n,:]{1,50}[,:])/i);
    if (dearMatch) {
        const splitIdx = text.indexOf(dearMatch[0]);
        const instrText = text.substring(0, splitIdx).trim();
        const templateText = text.substring(splitIdx).trim();

        const dateStr = dearMatch[1] ? dearMatch[1].trim() : '';
        const salutation = dearMatch[2].trim();
        const afterSalutation = templateText.substring(templateText.indexOf(salutation) + salutation.length).trim();

        let signoffLines = [];
        let bodyLines = [];
        let closerLines = [];
        const rawLines = afterSalutation.split(/\n+/).map(l => l.trim()).filter(Boolean);

        // 优先从后往前识别签名落款（Yours, / Best regards, / Li Hua 等）
        let signoffStart = -1;
        for (let i = rawLines.length - 1; i >= 0; i--) {
            const line = rawLines[i];
            const isSignoffWord = /^(?:Yours\s*(?:sincerely|faithfully|truly)?|Best\s*(?:regards|wishes)?|With\s+best\s+wishes|Sincerely|Warm\s*regards|Regards|Cheers)[,:\s]*$/i.test(line);
            if (isSignoffWord) {
                signoffStart = i;
                break;
            }
        }

        const isCloserLine = (line) => {
            return /^(?:(?:I\s*(?:am\s*)?)?look(?:ing)?\s*forward\s*to\s*[^\n]+|Thank\s*you\s*[^\n]+|Wish(?:ing)?\s+you\s+[^\n]+|Hope\s+to\s+hear\s*[^\n]+)[,\.\!]?$/i.test(line);
        };

        if (signoffStart !== -1) {
            signoffLines = rawLines.slice(signoffStart).filter(l => !l.startsWith('_'));
            const beforeSignoff = rawLines.slice(0, signoffStart);
            beforeSignoff.forEach((line, idx) => {
                if (isCloserLine(line) || (idx === beforeSignoff.length - 1 && /结束语已为你写好|结尾已为你写好/.test(instrText))) {
                    closerLines.push(line);
                } else {
                    bodyLines.push(line);
                }
            });
        } else {
            let foundSignoff = false;
            for (let i = 0; i < rawLines.length; i++) {
                const line = rawLines[i];
                const isSignoff = /^(?:Yours|Best|Sincerely)/i.test(line);
                if (isSignoff) {
                    foundSignoff = true;
                    signoffLines.push(line);
                } else if (foundSignoff) {
                    if (!line.startsWith('_')) signoffLines.push(line);
                } else if (isCloserLine(line) || (i === rawLines.length - 1 && /结束语已为你写好|结尾已为你写好/.test(instrText))) {
                    closerLines.push(line);
                } else {
                    bodyLines.push(line);
                }
            }
        }

        let starterText = '';
        bodyLines.forEach(l => {
            const cleaned = l.replace(/_{3,}/g, '').trim();
            if (cleaned) {
                if (starterText) starterText += ' ' + cleaned;
                else starterText = cleaned;
            }
        });

        const instructionsHtml = formatWritingInstructions(instrText);
        const answerSheetHtml = `
            <div class="writing-answer-sheet">
                <div class="sheet-header-badge"><div class="ios-subj-header-left"><span class="ios-subj-accent-bar"></span><span class="ios-subj-header-title">考场答题纸</span></div></div>
                ${dateStr ? `<div style="text-align:right; font-size:14px; color:#1C1C1E; margin-bottom:4px; line-height:30px; border-bottom:1px solid rgba(60, 60, 67, 0.18);">${makeTextClickable(dateStr)}</div>` : ''}
                <div class="sheet-salutation">${makeTextClickable(salutation)}</div>
                ${starterText ? `<div class="sheet-starter-line">${makeTextClickable(starterText)}</div>` : ''}
                <div class="sheet-ruled-lines">
                    <div class="sheet-ruled-line">${!starterText ? '<span class="sheet-indent-hint"></span>' : ''}</div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                </div>
                ${closerLines.length > 0 ? closerLines.map(c => `<div class="sheet-closer-line">${makeTextClickable(c)}</div>`).join('') : ''}
                ${signoffLines.length > 0 ? `
                    <div class="sheet-signoff-box">
                        ${signoffLines.map(s => `<div class="sheet-signoff-line">${makeTextClickable(s)}</div>`).join('')}
                    </div>
                ` : `
                    <div class="sheet-ruled-line"></div>
                `}
            </div>
        `;
        return { instructionsHtml, answerSheetHtml };
    }

    // 3. Standalone Title (e.g. "Youth and Me" or "My Views on Filming Short Videos on Campus" followed by underscores)
    const titleWithUndMatch = text.match(/(?:^|\n)\s*([A-Za-z0-9\s:,'"-]{4,80})\s*\n+_{3,}/);
    if (titleWithUndMatch) {
        const splitIdx = text.indexOf(titleWithUndMatch[0]);
        const instrText = text.substring(0, splitIdx).trim();
        const essayTitle = titleWithUndMatch[1].trim();

        const instructionsHtml = formatWritingInstructions(instrText);
        const answerSheetHtml = `
            <div class="writing-answer-sheet">
                <div class="sheet-header-badge"><div class="ios-subj-header-left"><span class="ios-subj-accent-bar"></span><span class="ios-subj-header-title">考场答题纸</span></div></div>
                <div class="sheet-title">${makeTextClickable(essayTitle)}</div>
                <div class="sheet-ruled-lines">
                    <div class="sheet-ruled-line"><span class="sheet-indent-hint"></span></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                </div>
            </div>
        `;
        return { instructionsHtml, answerSheetHtml };
    }

    // 4. Default / General Writing (e.g. Kaoyan Part A & B / CET-4 / CET-6 prompt)
    const cleanText = text.replace(/_{3,}/g, '').trim();
    const instructionsHtml = formatWritingInstructions(cleanText);

    const essayLines = (q && typeof q.essay === 'string')
        ? q.essay.split(/\n+/).map(l => l.trim()).filter(Boolean)
        : [];
    const firstEssayLine = essayLines[0] || '';

    // 4a. Notice format (e.g. Kaoyan Part A Notice)
    if (/^Notice$/i.test(firstEssayLine) || /\bwrite\s+a\s+notice\b/i.test(cleanText)) {
        const tailLines = essayLines.slice(-2).filter(l =>
            /^(?:Li\s*Ming|Li\s*Hua|(?:The\s+)?Students?'?\s*Union|(?:The\s+)?Postgraduates?'?\s*Association|(?:The\s+)?Youth\s+Volunteer\s+Association|[A-Z][a-z]+\s+\d{1,2},?\s*\d{4})[,\.]?$/i.test(l)
        );
        const answerSheetHtml = `
            <div class="writing-answer-sheet">
                <div class="sheet-header-badge"><div class="ios-subj-header-left"><span class="ios-subj-accent-bar"></span><span class="ios-subj-header-title">考场答题纸</span></div></div>
                <div class="sheet-title">Notice</div>
                <div class="sheet-ruled-lines">
                    <div class="sheet-ruled-line"><span class="sheet-indent-hint"></span></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                </div>
                ${tailLines.length > 0 ? `
                    <div class="sheet-signoff-box">
                        ${tailLines.map(s => `<div class="sheet-signoff-line">${makeTextClickable(s)}</div>`).join('')}
                    </div>
                ` : `
                    <div class="sheet-ruled-line"></div>
                `}
            </div>
        `;
        return { instructionsHtml, answerSheetHtml };
    }

    // 4b. Letter / Email format inferred from prompt or model essay (e.g. Kaoyan Part A Email/Letter)
    if (/^Dear\s+[^\n,:]{1,50}[,:]/i.test(firstEssayLine) ||
        /\bwrite\s+an?\s+(?:email|letter|reply)\b/i.test(cleanText) ||
        /Use\s+[“"']?(?:Li\s*(?:Ming|Hua|Ping)|Zhang\s*Wei|Wang\s*Ming)[”"']?/i.test(cleanText)) {
        const salutation = /^Dear\s+[^\n,:]{1,50}[,:]/i.test(firstEssayLine) ? firstEssayLine : 'Dear Sir or Madam,';
        let signoffLines = essayLines.slice(-2).filter(l =>
            /^(?:Yours\s*(?:sincerely|faithfully|truly|cordially)?|Sincerely(?:\s+yours)?|Best\s*(?:regards|wishes)?|Li\s*(?:Ming|Hua|Ping)|Zhang\s*Wei|Wang\s*Ming)[,:\.]?$/i.test(l)
        );
        if (signoffLines.length === 0) {
            const defaultSigner = /Zhang\s*Wei/i.test(cleanText) ? 'Zhang Wei' : (/Wang\s*Ming/i.test(cleanText) ? 'Wang Ming' : (/Li\s*Hua/i.test(cleanText) ? 'Li Hua' : 'Li Ming'));
            signoffLines = ['Yours sincerely,', defaultSigner];
        }
        const answerSheetHtml = `
            <div class="writing-answer-sheet">
                <div class="sheet-header-badge"><div class="ios-subj-header-left"><span class="ios-subj-accent-bar"></span><span class="ios-subj-header-title">考场答题纸</span></div></div>
                <div class="sheet-salutation">${makeTextClickable(salutation)}</div>
                <div class="sheet-ruled-lines">
                    <div class="sheet-ruled-line"><span class="sheet-indent-hint"></span></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                    <div class="sheet-ruled-line"></div>
                </div>
                <div class="sheet-signoff-box">
                    ${signoffLines.map(s => `<div class="sheet-signoff-line">${makeTextClickable(s)}</div>`).join('')}
                </div>
            </div>
        `;
        return { instructionsHtml, answerSheetHtml };
    }

    // 4c. Standard Essay format (Kaoyan Part B / CET-4 / CET-6) — 无预设答题纸内容时不生成空白考场答题纸
    return { instructionsHtml, answerSheetHtml: '' };
}

function formatModelEssayHtml(text) {
    if (!text || typeof text !== 'string') return '';
    text = text
        .replace(/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]](?:[:：\s]*(?:中文翻译|译文|范文))?\s*/gi, '')
        .replace(/^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[：:\s]*(?:应用文写作|读后续写|应用文|续写|短文写作|写作)?[：:\s]*\n*/gi, '')
        .replace(/^(?:读后续写|应用文写作|应用文|续写)[：:\s]*\n*/gi, '');

    const rawLines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return '';

    const isEnSignoffLine = (line, idx, total) => {
        if (/^(?:Yours\s*(?:sincerely|faithfully|truly|cordially)?|Sincerely(?:\s+yours)?|Best\s*(?:regards|wishes)?|With\s+best\s+wishes|Warm\s*regards|Kind\s*regards|Regards|Cheers|Respectfully(?:\s+yours)?)[,:\s]*$/i.test(line)) {
            return true;
        }
        if (/^(?:Li\s*Ming|Li\s*Hua|Li\s*Ping|Zhang\s*Wei|Wang\s*Ming|(?:The\s+)?Students?'?\s*Union|(?:The\s+)?Postgraduates?'?\s*Association|(?:The\s+)?Youth\s+Volunteer\s+Association|University\s+Library|Campus\s+Volunteer\s+Center)[,\.]?$/i.test(line)) {
            return true;
        }
        if (idx === total - 1 && /^[A-Z][a-z]+\s+\d{1,2},?\s*\d{4}\.?$/.test(line)) {
            return true;
        }
        return false;
    };

    let signoffStart = -1;
    const tailStart = Math.max(1, rawLines.length - 3);
    for (let i = tailStart; i < rawLines.length; i++) {
        if (isEnSignoffLine(rawLines[i], i, rawLines.length)) {
            signoffStart = i;
            break;
        }
    }

    const endIdx = signoffStart !== -1 ? signoffStart : rawLines.length;
    const signoffLines = signoffStart !== -1 ? rawLines.slice(signoffStart) : [];
    const bodyLines = rawLines.slice(0, endIdx);
    let html = '';

    bodyLines.forEach((line, idx) => {
        // 过滤残留的标记行
        if (/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]]/i.test(line) ||
            /^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[：:\s]*(?:应用文写作|读后续写|短文写作|写作)?[：:\s]*$/i.test(line) ||
            /^(?:读后续写|应用文写作|续写)[：:\s]*$/i.test(line)) {
            return;
        }

        // Notice header at the very top
        if (idx === 0 && /^Notice$/i.test(line)) {
            html += `<div style="text-align:center; font-size:16.5px; font-weight:700; color:#1c1c1e; margin-bottom:10px; letter-spacing:0.02em;">${makeTextClickable(line)}</div>`;
            return;
        }

        // Date at the top (e.g. June 8, 2008 or October 20, 2019 right under Notice)
        if ((idx === 0 || idx === 1) && /^[A-Z][a-z]+\s+\d{1,2},?\s*\d{4}$/.test(line)) {
            html += `<div style="text-align:right; font-size:14.5px; color:#64748b; margin-bottom:8px;">${makeTextClickable(line)}</div>`;
            return;
        }

        // Salutation (Dear ..., To whom ..., Greetings ...)
        if (/^(?:Dear\s+[A-Za-z0-9\s/,'\.-]+[,:]|To\s+whom\s+it\s+may\s+concern[,:]|Greetings[,:])/i.test(line)) {
            html += `<p style="margin-bottom:12px; text-indent:0; font-weight:600; color:#1c1c1e;">${makeTextClickable(line)}</p>`;
            return;
        }

        // Continuation writing paragraph marker (Paragraph 1: ... / Paragraph 2: ...)
        const paraMatch = line.match(/^(Paragraph\s*[12][：:]?)\s*(.*)/i);
        if (paraMatch) {
            html += `<p style="margin-bottom:12px; text-indent:2em; line-height:1.8;"><strong style="color:#007AFF;">${paraMatch[1]}</strong> ${makeTextClickable(paraMatch[2])}</p>`;
            return;
        }

        html += `<p style="margin-bottom:12px; text-indent:2em; line-height:1.8;">${makeTextClickable(line)}</p>`;
    });

    if (signoffLines.length > 0) {
        html += `
            <div class="essay-signoff-box" style="margin-left:auto; width:fit-content; text-align:right; margin-top:14px; margin-bottom:6px; padding-right:8px;">
                ${signoffLines.map(s => `<div style="font-size:15.5px; font-weight:600; color:#1c1c1e; line-height:1.65;">${makeTextClickable(s)}</div>`).join('')}
            </div>
        `;
    }

    return html;
}

function formatModelEssayZhHtml(text) {
    if (!text || typeof text !== 'string') return '';
    // 彻底清洗开头残留的“第一节：”、“第二节：读后续写”等标记
    text = text
        .replace(/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]](?:[:：\s]*(?:中文翻译|译文|范文))?\s*/gi, '')
        .replace(/^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[：:\s]*(?:应用文写作|读后续写|应用文|续写|短文写作|写作)?[：:\s]*\n*/gi, '')
        .replace(/^(?:读后续写|应用文写作|应用文|续写)[：:\s]*\n*/gi, '');

    const rawLines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return '';

    const isZhSignoffLine = (line, idx, total) => {
        if (/^(?:您?(?:真诚|诚挚|真挚|忠实)的|你的朋友|祝好|此致|敬礼|谨上|致以[^\n]{1,10}|祝[^\n]{1,8}|李明|李华|李平|张伟|研究生会|学生会|青年志愿者协会)[，,！!。：:\s]*$/i.test(line)) {
            return true;
        }
        if (idx === total - 1 && /^\d{4}年\d{1,2}月\d{1,2}日$/.test(line)) {
            return true;
        }
        return false;
    };

    let signoffStart = -1;
    const tailStart = Math.max(1, rawLines.length - 3);
    for (let i = tailStart; i < rawLines.length; i++) {
        if (isZhSignoffLine(rawLines[i], i, rawLines.length)) {
            signoffStart = i;
            break;
        }
    }

    const endIdx = signoffStart !== -1 ? signoffStart : rawLines.length;
    const signoffLines = signoffStart !== -1 ? rawLines.slice(signoffStart) : [];
    const bodyLines = rawLines.slice(0, endIdx);
    let html = '';

    bodyLines.forEach((line, idx) => {
        // 过滤独立成行的“第一节：”、“第二节：读后续写”、“读后续写”及原始标签行
        if (/^[【\[](?:practical_writing|applied_writing|continuation_writing|section_[12ab])[】\]]/i.test(line) ||
            /^(?:第[一二两12]节|Section\s*[AB12]|Part\s*[AB12])[：:\s]*(?:应用文写作|读后续写|短文写作|写作)?[：:\s]*$/i.test(line) ||
            /^(?:读后续写|续写)[：:\s]*$/i.test(line)) {
            return;
        }

        // Notice header at top (通知)
        if (idx === 0 && /^通知$/.test(line)) {
            html += `<div style="text-align:center; font-size:15.5px; font-weight:700; color:#1c1c1e; margin-bottom:8px;">${line}</div>`;
            return;
        }

        // Date at top (e.g. 2008年6月8日)
        if ((idx === 0 || idx === 1) && /^\d{4}年\d{1,2}月\d{1,2}日$/.test(line)) {
            html += `<div style="text-align:right; font-size:13.5px; color:#64748b; margin-bottom:6px;">${line}</div>`;
            return;
        }

        // Chinese Salutation (如 尊敬的...：/ 亲爱的...：/ 大家好：)
        if (/^(?:尊敬的[^\n]+[：:]|亲爱的[^\n]+[：:]|各位[^\n]+[：:]|大家好[！!，,：:])/i.test(line)) {
            html += `<p style="margin-bottom:8px; text-indent:0; font-weight:600; color:#1c1c1e;">${line}</p>`;
            return;
        }

        // Chinese Paragraph 1/2 for continuation writing
        const paraMatch = line.match(/^(第[一二12]段[：:]?)\s*(.*)/);
        if (paraMatch) {
            html += `<p style="margin-bottom:10px; text-indent:2em; line-height:1.75;"><strong style="color:#007AFF;">${paraMatch[1]}</strong> ${paraMatch[2]}</p>`;
            return;
        }

        html += `<p style="margin-bottom:8px; text-indent:2em; line-height:1.75;">${line}</p>`;
    });

    if (signoffLines.length > 0) {
        html += `
            <div style="margin-left:auto; width:fit-content; text-align:right; margin-top:12px; margin-bottom:4px; padding-right:8px;">
                ${signoffLines.map(s => `<div style="font-size:14.5px; font-weight:600; color:#1c1c1e; line-height:1.65;">${s}</div>`).join('')}
            </div>
        `;
    }

    return html;
}

function scrollElementIntoPane(el, pane) {
    if (!el) return;
    const splitContainer = document.querySelector('.written-split-container');
    if (splitContainer && splitContainer.classList.contains('mobile-sheet-split-active')) {
        const quizPane = splitContainer.querySelector('.written-split-quiz');
        const sheetH = (window.UXReadingSplitSheet && window.UXReadingSplitSheet._targetHeightPx)
            ? window.UXReadingSplitSheet._targetHeightPx
            : (quizPane ? quizPane.offsetHeight : (window.innerHeight * 0.5));
        const visibleUpperH = Math.max(160, window.innerHeight - sheetH);
        const elRect = el.getBoundingClientRect();
        const targetViewportY = Math.max(78, visibleUpperH * 0.38);
        const targetWindowTop = Math.max(0, window.scrollY + elRect.top - targetViewportY);
        window.scrollTo({ top: targetWindowTop, behavior: 'smooth' });
        return;
    }
    if (pane && pane.scrollHeight > pane.clientHeight + 10) {
        const elRect = el.getBoundingClientRect();
        const paneRect = pane.getBoundingClientRect();
        const relTop = elRect.top - paneRect.top + pane.scrollTop;
        const targetTop = Math.max(0, relTop - (pane.clientHeight * 0.36));
        pane.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function hideBackToQuestionPill() {
    const pill = document.getElementById('btn-back-to-question');
    if (pill) pill.classList.remove('show');
}

function showBackToQuestionPill(targetQ) {
    let pill = document.getElementById('btn-back-to-question');
    if (!pill) {
        pill = document.createElement('button');
        pill.id = 'btn-back-to-question';
        pill.type = 'button';
        pill.className = 'back-to-question-pill';
        document.body.appendChild(pill);
        window.addEventListener('scroll', () => {
            if (!pill.classList.contains('show')) return;
            const quizPane = document.querySelector('#view-written-arena .written-split-quiz');
            if (quizPane) {
                const rect = quizPane.getBoundingClientRect();
                if (rect.bottom > window.innerHeight * 0.45) {
                    pill.classList.remove('show');
                }
            }
        }, { passive: true });
    }
    const qLabel = (targetQ && targetQ.id) ? `第 ${targetQ.id} 题` : '当前题目';
    pill.textContent = `↑ 返回${qLabel}解析`;
    pill.onclick = () => {
        pill.classList.remove('show');
        const expEl = document.getElementById('written-explanation-card');
        const stageEl = document.getElementById('written-stage-card');
        const dest = (expEl && expEl.classList.contains('show')) ? expEl : stageEl;
        if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    setTimeout(() => {
        pill.classList.add('show');
    }, 180);
}

function formatInlineAnalysisMarkdown(rawStr, withClickableWords = true) {
    if (!rawStr || typeof rawStr !== 'string') return '';
    let s = (withClickableWords && typeof makeTextClickable === 'function')
        ? makeTextClickable(rawStr)
        : rawStr;
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#0f172a; font-weight:700;">$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<span class="md-em-phrase" style="font-style:italic; font-weight:600; color:#0369a1; background:rgba(2, 132, 199, 0.07); padding:1px 5px; border-radius:5px;">$2</span>$3');
    s = s.replace(/\*\*/g, '');
    return s;
}
window.formatInlineAnalysisMarkdown = formatInlineAnalysisMarkdown;

function formatAnalysisRows(rawAnalysis) {
    if (!rawAnalysis || typeof rawAnalysis !== 'string') return '';
    let lines = rawAnalysis.split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (lines.length === 1 && /(?:；|;|\。)\s*[2-9][\.\、]/.test(lines[0])) {
        lines = lines[0].replace(/([；;。])\s*(?=[1-9][\.\、])/g, '$1\n').split(/\n+/).map(p => p.trim()).filter(Boolean);
    }
    // 过滤类似“【审题立意与篇章架构解析】”这种无正文的独立冗余标题行
    lines = lines.filter(line => !/^【[^】]+】[：:\s]*$/.test(line) && !/^(?:审题立意与篇章架构解析|审题构思与行文拆解|审题构思|考点解析)[：:\s]*$/.test(line));
    return lines.map(line => {
        const numMatch = line.match(/^(\d+)[\.\、]\s*(\*\*[^*\n]+\*\*[：:]?|[^：:]{2,26}[：:])?(.*)$/);
        if (numMatch) {
            const num = numMatch[1];
            const cleanLead = numMatch[2] ? numMatch[2].replace(/\*\*/g, '').replace(/\*/g, '').trim() : '';
            const leadTitle = cleanLead ? `<strong style="color:#0f172a; font-weight:700; margin-right:4px;">${formatInlineAnalysisMarkdown(cleanLead, true)}</strong>` : '';
            const rest = formatInlineAnalysisMarkdown(numMatch[3] || '', true);
            return `<div class="ios-subj-list-row"><span class="ios-subj-step-num">${num}</span><div style="flex:1;">${leadTitle}${rest}</div></div>`;
        }
        const subBulletMatch = line.match(/^[-•]\s*(\*\*[^*\n]+\*\*[：:]?|[^：:“”"'‘’，,。；;]{2,18}[：:])?(.*)$/);
        if (subBulletMatch) {
            const cleanSubLead = subBulletMatch[1] ? subBulletMatch[1].replace(/\*\*/g, '').replace(/\*/g, '').trim() : '';
            const subLead = cleanSubLead ? `<strong style="color:#0f172a; font-weight:700; margin-right:4px;">${formatInlineAnalysisMarkdown(cleanSubLead, true)}</strong>` : '';
            const subRest = formatInlineAnalysisMarkdown(subBulletMatch[2] || '', true);
            return `<div class="ios-subj-list-row ios-subj-list-subrow"><div style="flex:1;"><span style="color:#94A3B8; margin-right:6px;">•</span>${subLead}${subRest}</div></div>`;
        }
        const bracketMatch = line.match(/^【([^】]+)】[：:\s]*(.+)$/);
        if (bracketMatch) {
            const cleanBTitle = bracketMatch[1].replace(/\*\*/g, '').trim();
            const bRest = formatInlineAnalysisMarkdown(bracketMatch[2] || '', true);
            return `<div class="ios-subj-list-row"><div style="flex:1;"><strong style="color:#0f172a; font-weight:700; margin-right:4px;">${cleanBTitle}：</strong>${bRest}</div></div>`;
        }
        return `<div class="ios-subj-list-row"><div style="flex:1;">${formatInlineAnalysisMarkdown(line, true)}</div></div>`;
    }).join('');
}
window.formatAnalysisRows = formatAnalysisRows;

function formatObjectiveAnalysisHtml(rawAnalysis) {
    if (!rawAnalysis || typeof rawAnalysis !== 'string') return '暂无详细题目解析。';
    const text = rawAnalysis.trim();
    if (!text) return '暂无详细题目解析。';
    const parts = text
        .replace(/([。；;！!])\s*(?=(?:(?:[A-G]\s*[、,，]\s*)*[A-G]\s*选?项|选项\s*[A-G]|【[A-G]】))/g, '$1\n')
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean);
    const highlightOpt = (s) => formatInlineAnalysisMarkdown(
        s.replace(
            /((?:[A-G]\s*[、,，]\s*)*[A-G]\s*选?项|选项\s*[A-G](?:\s*[、,，]\s*[A-G])*|【[A-G]】)\s*/g,
            (match, tag, offset, fullStr) => {
                const rest = fullStr.slice(offset + match.length);
                const isPunctNext = !rest || /^[，。；;：:、！？!?,.\)）\]】]/.test(rest);
                return isPunctNext
                    ? `<span class="exp-opt-tag">${tag.trim()}</span>`
                    : `<span class="exp-opt-tag">${tag.trim()}</span> `;
            }
        ),
        false
    );
    if (parts.length <= 1) {
        return highlightOpt(text);
    }
    return parts.map(p => `<div class="exp-analysis-seg">${highlightOpt(p)}</div>`).join('');
}
window.formatObjectiveAnalysisHtml = formatObjectiveAnalysisHtml;


window.formatWritingInstructions = formatWritingInstructions;
window.parseWritingDirections = parseWritingDirections;
window.formatModelEssayHtml = formatModelEssayHtml;
window.formatModelEssayZhHtml = formatModelEssayZhHtml;
window.scrollElementIntoPane = scrollElementIntoPane;
window.hideBackToQuestionPill = hideBackToQuestionPill;
window.showBackToQuestionPill = showBackToQuestionPill;
