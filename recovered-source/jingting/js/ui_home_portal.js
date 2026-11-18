/* === js/ui_home_portal.js === */
/**
 * ==========================================================================
 * Home Portal Event Delegation, Track Tabs & Top Stats Switcher (js/ui_home_portal.js)
 * ==========================================================================
 */

// ==========================================================================
// 🎨 Home Level Switcher & Daily Listening Module Designer Engine (Top-Level Exports)
// ==========================================================================
function renderSwitcherHTML(activeLevel) {
    const lvl = activeLevel || window.currentExamLevel || 'cet4';
    return `
        <div class="exam-level-switcher" id="home-exam-level-switcher">
            <button class="level-tab-btn ${lvl === 'cet4' ? 'active' : ''}" data-level="cet4" id="btn-tab-cet4">
                <span class="level-tab-icon">📘</span>
                <span class="level-tab-text">四级真题</span>
            </button>
            <button class="level-tab-btn ${lvl === 'cet6' ? 'active' : ''}" data-level="cet6" id="btn-tab-cet6">
                <span class="level-tab-icon">📕</span>
                <span class="level-tab-text">六级真题</span>
            </button>
            <button class="level-tab-btn ${lvl === 'gaokao' ? 'active' : ''}" data-level="gaokao" id="btn-tab-gaokao">
                <span class="level-tab-icon">🎓</span>
                <span class="level-tab-text">高考真题</span>
            </button>
            <button class="level-tab-btn ${lvl === 'daily' ? 'active' : ''}" data-level="daily" id="btn-tab-daily">
                <span class="level-tab-icon">🎙️</span>
                <span class="level-tab-text">每日精听</span>
            </button>
        </div>
    `;
}
window.renderSwitcherHTML = renderSwitcherHTML;

function getCurrentDailyVariant() {
    try {
        return window.__toyLS.getItem('toy_daily_design_variant') || 'd3';
    } catch (e) {
        return 'd3';
    }
}

function renderDailyModulesHTML(variant) {
    const v = variant || getCurrentDailyVariant();

    if (v === 'd2' || v === 'v2') {
        // V2: iOS 17 灵动声学深色大卡 (Dark Obsidian Acoustic Island)
        return `
            <div class="daily-design-v2" onclick="openDailyListening('uk', 5)">
                <div class="v2-dark-card">
                    <div class="v2-top-row">
                        <div class="v2-badge">
                            <span>🎙️</span>
                            <span>每日英语听力</span>
                        </div>
                        <div class="v2-wave-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                    <div class="v2-mid-row">
                        <div class="v2-sub">30 DAYS MASTER · ISSUE 05</div>
                        <div class="v2-title">第五期 · 原声逐句精听</div>
                    </div>
                    <div class="v2-bottom-row">
                        <span class="v2-meta">双音色朗读 · 450 句特训</span>
                        <button class="v2-action-btn">
                            <span>开始精听</span>
                            <span>▶</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else if (v === 'd1' || v === 'v1') {
        // V1: Apple Music 专辑精选大卡 (Editorial Album Hero)
        return `
            <div class="daily-design-v1" onclick="openDailyListening('uk', 5)">
                <div class="v1-header-row">
                    <div class="v1-cover-badge">
                        <span>🎙️</span>
                        <span>每日英语听力</span>
                    </div>
                    <span class="v1-status-pill">30天精选 · 450句</span>
                </div>
                <div class="v1-body-row">
                    <div class="v1-title-group">
                        <span class="v1-sub-title">Daily English Listening</span>
                        <span class="v1-main-title">第五期 · 原声逐句精听</span>
                    </div>
                    <button class="v1-play-btn">
                        <span>开始精听</span>
                        <span>▶</span>
                    </button>
                </div>
            </div>
        `;
    } else if (v === 'd4' || v === 'v4') {
        // V4: iOS 健身习惯特训大卡 (Habit & Momentum Card)
        return `
            <div class="daily-design-v4" onclick="openDailyListening('uk', 5)">
                <div class="v4-habit-card">
                    <div class="v4-header">
                        <div class="v4-badge">
                            <span>🎙️</span>
                            <span>每日英语听力</span>
                        </div>
                        <span class="v4-issue-chip">第五期特训</span>
                    </div>
                    <div class="v4-chips-row">
                        <span class="v4-chip">📅 30 天计划</span>
                        <span class="v4-chip">🎧 450 句原声</span>
                        <span class="v4-chip">⚡ 智能磨耳</span>
                    </div>
                    <button class="v4-full-btn">
                        <span>开启第五期精听</span>
                        <span>➔</span>
                    </button>
                </div>
            </div>
        `;
    } else if (v === 'd5' || v === 'v5') {
        // V5: Apple Books 极简留白通栏大卡 (Editorial Minimalist Row)
        return `
            <div class="daily-design-v5" onclick="openDailyListening('uk', 5)">
                <div class="v5-minimal-card">
                    <div class="v5-info">
                        <div class="v5-kicker">DAILY LISTENING · EPISODE 05</div>
                        <div class="v5-title">每日英语听力（第五期）</div>
                        <div class="v5-meta">逐句精听 · 智能挖空 · 权威点词即查</div>
                    </div>
                    <button class="v5-btn">进入 ›</button>
                </div>
            </div>
        `;
    } else {
        // V3: Apple Podcasts 播客封面大卡 (Podcasts Studio Inset - 官方精选)
        return `
            <div class="daily-design-v3" onclick="openDailyListening('uk', 5)">
                <div class="v3-podcast-card">
                    <div class="v3-cover-box">
                        <span class="v3-cover-icon">🎙️</span>
                        <span class="v3-cover-tag">EP.05</span>
                    </div>
                    <div class="v3-info-box">
                        <div class="v3-kicker">DAILY ENGLISH LISTENING</div>
                        <div class="v3-main-title">每日英语听力（第五期）</div>
                    </div>
                    <div class="v3-play-circle">
                        <span>▶</span>
                    </div>
                </div>
            </div>
        `;
    }
}
window.renderDailyModulesHTML = renderDailyModulesHTML;

function updateYearFilterVisibility(level) {
    const rawLvl = level || window.currentExamLevel || 'cet4';
    const lvl = (rawLvl === 'kaoyan_eng1' || rawLvl === 'kaoyan_eng2') ? 'kaoyan' : rawLvl;
    const hasEarlyYears = (lvl === 'gaokao' || lvl === 'kaoyan');
    const isKaoyan = (lvl === 'kaoyan');

    if (typeof window.initDictationYearFilterBar === 'function') {
        window.initDictationYearFilterBar(lvl);
    }

    document.querySelectorAll('.year-filter-bar:not(#dictation-year-filter-bar)').forEach(bar => {
        const chip0814 = bar.querySelector('.chip-year[data-range="2008-2014"]');
        if (chip0814) {
            chip0814.style.display = hasEarlyYears ? '' : 'none';
            chip0814.textContent = isKaoyan ? '2010–2014年' : '2008–2014年';
            if (!hasEarlyYears && chip0814.classList.contains('active')) {
                chip0814.classList.remove('active');
                const allChip = bar.querySelector('.chip-year[data-range="ALL"]');
                if (allChip) allChip.classList.add('active');
            }
        }
        if (typeof updateSegmentedSlider === 'function') {
            updateSegmentedSlider(bar, false);
        }
    });
}
window.updateYearFilterVisibility = updateYearFilterVisibility;

function switchTrainingMode(mode, animate = true) {
    const prevMode = window.currentTrainingMode || 'written';
    const shouldAnimate = (animate !== false) && (prevMode !== mode);
    window.currentTrainingMode = mode;
    try { window.__toyLS.setItem('toy_selected_training_mode', mode); } catch(e) {}

    const switcher = document.getElementById('home-training-mode-switcher');
    if (switcher) {
        switcher.querySelectorAll('.training-mode-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
        });
        if (window.UXSegmentedGlider) {
            window.UXSegmentedGlider.sync(switcher, shouldAnimate);
        }
    }

    const indicator = document.getElementById('training-mode-indicator');
    if (indicator) {
        indicator.querySelectorAll('.mode-indicator-dot').forEach(dot => {
            dot.classList.toggle('active', dot.getAttribute('data-mode') === mode);
        });
    }

    const modeOrder = ['written', 'listening', 'dictation'];
    const prevIdx = modeOrder.indexOf(prevMode);
    const nextIdx = modeOrder.indexOf(mode);
    const animClass = (nextIdx >= prevIdx) ? 'slide-from-right' : 'slide-from-left';

    const sections = [
        { id: 'section-content-written', mode: 'written' },
        { id: 'section-content-listening', mode: 'listening' },
        { id: 'section-content-dictation', mode: 'dictation' }
    ];

    sections.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        if (el._modeSlideTimer) {
            clearTimeout(el._modeSlideTimer);
            el._modeSlideTimer = null;
        }
        el.classList.remove('slide-from-right', 'slide-from-left');
        if (item.mode === mode) {
            el.style.display = 'block';
            if (shouldAnimate) {
                void el.offsetWidth;
                el.classList.add(animClass);
                el._modeSlideTimer = setTimeout(() => {
                    el.classList.remove('slide-from-right', 'slide-from-left');
                    el._modeSlideTimer = null;
                }, 230);
            }
        } else {
            el.style.display = 'none';
        }
    });
}
window.switchTrainingMode = switchTrainingMode;

function syncLobbyLevelPillsUI(animateScroll = false) {
    const curLevel = window.currentExamLevel || 'cet4';
    document.querySelectorAll('.lobby-level-pills-bar').forEach(bar => {
        const pills = bar.querySelectorAll('.lobby-level-pill');
        let targetLevel = curLevel;
        if (window.activeView === 'daily-lobby') {
            targetLevel = 'daily';
        } else if (targetLevel === 'daily') {
            targetLevel = 'cet4';
        } else if (targetLevel === 'kaoyan') {
            targetLevel = (window.currentKaoyanSubjectFilter === 'ENG2') ? 'kaoyan_eng2' : 'kaoyan_eng1';
        }

        let hasTarget = false;
        pills.forEach(pill => {
            if (pill.getAttribute('data-level') === targetLevel) {
                hasTarget = true;
            }
        });

        if (!hasTarget) {
            targetLevel = 'cet4';
        }

        let activePillEl = null;
        pills.forEach(pill => {
            const isMatch = pill.getAttribute('data-level') === targetLevel;
            pill.classList.toggle('active', isMatch);
            if (isMatch) activePillEl = pill;
        });

        if (activePillEl && bar.clientWidth > 0 && bar.scrollWidth > bar.clientWidth) {
            const pillCenter = activePillEl.offsetLeft + activePillEl.offsetWidth / 2;
            const targetScroll = Math.max(0, pillCenter - bar.clientWidth / 2);
            if (animateScroll === true && typeof bar.scrollTo === 'function') {
                bar.scrollTo({ left: targetScroll, behavior: 'smooth' });
            } else {
                bar.scrollLeft = targetScroll;
            }
        }
        if (!bar._dragScrollBound && typeof window.enableHorizontalDragScroll === 'function') {
            bar._dragScrollBound = true;
            window.enableHorizontalDragScroll(bar);
        }
    });
}
window.syncLobbyLevelPillsUI = syncLobbyLevelPillsUI;

function selectTrainingLevel(mode, level) {
    window._navActionSeqId = (window._navActionSeqId || 0) + 1;
    if (level === 'kaoyan_eng1') {
        window.currentKaoyanSubjectFilter = 'ENG1';
        level = 'kaoyan';
    } else if (level === 'kaoyan_eng2') {
        window.currentKaoyanSubjectFilter = 'ENG2';
        level = 'kaoyan';
    } else if (level === 'kaoyan') {
        window.currentKaoyanSubjectFilter = window.currentKaoyanSubjectFilter || 'ENG1';
    }
    if (level === 'ielts' && mode !== 'dictation') level = 'cet4';
    if (level === 'kaoyan' && mode !== 'written') level = 'cet4';
    window.currentExamLevel = level;
    window.currentListeningFilter = 'ALL';
    window.currentWrittenFilter = 'ALL';
    window.currentWrittenFilterRange = 'ALL';
    window.currentDictationFilter = 'ALL';
    try {
        window.__toyLS.setItem('toy_selected_exam_level', level);
        if (level === 'kaoyan') {
            window.__toyLS.setItem('toy_selected_kaoyan_subj', window.currentKaoyanSubjectFilter || 'ENG1');
        }
    } catch(e) {}

    let text = '四级';
    if (level === 'cet6') text = '六级';
    else if (level === 'gaokao') text = '高考';
    else if (level === 'kaoyan') text = (window.currentKaoyanSubjectFilter === 'ENG2') ? '考研英语(二)' : '考研英语(一)';
    else if (level === 'ielts') text = '雅思';
    document.querySelectorAll('.level-tag-bind').forEach(el => {
        el.textContent = text;
    });

    updateYearFilterVisibility(level);
    syncLobbyLevelPillsUI();
    if (window.ToyPermissions && typeof window.ToyPermissions.updateUI === 'function') {
        window.ToyPermissions.updateUI();
    }

    if (mode === 'written') {
        switchView('written-lobby');
    } else if (mode === 'listening') {
        switchView('lobby');
    } else if (mode === 'dictation') {
        if (level === 'daily') {
            switchView('daily-lobby');
        } else {
            switchView('dictation-lobby');
        }
    }
}
window.selectTrainingLevel = selectTrainingLevel;

function switchLobbyLevel(lobbyType, targetLevel) {
    window._navActionSeqId = (window._navActionSeqId || 0) + 1;
    if (targetLevel === 'kaoyan_eng1') {
        window.currentKaoyanSubjectFilter = 'ENG1';
        targetLevel = 'kaoyan';
    } else if (targetLevel === 'kaoyan_eng2') {
        window.currentKaoyanSubjectFilter = 'ENG2';
        targetLevel = 'kaoyan';
    } else if (targetLevel === 'kaoyan') {
        window.currentKaoyanSubjectFilter = window.currentKaoyanSubjectFilter || 'ENG1';
    }
    if (targetLevel === 'ielts' && lobbyType !== 'dictation' && lobbyType !== 'daily') targetLevel = 'cet4';
    if (targetLevel === 'kaoyan' && lobbyType && lobbyType !== 'written') targetLevel = 'cet4';
    if (targetLevel === 'daily') {
        window.currentExamLevel = 'daily';
        switchView('daily-lobby', false, true);
        if (window.ToyPermissions && typeof window.ToyPermissions.updateUI === 'function') {
            window.ToyPermissions.updateUI();
        }
        return;
    }

    window.currentExamLevel = targetLevel;
    window.currentListeningFilter = 'ALL';
    window.currentWrittenFilter = 'ALL';
    window.currentWrittenFilterRange = 'ALL';
    window.currentDictationFilter = 'ALL';
    try {
        window.__toyLS.setItem('toy_selected_exam_level', targetLevel);
        if (targetLevel === 'kaoyan') {
            window.__toyLS.setItem('toy_selected_kaoyan_subj', window.currentKaoyanSubjectFilter || 'ENG1');
        }
    } catch(e) {}

    let text = '四级';
    if (targetLevel === 'cet6') text = '六级';
    else if (targetLevel === 'gaokao') text = '高考';
    else if (targetLevel === 'kaoyan') text = (window.currentKaoyanSubjectFilter === 'ENG2') ? '考研英语(二)' : '考研英语(一)';
    else if (targetLevel === 'ielts') text = '雅思';
    document.querySelectorAll('.level-tag-bind').forEach(el => {
        el.textContent = text;
    });

    syncLobbyLevelPillsUI(true);
    updateYearFilterVisibility(targetLevel);
    if (window.ToyPermissions && typeof window.ToyPermissions.updateUI === 'function') {
        window.ToyPermissions.updateUI();
    }

    // Reset year filters to ALL on level change (snap instantly without delayed glide)
    document.querySelectorAll('.year-filter-bar').forEach(bar => {
        bar.querySelectorAll('.chip-year').forEach(c => {
            c.classList.toggle('active', c.dataset.range === 'ALL');
        });
        if (typeof updateSegmentedSlider === 'function') {
            updateSegmentedSlider(bar, false);
        }
    });

    if (lobbyType === 'listening' || window.activeView === 'lobby') {
        if (typeof renderLobbyGrid === 'function') renderLobbyGrid('ALL');
        if (typeof triggerExamGridFilterTransition === 'function') triggerExamGridFilterTransition('exam-grid');
    } else if (lobbyType === 'written' || window.activeView === 'written-lobby') {
        if (typeof renderWrittenLobbyGrid === 'function') renderWrittenLobbyGrid('ALL');
        if (typeof triggerExamGridFilterTransition === 'function') triggerExamGridFilterTransition('written-exam-grid');
    } else if (lobbyType === 'dictation' || window.activeView === 'dictation-lobby') {
        if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid('ALL');
        if (typeof triggerExamGridFilterTransition === 'function') triggerExamGridFilterTransition('dictation-exam-grid');
    } else if (lobbyType === 'daily' && targetLevel !== 'daily') {
        switchView('dictation-lobby', false, true);
    }
}
window.switchLobbyLevel = switchLobbyLevel;

window.setAppExamLevel = function(level) { switchLobbyLevel('', level); };

window.toggleDailyAccent = function(accent) {
    window._dailyAccent = accent;
    const dailyContainer = document.getElementById('home-daily-modules-container');
    if (dailyContainer) {
        dailyContainer.innerHTML = renderDailyModulesHTML(getCurrentDailyVariant());
    }
};

window.openDailyListening = function(accent = 'uk', issue = 5) {
    window._dailyAccent = accent;
    if (typeof setDailyAudioAccent === 'function') {
        setDailyAudioAccent(accent);
    }
    if (typeof switchView === 'function') {
        switchView('daily-lobby');
    }
};

let _homePortalEventsBound = false;
function initHomePortalEvents() {
    if (_homePortalEventsBound) return;
    _homePortalEventsBound = true;

    // Main menu cards & Multi-Scheme Global Delegation
    document.querySelectorAll('.btn-entry-quiz, #card-entry-quiz').forEach(el => {
        el.addEventListener('click', () => switchView('lobby'));
    });
    document.querySelectorAll('.btn-entry-dictation, #card-entry-dictation').forEach(el => {
        el.addEventListener('click', () => switchView('dictation-lobby'));
    });
    document.querySelectorAll('.btn-entry-written, #card-entry-written').forEach(el => {
        el.addEventListener('click', () => switchView('written-lobby'));
    });

    function initHomeTrainingModeSwitcher() {
        let savedMode = 'written';
        let savedLevel = 'cet4';
        try {
            savedMode = window.__toyLS.getItem('toy_selected_training_mode') || 'written';
            savedLevel = window.__toyLS.getItem('toy_selected_exam_level') || 'cet4';
        } catch (e) {}
        switchTrainingMode(savedMode, false);

        if (savedLevel === 'kaoyan_eng1') {
            savedLevel = 'kaoyan';
            window.currentKaoyanSubjectFilter = 'ENG1';
        } else if (savedLevel === 'kaoyan_eng2') {
            savedLevel = 'kaoyan';
            window.currentKaoyanSubjectFilter = 'ENG2';
        } else if (savedLevel === 'kaoyan') {
            try {
                window.currentKaoyanSubjectFilter = window.__toyLS.getItem('toy_selected_kaoyan_subj') || 'ENG1';
            } catch (e) {
                window.currentKaoyanSubjectFilter = 'ENG1';
            }
        }
        if (savedMode !== 'dictation' && savedLevel === 'ielts') {
            savedLevel = 'cet4';
            try { window.__toyLS.setItem('toy_selected_exam_level', 'cet4'); } catch(e) {}
        }
        if (savedMode !== 'dictation' && savedLevel === 'daily') {
            savedLevel = 'cet4';
        }
        if (savedMode !== 'written' && savedLevel === 'kaoyan') {
            savedLevel = 'cet4';
        }
        window.currentExamLevel = savedLevel;
        let text = '四级';
        if (savedLevel === 'cet6') text = '六级';
        else if (savedLevel === 'gaokao') text = '高考';
        else if (savedLevel === 'kaoyan') text = (window.currentKaoyanSubjectFilter === 'ENG2') ? '考研英语(二)' : '考研英语(一)';
        else if (savedLevel === 'ielts') text = '雅思';
        document.querySelectorAll('.level-tag-bind').forEach(el => {
            el.textContent = text;
        });
        updateYearFilterVisibility(savedLevel);
    }
    try { initHomeTrainingModeSwitcher(); } catch (e) { console.warn('[HomePortal] Mode switcher init notice:', e); }

    function initTrainingModeIndicator() {
        const ind = document.getElementById('training-mode-indicator');
        if (!ind) return;
        const dots = ind.querySelectorAll('.mode-indicator-dot');
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                const targetMode = dot.getAttribute('data-mode');
                if (targetMode) switchTrainingMode(targetMode);
            });
        });
    }
    try { initTrainingModeIndicator(); } catch (e) { console.warn('[HomePortal] Mode indicator init notice:', e); }


    // Custom Hero Cover Wallpaper Upload & Persistence Engine
    function initHeroBgCustomizer() {
        const btnChangeHeroBg = document.getElementById('btn-change-hero-bg') || document.getElementById('btn-home-settings');
        const inputHeroBgUpload = document.getElementById('input-hero-bg-upload');
        const heroCover = document.querySelector('.home-hero-cover');
        if (!btnChangeHeroBg || !inputHeroBgUpload || !heroCover) return;
        if (btnChangeHeroBg.dataset && btnChangeHeroBg.dataset.heroBgBound === '1') return;
        if (btnChangeHeroBg.dataset) btnChangeHeroBg.dataset.heroBgBound = '1';

        const DEFAULT_HERO_BG = 'assets/images/background1.jpg';

        // 1. Load saved hero cover on startup (migrate legacy background1.png path seamlessly)
        let savedHeroBg = window.__toyLS.getItem('cet4_custom_hero_bg');
        if (savedHeroBg && savedHeroBg.includes('assets/images/background1.png')) {
            savedHeroBg = DEFAULT_HERO_BG;
            try { window.__toyLS.removeItem('cet4_custom_hero_bg'); } catch (e) {}
        }
        if (savedHeroBg) {
            heroCover.style.backgroundImage = `url("${savedHeroBg}")`;
        }

        const actionMask = document.getElementById('wallpaper-action-mask');
        const btnUploadBg = document.getElementById('btn-sheet-upload-bg');
        const btnResetBg = document.getElementById('btn-sheet-reset-bg');
        const btnCancelBg = document.getElementById('btn-sheet-cancel-bg');

        const openActionSheet = () => {
            if (actionMask) {
                const hasCustom = !!window.__toyLS.getItem('cet4_custom_hero_bg');
                if (btnResetBg) {
                    btnResetBg.style.display = hasCustom ? 'flex' : 'none';
                }
                actionMask.style.display = 'flex';
            }
        };

        const closeActionSheet = () => {
            if (actionMask) actionMask.style.display = 'none';
        };

        // 2. Click to open Wallpaper Action Sheet
        btnChangeHeroBg.addEventListener('click', (e) => {
            e.stopPropagation();
            openActionSheet();
        });

        if (btnUploadBg) {
            btnUploadBg.addEventListener('click', () => {
                closeActionSheet();
                inputHeroBgUpload.value = '';
                inputHeroBgUpload.click();
            });
        }

        if (btnResetBg) {
            btnResetBg.addEventListener('click', () => {
                closeActionSheet();
                window.__toyLS.removeItem('cet4_custom_hero_bg');
                heroCover.style.backgroundImage = `url("${DEFAULT_HERO_BG}")`;
            });
        }

        if (btnCancelBg) {
            btnCancelBg.addEventListener('click', closeActionSheet);
        }

        if (actionMask) {
            actionMask.addEventListener('click', (e) => {
                if (e.target === actionMask) closeActionSheet();
            });
        }

        // 3. Long press (Mobile) or Right Click (Desktop) quick reset shortcut
        let pressTimer = null;
        btnChangeHeroBg.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                if (window.__toyLS.getItem('cet4_custom_hero_bg')) {
                    window.__toyLS.removeItem('cet4_custom_hero_bg');
                    heroCover.style.backgroundImage = `url("${DEFAULT_HERO_BG}")`;
                }
            }, 700);
        }, { passive: true });
        btnChangeHeroBg.addEventListener('touchend', () => clearTimeout(pressTimer));
        btnChangeHeroBg.addEventListener('touchcancel', () => clearTimeout(pressTimer));

        btnChangeHeroBg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (window.__toyLS.getItem('cet4_custom_hero_bg')) {
                window.__toyLS.removeItem('cet4_custom_hero_bg');
                heroCover.style.backgroundImage = `url("${DEFAULT_HERO_BG}")`;
            }
        });

        // 4. Handle file selection with canvas resizing
        inputHeroBgUpload.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                if (typeof showToyToast === 'function') showToyToast('⚠️ 请选择有效的图片文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = (loadEvt) => {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 1200;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    try {
                        window.__toyLS.setItem('cet4_custom_hero_bg', compressedDataUrl);
                    } catch (err) {
                        console.warn('LocalStorage limit exceeded, saving lower quality:', err);
                        const lowerDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                        try {
                            window.__toyLS.setItem('cet4_custom_hero_bg', lowerDataUrl);
                        } catch (e2) {}
                    }

                    heroCover.style.backgroundImage = `url("${compressedDataUrl}")`;
                };
                img.src = loadEvt.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    initHeroBgCustomizer();
}
window.initHomePortalEvents = initHomePortalEvents;

/**
 * 5-Scheme Top Stats Unified Card Switcher Controller
 */
function initTopStatsSwitcher() {
    const savedTop = window.__toyLS.getItem('cet4_top_stats_deck') || '1';
    applyTopStatsScheme(savedTop);

    const layoutButtons = document.querySelectorAll('.layout-pill-btn[data-top]');
    layoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topId = e.currentTarget.getAttribute('data-top') || '1';
            applyTopStatsScheme(topId);
        });
    });
}

function applyTopStatsScheme(topId) {
    const validTop = ['1', '2', '3', '4', '5'].includes(String(topId)) ? String(topId) : '1';
    try {
        window.__toyLS.setItem('cet4_top_stats_deck', validTop);
    } catch (e) {}

    const layoutButtons = document.querySelectorAll('.layout-pill-btn[data-top]');
    layoutButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-top') === validTop);
    });

    const decks = document.querySelectorAll('.top-stats-deck');
    decks.forEach(deck => {
        deck.classList.toggle('active', deck.id === `top-stats-deck-${validTop}`);
    });

    if (typeof updateUserStatsOverview === 'function') {
        updateUserStatsOverview();
    }
}

window.initTopStatsSwitcher = initTopStatsSwitcher;
window.applyTopStatsScheme = applyTopStatsScheme;
