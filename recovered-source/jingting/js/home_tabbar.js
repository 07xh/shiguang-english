/* === js/home_tabbar.js === */
/**
 * ==========================================================================
 * Home Liquid-Glass Tab Bar Controller (js/home_tabbar.js)
 * 首页 / 统计 / 我的 — 1:1 ported from 单词Toy LiquidGlassTabBar.vue
 *
 * - Tab pages (统计 / 我的) are fixed overlay panels above #view-home, so the
 *   existing switchView() routing, history depth & scroll memory stay untouched.
 * - Includes LiquidGlassTabBar pill physics, drag-to-select, PC specular --hx
 *   refraction tracking, and 7-point adaptive luminance contrast sampling.
 * ==========================================================================
 */
(function (window, document) {
    'use strict';

    if (window.HomeTabs) return;

    const TAB_IDS = ['home', 'stats'];
    const pages = Object.create(null);
    let current = 'home';
    let nav = null;
    let pill = null;
    let tabs = [];
    let settleTimer = null;
    let detectRaf = 0;
    let contrastMode = 'lt';
    let bound = false;
    let toastTimer = null;

    function haptic(type) {
        if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
            try { window.FeedbackEngine.triggerHaptic(type || 'selection'); } catch (e) {}
        }
    }

    /* ---------- pill placement ---------- */
    function place() {
        if (!nav || !pill || nav.classList.contains('is-dragging')) return;
        const t = tabs.find(x => x.dataset.id === current) || tabs[0];
        if (!t || !t.offsetWidth) return;
        pill.style.width = `${t.offsetWidth}px`;
        pill.style.transform = `translateX(${t.offsetLeft}px)`;
    }

    function schedulePlace() {
        place();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(place);
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(place, 560);
    }

    /* ---------- adaptive background luminance detection ---------- */
    function parseRgb(s) {
        const m = s && String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
    }

    function calcLum(c) {
        const f = (v) => {
            const n = v / 255;
            return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }

    function sampleBehind(x, y) {
        if (typeof document.elementsFromPoint !== 'function' || typeof window.getComputedStyle !== 'function') {
            return { L: 1, text: false, busy: false };
        }
        let text = false;
        let busy = false;
        const list = document.elementsFromPoint(x, y) || [];
        for (let i = 0; i < list.length; i++) {
            const el = list[i];
            if (!el || (nav && nav.contains && nav.contains(el))) continue;
            if (el.dataset && el.dataset.lgLum != null) {
                return { L: Number(el.dataset.lgLum), text, busy };
            }
            const tag = el.tagName;
            if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'svg') {
                return { L: 0.7, text, busy: true };
            }
            if (!text && el.childNodes && el.childNodes.length) {
                for (let j = 0; j < el.childNodes.length; j++) {
                    const cn = el.childNodes[j];
                    if (cn && cn.nodeType === 3 && cn.textContent && cn.textContent.trim()) {
                        text = true;
                        break;
                    }
                }
            }
            const cs = window.getComputedStyle(el);
            const c = cs ? parseRgb(cs.backgroundColor) : null;
            if (c && c.a > 0.5) return { L: calcLum(c), text, busy };
            if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') return { L: 0.5, text, busy: true };
        }
        return { L: 1, text, busy };
    }

    function detectContrast() {
        detectRaf = 0;
        if (!nav || !document.body || !document.body.classList.contains('view-home-active')) return;
        if (typeof document.elementsFromPoint !== 'function') return;
        const r = nav.getBoundingClientRect();
        if (!r || !r.width) return;
        const y = r.top + r.height / 2;
        let text = false;
        let busy = false;
        const pts = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92];
        const Ls = pts.map((f) => {
            const s = sampleBehind(r.left + r.width * f, y);
            text = text || s.text;
            busy = busy || s.busy;
            return s.L;
        }).sort((a, b) => a - b);
        const L = Ls[3];
        if (contrastMode === 'lt' && L < 0.2) contrastMode = 'dk';
        else if (contrastMode === 'dk' && L > 0.32) contrastMode = 'lt';
        nav.classList.toggle('htb-dark', contrastMode === 'dk');
        nav.classList.toggle('htb-busy', contrastMode === 'lt' && (text || busy));
        nav.classList.toggle('htb-white', L > 0.85 && !text && !busy);
        tabs.forEach((t) => {
            const tr = t.getBoundingClientRect();
            const s = sampleBehind(tr.left + tr.width / 2, y);
            t.classList.toggle('inv', contrastMode === 'lt' && s.L < 0.07);
        });
    }

    function kickDetect() {
        if (!nav || detectRaf || typeof requestAnimationFrame !== 'function') return;
        detectRaf = requestAnimationFrame(detectContrast);
    }

    function renderTabs() {
        tabs.forEach(t => {
            const on = t.dataset.id === current;
            t.classList.toggle('on', on);
            t.setAttribute('aria-selected', String(on));
        });
        if (nav) nav.dataset.active = current;
        schedulePlace();
        kickDetect();
    }

    /* ---------- panels ---------- */
    function panelEl(id) {
        return document.getElementById(`home-tab-panel-${id}`);
    }

    function scrollPanelTop(id, smooth) {
        const panel = panelEl(id);
        const scroller = panel && panel.querySelector ? panel.querySelector('.htp-scroll') : null;
        if (!scroller) return;
        try {
            if (typeof scroller.scrollTo === 'function') {
                scroller.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
            } else {
                scroller.scrollTop = 0;
            }
        } catch (e) {
            scroller.scrollTop = 0;
        }
    }

    function setActive(id, opts) {
        const options = opts || {};
        if (TAB_IDS.indexOf(id) < 0) return false;
        const prev = current;

        if (prev === id) {
            if (options.fromUser) {
                if (id === 'home') {
                    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
                    const vc = document.querySelector('.views-container');
                    if (vc && vc.scrollTop > 0) {
                        try { vc.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { vc.scrollTop = 0; }
                    }
                } else {
                    scrollPanelTop(id, true);
                }
            }
            return true;
        }

        current = id;
        window.activeHomeTab = id;
        renderTabs();

        TAB_IDS.forEach(tid => {
            if (tid === 'home') return;
            const el = panelEl(tid);
            if (!el) return;
            const open = tid === id;
            el.classList.toggle('is-open', open);
            el.setAttribute('aria-hidden', open ? 'false' : 'true');
        });

        if (document.body && document.body.classList) {
            document.body.classList.toggle('home-tab-locked', id !== 'home');
        }

        if (id !== 'home') {
            scrollPanelTop(id, false);
            const page = pages[id];
            if (page && typeof page.render === 'function') {
                try { page.render(); } catch (e) { console.error('[HomeTabs] render failed:', e); }
            }
        }
        if (prev !== 'home') {
            const prevPage = pages[prev];
            if (prevPage && typeof prevPage.onHide === 'function') {
                try { prevPage.onHide(); } catch (e) {}
            }
        }
        if (id === 'home' && typeof window.updateDashboardStats === 'function') {
            try { window.updateDashboardStats(); } catch (e) {}
        }
        if (options.fromUser) haptic('selection');
        return true;
    }

    function handleBack() {
        const view = (typeof window.activeView === 'string') ? window.activeView : 'home';
        if (view === 'home' && current !== 'home') {
            setActive('home');
            return true;
        }
        return false;
    }

    function registerPage(id, api) {
        if (!id || !api) return;
        pages[id] = api;
        if (current === id && typeof api.render === 'function') {
            try { api.render(); } catch (e) {}
        }
    }

    function refreshActivePage() {
        place();
        kickDetect();
        if (current !== 'home' && pages[current] && typeof pages[current].render === 'function') {
            try { pages[current].render(); } catch (e) {}
        }
    }

    function showToast(msg) {
        let el = document.getElementById('htp-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'htp-toast';
            el.className = 'htp-toast';
            const host = document.getElementById('app-layout') || document.body;
            if (host && typeof host.appendChild === 'function') host.appendChild(el);
        }
        el.textContent = String(msg || '');
        el.classList.add('on');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('on'), 1800);
    }

    /* ---------- drag & specular refraction ---------- */
    function bindInteractions() {
        let d = null;
        let justDragged = false;

        nav.addEventListener('click', (e) => {
            if (justDragged) {
                justDragged = false;
                return;
            }
            const t = e.target && e.target.closest ? e.target.closest('.htb-tab') : null;
            if (t && t.dataset.id) setActive(t.dataset.id, { fromUser: true });
        });

        const onEnd = () => {
            if (!d) return;
            const moved = d.moved;
            const best = d.best;
            d = null;
            if (!moved) return;
            justDragged = true;
            nav.classList.remove('is-dragging');
            tabs.forEach(t => t.classList.remove('hov'));
            const chosen = tabs[best] && tabs[best].dataset.id;
            if (chosen && chosen !== current) setActive(chosen, { fromUser: true });
            else place();
            setTimeout(() => { justDragged = false; }, 60);
        };

        nav.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            const r = nav.getBoundingClientRect();
            d = {
                x0: e.clientX,
                k: (r.width / (nav.offsetWidth || 1)) || 1,
                left: r.left,
                moved: false,
                id: e.pointerId,
                best: Math.max(0, TAB_IDS.indexOf(current))
            };
        });

        nav.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse' && nav.style && typeof nav.style.setProperty === 'function') {
                const r = nav.getBoundingClientRect();
                if (r && r.width) {
                    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                    nav.style.setProperty('--hx', `${20 + 60 * f}%`);
                }
            }
            if (!d) return;
            if (e.pointerType === 'mouse' && e.buttons === 0) {
                onEnd();
                return;
            }
            if (!d.moved && Math.abs(e.clientX - d.x0) > 6) {
                d.moved = true;
                try { if (typeof nav.setPointerCapture === 'function') nav.setPointerCapture(d.id); } catch (err) {}
                nav.classList.add('is-dragging');
            }
            if (!d.moved) return;
            const w = pill.offsetWidth;
            const x = Math.max(2, Math.min(nav.offsetWidth - w - 2, (e.clientX - d.left) / d.k - w / 2));
            const c = x + w / 2;
            pill.style.transform = `translateX(${x}px) scale(1.12, 1.1)`;
            let bd = 1e9;
            tabs.forEach((t, i) => {
                const m = Math.abs(t.offsetLeft + t.offsetWidth / 2 - c);
                if (m < bd) {
                    bd = m;
                    d.best = i;
                }
            });
            tabs.forEach((t, i) => t.classList.toggle('hov', i === d.best));
        });

        nav.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse' && nav.style && typeof nav.style.setProperty === 'function') {
                nav.style.setProperty('--hx', '50%');
            }
        });

        nav.addEventListener('pointerup', onEnd);
        nav.addEventListener('pointercancel', onEnd);
        nav.addEventListener('lostpointercapture', onEnd);
        window.addEventListener('pointerup', onEnd, true);
        window.addEventListener('pointercancel', onEnd, true);
    }

    function init() {
        if (bound) return;
        nav = document.getElementById('home-tabbar');
        if (!nav || typeof nav.querySelector !== 'function') return;
        pill = nav.querySelector('.htb-pill');
        tabs = Array.prototype.slice.call(nav.querySelectorAll('.htb-tab') || []);
        if (!pill || tabs.length === 0) return;
        bound = true;

        bindInteractions();

        nav.addEventListener('transitionend', (e) => {
            if (e && (e.propertyName === 'max-width' || e.propertyName === 'padding-left' || e.propertyName === 'padding-right')) {
                place();
            }
        });
        window.addEventListener('resize', () => { place(); kickDetect(); });
        window.addEventListener('orientationchange', () => { place(); setTimeout(place, 120); setTimeout(place, 320); kickDetect(); });
        window.addEventListener('scroll', kickDetect, { passive: true, capture: true });

        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => { place(); kickDetect(); });
            ro.observe(nav);
            tabs.forEach(t => ro.observe(t));
        }

        pill.style.transition = 'none';
        renderTabs();
        place();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(() => { pill.style.transition = ''; }));
        } else {
            pill.style.transition = '';
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => { place(); kickDetect(); }).catch(() => {});
        }
    }

    window.HomeTabs = {
        init,
        setActive,
        handleBack,
        registerPage,
        refreshActivePage,
        showToast,
        refresh: place,
        get current() { return current; }
    };
    window.activeHomeTab = current;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
