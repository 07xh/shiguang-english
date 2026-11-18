/* === js/dict_virtual_keyboard.js === */
// ==========================================================================

// ⌨️ In-App 26-Key Virtual Keyboard Controller (js/dict_virtual_keyboard.js)

// ==========================================================================

// 1. 26键纯英输入键盘: 触感极佳、零抖动、全设备适配

// 2. 极致非侵入设计: 切句/进题默认轻量收拢，专注听读，点击挖空才平滑滑出

// 3. 智能答题闭环: 填对全部自动收起并引导下一句，无缝衔接

// ==========================================================================

function isTabletDevice() {
    const toyDevice = document.documentElement.getAttribute('data-toy-device') || window._toyDeviceType;
    if (toyDevice === 'tablet' || toyDevice === 'pad') return true;
    if (toyDevice === 'desktop' || toyDevice === 'pc' || toyDevice === 'phone' || toyDevice === 'mobile') return false;

    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    // iPadOS 13+ Safari reports Macintosh UA with multi-touch points
    const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
    if (isIPadOS || /iPad|Tablet|PlayBook|Silk/i.test(ua)) return true;

    // Android Tablet (has Android in UA, but not Mobile)
    if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;

    // Touch-first device with tablet-sized screen (short side >= 600px)
    const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const minSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    if (hasCoarsePointer && minSide >= 600) return true;

    return false;
}

window.isTabletDevice = isTabletDevice;

function isPCDesktopDevice() {

    // 1. 🥇 Toy JS SDK 官方容器状态判定 (B站 App 内)

    const toyDevice = document.documentElement.getAttribute('data-toy-device') || window._toyDeviceType;
    if (toyDevice === 'desktop' || toyDevice === 'pc') return true;
    if (toyDevice === 'phone' || toyDevice === 'mobile' || toyDevice === 'tablet' || toyDevice === 'pad') return false;

    // 2. 🥈 移动端与平板 User-Agent 强特征排除 (含 iPadOS 13+ 桌面级 Safari 伪装 Macintosh + 多点触控)

    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
    if (isIPadOS) return false;

    const isMobileOrTabletUA = /Android|webOS|iPhone|iPad|iPod|Tablet|PlayBook|Silk|BlackBerry|IEMobile|Opera Mini|Mobile|BiliApp|bili-universal/i.test(ua);
    if (isMobileOrTabletUA) return false;

    // 3. 🥉 现代浏览器 Client Hints API (navigator.userAgentData)

    if (navigator && navigator.userAgentData) {
        if (typeof navigator.userAgentData.mobile === 'boolean') {
            if (navigator.userAgentData.mobile) return false;
        }
    }

    // 4. 触屏主指针排除 (如果主输入设备是手指触控而非鼠标，则归为移动/平板触屏端)
    const isCoarsePrimary = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
    if (isCoarsePrimary) return false;

    // 5. 桌面操作系统 UA 强特征判定 (Windows NT, Macintosh, Linux x86_64, CrOS)

    const isDesktopOS = /Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(ua);
    if (isDesktopOS && !isMobileOrTabletUA) {
        return true;
    }

    // 6. 纯鼠标物理指针与屏幕尺寸兜底

    const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    return !!(hasFinePointer && hasHover && window.innerWidth >= 900);
}

window.isPCDesktopDevice = isPCDesktopDevice;

// In-app 26-Key QWERTY keyboard

// 移动端/触屏默认展开，方便即刻填词；纯PC桌面端有实体物理键盘，默认收拢

let dictKeyboardCollapsed = isPCDesktopDevice();
try {
    Object.defineProperty(window, 'dictKeyboardCollapsed', {
        get() { return dictKeyboardCollapsed; },
        set(v) { dictKeyboardCollapsed = v; },
        configurable: true
    });
} catch(e) {
    window.dictKeyboardCollapsed = dictKeyboardCollapsed;
}
let activeCustomKeyboardInput = null;
try {
    Object.defineProperty(window, 'activeCustomKeyboardInput', {
        get() { return activeCustomKeyboardInput; },
        set(v) { activeCustomKeyboardInput = v; },
        configurable: true
    });
} catch(e) {
    window.activeCustomKeyboardInput = activeCustomKeyboardInput;
}
let customKbBackspaceTimer = null;
let customKbBackspaceInterval = null;

// User preferred keyboard mode: 'custom' (自制26键虚拟键盘) | 'system' (手机自带输入法)

let dictKeyboardPreference = 'custom';
try {
    const saved = window.__toyLS.getItem('toy_dict_keyboard_mode');
    if (saved === 'system' || saved === 'custom') {

        dictKeyboardPreference = saved;
    }

} catch(e) {}

function getDictKeyboardPreference() {
    return dictKeyboardPreference;
}

window.getDictKeyboardPreference = getDictKeyboardPreference;
try {

    Object.defineProperty(window, 'dictKeyboardPreference', {

        get: () => dictKeyboardPreference,

        set: (v) => { dictKeyboardPreference = v; },

        configurable: true

    });
} catch(e) {}

function isCustomKeyboardEnabled() {
    return dictKeyboardPreference === 'custom';
}

window.isCustomKeyboardEnabled = isCustomKeyboardEnabled;

function getDictKeyboardMode() {
    return dictKeyboardPreference;
}

window.getDictKeyboardMode = getDictKeyboardMode;

function switchDictKeyboard(mode) {

    dictKeyboardPreference = (mode === 'system') ? 'system' : 'custom';
    try {

        window.__toyLS.setItem('toy_dict_keyboard_mode', dictKeyboardPreference);
    } catch(e) {}

    // Update all existing cloze inputs on screen

    document.querySelectorAll('#dict-cloze-card .cloze-input').forEach(inp => {
        if (dictKeyboardPreference === 'custom') {

            inp.setAttribute('inputmode', 'none');
        } else {

            inp.removeAttribute('inputmode');
        }

    });
    if (dictKeyboardPreference === 'system') {

        collapseCustomKeyboard();
        const active = getActiveOrFirstUnsolvedInput();
        if (active && !active.disabled) {

            setTimeout(() => {
                try {

                    active.removeAttribute('inputmode');
                    active.focus();
                    const len = (active.value || '').length;
                    active.setSelectionRange(len, len);
                    active._virtualCaretPos = len;
                } catch(e) {}

            }, 80);
        }

    } else {

        expandCustomKeyboard();

    }

    syncDictKeyboardPreferenceUI();
}

window.switchDictKeyboard = switchDictKeyboard;

function toggleDictKeyboardMode() {
    const nextMode = (dictKeyboardPreference === 'custom') ? 'system' : 'custom';

    switchDictKeyboard(nextMode);
}

window.toggleDictKeyboardMode = toggleDictKeyboardMode;

function syncDictKeyboardPreferenceUI() {
    const isPC = isPCDesktopDevice();
    const btnCanvasToggle = document.getElementById('btn-dict-canvas-kb-toggle');
    const popKbItem = document.getElementById('pop-item-dict-keyboard');
    const btnNavKb = document.getElementById('btn-dict-nav-keyboard');
    const navKbIcon = document.getElementById('dict-nav-kb-icon');
    const navKbText = document.getElementById('dict-nav-kb-text');

    // 1. Permanently hide cramped canvas header button as requested by user

    if (btnCanvasToggle) {

        btnCanvasToggle.style.display = 'none';

        btnCanvasToggle.style.setProperty('display', 'none', 'important');
    }

    // 2. Bottom Nav Keyboard Action Button - Permanently hidden (moved to 3-dots top settings)

    if (btnNavKb) {

        btnNavKb.style.display = 'none';

        btnNavKb.style.setProperty('display', 'none', 'important');
    }

    // 3. Popover Menu Item: Strictly ONLY shown in dictation-arena, NEVER in quiz or written-arena

    const currentView = window.activeView || '';
    if (popKbItem) {
        if (currentView === 'dictation-arena') {

            popKbItem.style.removeProperty('display');

            popKbItem.style.display = 'flex';
        } else {

            popKbItem.style.display = 'none';

            popKbItem.style.setProperty('display', 'none', 'important');
        }

    }

    const popText = document.getElementById('pop-text-dict-keyboard');
    const popIcon = document.getElementById('pop-icon-dict-keyboard');
    const isKbOpen = (!dictKeyboardCollapsed && dictKeyboardPreference === 'custom');
    if (popText) {

        popText.textContent = isKbOpen ? '收起键盘' : '展开键盘';
    }

    if (popIcon) {

        popIcon.textContent = '⌨️';
    }

}

window.syncDictKeyboardPreferenceUI = syncDictKeyboardPreferenceUI;

function scrollInputIntoSafeView(input) {
    if (!input) return;
    try {
        const kb = document.getElementById('dict-virtual-keyboard');
        const isKbOpen = (!dictKeyboardCollapsed && kb && kb.style.display !== 'none');
        const rect = input.getBoundingClientRect();
        const kbHeight = isKbOpen ? (kb.offsetHeight || 240) : 0;
        const visibleHeight = window.innerHeight - kbHeight;

        if (rect.bottom > (visibleHeight - 20) || rect.top < 70) {
            const targetY = Math.max(80, visibleHeight * 0.35);
            const scrollDelta = rect.top - targetY;

            window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
        }

    } catch(e) {}

}

window.scrollInputIntoSafeView = scrollInputIntoSafeView;

/**

 * Set active input.

 * fromUserGesture: true when user actively clicked/tapped a blank or when entering on mobile.

 */

function setActiveInputForCustomKeyboard(input, fromUserGesture = true) {
    if (!input || input.disabled) return;

    activeCustomKeyboardInput = input;

    // Ensure only the selected cloze capsule gets .has-focus with #94A3B8 border

    document.querySelectorAll('.cloze-input-wrap.has-focus').forEach(w => {
        if (!input || w !== input.closest('.cloze-input-wrap')) {

            w.classList.remove('has-focus');
        }

    });
    const wrap = input.closest('.cloze-input-wrap');
    if (wrap) wrap.classList.add('has-focus');

    // 💡 Always position cursor at end of existing text to prevent reverse insertion bugs

    try {
        const len = (input.value || '').length;
        input.setSelectionRange(len, len);
        input._virtualCaretPos = len;
        input._userExplicitlyAtZero = false;
    } catch(e) {}

    // 💡 自制键盘模式

    if (isCustomKeyboardEnabled()) {
        const isPC = isPCDesktopDevice();
        const canAutoExpand = !isPC && !window.isLookupMode;
        if ((fromUserGesture && canAutoExpand) || !dictKeyboardCollapsed) {
            if (typeof customKbAutoCollapseTimer !== 'undefined' && customKbAutoCollapseTimer) {
                clearTimeout(customKbAutoCollapseTimer);
                customKbAutoCollapseTimer = null;
            }
            if (dictKeyboardCollapsed) {
                dictKeyboardCollapsed = false;
                syncCustomVirtualKeyboardUI();
            }
        }

        if (!dictKeyboardCollapsed) {
            input.setAttribute('inputmode', 'none');
        } else if (isPC) {
            input.removeAttribute('inputmode');
        } else {
            input.setAttribute('inputmode', 'none');
        }

        try {
            input._isProgrammaticFocus = true;
            input.focus({ preventScroll: true });
        } catch(e) {
        } finally {
            input._isProgrammaticFocus = false;
        }

        if (!dictKeyboardCollapsed) {

            scrollInputIntoSafeView(input);
        }

    } else {

        // 💡 手机自带系统输入法模式

        input.removeAttribute('inputmode');

        dictKeyboardCollapsed = true;

        syncCustomVirtualKeyboardUI();
        if (fromUserGesture) {
            try {
                input._isProgrammaticFocus = true;
                input.focus();
            } catch(e) {
            } finally {
                input._isProgrammaticFocus = false;
            }
        }

    }

    updateCustomKeyboardStatus();
}

window.setActiveInputForCustomKeyboard = setActiveInputForCustomKeyboard;

function getActiveOrFirstUnsolvedInput() {
    // 1. Give highest priority to the explicitly selected custom keyboard blank
    if (activeCustomKeyboardInput && 
        !activeCustomKeyboardInput.disabled && 
        document.body.contains(activeCustomKeyboardInput)) {
        return activeCustomKeyboardInput;
    }
    // 2. Fall back to document.activeElement if it is a valid cloze input
    if (document.activeElement && 
        document.activeElement.classList && 
        document.activeElement.classList.contains('cloze-input') && 
        !document.activeElement.disabled &&
        document.body.contains(document.activeElement)) {
        activeCustomKeyboardInput = document.activeElement;
        return activeCustomKeyboardInput;
    }
    // 3. Fall back to first unsolved blank
    const first = document.querySelector('#dict-cloze-card .cloze-input:not([disabled])');
    if (first) {
        activeCustomKeyboardInput = first;
        return first;
    }
    return null;
}

window.getActiveOrFirstUnsolvedInput = getActiveOrFirstUnsolvedInput;

function syncDictKbToolButtonsState() {
    const btnKbHint = document.getElementById('btn-dict-kb-hint');
    if (btnKbHint) {
        const isSkeleton = !!window.dictSkeletonModeActive;

        btnKbHint.classList.toggle('is-active', isSkeleton);
        const textEl = btnKbHint.querySelector('.dict-kb-tool-text');
        if (textEl) textEl.textContent = isSkeleton ? '关闭提示' : '提示';
    }

    const btnKbAnswer = document.getElementById('btn-dict-kb-answer');
    if (btnKbAnswer) {
        const isAnswer = !!window.dictAnswerModeActive;

        btnKbAnswer.classList.toggle('is-active', isAnswer);
        const textEl = btnKbAnswer.querySelector('.dict-kb-tool-text');
        if (textEl) textEl.textContent = isAnswer ? '关闭答案' : '答案';
    }

    const btnKbPrev = document.getElementById('btn-dict-kb-prev');
    if (btnKbPrev) {
        const curIdx = (typeof window.currentDictIndex === 'number') ? window.currentDictIndex : 0;

        btnKbPrev.disabled = (curIdx <= 0);
    }

}

window.syncDictKbToolButtonsState = syncDictKbToolButtonsState;

window.updateKeyboardMagnifier = syncDictKbToolButtonsState;

function updateCustomKeyboardStatus() {

    syncDictKbToolButtonsState();
}

window.updateCustomKeyboardStatus = updateCustomKeyboardStatus;

function handleCustomKeyboardPrevBlank() {
    const allInputs = Array.from(document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])'));
    if (allInputs.length <= 1) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch(e) {}

    }

    const input = getActiveOrFirstUnsolvedInput();
    const curIdx = input ? allInputs.indexOf(input) : -1;
    let targetIdx = curIdx - 1;
    if (targetIdx < 0) {

        targetIdx = allInputs.length - 1;
    }

    const targetInput = allInputs[targetIdx];
    if (targetInput) {
        try { targetInput.focus({ preventScroll: true }); } catch(e) {}

        setActiveInputForCustomKeyboard(targetInput, true);
        try {
            const len = targetInput.value.length;

            targetInput.setSelectionRange(len, len);

            targetInput._virtualCaretPos = len;

            targetInput._userExplicitlyAtZero = false;
        } catch(e) {}

        scrollInputIntoSafeView(targetInput);
    }

}

window.handleCustomKeyboardPrevBlank = handleCustomKeyboardPrevBlank;

function handleCustomKeyboardNextBlank() {
    const input = getActiveOrFirstUnsolvedInput();
    if (!input || input.disabled) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch(e) {}

    }

    const target = input.dataset.target || '';

    // If target has a space (e.g. phrases) and input needs a space

    if (target.includes(' ') && !input.value.endsWith(' ')) {

        handleCustomKeyboardLetter(' ');
        return;
    }

    // Advance focus to next unsolved blank

    const allInputs = Array.from(document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])'));
    if (allInputs.length <= 1) return;
    const curIdx = allInputs.indexOf(input);
    let targetIdx = curIdx + 1;
    if (targetIdx >= allInputs.length) {

        targetIdx = 0;
    }

    const nextInput = allInputs[targetIdx];
    if (nextInput) {
        try { nextInput.focus({ preventScroll: true }); } catch(e) {}

        setActiveInputForCustomKeyboard(nextInput, true);
        try {
            const len = nextInput.value.length;

            nextInput.setSelectionRange(len, len);

            nextInput._virtualCaretPos = len;

            nextInput._userExplicitlyAtZero = false;
        } catch(e) {}

        scrollInputIntoSafeView(nextInput);
    }

}

window.handleCustomKeyboardNextBlank = handleCustomKeyboardNextBlank;

window.handleCustomKeyboardSpace = handleCustomKeyboardNextBlank;

let customKbAutoCollapseTimer = null;

function updateCustomKeyboardNextBtnState(isSentenceDone) {
    const nextBtn = document.getElementById('btn-dict-kb-next');
    const nextText = document.getElementById('dict-kb-next-text');
    const curIdx = (typeof window.currentDictIndex === 'number') ? window.currentDictIndex : 0;
    const curSents = window.currentDictSentences || [];
    const isLast = (curSents.length > 0 && curIdx === curSents.length - 1);

    if (nextText) {

        nextText.textContent = isLast ? '🎉 完成精听' : '下句 ➔';
    }

    if (nextBtn) {
        if (isSentenceDone) {

            nextBtn.classList.add('pulse-success');
        } else {

            nextBtn.classList.remove('pulse-success');
        }

    }

    updateCustomKeyboardStatus();

    if (customKbAutoCollapseTimer) {
        clearTimeout(customKbAutoCollapseTimer);
        customKbAutoCollapseTimer = null;
    }

    // If whole sentence is solved, auto collapse keyboard smoothly after 450ms

    if (isSentenceDone && !dictKeyboardCollapsed) {

        customKbAutoCollapseTimer = setTimeout(() => {
            customKbAutoCollapseTimer = null;
            collapseCustomKeyboard();
        }, 450);
    }

}

window.updateCustomKeyboardNextBtnState = updateCustomKeyboardNextBtnState;

// ==========================================================================

// 🔤 26-Key QWERTY Typing Logic

// ==========================================================================

function handleCustomKeyboardLetter(letter) {
    const input = getActiveOrFirstUnsolvedInput();
    if (!input || input.disabled) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch(e) {}

    }

    const target = input.dataset.target || '';
    let charToInsert = letter.toLowerCase();

    // Smart capitalization: if target word starts uppercase and input is currently empty

    if (input.value.length === 0 && target.length > 0) {
        const first = target[0];
        if (first >= 'A' && first <= 'Z') {

            charToInsert = charToInsert.toUpperCase();
        }

    }

    const val = input.value || '';
    let start = val.length;
    let end = val.length;

    // Robust cursor position resolution:

    // If the user has an active text selection range (start < end), respect the selection to replace it!

    if (typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number') {
        if (input.selectionStart < input.selectionEnd) {

            // Explicit range selection: replace selection

            start = input.selectionStart;

            end = input.selectionEnd;
        } else if (input.selectionStart > 0 && input.selectionStart <= val.length) {

            // Mid-word or end cursor explicitly positioned > 0

            start = input.selectionStart;

            end = input.selectionEnd;
        } else if (input.selectionStart === 0 && val.length === 0) {

            // Blank is empty, starting at 0

            start = 0;

            end = 0;
        } else if (input.selectionStart === 0 && val.length > 0) {

            // Browser reported 0 on non-empty input (classic WebView focus/blur/touch bug)

            // If user explicitly pressed Home or Left Arrow to 0:

            if (input._userExplicitlyAtZero) {

                start = 0;

                end = 0;
            } else {

                start = (typeof input._virtualCaretPos === 'number' && input._virtualCaretPos <= val.length)

                    ? input._virtualCaretPos

                    : val.length;

                end = start;
            }

        }

    } else if (typeof input._virtualCaretPos === 'number' && input._virtualCaretPos <= val.length) {

        start = input._virtualCaretPos;

        end = start;
    }

    // 🌟 Strictly enforce user-specified character limit: e.g. 6 letters allows max 8 letters (target.length + 2)

    const maxLen = (input.maxLength && input.maxLength > 0) ? input.maxLength : Math.max(3, target.length + 2);
    if ((val.length - (end - start) + 1) > maxLen) {
        return;
    }

    input.value = val.slice(0, start) + charToInsert + val.slice(end);
    const newPos = start + 1;
    input._virtualCaretPos = newPos;
    input._userExplicitlyAtZero = false;
    try {
        input.setSelectionRange(newPos, newPos);
    } catch(e) {}

    input.dispatchEvent(new Event('input', { bubbles: true }));

    scrollInputIntoSafeView(input);

    updateCustomKeyboardStatus();
}

window.handleCustomKeyboardLetter = handleCustomKeyboardLetter;

function deleteCustomKeyboardChar() {
    const input = getActiveOrFirstUnsolvedInput();
    if (!input || input.disabled) return;
    if (navigator.vibrate) {
        try { navigator.vibrate(8); } catch(e) {}

    }

    const val = input.value || '';
    let start = val.length;
    let end = val.length;
    if (typeof input.selectionStart === 'number' && typeof input.selectionEnd === 'number') {
        if (input.selectionStart < input.selectionEnd) {

            start = input.selectionStart;

            end = input.selectionEnd;
        } else if (input.selectionStart > 0 && input.selectionStart <= val.length) {

            start = input.selectionStart;

            end = input.selectionEnd;
        } else if (input.selectionStart === 0 && val.length > 0) {
            if (input._userExplicitlyAtZero) {

                start = 0;

                end = 0;
            } else {

                start = (typeof input._virtualCaretPos === 'number' && input._virtualCaretPos <= val.length)

                    ? input._virtualCaretPos

                    : val.length;

                end = start;
            }

        }

    } else if (typeof input._virtualCaretPos === 'number' && input._virtualCaretPos <= val.length) {

        start = input._virtualCaretPos;

        end = start;
    }

    if (val.length > 0) {
        if (start < end) {
            input.value = val.slice(0, start) + val.slice(end);
            const newPos = start;
            input._virtualCaretPos = newPos;
            input._userExplicitlyAtZero = (newPos === 0 && input.value.length > 0);
            try { input.setSelectionRange(newPos, newPos); } catch(e) {}

            input.dispatchEvent(new Event('input', { bubbles: true }));

            scrollInputIntoSafeView(input);

            updateCustomKeyboardStatus();
            return;
        } else if (start > 0) {
            input.value = val.slice(0, start - 1) + val.slice(end);
            const newPos = Math.max(0, start - 1);
            input._virtualCaretPos = newPos;
            input._userExplicitlyAtZero = false;
            try { input.setSelectionRange(newPos, newPos); } catch(e) {}

            input.dispatchEvent(new Event('input', { bubbles: true }));

            scrollInputIntoSafeView(input);

            updateCustomKeyboardStatus();
            return;
        }

    }

    // If blank is now empty, stop hold-to-repeat so it doesn't accidentally wipe out previous words!
    stopCustomKeyboardBackspace();

    // Switch focus to previous unsolved blank if empty
    const allInputs = Array.from(document.querySelectorAll('#dict-cloze-card .cloze-input:not([disabled])'));
    const idx = allInputs.indexOf(input);
    if (idx > 0) {
        const prevInput = allInputs[idx - 1];
        try { prevInput.focus({ preventScroll: true }); } catch(e) {}

        setActiveInputForCustomKeyboard(prevInput);
        try {
            const prevLen = prevInput.value.length;

            prevInput.setSelectionRange(prevLen, prevLen);

            prevInput._virtualCaretPos = prevLen;

            prevInput._userExplicitlyAtZero = false;
        } catch(e) {}

        scrollInputIntoSafeView(prevInput);
    }

}

window.deleteCustomKeyboardChar = deleteCustomKeyboardChar;

function startCustomKeyboardBackspace() {

    deleteCustomKeyboardChar();

    clearTimeout(customKbBackspaceTimer);

    clearInterval(customKbBackspaceInterval);

    customKbBackspaceTimer = setTimeout(() => {

        customKbBackspaceInterval = setInterval(deleteCustomKeyboardChar, 80);
    }, 450);
}

function stopCustomKeyboardBackspace() {

    clearTimeout(customKbBackspaceTimer);

    clearInterval(customKbBackspaceInterval);

    customKbBackspaceTimer = null;

    customKbBackspaceInterval = null;
}

// ==========================================================================

// 📱 Expand / Collapse & Viewport Sync

// ==========================================================================

function collapseCustomKeyboard() {

    dictKeyboardCollapsed = true;

    syncCustomVirtualKeyboardUI();

    syncDictKeyboardPreferenceUI();
    if (activeCustomKeyboardInput && document.activeElement !== activeCustomKeyboardInput) {
        const wrap = activeCustomKeyboardInput.closest('.cloze-input-wrap');
        if (wrap) wrap.classList.remove('has-focus');
    }

}

window.collapseCustomKeyboard = collapseCustomKeyboard;

function expandCustomKeyboard() {
    if (customKbAutoCollapseTimer) {
        clearTimeout(customKbAutoCollapseTimer);
        customKbAutoCollapseTimer = null;
    }
    dictKeyboardPreference = 'custom';
    try {

        window.__toyLS.setItem('toy_dict_keyboard_mode', 'custom');
    } catch(e) {}

    dictKeyboardCollapsed = false;

    syncCustomVirtualKeyboardUI();

    syncDictKeyboardPreferenceUI();

    document.querySelectorAll('#dict-cloze-card .cloze-input').forEach(inp => {

        inp.setAttribute('inputmode', 'none');
    });
    const input = getActiveOrFirstUnsolvedInput();
    if (input) {
        setActiveInputForCustomKeyboard(input, true);
        try {
            input.focus({ preventScroll: true });
            const len = (input.value || '').length;
            input.setSelectionRange(len, len);
            input._virtualCaretPos = len;
            input._userExplicitlyAtZero = false;
        } catch(e) {}
        scrollInputIntoSafeView(input);
    }

}

window.expandCustomKeyboard = expandCustomKeyboard;

function isDictArenaActive() {
    const viewDict = document.getElementById('view-dictation-arena');
    if (viewDict && (viewDict.classList.contains('active') || viewDict.style.display === 'block')) {
        return true;
    }

    if (typeof window.activeView !== 'undefined' && window.activeView === 'dictation-arena') {
        return true;
    }

    if (typeof activeView !== 'undefined' && activeView === 'dictation-arena') {
        return true;
    }

    return false;
}

window.isDictArenaActive = isDictArenaActive;

function syncCustomVirtualKeyboardUI() {
    const isDictArena = isDictArenaActive();
    const kb = document.getElementById('dict-virtual-keyboard');
    const viewDict = document.getElementById('view-dictation-arena');
    const dictNavGroup = document.getElementById('dictation-nav-group');

    // If not in dictation arena, hide keyboard AND dictation nav group completely!

    if (!isDictArena) {
        if (kb) kb.style.display = 'none';
        if (viewDict) viewDict.classList.remove('has-custom-kb');

        document.body.classList.remove('dict-custom-kb-open');
        if (dictNavGroup) dictNavGroup.style.display = 'none';
        return;
    }

    const isCustom = (dictKeyboardPreference === 'custom');
    const shouldShowKb = (!dictKeyboardCollapsed && isCustom);
    if (shouldShowKb) {
        if (kb) {

            kb.style.display = 'flex';

            kb.classList.remove('is-collapsed');
        }

        if (viewDict) viewDict.classList.add('has-custom-kb');

        document.body.classList.add('dict-custom-kb-open');
        if (dictNavGroup) dictNavGroup.style.display = 'none';
    } else {
        if (kb) {

            kb.classList.add('is-collapsed');

            kb.style.display = 'none';
        }

        if (viewDict) viewDict.classList.remove('has-custom-kb');

        document.body.classList.remove('dict-custom-kb-open');
        if (dictNavGroup) dictNavGroup.style.display = 'flex';
    }

    updateCustomKeyboardStatus();
}

window.syncCustomVirtualKeyboardUI = syncCustomVirtualKeyboardUI;

window.syncCustomVirtualKeyboardState = syncCustomVirtualKeyboardUI;

function hideCustomVirtualKeyboard() {

    collapseCustomKeyboard();
}

window.hideCustomVirtualKeyboard = hideCustomVirtualKeyboard;

// ==========================================================================

// 🚀 Initialization

// ==========================================================================

function initCustomVirtualKeyboard() {
    const kb = document.getElementById('dict-virtual-keyboard');
    if (!kb || kb.dataset.initialized) return;

    kb.dataset.initialized = 'true';

    // 1. QWERTY Letter keys

    kb.querySelectorAll('.dict-key-letter').forEach(btn => {
        const handler = (e) => {

            e.preventDefault();

            btn.classList.add('is-pressed');

            setTimeout(() => btn.classList.remove('is-pressed'), 120);
            if (window.FeedbackEngine) window.FeedbackEngine.playTap();
            const letter = btn.dataset.key;
            if (letter) handleCustomKeyboardLetter(letter);
        };

        btn.addEventListener('pointerdown', handler);
    });

    // 2. Backspace key (with hold-to-repeat)

    const btnBackspace = document.getElementById('btn-dict-kb-backspace');
    if (btnBackspace) {
        const downHandler = (e) => {

            e.preventDefault();

            btnBackspace.classList.add('is-pressed');
            if (window.FeedbackEngine) window.FeedbackEngine.playTap();

            startCustomKeyboardBackspace();
        };
        const upHandler = (e) => {

            btnBackspace.classList.remove('is-pressed');

            stopCustomKeyboardBackspace();
        };

        btnBackspace.addEventListener('pointerdown', downHandler);

        btnBackspace.addEventListener('pointerup', upHandler);

        btnBackspace.addEventListener('pointerleave', upHandler);

        btnBackspace.addEventListener('pointercancel', upHandler);
        btnBackspace.addEventListener('touchend', upHandler, { passive: true });
        btnBackspace.addEventListener('touchcancel', upHandler, { passive: true });
        window.addEventListener('pointerup', upHandler, { passive: true });
        window.addEventListener('touchend', upHandler, { passive: true });
    }

    // 3. Action keys (Prev, Blank Navigation, Next, Replay)

    const btnKbPrev = document.getElementById('btn-dict-kb-prev');
    if (btnKbPrev) {

        btnKbPrev.addEventListener('pointerdown', (e) => {

            e.preventDefault();
            if (btnKbPrev.disabled) return;
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            const mainPrev = document.getElementById('btn-dict-prev') || document.getElementById('btn-dict-card-prev');
            if (mainPrev) mainPrev.click();

            else if (typeof window.handlePrevDictSentence === 'function') window.handlePrevDictSentence();
        });
    }

    const btnPrevBlank = document.getElementById('btn-dict-kb-prev-blank');
    if (btnPrevBlank) {

        btnPrevBlank.addEventListener('pointerdown', (e) => {

            e.preventDefault();

            btnPrevBlank.classList.add('is-pressed');

            setTimeout(() => btnPrevBlank.classList.remove('is-pressed'), 120);

            handleCustomKeyboardPrevBlank();
        });
    }

    const btnNextBlank = document.getElementById('btn-dict-kb-next-blank');
    if (btnNextBlank) {

        btnNextBlank.addEventListener('pointerdown', (e) => {

            e.preventDefault();

            btnNextBlank.classList.add('is-pressed');

            setTimeout(() => btnNextBlank.classList.remove('is-pressed'), 120);

            handleCustomKeyboardNextBlank();
        });
    }

    const btnSpaceBar = document.getElementById('btn-dict-kb-space-bar');
    if (btnSpaceBar) {

        btnSpaceBar.addEventListener('pointerdown', (e) => {

            e.preventDefault();

            btnSpaceBar.classList.add('is-pressed');

            setTimeout(() => btnSpaceBar.classList.remove('is-pressed'), 120);

            handleCustomKeyboardNextBlank();
        });
    }

    const btnNext = document.getElementById('btn-dict-kb-next');
    if (btnNext) {

        btnNext.addEventListener('pointerdown', (e) => {

            e.preventDefault();
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            const mainNext = document.getElementById('btn-dict-next');
            if (mainNext) mainNext.click();
        });
    }

    // Row 3 Replay button

    const btnReplay = document.getElementById('btn-dict-kb-replay');
    if (btnReplay) {

        btnReplay.addEventListener('pointerdown', (e) => {

            e.preventDefault();

            btnReplay.classList.add('is-pressed');

            setTimeout(() => btnReplay.classList.remove('is-pressed'), 120);
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            if (typeof window.replayDictationAudio === 'function') {

                window.replayDictationAudio();
            } else {
                const playBtn = document.getElementById('btn-dict-play') || document.getElementById('btn-zen-play-pause');
                if (playBtn) playBtn.click();
            }

        });
    }

    // 4. Toolbar buttons (💡提示, 📖答案, 📋选句, 收起˅)

    const btnHint = document.getElementById('btn-dict-kb-hint');
    if (btnHint) {
        let lastHintTime = 0;
        const handleHint = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            const now = Date.now();
            if (now - lastHintTime < 250) return;

            lastHintTime = now;

            btnHint.classList.add('is-pressed');

            setTimeout(() => btnHint.classList.remove('is-pressed'), 120);
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            if (typeof window.toggleDictHint === 'function') {

                window.toggleDictHint();
            } else {
                const mainHint = document.getElementById('btn-dict-hint-first');
                if (mainHint) mainHint.click();
            }

            syncDictKbToolButtonsState();
        };

        btnHint.addEventListener('pointerdown', handleHint);

        btnHint.addEventListener('click', handleHint);
    }

    const btnAnswer = document.getElementById('btn-dict-kb-answer');
    if (btnAnswer) {
        let lastAnsTime = 0;
        const handleAnswer = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            const now = Date.now();
            if (now - lastAnsTime < 250) return;

            lastAnsTime = now;

            btnAnswer.classList.add('is-pressed');

            setTimeout(() => btnAnswer.classList.remove('is-pressed'), 120);
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            if (typeof window.toggleDictAnswer === 'function') {

                window.toggleDictAnswer();
            } else {
                const mainAns = document.getElementById('btn-dict-reveal-answer');
                if (mainAns) mainAns.click();
            }

            syncDictKbToolButtonsState();
        };

        btnAnswer.addEventListener('pointerdown', handleAnswer);

        btnAnswer.addEventListener('click', handleAnswer);
    }

    const btnSwitchNative = document.getElementById('btn-dict-kb-switch-native');
    if (btnSwitchNative) {
        const handleSwitchNative = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            btnSwitchNative.classList.add('is-pressed');

            setTimeout(() => btnSwitchNative.classList.remove('is-pressed'), 120);
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            switchDictKeyboard('system');
        };

        btnSwitchNative.addEventListener('pointerdown', handleSwitchNative);

        btnSwitchNative.addEventListener('click', handleSwitchNative);
    }

    const btnCanvasToggle = document.getElementById('btn-dict-canvas-kb-toggle');
    if (btnCanvasToggle) {

        btnCanvasToggle.addEventListener('click', (e) => {

            e.preventDefault();

            e.stopPropagation();
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}

            toggleDictKeyboardMode();
        });
    }

    const popKbItem = document.getElementById('pop-item-dict-keyboard');
    if (popKbItem) {

        popKbItem.addEventListener('click', (e) => {

            e.preventDefault();

            e.stopPropagation();
            if (window.FeedbackEngine) window.FeedbackEngine.playTap();
            const isKbOpen = (!dictKeyboardCollapsed && dictKeyboardPreference === 'custom');
            if (isKbOpen) {

                collapseCustomKeyboard();
            } else {

                expandCustomKeyboard();
            }

            syncDictKeyboardPreferenceUI();
            const popCard = document.getElementById('popover-quiz-actions');
            if (popCard) {

                popCard.classList.remove('show');

                popCard.classList.remove('active');
            }

        });
    }

    syncDictKeyboardPreferenceUI();

    window.addEventListener('resize', syncDictKeyboardPreferenceUI, { passive: true });

    window.addEventListener('orientationchange', syncDictKeyboardPreferenceUI, { passive: true });
    const btnCollapse = document.getElementById('btn-dict-kb-collapse');
    if (btnCollapse) {
        let lastCollapseTime = 0;
        const handleCollapse = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            const now = Date.now();
            if (now - lastCollapseTime < 250) return;

            lastCollapseTime = now;

            btnCollapse.classList.add('is-pressed');

            setTimeout(() => btnCollapse.classList.remove('is-pressed'), 120);

            collapseCustomKeyboard();
        };

        btnCollapse.addEventListener('pointerdown', handleCollapse);

        btnCollapse.addEventListener('click', handleCollapse);
    }

    // 5. Bottom Nav Keyboard Action Button (#btn-dict-nav-keyboard)

    const btnNavKb = document.getElementById('btn-dict-nav-keyboard');
    if (btnNavKb) {
        const handleNavKb = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            btnNavKb.classList.add('is-pressed');

            setTimeout(() => btnNavKb.classList.remove('is-pressed'), 120);
            if (navigator.vibrate) try { navigator.vibrate(8); } catch(err) {}

            if (dictKeyboardPreference === 'custom') {

                expandCustomKeyboard();
            } else {

                switchDictKeyboard('custom');
            }

        };

        btnNavKb.addEventListener('pointerdown', handleNavKb);

        btnNavKb.addEventListener('click', handleNavKb);
    }

    // 6. 📱 Keyboard Swipe Down to Dismiss Gesture

    const kbEl = document.getElementById('dict-virtual-keyboard');
    if (kbEl) {
        let kbTouchStartY = 0;
        let kbTouchStartX = 0;
        let kbTouchStartTime = 0;

        kbEl.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {

                kbTouchStartY = e.touches[0].clientY;

                kbTouchStartX = e.touches[0].clientX;

                kbTouchStartTime = Date.now();
            }

        }, { passive: true });

        kbEl.addEventListener('touchend', (e) => {
            if (dictKeyboardCollapsed) return;
            if (e.changedTouches && e.changedTouches.length === 1) {
                const dy = e.changedTouches[0].clientY - kbTouchStartY;
                const dx = e.changedTouches[0].clientX - kbTouchStartX;
                const dt = Date.now() - kbTouchStartTime;

                // Vertical downward swipe: dy >= 36px, dy > |dx| * 1.25, duration < 500ms

                if (dy >= 36 && dy > Math.abs(dx) * 1.25 && dt < 500) {

                    collapseCustomKeyboard();
                }

            }

        }, { passive: true });
    }

    syncCustomVirtualKeyboardUI();
}

window.initCustomVirtualKeyboard = initCustomVirtualKeyboard;

// Initialize on ready

if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', initCustomVirtualKeyboard);
} else {

    initCustomVirtualKeyboard();
}
