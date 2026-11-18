/* === js/home_calendar.js === */
/**
 * ==========================================================================
 * Bilibili Toy Home Calendar Engine (Week Strip & Full Month Calendar)
 * 1:1 Parity with 单词Toy StyleStoicObsidian & Habit Streak Calendar
 * ==========================================================================
 */

(function() {
    'use strict';

    const DAYS_META = [
        { single: 'M', short: 'Mon' },
        { single: 'T', short: 'Tue' },
        { single: 'W', short: 'Wed' },
        { single: 'T', short: 'Thu' },
        { single: 'F', short: 'Fri' },
        { single: 'S', short: 'Sat' },
        { single: 'S', short: 'Sun' }
    ];

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const DOT_COLOR_PRESETS = [
        { id: 'orange', name: '暖日橙', value: '#F97316' },
        { id: 'emerald', name: '翡翠绿', value: '#10B981' },
        { id: 'blue', name: '科技蓝', value: '#3B82F6' },
        { id: 'purple', name: '极光紫', value: '#8B5CF6' },
        { id: 'rose', name: '珊瑚粉', value: '#F43F5E' },
        { id: 'amber', name: '琥珀金', value: '#F59E0B' }
    ];

    let isCalendarExpanded = false;
    let realCurrentYear = new Date().getFullYear();
    let realCurrentMonth = new Date().getMonth(); // 0-indexed
    let realCurrentDate = new Date().getDate();

    let viewYear = realCurrentYear;
    let viewMonth = realCurrentMonth;

    let touchStartX = 0;
    let touchStartY = 0;

    /**
     * Color palette storage and switching
     */
    function getStoredDotColorId() {
        try {
            return window.__toyLS.getItem('toy_calendar_dot_color') || 'orange';
        } catch (e) {
            return 'orange';
        }
    }

    function setCalendarDotColor(colorId, showToast) {
        const found = DOT_COLOR_PRESETS.find(p => p.id === colorId) || DOT_COLOR_PRESETS[0];
        document.documentElement.style.setProperty('--calendar-dot-color', found.value);
        try {
            window.__toyLS.setItem('toy_calendar_dot_color', found.id);
        } catch (e) {}

        // Update active chip state in palette bar
        const chips = document.querySelectorAll('.palette-chip');
        chips.forEach(chip => {
            if (chip.dataset.color === found.id) {
                chip.classList.add('is-active');
            } else {
                chip.classList.remove('is-active');
            }
        });
    }

    function cycleCalendarDotColor() {
        const currentId = getStoredDotColorId();
        const currentIndex = DOT_COLOR_PRESETS.findIndex(p => p.id === currentId);
        const nextIndex = (currentIndex + 1) % DOT_COLOR_PRESETS.length;
        setCalendarDotColor(DOT_COLOR_PRESETS[nextIndex].id, true);
    }

    /**
     * Hand-drawn organic sketch circle SVG (手绘质感圈)
     */
    function getHandDrawnCircleSVG(seed) {
        // Natural rotational variance (-10deg to +10deg)
        const rot = ((seed * 19) % 21) - 10;
        return `
            <svg class="calendar-hand-circle" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rot}deg);" aria-hidden="true">
                <path d="M22 6 C32 5, 39.5 12, 38.5 22 C37.5 31.5, 30.5 38.5, 20.5 38 C11 37.5, 5.5 29.5, 6 20 C6.5 10.5, 15 5.5, 25 5.5 C29.5 5.5, 35 7.5, 37.5 10.5" 
                      stroke="var(--calendar-dot-color, #F97316)" 
                      stroke-width="2.3" 
                      stroke-linecap="round" 
                      stroke-linejoin="round" />
            </svg>
        `;
    }

    /**
     * User-isolated custom punched dates storage key
     */
    function getCalendarPunchesKey() {
        if (typeof window !== 'undefined' && typeof window.getUserStorageKey === 'function') {
            return window.getUserStorageKey('calendar_custom_punches');
        }
        return 'toy_calendar_custom_punches';
    }

    /**
     * Custom punched dates storage with safe user-isolated resolution
     */
    function getCustomPunchedDates() {
        try {
            const key = getCalendarPunchesKey();
            let raw = window.__toyLS.getItem(key);
            if (!raw) {
                const oldPunches = window.__toyLS.getItem('toy_calendar_custom_punches');
                const migratedTo = window.__toyLS.getItem('toy_custom_punches_migrated_to');
                const curUser = (typeof window.getCurrentUserKey === 'function') ? window.getCurrentUserKey() : 'guest';
                if (oldPunches && (!migratedTo || migratedTo === curUser)) {
                    try {
                        window.__toyLS.setItem(key, oldPunches);
                        window.__toyLS.setItem('toy_custom_punches_migrated_to', curUser);
                        raw = oldPunches;
                    } catch(e) {}
                }
            }
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function initSeedPunchesIfEmpty() {
        // Production ready: 严禁向真实账号写入虚假测试打卡点，保持新账号日历绝对纯净
        return;
    }

    /**
     * Check if a specific date has punch-in / practice history
     */
    function isDatePunched(year, month, day) {
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;

        // Priority 0: Check HabitStreak engine for current month
        if (window.HabitStreak && typeof window.HabitStreak.isDayPunched === 'function' && year === realCurrentYear && month === realCurrentMonth) {
            if (window.HabitStreak.isDayPunched(day)) {
                return true;
            }
        }

        // 1. Check custom toggled punch marks
        const customPunches = getCustomPunchedDates();
        if (customPunches[dateStr] !== undefined) {
            return !!customPunches[dateStr];
        }

        // 2. Check daily practice history
        if (typeof getDailyPracticeHistory === 'function') {
            const history = getDailyPracticeHistory();
            if (history && history.recent && history.recent[dateStr] > 0) {
                return true;
            }
        }

        // 3. Check completed exams timestamps
        if (window.completedExams) {
            for (const title in window.completedExams) {
                const item = window.completedExams[title];
                if (item && item.timestamp) {
                    const d = new Date(item.timestamp);
                    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
                        return true;
                    }
                }
            }
        }

        // 4. Check HabitStreak state for this month (Direct state inspection to prevent re-entrant deadlock)
        const monthKey = `${year}-${pad(month + 1)}`;
        if (window.HabitStreak && window.HabitStreak.state) {
            if (window.HabitStreak.state.monthKey === monthKey) {
                const isP = Array.isArray(window.HabitStreak.state.punchedDays) && window.HabitStreak.state.punchedDays.includes(day);
                const isM = Array.isArray(window.HabitStreak.state.makeupPunchedDays) && window.HabitStreak.state.makeupPunchedDays.includes(day);
                if (isP || isM) {
                    return true;
                }
            }
            if (Array.isArray(window.HabitStreak.state.makeupPunchedDates) && window.HabitStreak.state.makeupPunchedDates.includes(dateStr)) {
                return true;
            }
        }

        return false;
    }
    window.isCalendarDatePunched = isDatePunched;

    function refreshCurrentDate() {
        if (typeof getTodayDateStr === 'function') {
            const parts = getTodayDateStr().split('-').map(Number);
            if (parts.length === 3 && !isNaN(parts[0])) {
                realCurrentYear = parts[0];
                realCurrentMonth = parts[1] - 1;
                realCurrentDate = parts[2];
                return;
            }
        }
        const now = new Date();
        realCurrentYear = now.getFullYear();
        realCurrentMonth = now.getMonth();
        realCurrentDate = now.getDate();
    }

    /**
     * Get 7 days data for current week (Monday through Sunday)
     */
    function getWeekDaysData() {
        refreshCurrentDate();
        const today = new Date(realCurrentYear, realCurrentMonth, realCurrentDate);
        const jsDay = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
        const currentMondayIndex = jsDay === 0 ? 6 : jsDay - 1;
        const currentDate = today.getDate();

        return DAYS_META.map((meta, idx) => {
            const diff = idx - currentMondayIndex;
            const d = new Date(today);
            d.setDate(currentDate + diff);
            const dateNum = d.getDate();
            const yearNum = d.getFullYear();
            const monthNum = d.getMonth();
            const isToday = (idx === currentMondayIndex);
            
            let isPunched = false;
            let isMakeup = false;
            if (isToday) {
                isPunched = true;
            } else if (window.HabitStreak && yearNum === realCurrentYear && monthNum === realCurrentMonth) {
                isPunched = window.HabitStreak.isDayPunched(dateNum);
                isMakeup = window.HabitStreak.isDayMakeupPunched(dateNum);
            } else {
                isPunched = isDatePunched(yearNum, monthNum, dateNum);
            }

            return {
                dayLabel: isToday ? meta.short : meta.single,
                dateNum: dateNum,
                year: yearNum,
                month: monthNum,
                isToday: isToday,
                isPunched: isPunched,
                isMakeup: isMakeup
            };
        });
    }

    /**
     * Render the collapsed week strip (1:1 parity with Figure 1)
     */
    function renderWeekStrip() {
        const weekStrip = document.getElementById('calendar-week-strip');
        if (!weekStrip) return;

        const weekData = getWeekDaysData();
        let html = '';

        weekData.forEach(item => {
            const todayClass = item.isToday ? 'is-today' : '';
            const punchClass = item.isPunched ? 'has-punch' : '';
            const makeupClass = item.isMakeup ? 'is-makeup-punched' : '';
            // On home page week strip: only show dot for today (if punched)
            const showDot = item.isToday && item.isPunched;
            let dotHtml = '';
            if (showDot) {
                dotHtml = '<div class="calendar-dot is-today-dot" title="' + (item.isMakeup ? '已补签' : '已打卡') + '"></div>';
            }

            html += `
                <div class="calendar-week-pill ${todayClass} ${punchClass} ${makeupClass}" data-year="${item.year}" data-month="${item.month}" data-date="${item.dateNum}">
                    <span class="calendar-pill-day">${item.dayLabel}</span>
                    <span class="calendar-pill-date">${item.dateNum}</span>
                    <div class="calendar-pill-dot-box">${dotHtml}</div>
                </div>
            `;
        });

        weekStrip.innerHTML = html;
    }

    /**
     * Compute full-fidelity cumulative check-in days across all historical records:
     * - completedExams timestamps
     * - dailyPracticeHistory.recent keys
     * - calendar_custom_punches keys
     * - HabitStreak punchedDays & makeupPunchedDates
     * - persistent streakInfo.days counter
     */
    function getCalculatedTotalCumulativeDays() {
        const uniqueDates = new Set();

        // 1. All timestamps in completedExams
        if (window.completedExams && typeof window.completedExams === 'object') {
            Object.values(window.completedExams).forEach(item => {
                if (item && item.timestamp) {
                    const dt = new Date(item.timestamp);
                    if (!isNaN(dt.getTime())) {
                        const pad = n => String(n).padStart(2, '0');
                        uniqueDates.add(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
                    }
                }
            });
        }

        // 2. All practice history in dailyHistory
        if (typeof getDailyPracticeHistory === 'function') {
            const hist = getDailyPracticeHistory();
            if (hist && hist.recent) {
                Object.keys(hist.recent).forEach(d => {
                    uniqueDates.add(d);
                });
            }
        }

        // 3. All custom punched dates
        try {
            const custom = getCustomPunchedDates();
            Object.entries(custom).forEach(([d, val]) => {
                if (val) uniqueDates.add(d);
            });
        } catch(e) {}

        // 4. Current month punchedDays and makeup dates in HabitStreak
        if (window.HabitStreak && window.HabitStreak.state) {
            const hs = window.HabitStreak.state;
            if (Array.isArray(hs.makeupPunchedDates)) {
                hs.makeupPunchedDates.forEach(d => uniqueDates.add(d));
            }
            if (Array.isArray(hs.punchedDays) && hs.monthKey) {
                hs.punchedDays.forEach(day => {
                    const pad = n => String(n).padStart(2, '0');
                    uniqueDates.add(`${hs.monthKey}-${pad(day)}`);
                });
            }
            if (Array.isArray(hs.makeupPunchedDays) && hs.monthKey) {
                hs.makeupPunchedDays.forEach(day => {
                    const pad = n => String(n).padStart(2, '0');
                    uniqueDates.add(`${hs.monthKey}-${pad(day)}`);
                });
            }
        }

        const recordedDays = (window.streakInfo && typeof window.streakInfo.days === 'number') ? window.streakInfo.days : 0;
        const streakVal = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
            ? window.HabitStreak.calculateConsecutiveStreak()
            : ((window.HabitStreak && window.HabitStreak.state) ? window.HabitStreak.state.streakCount : 0);

        const total = Math.max(uniqueDates.size, recordedDays, streakVal);
        if (window.streakInfo && total > (window.streakInfo.days || 0)) {
            window.streakInfo.days = total;
        }
        return total;
    }
    window.getCalculatedTotalCumulativeDays = getCalculatedTotalCumulativeDays;

    /**
     * Synchronize the 3-item statistics card in the expanded month calendar view
     * (1:1 Parity with StyleStoicObsidian.vue lines 147-179)
     * 【累计打卡 N天 · 学习时长 N分/小时 · 连续打卡 N天】
     */
    function syncMonthStatsCard() {
        // 1. 累计打卡 (计算全部历史实际打卡天数，不随中断清零)
        const totalPunchedDays = getCalculatedTotalCumulativeDays();
        const totalValEl = document.getElementById('calendar-stat-total-val');
        if (totalValEl) {
            totalValEl.textContent = totalPunchedDays;
        }

        // 2. 学习时长
        const durValEl = document.getElementById('calendar-stat-duration-val');
        const durUnitEl = document.getElementById('calendar-stat-duration-unit');
        if (durValEl && durUnitEl) {
            const sec = (typeof getTotalLifetimePracticeDuration === 'function') 
                ? getTotalLifetimePracticeDuration() 
                : ((typeof getTodayPracticeDuration === 'function') ? getTodayPracticeDuration() : 0);
            if (sec >= 3600) {
                durValEl.textContent = (sec / 3600).toFixed(1).replace(/\.0$/, '');
                durUnitEl.textContent = '小时';
            } else if (sec > 0) {
                durValEl.textContent = String(Math.max(1, Math.round(sec / 60)));
                durUnitEl.textContent = '分';
            } else {
                durValEl.textContent = '0';
                durUnitEl.textContent = '分';
            }
        }

        // 3. 连续打卡 (真实连续天数，遇未打卡中断日即终止，补签后可无缝连上)
        let streakVal = 0;
        if (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function') {
            streakVal = window.HabitStreak.calculateConsecutiveStreak();
        } else if (window.HabitStreak && window.HabitStreak.state && typeof window.HabitStreak.state.streakCount === 'number') {
            streakVal = window.HabitStreak.state.streakCount;
        } else if (window.streakInfo && typeof window.streakInfo.streak === 'number' && window.streakInfo.streak <= 31) {
            streakVal = window.streakInfo.streak;
        } else {
            streakVal = 0;
        }
        const streakValEl = document.getElementById('calendar-stat-streak-val') || document.getElementById('calendar-stat-exams-val');
        if (streakValEl) {
            streakValEl.textContent = streakVal;
        }
    }

    /**
     * Render full month grid (1:1 parity with StyleStoicObsidian expanded state)
     */
    function renderMonthGrid() {
        const monthGrid = document.getElementById('month-grid');
        const titleEl = document.getElementById('month-title-text');
        const btnToday = document.getElementById('btn-calendar-today');
        if (!monthGrid || !titleEl) return;

        // Synchronize 3-item statistics card
        syncMonthStatsCard();

        // Title format: October 2026
        titleEl.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

        // '今' Return button visibility
        const isCurrentMonth = (viewYear === realCurrentYear && viewMonth === realCurrentMonth);
        if (btnToday) {
            btnToday.style.display = isCurrentMonth ? 'none' : 'inline-flex';
        }

        // Days in viewing month
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

        // 1st of month Day of Week offset (Monday = 0, Sunday = 6)
        const jsDayFirst = new Date(viewYear, viewMonth, 1).getDay();
        const startDayOffset = jsDayFirst === 0 ? 6 : jsDayFirst - 1;

        let html = '';

        // Leading blank cells
        for (let b = 0; b < startDayOffset; b++) {
            html += '<div class="month-grid-blank"></div>';
        }

        // Days 1..daysInMonth
        for (let d = 1; d <= daysInMonth; d++) {
            const isTodayInView = (isCurrentMonth && d === realCurrentDate);
            let isPunched = isDatePunched(viewYear, viewMonth, d);
            let isMakeupPunched = false;
            let canMakeup = false;

            if (window.HabitStreak) {
                if (isCurrentMonth) {
                    isPunched = isPunched || window.HabitStreak.isDayPunched(d);
                    isMakeupPunched = window.HabitStreak.isDayMakeupPunched(d);
                } else {
                    const pad = n => String(n).padStart(2, '0');
                    const dStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
                    if (window.HabitStreak.state && Array.isArray(window.HabitStreak.state.makeupPunchedDates)) {
                        isMakeupPunched = window.HabitStreak.state.makeupPunchedDates.includes(dStr);
                    }
                }
                canMakeup = window.HabitStreak.canMakeupDay(d, viewMonth, viewYear);
            }

            const todayClass = isTodayInView ? 'is-today' : '';
            const punchClass = isPunched ? 'has-punch' : '';
            const makeupClass = isMakeupPunched ? 'is-makeup-punched' : '';
            const canMakeupClass = canMakeup ? 'can-makeup' : '';

            let dotHtml = '';
            if (isPunched) {
                dotHtml = '<div class="calendar-dot" title="' + (isMakeupPunched ? '已补签' : '已打卡') + '"></div>';
            }

            let cellTitle = '轻触查看';
            if (isTodayInView) cellTitle = isPunched ? '今日已打卡' : '轻触完成今日打卡';
            else if (canMakeup) cellTitle = `轻触补签 ${viewMonth + 1}月${d}日`;
            else if (isMakeupPunched) cellTitle = `${viewMonth + 1}月${d}日 (补签点亮)`;
            else if (isPunched) cellTitle = `${viewMonth + 1}月${d}日 (已打卡)`;

            html += `
                <div class="month-grid-day ${todayClass} ${punchClass} ${makeupClass} ${canMakeupClass}" data-year="${viewYear}" data-month="${viewMonth}" data-day="${d}" title="${cellTitle}">
                    <span class="month-day-num">${d}</span>
                    <div class="month-day-dot-box">${dotHtml}</div>
                </div>
            `;
        }

        monthGrid.innerHTML = html;

        // Attach click listeners to day cells to handle check-in & makeup punch
        monthGrid.querySelectorAll('.month-grid-day').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = parseInt(cell.dataset.day, 10);
                const isCurMonth = (viewYear === realCurrentYear && viewMonth === realCurrentMonth);

                if (!window.HabitStreak) return;

                // 1. 今日点击：直接完成今日打卡（静默打卡，无任何弹窗）
                if (isCurMonth && day === realCurrentDate) {
                    if (!window.HabitStreak.isDayPunched(day)) {
                        window.HabitStreak.punchToday();
                        renderMonthGrid();
                        renderWeekStrip();
                        syncMonthStatsCard();
                    }
                    return;
                }

                // 2. 漏打卡历史日期
                if (window.HabitStreak.canMakeupDay(day, viewMonth, viewYear)) {
                    const used = window.HabitStreak.state.monthlyUsedMakeupCount;
                    const maxQuota = window.HabitStreak.MAX_MONTHLY_MAKEUP;

                    if (used >= maxQuota) {
                        if (typeof showToyToast === 'function') {
                            showToyToast(`本月 ${maxQuota} 次补签机会已全部用完啦`);
                        }
                        return;
                    }

                    const hasCard = window.HabitStreak && window.HabitStreak.state.makeupCardsCount > 0;
                    if (hasCard) {
                        // 拥有补签卡：弹出简约白风格的“是否确定补签”确认弹窗
                        openDirectMakeupConfirmModal(day, viewMonth, viewYear);
                    } else {
                        // 未拥有补签卡：唤起成就明信片海报页面，引导用户转发补签
                        if (typeof window.openShareCardModal === 'function') {
                            window.openShareCardModal(day, viewMonth, viewYear);
                        }
                    }
                    return;
                }

                // 3. 已打卡日期 & 4. 未来日期：彻底静默，不触发任何黑色 toast 弹窗
            });
        });
    }

    /**
     * Expand to Full Month Calendar (Single-phase smooth direct transition, 0 overshoot)
     */
    function expandCalendar() {
        if (isCalendarExpanded) return;
        const wrap = document.getElementById('calendar-container-wrap');
        const monthCard = document.getElementById('calendar-month-card');
        if (!wrap || !monthCard) return;

        isCalendarExpanded = true;
        renderMonthGrid();

        // 1. Read exact natural height directly from the rendered month card
        const targetHeight = monthCard.offsetHeight;

        // 2. Animate directly to targetHeight in one single smooth transition
        wrap.classList.add('is-transitioning');
        wrap.classList.remove('is-collapsed');
        wrap.classList.add('is-expanded');
        wrap.style.height = `${targetHeight}px`;

        // 3. Clear transitioning flag when animation completes
        setTimeout(() => {
            wrap.classList.remove('is-transitioning');
        }, 340);
    }

    /**
     * Collapse back to Week Strip (Single-phase smooth direct transition)
     */
    function collapseCalendar() {
        if (!isCalendarExpanded) return;
        const wrap = document.getElementById('calendar-container-wrap');
        const weekStrip = document.getElementById('calendar-week-strip');
        if (!wrap || !weekStrip) return;

        isCalendarExpanded = false;

        const targetHeight = weekStrip.offsetHeight || 66;

        wrap.classList.add('is-transitioning');
        wrap.classList.remove('is-expanded');
        wrap.classList.add('is-collapsed');
        wrap.style.height = `${targetHeight}px`;

        setTimeout(() => {
            wrap.classList.remove('is-transitioning');
        }, 340);
    }

    function syncExpandedHeight() {
        if (!isCalendarExpanded) return;
        const wrap = document.getElementById('calendar-container-wrap');
        const monthCard = document.getElementById('calendar-month-card');
        if (wrap && monthCard) {
            wrap.style.height = `${monthCard.offsetHeight}px`;
        }
    }

    function prevMonth() {
        viewMonth--;
        if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
        }
        renderMonthGrid();
        syncExpandedHeight();
    }

    function nextMonth() {
        viewMonth++;
        if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
        }
        renderMonthGrid();
        syncExpandedHeight();
    }

    function resetToCurrentMonth() {
        viewYear = realCurrentYear;
        viewMonth = realCurrentMonth;
        renderMonthGrid();
        syncExpandedHeight();
    }

    /**
     * Touch swipe gestures for Month Card
     */
    function handleTouchStart(e) {
        if (!e.touches || e.touches.length === 0) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e) {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // If predominantly horizontal swipe (> 45px)
        if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX > 0) {
                prevMonth(); // Swipe right -> Previous month
            } else {
                nextMonth(); // Swipe left -> Next month
            }
        }
    }

    let currentPendingMakeup = null;

    function openDirectMakeupConfirmModal(day, month, year) {
        const modal = document.getElementById('makeup-confirm-modal-overlay');
        const descEl = document.getElementById('makeup-confirm-desc');
        if (!modal) return;

        currentPendingMakeup = { day, month, year };
        const m = (typeof month === 'number') ? month + 1 : (new Date().getMonth() + 1);
        const yPrefix = (typeof year === 'number' && year !== realCurrentYear) ? `${year}年` : '';
        if (descEl) {
            descEl.textContent = `是否确定消耗 1 张补签卡，补签 ${yPrefix}${m}月${day}日 的打卡记录？`;
        }

        modal.style.display = 'flex';
    }

    function closeDirectMakeupConfirmModal() {
        const modal = document.getElementById('makeup-confirm-modal-overlay');
        if (modal) modal.style.display = 'none';
        currentPendingMakeup = null;
    }

    function handleConfirmDirectMakeup() {
        if (!currentPendingMakeup || !window.HabitStreak) {
            closeDirectMakeupConfirmModal();
            return;
        }

        const { day, month, year } = currentPendingMakeup;
        const res = window.HabitStreak.useMakeupCard(day, month, year);
        closeDirectMakeupConfirmModal();

        if (res.success) {
            renderMonthGrid();
            renderWeekStrip();
            syncMonthStatsCard();
            if (typeof updateDashboardStats === 'function') {
                updateDashboardStats();
            }
            if (typeof window.launchGrandConfettiShow === 'function') {
                window.launchGrandConfettiShow();
            }
        }
    }

    /**
     * Initialize the Home Calendar Component
     */
    function initHomeCalendar() {
        // Initialize dot color and preview data
        initSeedPunchesIfEmpty();
        setCalendarDotColor(getStoredDotColorId(), false);

        const wrap = document.getElementById('calendar-container-wrap');
        const weekStrip = document.getElementById('calendar-week-strip');
        const monthCard = document.getElementById('calendar-month-card');

        if (!wrap || !weekStrip) return;

        // Render week strip & pre-render month grid so height is calculated with zero lag
        renderWeekStrip();
        renderMonthGrid();

        // Idempotency guard: prevent double event binding when both DOMContentLoaded and app.js call initHomeCalendar()
        if (wrap.dataset && wrap.dataset.calendarBound === '1') {
            if (!isCalendarExpanded) {
                const curH = weekStrip.offsetHeight || 66;
                wrap.style.height = `${curH}px`;
            }
            return;
        }
        if (wrap.dataset) wrap.dataset.calendarBound = '1';

        // Initial height set to week strip
        const initialHeight = weekStrip.offsetHeight || 66;
        wrap.style.height = `${initialHeight}px`;

        // Event: Minimalist White Makeup Confirm Modal
        const btnCancelMakeup = document.getElementById('btn-cancel-makeup');
        const btnOkMakeup = document.getElementById('btn-ok-makeup');
        const makeupConfirmOverlay = document.getElementById('makeup-confirm-modal-overlay');

        if (btnCancelMakeup) {
            btnCancelMakeup.addEventListener('click', (e) => {
                e.stopPropagation();
                closeDirectMakeupConfirmModal();
            });
        }
        if (btnOkMakeup) {
            btnOkMakeup.addEventListener('click', (e) => {
                e.stopPropagation();
                handleConfirmDirectMakeup();
            });
        }
        if (makeupConfirmOverlay) {
            makeupConfirmOverlay.addEventListener('click', (e) => {
                if (e.target === makeupConfirmOverlay) {
                    closeDirectMakeupConfirmModal();
                }
            });
        }

        // Event: Tap week strip to expand
        weekStrip.addEventListener('click', (e) => {
            expandCalendar();
        });

        // Event: Collapse button
        const btnCollapse = document.getElementById('btn-calendar-collapse');
        if (btnCollapse) {
            btnCollapse.addEventListener('click', (e) => {
                e.stopPropagation();
                collapseCalendar();
            });
        }

        // Event: Color palette chips in month card
        const paletteChips = document.querySelectorAll('.palette-chip');
        paletteChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const colorId = chip.dataset.color;
                setCalendarDotColor(colorId, true);
            });
        });

        // Event: Month nav buttons
        const btnPrev = document.getElementById('btn-month-prev');
        const btnNext = document.getElementById('btn-month-next');
        const btnToday = document.getElementById('btn-calendar-today');

        if (btnPrev) {
            btnPrev.addEventListener('click', (e) => {
                e.stopPropagation();
                prevMonth();
            });
        }
        if (btnNext) {
            btnNext.addEventListener('click', (e) => {
                e.stopPropagation();
                nextMonth();
            });
        }
        if (btnToday) {
            btnToday.addEventListener('click', (e) => {
                e.stopPropagation();
                resetToCurrentMonth();
            });
        }

        // Event: Open Makeup Card Center Modal
        const btnMakeupCenter = document.getElementById('btn-open-makeup-center');
        if (btnMakeupCenter) {
            btnMakeupCenter.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.HabitStreak && typeof window.HabitStreak.openMakeupCenterModal === 'function') {
                    window.HabitStreak.openMakeupCenterModal();
                }
            });
        }

        // Sync HabitStreak badge counts
        if (window.HabitStreak && typeof window.HabitStreak.syncMakeupBadgeUI === 'function') {
            window.HabitStreak.syncMakeupBadgeUI();
        }

        // Touch swipe support on month card
        if (monthCard) {
            monthCard.addEventListener('touchstart', handleTouchStart, { passive: true });
            monthCard.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
    }

    /**
     * Public method to refresh calendar UI on stats/date changes
     */
    function updateHomeCalendar() {
        realCurrentYear = new Date().getFullYear();
        realCurrentMonth = new Date().getMonth();
        realCurrentDate = new Date().getDate();

        renderWeekStrip();
        syncMonthStatsCard();
        if (isCalendarExpanded) {
            renderMonthGrid();
        }
        if (window.HabitStreak && typeof window.HabitStreak.syncMakeupBadgeUI === 'function') {
            window.HabitStreak.syncMakeupBadgeUI();
        }
    }

    /**
     * Hot reload home calendar for a newly switched user identity
     */
    function reloadForUser() {
        refreshCurrentDate();
        renderWeekStrip();
        syncMonthStatsCard();
        if (isCalendarExpanded) {
            renderMonthGrid();
        }
    }

    // Export to global scope
    window.initHomeCalendar = initHomeCalendar;
    window.updateHomeCalendar = updateHomeCalendar;
    window.expandCalendar = expandCalendar;
    window.collapseCalendar = collapseCalendar;
    window.setCalendarDotColor = setCalendarDotColor;
    window.cycleCalendarDotColor = cycleCalendarDotColor;
    window.syncMonthStatsCard = syncMonthStatsCard;
    window.renderMonthGrid = renderMonthGrid;
    window.HomeCalendar = {
        renderMonthGrid,
        renderWeekStrip,
        syncMonthStatsCard,
        updateHomeCalendar,
        expandCalendar,
        collapseCalendar,
        reloadForUser
    };

    // Auto mount when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHomeCalendar);
    } else {
        setTimeout(initHomeCalendar, 20);
    }
})();
