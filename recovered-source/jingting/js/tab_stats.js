/* === js/tab_stats.js === */
/**
 * ==========================================================================
 * 统计 · 学习复盘 Tab Page (js/tab_stats.js)
 * 1:1 visual language ported from 单词Toy StudyStatsModal.vue:
 *   1. Hero 核心总览 (周 / 月 / 全部 刷题量 + 学习天数 / 正确率 / 学习时长)
 *   2. 趋势柱状图 (刷题 / 时长 / 正确率 三维切换)
 *   3. 练习构成 (听力真题 / 笔试阅读 / 逐句精听 / 生词积累 分段比例与明细)
 *   4. 16 周打卡热力图
 * ==========================================================================
 */
(function (window, document) {
    'use strict';

    const DAY_MS = 86400000;
    const BJ_OFFSET_MS = 8 * 3600000;
    const WK = '一二三四五六日';
    const HEAT_DAYS = 112; // 16 weeks
    const RANGE_ITEMS = [
        { id: 'week', label: '周' },
        { id: 'month', label: '月' },
        { id: 'all', label: '全部' }
    ];
    const METRIC_ITEMS = [
        { id: 'count', label: '刷题' },
        { id: 'time', label: '时长' },
        { id: 'acc', label: '正确率' }
    ];

    const state = {
        range: 'week',
        metric: 'count',
        selectedBar: null,
        snapshot: null,
        tweens: new Map(),
        heatTipTimer: null,
        shellBound: false
    };

    const isLite = (function () {
        try {
            return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (e) {
            return false;
        }
    })();

    /* ------------------------------------------------------------------ */
    /* Helpers                                                              */
    /* ------------------------------------------------------------------ */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmt(n) {
        const v = Math.round(Number(n) || 0);
        return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function todayStr() {
        return (typeof window.getTodayDateStr === 'function') ? window.getTodayDateStr() : tsToDateStr(Date.now());
    }

    function tsToDateStr(ts) {
        return new Date(ts + BJ_OFFSET_MS).toISOString().slice(0, 10);
    }

    function dateStrToUtcMs(ds) {
        const p = String(ds).split('-');
        return Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }

    function shiftDateStr(ds, deltaDays) {
        return new Date(dateStrToUtcMs(ds) + deltaDays * DAY_MS).toISOString().slice(0, 10);
    }

    function weekdayIdx(ds) {
        return (new Date(dateStrToUtcMs(ds)).getUTCDay() + 6) % 7;
    }

    function mdLabel(ds) {
        const p = ds.split('-');
        return `${parseInt(p[1], 10)}月${parseInt(p[2], 10)}日`;
    }

    function storageKey(k) {
        return (typeof window.getUserStorageKey === 'function') ? window.getUserStorageKey(k) : k;
    }

    function readJson(key, fallback) {
        try {
            const raw = window.__toyLS.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return fallback;
    }

    function timeParts(sec) {
        const m = (Number(sec) || 0) / 60;
        if (m >= 60) {
            const h = m / 60;
            return [h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, ''), '小时'];
        }
        return [String(Math.round(m)), '分钟'];
    }

    function formatMinsLabel(mins) {
        if (mins >= 120) {
            return `${(mins / 60).toFixed(1).replace(/\.0$/, '')} 小时`;
        }
        return `${fmt(mins)} 分钟`;
    }

    function haptic() {
        if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
            try { window.FeedbackEngine.triggerHaptic('selection'); } catch (e) {}
        }
    }

    /* ------------------------------------------------------------------ */
    /* Snapshot builder                                                     */
    /* ------------------------------------------------------------------ */
    function buildSnapshot() {
        const today = todayStr();
        const days = Object.create(null);
        const day = (ds) => {
            if (!days[ds]) days[ds] = { n: 0, answers: 0, graded: 0, correct: 0, sec: 0, punched: false };
            return days[ds];
        };

        const hist = (typeof window.getDailyPracticeHistory === 'function') ? window.getDailyPracticeHistory() : { recent: {} };
        Object.keys((hist && hist.recent) || {}).forEach(ds => {
            const c = parseInt(hist.recent[ds], 10) || 0;
            if (c > 0) day(ds).n = Math.max(day(ds).n, c);
        });
        if (typeof window.getTodayPracticeStats === 'function') {
            const ts = window.getTodayPracticeStats();
            if (ts && ts.todayTotalQ > 0) day(today).n = Math.max(day(today).n, ts.todayTotalQ);
        }

        const exams = (window.completedExams && typeof window.completedExams === 'object') ? window.completedExams : {};
        let gradedAll = 0;
        let correctAll = 0;
        let listenTotal = 0;
        let listenGraded = 0;
        let listenCorrect = 0;
        let writtenTotal = 0;
        let writtenGraded = 0;
        let writtenCorrect = 0;
        let dictationTotal = 0;

        Object.keys(exams).forEach(title => {
            const ex = exams[title];
            if (!ex || typeof ex !== 'object') return;
            const scan = (map, kind) => {
                if (!map || typeof map !== 'object') return;
                Object.keys(map).forEach(k => {
                    const a = map[k];
                    if (!a || typeof a !== 'object' || a._deleted) return;
                    const graded = typeof a.isCorrect === 'boolean';
                    if (kind === 'listen') {
                        listenTotal++;
                        if (graded) {
                            listenGraded++;
                            if (a.isCorrect) listenCorrect++;
                        }
                    } else {
                        writtenTotal++;
                        if (graded) {
                            writtenGraded++;
                            if (a.isCorrect) writtenCorrect++;
                        }
                    }
                    if (graded) {
                        gradedAll++;
                        if (a.isCorrect) correctAll++;
                    }
                    const ts = Number(a.ts) || 0;
                    if (ts > 1e12) {
                        const b = day(tsToDateStr(ts));
                        b.answers++;
                        if (graded) {
                            b.graded++;
                            if (a.isCorrect) b.correct++;
                        }
                    }
                });
            };
            scan(ex.answers, 'listen');
            scan(ex.writtenAnswers, 'written');
            if (ex.dictationCompleted && typeof ex.dictationCompleted === 'object') {
                dictationTotal += Object.values(ex.dictationCompleted).filter(Boolean).length;
            }
        });

        const vocabTotal = (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.getFavoriteList === 'function')
            ? (window.VocabNotebookBridge.getFavoriteList() || []).length
            : 0;

        Object.keys(days).forEach(ds => {
            const b = days[ds];
            b.n = Math.max(b.n, b.answers);
        });

        const durLog = readJson(storageKey('daily_duration_log'), {}) || {};
        Object.keys(durLog).forEach(ds => {
            const s = Number(durLog[ds]) || 0;
            if (s > 0) day(ds).sec = Math.max(day(ds).sec, s);
        });
        const todaySec = (typeof window.getTodayPracticeDuration === 'function') ? window.getTodayPracticeDuration() : 0;
        if (todaySec > 0) day(today).sec = Math.max(day(today).sec, todaySec);

        const punch = (ds) => { if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) day(ds).punched = true; };
        const custom = readJson(storageKey('calendar_custom_punches'), {}) || {};
        Object.keys(custom).forEach(ds => { if (custom[ds]) punch(ds); });
        const hs = window.HabitStreak && window.HabitStreak.state;
        if (hs) {
            const pad = (n) => String(n).padStart(2, '0');
            (hs.makeupPunchedDates || []).forEach(punch);
            if (hs.monthKey) {
                (hs.punchedDays || []).forEach(d => punch(`${hs.monthKey}-${pad(d)}`));
                (hs.makeupPunchedDays || []).forEach(d => punch(`${hs.monthKey}-${pad(d)}`));
            }
        }

        const isActive = (ds) => !!(days[ds] && (days[ds].n > 0 || days[ds].punched || days[ds].sec >= 60));
        let curStreak = 0;
        let cursor = isActive(today) ? today : shiftDateStr(today, -1);
        while (isActive(cursor) && curStreak < 3650) {
            curStreak++;
            cursor = shiftDateStr(cursor, -1);
        }
        if (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function') {
            try { curStreak = Math.max(curStreak, window.HabitStreak.calculateConsecutiveStreak() || 0); } catch (e) {}
        }
        const activeDates = Object.keys(days).filter(isActive).sort();
        let longest = 0;
        let run = 0;
        let prev = null;
        activeDates.forEach(ds => {
            run = (prev && shiftDateStr(prev, 1) === ds) ? run + 1 : 1;
            longest = Math.max(longest, run);
            prev = ds;
        });
        longest = Math.max(longest, curStreak);

        const totalQ = (typeof window.getTotalCumulativeQuestions === 'function') ? window.getTotalCumulativeQuestions() : 0;
        const totalDays = (typeof window.getCalculatedTotalCumulativeDays === 'function')
            ? Math.max(window.getCalculatedTotalCumulativeDays() || 0, activeDates.length)
            : activeDates.length;
        const totalSec = (typeof window.getTotalLifetimePracticeDuration === 'function')
            ? window.getTotalLifetimePracticeDuration()
            : todaySec;

        return {
            today,
            days,
            isActive,
            curStreak,
            longest,
            totalQ: Math.max(totalQ || 0, 0),
            totalDays,
            totalSec,
            totalAcc: gradedAll > 0 ? (correctAll / gradedAll) * 100 : 0,
            composition: {
                listenTotal,
                listenAcc: listenGraded > 0 ? Math.round((listenCorrect / listenGraded) * 100) : null,
                writtenTotal,
                writtenAcc: writtenGraded > 0 ? Math.round((writtenCorrect / writtenGraded) * 100) : null,
                dictationTotal,
                vocabTotal
            }
        };
    }

    function rangeSlice(snap, range) {
        const make = (len, offset) => {
            const arr = [];
            for (let i = len - 1; i >= 0; i--) {
                const ds = shiftDateStr(snap.today, -(i + offset));
                const b = snap.days[ds] || { n: 0, graded: 0, correct: 0, sec: 0, punched: false };
                arr.push({ ds, n: b.n, graded: b.graded, correct: b.correct, sec: b.sec, active: snap.isActive(ds) });
            }
            return arr;
        };
        if (range === 'week') {
            const cur = make(7, 0);
            return {
                cur,
                prev: make(7, 7),
                name: '这周',
                vs: '上周',
                gap: '20px',
                bars: cur.map(h => ({ v: h.n, sec: h.sec, g: h.graded, c: h.correct, l: WK[weekdayIdx(h.ds)], t: `周${WK[weekdayIdx(h.ds)]}` }))
            };
        }
        if (range === 'month') {
            const cur = make(30, 0);
            return {
                cur,
                prev: make(30, 30),
                name: '这个月',
                vs: '上月',
                gap: '4px',
                bars: cur.map((h, i) => ({
                    v: h.n,
                    sec: h.sec,
                    g: h.graded,
                    c: h.correct,
                    l: (i % 7 === 0) ? `${parseInt(h.ds.slice(5, 7), 10)}/${parseInt(h.ds.slice(8, 10), 10)}` : '',
                    t: mdLabel(h.ds)
                }))
            };
        }
        const months = [];
        const ty = parseInt(snap.today.slice(0, 4), 10);
        const tm = parseInt(snap.today.slice(5, 7), 10) - 1;
        for (let i = 5; i >= 0; i--) {
            const d = new Date(Date.UTC(ty, tm - i, 1));
            const key = d.toISOString().slice(0, 7);
            months.push({ key, v: 0, sec: 0, g: 0, c: 0, l: `${d.getUTCMonth() + 1}月`, t: `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月` });
        }
        Object.keys(snap.days).forEach(ds => {
            const m = months.find(x => x.key === ds.slice(0, 7));
            if (!m) return;
            const b = snap.days[ds];
            m.v += b.n;
            m.sec += b.sec;
            m.g += b.graded;
            m.c += b.correct;
        });
        return { cur: null, prev: null, name: '累计', vs: '', gap: '10px', bars: months };
    }

    /* ------------------------------------------------------------------ */
    /* Tweens                                                               */
    /* ------------------------------------------------------------------ */
    function tween(el, to, formatter, dur) {
        if (!el) return;
        const prevRaf = state.tweens.get(el);
        if (prevRaf) cancelAnimationFrame(prevRaf);
        const from = Number(el.dataset.v || 0);
        const fmtFn = formatter || fmt;
        if (isLite || typeof requestAnimationFrame !== 'function' || Math.abs(from - to) < 0.01) {
            el.dataset.v = String(to);
            el.textContent = fmtFn(to);
            return;
        }
        const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        const d = dur || 750;
        const step = (now) => {
            const p = Math.min(1, (now - t0) / d);
            const e = 1 - Math.pow(1 - p, 3);
            const v = from + (to - from) * e;
            el.dataset.v = String(v);
            el.textContent = fmtFn(v);
            if (p < 1) state.tweens.set(el, requestAnimationFrame(step));
            else state.tweens.delete(el);
        };
        state.tweens.set(el, requestAnimationFrame(step));
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                            */
    /* ------------------------------------------------------------------ */
    function root() {
        return document.getElementById('tab-stats-root');
    }

    function segHtml(items, activeId, attr, small) {
        const idx = Math.max(0, items.findIndex(x => x.id === activeId));
        return `<div class="htp-seg${small ? ' is-small' : ''}" style="--seg-n:${items.length};--seg-i:${idx};">
            <i class="htp-seg-knob"></i>
            ${items.map(x => `<button type="button" data-${attr}="${x.id}" class="${x.id === activeId ? 'on' : ''}">${esc(x.label)}</button>`).join('')}
        </div>`;
    }

    function renderShell() {
        const el = root();
        if (!el) return;
        el.innerHTML = `
            <header class="htp-nav">
                <span></span>
                <h1>学习复盘</h1>
                <span></span>
            </header>
            <div class="tps-range-bar">
                <div id="tps-range-seg-wrap" style="flex:1;">${segHtml(RANGE_ITEMS, state.range, 'range')}</div>
                <button class="htp-cb" type="button" id="tps-share-btn" aria-label="分享打卡明信片">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>
                </button>
            </div>

            <section class="tps-hero tps-flat htp-rv" style="--rv-i:0;">
                <div class="tps-lead" id="tps-lead">这周你刷了</div>
                <div class="tps-big"><b id="tps-hero-total" data-v="0">0</b><span>题</span></div>
                <div class="tps-delta" id="tps-delta"></div>
                <div class="tps-kpi">
                    <div class="tps-m"><div class="tps-v"><span id="tps-kpi-days" data-v="0">0</span><span class="u">天</span></div><div class="tps-c">学习天数</div></div>
                    <div class="tps-m"><div class="tps-v"><span id="tps-kpi-acc" data-v="0">0</span><span class="u">%</span></div><div class="tps-c">正确率</div></div>
                    <div class="tps-m"><div class="tps-v"><span id="tps-kpi-time">0</span><span class="u" id="tps-kpi-time-u">分钟</span></div><div class="tps-c">学习时长</div></div>
                </div>
            </section>

            <section class="tps-sec tps-flat htp-rv" style="--rv-i:1;">
                <div class="tps-hd">
                    <h3 id="tps-trend-title">每日刷题</h3>
                    <div id="tps-metric-seg-wrap">${segHtml(METRIC_ITEMS, state.metric, 'metric', true)}</div>
                </div>
                <div class="tps-trend" id="tps-trend"></div>
                <div class="tps-xl" id="tps-xl"></div>
            </section>

            <section class="tps-sec tps-flat htp-rv" id="tps-comp-sec" style="--rv-i:2;">
                <div class="tps-hd">
                    <h3>练习构成</h3>
                    <span class="tps-meta" id="tps-comp-meta"></span>
                </div>
                <div class="tps-comp-bar" id="tps-comp-bar"></div>
                <div class="tps-comp-grid" id="tps-comp-grid"></div>
            </section>

            <section class="tps-sec tps-flat htp-rv" style="--rv-i:3;">
                <div class="tps-hd">
                    <h3 id="tps-keep-title">连续打卡</h3>
                    <span class="tps-meta">最长 <b id="tps-longest">0</b> 天</span>
                </div>
                <div class="tps-hw" id="tps-hw">
                    <div class="tps-heat" id="tps-heat"></div>
                    <div class="tps-htip" id="tps-htip"></div>
                </div>
            </section>
        `;
        if (!state.shellBound) {
            state.shellBound = true;
            bindShell(el);
        }
    }

    function bindShell(el) {
        el.addEventListener('click', (e) => {
            const t = e.target;
            if (!t || !t.closest) return;

            const rBtn = t.closest('[data-range]');
            if (rBtn) { setRange(rBtn.getAttribute('data-range')); return; }

            const mBtn = t.closest('[data-metric]');
            if (mBtn) { setMetric(mBtn.getAttribute('data-metric')); return; }

            const bar = t.closest('.tps-b');
            if (bar) {
                const idx = parseInt(bar.getAttribute('data-idx'), 10);
                if (bar.classList.contains('zero')) return;
                state.selectedBar = (state.selectedBar === idx) ? null : idx;
                el.querySelectorAll('.tps-b').forEach((b, i) => b.classList.toggle('sel', i === state.selectedBar));
                return;
            }

            const cell = t.closest('.tps-heat i');
            if (cell) { showHeatTip(cell); return; }

            if (t.closest('#tps-share-btn')) {
                if (typeof window.openShareCardModal === 'function') window.openShareCardModal();
            }
        });
    }

    function setSeg(wrapId, items, activeId, attr, small) {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        const seg = wrap.querySelector('.htp-seg');
        const idx = Math.max(0, items.findIndex(x => x.id === activeId));
        if (!seg) {
            wrap.innerHTML = segHtml(items, activeId, attr, small);
            return;
        }
        seg.style.setProperty('--seg-i', String(idx));
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.getAttribute(`data-${attr}`) === activeId));
    }

    function setRange(r) {
        if (!r || r === state.range) return;
        state.range = r;
        state.selectedBar = null;
        setSeg('tps-range-seg-wrap', RANGE_ITEMS, r, 'range');
        haptic();
        renderHeroAndTrend();
    }

    function setMetric(m) {
        if (!m || m === state.metric) return;
        state.metric = m;
        state.selectedBar = null;
        setSeg('tps-metric-seg-wrap', METRIC_ITEMS, m, 'metric', true);
        haptic();
        renderTrend(rangeSlice(state.snapshot, state.range));
    }

    function renderHeroAndTrend() {
        const snap = state.snapshot;
        if (!snap) return;
        const s = rangeSlice(snap, state.range);
        const isAll = state.range === 'all';
        const sumN = (arr) => arr.reduce((a, h) => a + h.n, 0);

        const total = isAll ? snap.totalQ : sumN(s.cur);
        const prevTotal = s.prev ? sumN(s.prev) : 0;
        const activeDays = isAll ? snap.totalDays : s.cur.filter(h => h.active).length;
        let acc;
        if (isAll) {
            acc = snap.totalAcc;
        } else {
            const g = s.cur.reduce((a, h) => a + h.graded, 0);
            const c = s.cur.reduce((a, h) => a + h.correct, 0);
            acc = g > 0 ? (c / g) * 100 : 0;
        }
        const secs = isAll ? snap.totalSec : s.cur.reduce((a, h) => a + h.sec, 0);

        const lead = document.getElementById('tps-lead');
        if (lead) lead.textContent = isAll ? '你一共刷了' : `${s.name}你刷了`;

        const heroEl = document.getElementById('tps-hero-total');
        if (heroEl) {
            const L = fmt(total).length;
            heroEl.style.setProperty('--hs', `${L <= 4 ? 72 : (L <= 6 ? 60 : 48)}px`);
            tween(heroEl, total);
        }

        let html = '';
        const allDays = Math.max(snap.totalDays, 0);
        if (allDays <= 0 && total <= 0) {
            html = '还没有开始练习，今天刷一套真题吧';
        } else if (allDays === 1) {
            html = '第一天，好的开始';
        } else if (allDays < 7) {
            html = snap.curStreak > 0 ? `连续第 <b>${snap.curStreak}</b> 天，习惯正在形成` : '今天重新出发，点亮连续打卡';
        } else if (isAll) {
            html = `坚持了 <b>${fmt(allDays)}</b> 天，累计练习 <b>${fmt(Math.round(snap.totalSec / 60))}</b> 分钟`;
        } else if (prevTotal === 0) {
            html = total > 0 ? `比${s.vs}新增 <b>${fmt(total)} 题</b>` : `${s.name}还没有刷题`;
        } else {
            const diff = Math.round(((total - prevTotal) / prevTotal) * 100);
            html = `比${s.vs}${diff >= 0 ? '多' : '少'} <b class="${diff < 0 ? 'dn' : ''}">${Math.abs(diff)}%</b>`;
        }
        const deltaEl = document.getElementById('tps-delta');
        if (deltaEl) deltaEl.innerHTML = html;

        tween(document.getElementById('tps-kpi-days'), activeDays);
        tween(document.getElementById('tps-kpi-acc'), acc);
        const tp = timeParts(secs);
        const tEl = document.getElementById('tps-kpi-time');
        const tuEl = document.getElementById('tps-kpi-time-u');
        if (tEl) tEl.textContent = tp[0];
        if (tuEl) tuEl.textContent = tp[1];

        renderTrend(s);
    }

    function renderTrend(s) {
        const trend = document.getElementById('tps-trend');
        const xl = document.getElementById('tps-xl');
        const titleEl = document.getElementById('tps-trend-title');
        if (!trend || !xl) return;

        const m = state.metric;
        const unit = state.range === 'all' ? '每月' : '每日';
        if (titleEl) {
            titleEl.textContent = m === 'acc' ? `${unit}正确率` : (m === 'time' ? `${unit}时长` : `${unit}刷题`);
        }

        const raw = s.bars.map(b => {
            if (m === 'acc') return b.g > 0 ? Math.round((b.c / b.g) * 100) : 0;
            if (m === 'time') return b.sec > 0 ? Math.max(1, Math.round(b.sec / 60)) : 0;
            return b.v;
        });

        const pos = raw.filter(v => v > 0);
        const floor = m === 'acc' ? (pos.length ? Math.max(0, Math.min(60, Math.min.apply(null, pos) - 12)) : 0) : 0;
        const max = m === 'acc' ? 100 : Math.max.apply(null, raw.concat([floor + 1]));
        const bestIdx = raw.reduce((best, v, i) => (v > raw[best] ? i : best), 0);
        const calcH = (v) => (v <= 0 ? 4 : Math.max(8, Math.min(100, ((v - floor) / Math.max(1, max - floor)) * 100)));
        const edge = Math.max(2, Math.ceil(s.bars.length * 0.24));

        trend.style.setProperty('--gap', s.gap);
        xl.style.setProperty('--gap', s.gap);
        trend.innerHTML = s.bars.map((b, i) => {
            const v = raw[i];
            const h = calcH(v);
            const tip = m === 'acc' ? `${b.t} · ${v}%` : (m === 'time' ? `${b.t} · ${formatMinsLabel(v)}` : `${b.t} · ${fmt(v)} 题`);
            const cls = [
                'tps-b',
                v <= 0 ? 'zero' : '',
                (state.selectedBar === null && i === bestIdx && v > 0) ? 'peak' : '',
                state.selectedBar === i ? 'sel' : '',
                i < edge ? 'edgeL' : '',
                i >= s.bars.length - edge ? 'edgeR' : ''
            ].filter(Boolean).join(' ');
            return `<div class="${cls}" data-idx="${i}" style="--h:${h}%;"><span class="tps-tipb">${esc(tip)}</span><i data-h="${h}"></i></div>`;
        }).join('');
        xl.innerHTML = s.bars.map(b => `<span>${esc(b.l)}</span>`).join('');

        const grow = () => trend.querySelectorAll('.tps-b i').forEach(i => { i.style.height = `${i.getAttribute('data-h')}%`; });
        if (isLite || typeof requestAnimationFrame !== 'function') grow();
        else requestAnimationFrame(() => requestAnimationFrame(grow));
    }

    function renderHeat() {
        const snap = state.snapshot;
        const heat = document.getElementById('tps-heat');
        if (!heat || !snap) return;
        const keepTitle = document.getElementById('tps-keep-title');
        if (keepTitle) keepTitle.textContent = snap.curStreak > 0 ? `连续打卡 ${snap.curStreak} 天` : '开启连续打卡';
        const longestEl = document.getElementById('tps-longest');
        if (longestEl) longestEl.textContent = String(snap.longest);

        const start = shiftDateStr(snap.today, -weekdayIdx(snap.today) - 15 * 7);
        const goal = Math.max(10, state.dailyGoalQ || 50);
        const cells = [];
        for (let i = 0; i < HEAT_DAYS; i++) {
            const ds = shiftDateStr(start, i);
            const fut = ds > snap.today;
            const b = snap.days[ds];
            const n = b ? b.n : 0;
            let cls = '';
            let tip;
            if (fut) {
                cls = 'fut';
                tip = `${mdLabel(ds)} · 未来`;
            } else {
                if (ds === snap.today && snap.isActive(ds)) cls = 'today';
                else if (n > 0) cls = n < goal * 0.6 ? 'l1' : (n < goal * 1.2 ? 'l2' : 'l3');
                else if (snap.isActive(ds)) cls = 'l1';
                tip = `${mdLabel(ds)} · ${n > 0 ? `${fmt(n)} 题` : (b && b.punched ? '已打卡' : (b && b.sec >= 60 ? `${Math.round(b.sec / 60)} 分钟` : '未学习'))}`;
            }
            const delay = isLite ? 0 : (Math.floor(i / 7) * 18 + (i % 7) * 4);
            cells.push(`<i class="${cls}" data-tip="${esc(tip)}" style="transition-delay:${delay}ms;"></i>`);
        }
        heat.classList.remove('show');
        heat.innerHTML = cells.join('');
        if (isLite || typeof requestAnimationFrame !== 'function') heat.classList.add('show');
        else requestAnimationFrame(() => requestAnimationFrame(() => heat.classList.add('show')));
    }

    function showHeatTip(cell) {
        if (cell.classList.contains('fut')) return;
        const hw = document.getElementById('tps-hw');
        const tipEl = document.getElementById('tps-htip');
        if (!hw || !tipEl) return;
        document.querySelectorAll('#tps-heat i.pick').forEach(c => c.classList.remove('pick'));
        cell.classList.add('pick');
        const sc = hw.getBoundingClientRect().width / Math.max(1, hw.offsetWidth);
        const r = cell.getBoundingClientRect();
        const hr = hw.getBoundingClientRect();
        tipEl.textContent = cell.getAttribute('data-tip') || '';
        tipEl.style.left = `${Math.min(hw.offsetWidth - 60, Math.max(60, (r.left - hr.left + r.width / 2) / sc))}px`;
        tipEl.style.top = `${(r.top - hr.top) / sc - 8}px`;
        tipEl.classList.add('on');
        if (state.heatTipTimer) clearTimeout(state.heatTipTimer);
        state.heatTipTimer = setTimeout(() => {
            tipEl.classList.remove('on');
            cell.classList.remove('pick');
        }, 2000);
    }

    function renderComposition() {
        const snap = state.snapshot;
        const barEl = document.getElementById('tps-comp-bar');
        const gridEl = document.getElementById('tps-comp-grid');
        const metaEl = document.getElementById('tps-comp-meta');
        if (!snap || !barEl || !gridEl) return;

        const c = snap.composition || {};
        const items = [
            {
                id: 'listen',
                cls: 'is-listen',
                label: '听力真题',
                count: c.listenTotal || 0,
                unit: '题',
                sub: (typeof c.listenAcc === 'number') ? `${c.listenAcc}%` : ''
            },
            {
                id: 'written',
                cls: 'is-written',
                label: '笔试阅读',
                count: c.writtenTotal || 0,
                unit: '题',
                sub: (typeof c.writtenAcc === 'number') ? `${c.writtenAcc}%` : ''
            },
            {
                id: 'dictation',
                cls: 'is-dict',
                label: '逐句精听',
                count: c.dictationTotal || 0,
                unit: '句',
                sub: ''
            },
            {
                id: 'vocab',
                cls: 'is-vocab',
                label: '生词积累',
                count: c.vocabTotal || 0,
                unit: '词',
                sub: ''
            }
        ];

        const sum = items.reduce((acc, x) => acc + x.count, 0);
        if (metaEl) {
            metaEl.innerHTML = sum > 0 ? `累计 <b>${fmt(sum)}</b> 项` : '暂无记录';
        }

        barEl.classList.remove('show');
        barEl.classList.toggle('is-empty', sum === 0);
        if (sum > 0) {
            barEl.innerHTML = items
                .filter(it => it.count > 0)
                .map(it => `<i class="tps-comp-seg ${it.cls}" data-id="${it.id}" style="flex-grow:${it.count};" title="${esc(`${it.label} ${fmt(it.count)}${it.unit}`)}"></i>`)
                .join('');
            if (isLite || typeof requestAnimationFrame !== 'function') barEl.classList.add('show');
            else requestAnimationFrame(() => requestAnimationFrame(() => barEl.classList.add('show')));
        } else {
            barEl.innerHTML = '';
        }

        gridEl.innerHTML = items.map(it => `
            <div class="tps-comp-item" data-comp-id="${it.id}">
                <div class="tps-comp-lbl">
                    <i class="tps-comp-dot ${it.cls}"></i>
                    <span>${esc(it.label)}</span>
                </div>
                <div class="tps-comp-val">
                    <b>${fmt(it.count)}</b><span class="u">${it.unit}</span>${it.sub ? `<em class="tps-comp-acc">正确率 ${esc(it.sub)}</em>` : ''}
                </div>
            </div>
        `).join('');
    }

    function render() {
        const el = root();
        if (!el) return;
        state.snapshot = buildSnapshot();
        state.selectedBar = null;
        renderShell();
        renderHeroAndTrend();
        renderComposition();
        renderHeat();
    }

    function onHide() {
        state.tweens.forEach(id => cancelAnimationFrame(id));
        state.tweens.clear();
        if (state.heatTipTimer) {
            clearTimeout(state.heatTipTimer);
            state.heatTipTimer = null;
        }
    }

    window.TabStats = { render, onHide, buildSnapshot, setMetric, setRange };

    const register = () => {
        if (window.HomeTabs && typeof window.HomeTabs.registerPage === 'function') {
            window.HomeTabs.registerPage('stats', window.TabStats);
        }
    };
    if (window.HomeTabs) register();
    else document.addEventListener('DOMContentLoaded', register);
})(window, document);
