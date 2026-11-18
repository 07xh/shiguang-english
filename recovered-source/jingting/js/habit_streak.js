/* === js/habit_streak.js === */
/**
 * ==========================================================================
 * Bilibili Toy Habit Streak & Makeup Punch Engine (连胜签到与补签卡中心)
 * 1:1 Parity with 单词Toy useHabitStreak.ts & StyleStoicObsidian
 * ==========================================================================
 */

(function() {
    'use strict';

    // 每月最多补签 4 次，转发卡片成功最多获取 4 次机会
    const MAX_MONTHLY_MAKEUP = 4;
    function getStreakStorageKey() {
        if (typeof window !== 'undefined' && typeof window.getUserStorageKey === 'function') {
            return window.getUserStorageKey('habit_streak_v5');
        }
        return 'word_toy_habit_streak_v5';
    }
    const LEGACY_STORAGE_KEYS = ['word_toy_habit_streak_v4', 'word_toy_habit_streak_v3', 'word_toy_habit_streak_v2', 'word_toy_habit_streak'];

    // 当前年月 Key (例如 2026-10)
    function getCurrentMonthKey() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}`;
    }

    // 初始化默认打卡状态（真实生产账号初始无打卡记录，彻底杜绝跨账号数据污染）
    function initDefaultPunchedDays() {
        return [];
    }

    /**
     * 核心算法：精准计算从今天倒推的真实连续打卡天数（Consecutive Streak）
     * 遇到任何一天中断，立即 break 终止连胜！
     * 例如 13 号中断，14、15 号打卡，则连续打卡严格为 2 天。
     */
    let isCalculatingStreak = false;
    function calculateConsecutiveStreak() {
        if (isCalculatingStreak) {
            return (state && typeof state.streakCount === 'number') ? state.streakCount : 0;
        }
        isCalculatingStreak = true;
        try {
            const now = new Date();
            const curYear = now.getFullYear();
            const curMonth = now.getMonth();
            const today = now.getDate();

            // 检查今天是否在已打卡列表或今日已学
            const todayPunched = (state.punchedDays && state.punchedDays.includes(today)) || 
                                 (state.makeupPunchedDays && state.makeupPunchedDays.includes(today)) ||
                                 (typeof getTodayPracticeDuration === 'function' && getTodayPracticeDuration() > 0) ||
                                 (typeof window.isCalendarDatePunched === 'function' && window.isCalendarDatePunched(curYear, curMonth, today));

        let streak = 0;
        let checkDate = new Date(curYear, curMonth, today);

        if (todayPunched) {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // 今天白天尚未打卡，从昨天向前检测（保留昨日延续的连胜，不直接归零）
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // 逐日前推校验（最多前推 365 天）
        for (let i = 0; i < 365; i++) {
            const y = checkDate.getFullYear();
            const m = checkDate.getMonth();
            const d = checkDate.getDate();

            let punched = false;
            if (y === curYear && m === curMonth) {
                // 当月：严格以 punchedDays、makeupPunchedDays 或日历做题记录为准
                punched = (state.punchedDays && state.punchedDays.includes(d)) || 
                          (state.makeupPunchedDays && state.makeupPunchedDays.includes(d)) ||
                          (typeof window.isCalendarDatePunched === 'function' && window.isCalendarDatePunched(y, m, d));
            } else {
                // 跨月（历史月份）：
                if (typeof window.isCalendarDatePunched === 'function') {
                    punched = window.isCalendarDatePunched(y, m, d);
                } else {
                    const pad = n => String(n).padStart(2, '0');
                    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
                    try {
                        const calKey = (typeof window.getUserStorageKey === 'function') 
                            ? window.getUserStorageKey('calendar_custom_punches') 
                            : 'toy_calendar_custom_punches';
                        const custom = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
                        punched = !!custom[k];
                    } catch(e) {}
                }
            }

            if (punched) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                // 🛑 核心修复：一旦遇到任何未打卡中断日，绝不能继续累计，立即退出循环！
                break;
            }
        }

        return streak;
    } finally {
        isCalculatingStreak = false;
    }
}

    // 全局打卡与补签状态对象（初始为纯净真实账号状态）
    const state = {
        monthKey: getCurrentMonthKey(),
        streakCount: 0, // 连胜天数
        makeupCardsCount: 0, // 当前可用补签卡数量 (初始为 0，需转发卡片获取)
        monthlyRewardedCardsCount: 0, // 本月已通过转发卡片获得的补签机会数（上限 4）
        monthlyUsedMakeupCount: 0, // 本月已使用的补签次数（上限 4）
        punchedDays: [], // 本月正常打卡日期
        makeupPunchedDays: [], // 本月补签日期
        makeupPunchedDates: [], // 历史补签日期 (格式 YYYY-MM-DD)
    };

    let isInitialized = false;

    function loadFromLocal() {
        if (typeof window === 'undefined') return;
        try {
            const currentStorageKey = getStreakStorageKey();
            let raw = window.__toyLS.getItem(currentStorageKey);
            const nowKey = getCurrentMonthKey();

            // 如果当前独立账号键暂无记录，尝试为第一位老用户进行单次平滑迁移，绝不污染新账号
            if (!raw) {
                const curUser = (typeof window.getCurrentUserKey === 'function') ? window.getCurrentUserKey() : 'guest';
                const migratedTo = window.__toyLS.getItem('toy_habit_streak_migrated_to');
                if (!migratedTo || migratedTo === curUser) {
                    for (const oldKey of LEGACY_STORAGE_KEYS) {
                        const oldRaw = window.__toyLS.getItem(oldKey);
                        if (oldRaw) {
                            try {
                                const oldData = JSON.parse(oldRaw);
                                if (oldData && (oldData.streakCount || (oldData.punchedDays && oldData.punchedDays.length > 0))) {
                                    window.__toyLS.setItem(currentStorageKey, oldRaw);
                                    window.__toyLS.setItem('toy_habit_streak_migrated_to', curUser);
                                    raw = oldRaw;
                                    break;
                                }
                            } catch(e) {}
                        }
                    }
                }
            }

            if (raw) {
                const data = JSON.parse(raw);
                if (data.monthKey === nowKey) {
                    state.monthKey = nowKey;
                    state.makeupCardsCount = data.makeupCardsCount ?? 0;
                    state.monthlyRewardedCardsCount = data.monthlyRewardedCardsCount ?? 0;
                    state.monthlyUsedMakeupCount = data.monthlyUsedMakeupCount ?? 0;
                    state.punchedDays = Array.isArray(data.punchedDays) ? data.punchedDays : [];
                    state.makeupPunchedDays = Array.isArray(data.makeupPunchedDays) ? data.makeupPunchedDays : [];
                    state.makeupPunchedDates = Array.isArray(data.makeupPunchedDates) ? data.makeupPunchedDates : [];
                } else {
                    // 跨月重置月度额度与使用次数，保留剩余补签卡及历史补签日期
                    state.monthKey = nowKey;
                    state.makeupCardsCount = data.makeupCardsCount ?? 0;
                    state.monthlyRewardedCardsCount = 0; // 重置每月领取额度
                    state.monthlyUsedMakeupCount = 0; // 重置每月使用额度
                    state.punchedDays = [];
                    state.makeupPunchedDays = [];
                    state.makeupPunchedDates = Array.isArray(data.makeupPunchedDates) ? data.makeupPunchedDates : [];
                }
            } else {
                state.monthKey = nowKey;
                state.makeupCardsCount = 0;
                state.monthlyRewardedCardsCount = 0;
                state.monthlyUsedMakeupCount = 0;
                state.punchedDays = [];
                state.makeupPunchedDays = [];
                state.makeupPunchedDates = [];
            }

            // 每日登录 Toy 自动静默打卡（无任何弹窗提示）
            const now = new Date();
            const today = now.getDate();
            const pad = n => String(n).padStart(2, '0');
            const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(today)}`;
            let autoPunchedToday = false;
            if (!state.punchedDays.includes(today) && !state.makeupPunchedDays.includes(today)) {
                state.punchedDays.push(today);
                state.punchedDays.sort((a, b) => a - b);
                autoPunchedToday = true;
            }
            try {
                const calKey = (typeof window.getUserStorageKey === 'function')
                    ? window.getUserStorageKey('calendar_custom_punches')
                    : 'toy_calendar_custom_punches';
                const custom = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
                if (!custom[todayDateStr]) {
                    custom[todayDateStr] = true;
                    if (typeof safeLocalStorageSet === 'function') {
                        safeLocalStorageSet(calKey, JSON.stringify(custom));
                    } else {
                        window.__toyLS.setItem(calKey, JSON.stringify(custom));
                    }
                }
            } catch (e) {}

            // 依据实际打卡记录动态精准计算连胜天数
            state.streakCount = calculateConsecutiveStreak();

            if (autoPunchedToday) {
                try {
                    if (typeof safeLocalStorageSet === 'function') {
                        safeLocalStorageSet(currentStorageKey, JSON.stringify(state));
                    } else {
                        window.__toyLS.setItem(currentStorageKey, JSON.stringify(state));
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[HabitStreak] 加载打卡状态失败', e);
            state.punchedDays = [new Date().getDate()];
            state.streakCount = 1;
        }
    }

    function saveToLocal(triggerSync = true) {
        if (typeof window === 'undefined') return;
        try {
            state.streakCount = calculateConsecutiveStreak();
            const currentStorageKey = getStreakStorageKey();

            if (typeof safeLocalStorageSet === 'function') {
                safeLocalStorageSet(currentStorageKey, JSON.stringify(state));
            } else {
                window.__toyLS.setItem(currentStorageKey, JSON.stringify(state));
            }

            // 同步更新全局 streakInfo
            const streakToday = (typeof getTodayDateStr === 'function') 
                ? getTodayDateStr() 
                : (function() {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();

            const calcDays = (typeof window.getCalculatedTotalCumulativeDays === 'function')
                ? window.getCalculatedTotalCumulativeDays()
                : Math.max((window.streakInfo && window.streakInfo.days) || 0, state.streakCount);

            if (window.streakInfo) {
                window.streakInfo.streak = state.streakCount; // 连续打卡
                window.streakInfo.days = calcDays; // 真实去重累计打卡天数
                window.streakInfo.lastDate = streakToday;
            }

            try {
                const totalDaysVal = (window.streakInfo && window.streakInfo.days) ? window.streakInfo.days : calcDays;
                if (typeof getUserStorageKey === 'function') {
                    const sKey = getUserStorageKey('streak_info');
                    const sData = JSON.stringify(window.streakInfo || { streak: state.streakCount, days: totalDaysVal, lastDate: streakToday });
                    if (typeof safeLocalStorageSet === 'function') {
                        safeLocalStorageSet(sKey, sData);
                    } else {
                        window.__toyLS.setItem(sKey, sData);
                    }
                }
            } catch (e) {}

            // 触发权威 Bilibili Toy 云存储同步
            if (triggerSync && typeof saveUserCloudData === 'function') {
                saveUserCloudData();
            }

            // 同步更新页面中的所有连续打卡天数显示
            syncStreakDisplay();
            syncMakeupBadgeUI();
        } catch (e) {
            console.warn('[HabitStreak] 保存打卡状态失败', e);
        }
    }

    function syncStreakDisplay() {
        state.streakCount = calculateConsecutiveStreak();
        const streak = state.streakCount;
        document.querySelectorAll('#dashboard-streak-number, .home-streak-number-bind, #home-streak-days-val').forEach(el => {
            el.textContent = streak;
        });
        document.querySelectorAll('.stat-streak-days, #home-pill-streak').forEach(el => {
            el.innerHTML = `${streak}<small>天</small>`;
        });
        const shareStreakEl = document.getElementById('share-card-streak');
        if (shareStreakEl) {
            shareStreakEl.textContent = `${streak}天`;
        }
        const calStreakEl = document.getElementById('calendar-stat-streak-val') || document.getElementById('calendar-stat-exams-val');
        if (calStreakEl) {
            calStreakEl.textContent = streak;
        }
        if (typeof window.updateFlame === 'function') {
            window.updateFlame(streak);
        }
        if (typeof window.updateDashboardFlame === 'function') {
            window.updateDashboardFlame(streak);
        }
        if (typeof window.syncMonthStatsCard === 'function') {
            window.syncMonthStatsCard();
        }
        if (typeof window.renderMonthGrid === 'function') {
            window.renderMonthGrid();
        }
    }

    function syncMakeupBadgeUI() {
        const badgeNum = document.getElementById('calendar-makeup-count');
        if (badgeNum) {
            badgeNum.textContent = state.makeupCardsCount;
        }
        const badgeCenterNum = document.getElementById('modal-makeup-balance-num');
        if (badgeCenterNum) {
            badgeCenterNum.textContent = state.makeupCardsCount;
        }
        const modalUsedNum = document.getElementById('modal-makeup-used-num');
        if (modalUsedNum) {
            modalUsedNum.textContent = `${state.monthlyUsedMakeupCount} / ${MAX_MONTHLY_MAKEUP} 次`;
        }
        const modalRewardNum = document.getElementById('modal-makeup-reward-num');
        if (modalRewardNum) {
            const rem = Math.max(0, MAX_MONTHLY_MAKEUP - state.monthlyRewardedCardsCount);
            modalRewardNum.textContent = `${rem} 张`;
        }
    }

    let isInitializing = false;
    function ensureInit() {
        if (isInitialized || isInitializing) return;
        isInitializing = true;
        try {
            loadFromLocal();
            state.streakCount = calculateConsecutiveStreak();
            isInitialized = true;
            syncStreakDisplay();
            syncMakeupBadgeUI();
        } catch(e) {
            console.warn('[HabitStreak] ensureInit error:', e);
            isInitialized = true;
        } finally {
            isInitializing = false;
        }
    }

    // 本月剩余可通过转发领取的补签机会（上限 4）
    function getRemainingShareRewards() {
        ensureInit();
        return Math.max(0, MAX_MONTHLY_MAKEUP - state.monthlyRewardedCardsCount);
    }

    // 本月剩余可补签次数（上限 4）
    function getRemainingMakeupQuota() {
        ensureInit();
        return Math.max(0, MAX_MONTHLY_MAKEUP - state.monthlyUsedMakeupCount);
    }

    // 判断指定日期是否已打卡（正常打卡或已补签）
    function isDayPunched(day) {
        ensureInit();
        return (state.punchedDays && state.punchedDays.includes(day)) || 
               (state.makeupPunchedDays && state.makeupPunchedDays.includes(day));
    }

    // 判断指定日期是否是通过补签点亮的
    function isDayMakeupPunched(day) {
        ensureInit();
        return state.makeupPunchedDays.includes(day);
    }

    // 判断指定日期是否可补签（必须是今天之前的历史日期，且尚未打卡）
    function canMakeupDay(day, checkMonth, checkYear) {
        ensureInit();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const today = now.getDate();

        const targetYear = (typeof checkYear === 'number') ? checkYear : currentYear;
        const targetMonth = (typeof checkMonth === 'number') ? checkMonth : currentMonth;

        // 1. 严格检查是否是过去的日期（今天及未来不可补签）
        if (targetYear > currentYear) return false;
        if (targetYear === currentYear && targetMonth > currentMonth) return false;
        if (targetYear === currentYear && targetMonth === currentMonth && day >= today) return false;

        // 2. 检查当月是否已打卡（正常打卡或已补签）
        if (targetYear === currentYear && targetMonth === currentMonth) {
            return !isDayPunched(day);
        }

        // 3. 检查跨月历史日期是否已打卡
        if (typeof window.isCalendarDatePunched === 'function') {
            return !window.isCalendarDatePunched(targetYear, targetMonth, day);
        }

        const pad = n => String(n).padStart(2, '0');
        const k = `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;
        try {
            const calKey = (typeof window.getUserStorageKey === 'function') 
                ? window.getUserStorageKey('calendar_custom_punches') 
                : 'toy_calendar_custom_punches';
            const custom = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
            return !custom[k];
        } catch (e) {
            return true;
        }
    }

    // 转发卡片给好友/保存明信片成功后获得 1 次补签机会（每月最多 4 次）
    function grantMakeupCardViaShare() {
        ensureInit();
        if (state.monthlyRewardedCardsCount >= MAX_MONTHLY_MAKEUP) {
            return {
                success: false,
                limitReached: true,
                message: `本月通过转发卡片领取的补签机会已达上限（${MAX_MONTHLY_MAKEUP}/${MAX_MONTHLY_MAKEUP} 次）`,
            };
        }

        state.makeupCardsCount += 1;
        state.monthlyRewardedCardsCount += 1;
        saveToLocal();

        return {
            success: true,
            message: `🎉 转发卡片成功！已获得 1 次补签机会（本月已获得 ${state.monthlyRewardedCardsCount}/${MAX_MONTHLY_MAKEUP} 次）`,
        };
    }

    // 消耗 1 次补签机会补签指定日期（支持当前月份及所有历史月份）
    function useMakeupCard(day, checkMonth, checkYear) {
        ensureInit();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const targetYear = (typeof checkYear === 'number') ? checkYear : currentYear;
        const targetMonth = (typeof checkMonth === 'number') ? checkMonth : currentMonth;

        if (!canMakeupDay(day, targetMonth, targetYear)) {
            return { success: false, message: '该日期不可补签' };
        }

        if (state.monthlyUsedMakeupCount >= MAX_MONTHLY_MAKEUP) {
            return { success: false, message: `本月 ${MAX_MONTHLY_MAKEUP} 次补签机会已全部用完` };
        }

        if (state.makeupCardsCount <= 0) {
            return { success: false, message: '暂无可用补签机会，请先转发卡片给好友获取' };
        }

        state.makeupCardsCount -= 1;
        state.monthlyUsedMakeupCount += 1;

        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;

        // 1. 同步写入持久化日历自定义打卡存储 (跨月与全屏日历视图直接生效)
        try {
            const calKey = (typeof window.getUserStorageKey === 'function') 
                ? window.getUserStorageKey('calendar_custom_punches') 
                : 'toy_calendar_custom_punches';
            const custom = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
            custom[dateStr] = true;
            window.__toyLS.setItem(calKey, JSON.stringify(custom));
        } catch (e) {}

        // 2. 当月日期同步至 makeupPunchedDays
        if (targetYear === currentYear && targetMonth === currentMonth) {
            if (!state.makeupPunchedDays.includes(day)) {
                state.makeupPunchedDays = [...state.makeupPunchedDays, day];
            }
        }

        // 3. 记录跨月历史补签列表
        if (!state.makeupPunchedDates) {
            state.makeupPunchedDates = [];
        }
        if (!state.makeupPunchedDates.includes(dateStr)) {
            state.makeupPunchedDates.push(dateStr);
        }

        state.streakCount = calculateConsecutiveStreak();
        saveToLocal();

        if (typeof window.updateHomeCalendar === 'function') {
            window.updateHomeCalendar();
        }

        return {
            success: true,
            message: `成功补签 ${targetMonth + 1}月${day}日！连胜天数已恢复至 ${state.streakCount} 天 ✨`,
        };
    }

    // 正常打卡（登录 Toy 自动静默打卡或学习完试题打卡，绝不触发任何弹窗）
    function punchToday(triggerSync = true) {
        ensureInit();
        const now = new Date();
        const today = now.getDate();
        const pad = n => String(n).padStart(2, '0');
        const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(today)}`;
        let changed = false;

        try {
            const calKey = (typeof window.getUserStorageKey === 'function')
                ? window.getUserStorageKey('calendar_custom_punches')
                : 'toy_calendar_custom_punches';
            const custom = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
            if (!custom[todayDateStr]) {
                custom[todayDateStr] = true;
                if (typeof safeLocalStorageSet === 'function') {
                    safeLocalStorageSet(calKey, JSON.stringify(custom));
                } else {
                    window.__toyLS.setItem(calKey, JSON.stringify(custom));
                }
                changed = true;
            }
        } catch (e) {}

        if (!state.punchedDays.includes(today) && !state.makeupPunchedDays.includes(today)) {
            state.punchedDays = [...state.punchedDays, today].sort((a, b) => a - b);
            changed = true;
        }

        if (changed) {
            saveToLocal(triggerSync);
            if (typeof window.updateHomeCalendar === 'function') {
                window.updateHomeCalendar();
            }
            return { success: true, message: '' };
        }
        return { success: true, message: '' };
    }

    // 打开「连胜补签卡中心」规则弹窗
    function openMakeupCenterModal() {
        ensureInit();
        let modal = document.getElementById('makeup-center-modal-overlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'makeup-center-modal-overlay';
            modal.className = 'modal-mask';
            modal.innerHTML = `
                <div class="modal-card" style="max-width: 360px; padding: 24px 20px; border-radius: 26px; text-align: left; background: #ffffff;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">🎫</span>
                            <h3 style="font-size: 16px; font-weight: 800; color: #0F172A; margin: 0;">连胜补签卡中心</h3>
                        </div>
                        <span style="font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;">
                            剩余 <span id="modal-makeup-balance-num">0</span> 张
                        </span>
                    </div>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 14px; margin-bottom: 16px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748B;">本月已使用补签:</span>
                            <span id="modal-makeup-used-num" style="font-weight: 700; color: #1E293B;">0 / 4 次</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748B;">本月还可领卡:</span>
                            <span id="modal-makeup-reward-num" style="font-weight: 700; color: #1E293B;">4 张</span>
                        </div>
                        <div style="padding-top: 8px; border-top: 1px solid #EDF2F7; font-size: 11px; line-height: 1.5; color: #64748B;">
                            💡 <b>规则说明</b>：每月上限补签 4 次。点击日历上漏打卡的断点日期即可补签；若补签卡不足，保存或转发一次学习成就明信片即可免费领取并完成补签！
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button id="btn-modal-share-for-card" style="width: 100%; height: 42px; border-radius: 12px; border: none; background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); color: #ffffff; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                            <span>转发海报领补签卡 📮</span>
                        </button>
                        <button id="btn-modal-close-center" style="width: 100%; height: 38px; border-radius: 12px; border: 1px solid #E2E8F0; background: #ffffff; color: #475569; font-weight: 600; font-size: 12.5px; cursor: pointer;">
                            关闭
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const btnShare = modal.querySelector('#btn-modal-share-for-card');
            const btnClose = modal.querySelector('#btn-modal-close-center');

            if (btnShare) {
                btnShare.addEventListener('click', () => {
                    modal.classList.remove('active');
                    if (typeof window.openShareCardModal === 'function') {
                        window.openShareCardModal();
                    }
                });
            }
            if (btnClose) {
                btnClose.addEventListener('click', () => {
                    modal.classList.remove('active');
                });
            }
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }

        syncMakeupBadgeUI();
        modal.classList.add('active');
    }

    /**
     * Hot reload habit streak engine for a newly switched user identity
     */
    function reloadForUser() {
        state.monthKey = getCurrentMonthKey();
        state.streakCount = 0;
        state.makeupCardsCount = 0;
        state.monthlyRewardedCardsCount = 0;
        state.monthlyUsedMakeupCount = 0;
        state.punchedDays = [];
        state.makeupPunchedDays = [];
        state.makeupPunchedDates = [];
        loadFromLocal();
        syncStreakDisplay();
        syncMakeupBadgeUI();
    }

    // 挂载全局对象 HabitStreak
    window.HabitStreak = {
        MAX_MONTHLY_MAKEUP,
        state,
        ensureInit,
        reloadForUser,
        getStreakStorageKey,
        calculateConsecutiveStreak,
        getRemainingShareRewards,
        getRemainingMakeupQuota,
        isDayPunched,
        isDayMakeupPunched,
        canMakeupDay,
        grantMakeupCardViaShare,
        useMakeupCard,
        punchToday,
        saveToLocal,
        openMakeupCenterModal,
        syncStreakDisplay,
        syncMakeupBadgeUI,
    };

    // 页面就绪后立即初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureInit);
    } else {
        ensureInit();
    }
})();
