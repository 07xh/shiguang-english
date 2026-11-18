/* === js/ux_physics_engines.js === */
/**
 * ==========================================================================
 * 🚀 UX Physics & Micro-Interaction Engines (v3.81)
 * Zero-Dependency Inlined Implementations of Top 1–5 Open-Source Engines:
 *   TOP 1: Cupertino-Pane / Vaul — iOS Physics Bottom Sheet & Reading Split Sheet
 *   TOP 2: Rough-Notation — Organic Hand-Drawn SVG Pen & Evidence Annotations
 *   TOP 3: iOS-Haptics — Native iPhone Taptic Engine WebKit Switch Bridge
 *   TOP 4: Auto-Animate — 120Hz Smooth Height & Layout FLIP Transitions
 *   TOP 5: Floating-UI — Collision-Aware Popover + Dynamic Arrow + Scroll Follow
 * ==========================================================================
 */

(function(window, document) {
    'use strict';

    function triggerHaptic(type) {
        if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
            window.FeedbackEngine.triggerHaptic(type || 'tap');
        }
    }

    // =========================================================================
    // TOP 4: UXAutoAnimate — 120Hz Zero-Config Smooth Height & Opacity Engine
    // =========================================================================
    const UXAutoAnimate = {
        /**
         * Smoothly expands or collapses an element without layout jump
         */
        smoothToggle: function(el, shouldShow, options = {}) {
            if (!el) return;
            const displayMode = options.display || 'block';
            const duration = options.duration || 240;
            const easing = options.easing || 'cubic-bezier(0.22, 1, 0.36, 1)';

            if (el._uxAnim) {
                try { el._uxAnim.cancel(); } catch (e) {}
                el._uxAnim = null;
            }

            const isCurrentlyVisible = (el.style.display !== 'none' && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);

            if (shouldShow) {
                el.style.display = displayMode;
                if (isCurrentlyVisible && !options.forceAnimate) return;

                const targetHeight = el.scrollHeight;
                if (targetHeight <= 0 || typeof el.animate !== 'function') return;

                const prevOverflow = el.style.overflow;
                el.style.overflow = 'hidden';

                const anim = el.animate([
                    { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
                    { height: targetHeight + 'px', opacity: 1, transform: 'translateY(0)' }
                ], {
                    duration: duration,
                    easing: easing
                });

                el._uxAnim = anim;
                anim.onfinish = anim.oncancel = function() {
                    el.style.overflow = prevOverflow || '';
                    el.style.height = '';
                    el.style.opacity = '';
                    el.style.transform = '';
                    el._uxAnim = null;
                };
            } else {
                if (!isCurrentlyVisible) {
                    el.style.display = 'none';
                    return;
                }
                const startHeight = el.offsetHeight;
                if (startHeight <= 0 || typeof el.animate !== 'function') {
                    el.style.display = 'none';
                    return;
                }

                const prevOverflow = el.style.overflow;
                el.style.overflow = 'hidden';

                const anim = el.animate([
                    { height: startHeight + 'px', opacity: 1, transform: 'translateY(0)' },
                    { height: '0px', opacity: 0, transform: 'translateY(-4px)' }
                ], {
                    duration: Math.max(160, duration - 40),
                    easing: easing
                });

                el._uxAnim = anim;
                anim.onfinish = function() {
                    el.style.display = 'none';
                    el.style.overflow = prevOverflow || '';
                    el.style.height = '';
                    el.style.opacity = '';
                    el.style.transform = '';
                    el._uxAnim = null;
                };
                anim.oncancel = function() {
                    el.style.overflow = prevOverflow || '';
                    el.style.height = '';
                    el.style.opacity = '';
                    el.style.transform = '';
                    el._uxAnim = null;
                };
            }
        },

        /**
         * Animates newly revealed explanation card with spring entrance
         */
        animateCardReveal: function(cardEl) {
            if (!cardEl || typeof cardEl.animate !== 'function') return;
            if (cardEl._uxRevealAnim) {
                try { cardEl._uxRevealAnim.cancel(); } catch (e) {}
            }
            cardEl._uxRevealAnim = cardEl.animate([
                { opacity: 0, transform: 'translate3d(0, 8px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' }
            ], {
                duration: 240,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
            });
            cardEl._uxRevealAnim.onfinish = cardEl._uxRevealAnim.oncancel = function() {
                cardEl._uxRevealAnim = null;
            };
        },

        /**
         * Soft 180ms reveal for newly toggled bilingual subtitle blocks
         */
        animateBilingualReveal: function(rootEl) {
            const scope = rootEl || document;
            if (!scope || typeof scope.querySelectorAll !== 'function') return;
            const targets = scope.querySelectorAll('.q-zh-sub, .opt-zh-text.show, #written-translation-card');
            let count = 0;
            targets.forEach(el => {
                if (count >= 16 || !el || typeof el.animate !== 'function') return;
                if (el.style && el.style.display === 'none') return;
                count++;
                try {
                    el.animate([
                        { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
                        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
                    ], {
                        duration: 185,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
                    });
                } catch (e) {}
            });
        }
    };

    // =========================================================================
    // TOP 6: UXSegmentedGlider — 120Hz Physical Sliding Pill Segmented Engine
    // =========================================================================
    const UXSegmentedGlider = {
        _configs: [
            { selector: '#header-mode-segmented', itemSelector: '.mode-tab-btn', variant: 'dark' },
            { selector: '#header-dict-segmented', itemSelector: '.mode-tab-btn', variant: 'dark' },
            { selector: '.sheet-detent-pills', itemSelector: '.sheet-detent-chip', variant: 'light' },
            { selector: '#home-training-mode-switcher', itemSelector: '.training-mode-tab-btn', variant: 'card' }
        ],
        _resizeObserver: null,

        initAll: function() {
            if (!document || typeof document.querySelectorAll !== 'function') return;
            this._configs.forEach(cfg => {
                const bars = document.querySelectorAll(cfg.selector);
                if (!bars) return;
                Array.from(bars).forEach(bar => {
                    this.attach(bar, cfg);
                });
            });
        },

        _findConfigForBar: function(bar) {
            if (!bar) return null;
            if (bar.id === 'header-mode-segmented' || bar.id === 'header-dict-segmented') {
                return { itemSelector: '.mode-tab-btn', variant: 'dark' };
            }
            if (bar.id === 'home-training-mode-switcher' || (bar.classList && bar.classList.contains('training-mode-switcher'))) {
                return { itemSelector: '.training-mode-tab-btn', variant: 'card' };
            }
            if (bar.classList && bar.classList.contains('sheet-detent-pills')) {
                return { itemSelector: '.sheet-detent-chip', variant: 'light' };
            }
            return null;
        },

        attach: function(bar, customCfg) {
            if (!bar || typeof bar.querySelectorAll !== 'function') return null;
            const cfg = customCfg || bar._uxGliderCfg || this._findConfigForBar(bar);
            if (!cfg) return null;

            bar._uxGliderCfg = cfg;
            if (bar.classList) bar.classList.add('has-ux-glider');

            let pill = typeof bar.querySelector === 'function' ? bar.querySelector('.ux-seg-glider-pill') : null;
            if (!pill && document && typeof document.createElement === 'function') {
                pill = document.createElement('div');
                pill.className = `ux-seg-glider-pill glider-${cfg.variant || 'light'}`;
                if (typeof pill.setAttribute === 'function') {
                    pill.setAttribute('aria-hidden', 'true');
                }
                if (typeof bar.prepend === 'function') {
                    bar.prepend(pill);
                } else if (typeof bar.insertBefore === 'function') {
                    bar.insertBefore(pill, bar.firstChild || null);
                } else if (typeof bar.appendChild === 'function') {
                    bar.appendChild(pill);
                }
                bar._uxGliderReady = false;
            }

            if (!bar._uxGliderObserved) {
                bar._uxGliderObserved = true;
                if (typeof MutationObserver !== 'undefined') {
                    try {
                        const mo = new MutationObserver((mutations) => {
                            let styleChanged = false;
                            let activeChanged = false;
                            for (let i = 0; i < mutations.length; i++) {
                                const m = mutations[i];
                                if (m.target === bar && m.attributeName === 'style') {
                                    styleChanged = true;
                                } else if (m.attributeName === 'class' && m.target !== bar && m.target !== pill) {
                                    activeChanged = true;
                                }
                            }
                            if (styleChanged) {
                                this.sync(bar, false);
                            } else if (activeChanged) {
                                this.sync(bar, true);
                            }
                        });
                        mo.observe(bar, {
                            attributes: true,
                            subtree: true,
                            attributeFilter: ['class', 'style']
                        });
                        bar._uxGliderMO = mo;
                    } catch (e) {}
                }

                if (typeof ResizeObserver !== 'undefined') {
                    try {
                        if (!this._resizeObserver) {
                            this._resizeObserver = new ResizeObserver((entries) => {
                                for (let i = 0; i < entries.length; i++) {
                                    const target = entries[i].target;
                                    if (target && target._uxGliderCfg) {
                                        this.sync(target, false);
                                    }
                                }
                            });
                        }
                        this._resizeObserver.observe(bar);
                    } catch (e) {}
                }
            }

            this.sync(bar, false);
            return pill;
        },

        sync: function(barOrSelector, animate = true) {
            const bar = (typeof barOrSelector === 'string')
                ? (document && typeof document.querySelector === 'function' ? document.querySelector(barOrSelector) : null)
                : barOrSelector;
            if (!bar || typeof bar.querySelectorAll !== 'function') return false;

            if (!bar._uxGliderCfg) {
                this.attach(bar);
                return Boolean(bar._uxGliderCfg);
            }

            const cfg = bar._uxGliderCfg;
            const pill = typeof bar.querySelector === 'function' ? bar.querySelector('.ux-seg-glider-pill') : null;
            if (!pill || !pill.style) return false;

            const isHidden = (bar.style && bar.style.display === 'none') ||
                             (typeof getComputedStyle === 'function' && getComputedStyle(bar).display === 'none');
            if (isHidden) {
                bar._uxGliderReady = false;
                return false;
            }

            const items = Array.from(bar.querySelectorAll(cfg.itemSelector) || []);
            const activeItem = items.find(el => el && el.classList && el.classList.contains('active'));

            if (!activeItem) {
                pill.style.opacity = '0';
                pill.style.transform = pill._lastTransform ? `${pill._lastTransform} scale(0.94)` : 'translate3d(0px, 0px, 0px) scale(0.94)';
                return true;
            }

            const w = Number(activeItem.offsetWidth) || 0;
            const h = Number(activeItem.offsetHeight) || 0;
            const x = Number(activeItem.offsetLeft) || 0;
            const y = Number(activeItem.offsetTop) || 0;

            if (w <= 0 || h <= 0) {
                bar._uxGliderReady = false;
                return false;
            }

            const glideTransition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), width 0.28s cubic-bezier(0.32, 0.72, 0, 1), height 0.22s ease, opacity 0.18s ease';
            const shouldAnimate = Boolean(animate && bar._uxGliderReady);
            pill.style.transition = shouldAnimate ? glideTransition : 'none';

            if (typeof activeItem.getAttribute === 'function' && typeof pill.setAttribute === 'function') {
                const modeAttr = activeItem.getAttribute('data-mode');
                if (modeAttr) pill.setAttribute('data-active-mode', modeAttr);
            }

            const nextTransform = `translate3d(${x}px, ${y}px, 0px)`;
            pill._lastTransform = nextTransform;
            pill.style.width = `${w}px`;
            pill.style.height = `${h}px`;
            pill.style.transform = nextTransform;
            pill.style.opacity = '1';

            if (!shouldAnimate) {
                void pill.offsetWidth;
                pill.style.transition = glideTransition;
            }
            bar._uxGliderReady = true;
            return true;
        },

        syncAll: function(animate = false) {
            if (!document || typeof document.querySelectorAll !== 'function') return;
            this._configs.forEach(cfg => {
                const bars = document.querySelectorAll(cfg.selector);
                if (!bars) return;
                Array.from(bars).forEach(bar => {
                    this.sync(bar, animate);
                });
            });
        }
    };

    // =========================================================================
    // TOP 5: UXFloatingUI — Smart Collision-Aware Popover + Arrow + AutoUpdate
    // =========================================================================
    const UXFloatingUI = {
        _cleanupFn: null,

        /**
         * Selects the specific line rect of an inline element closest to clickPoint,
         * or falls back to getBoundingClientRect().
         */
        getTargetRect: function(targetEl, clickPoint) {
            if (!targetEl) return null;
            const rects = targetEl.getClientRects ? Array.from(targetEl.getClientRects()) : [];
            if (rects.length > 1 && clickPoint && typeof clickPoint.x === 'number' && typeof clickPoint.y === 'number') {
                let bestRect = rects[0];
                let minDist = Infinity;
                for (let i = 0; i < rects.length; i++) {
                    const r = rects[i];
                    if (r.width <= 0 || r.height <= 0) continue;
                    const dx = clickPoint.x < r.left ? (r.left - clickPoint.x) : (clickPoint.x > r.right ? (clickPoint.x - r.right) : 0);
                    const dy = clickPoint.y < r.top ? (r.top - clickPoint.y) : (clickPoint.y > r.bottom ? (clickPoint.y - r.bottom) : 0);
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) {
                        minDist = dist;
                        bestRect = r;
                    }
                }
                return bestRect;
            }
            if (rects.length === 1 && rects[0].width > 0) {
                return rects[0];
            }
            return targetEl.getBoundingClientRect();
        },

        /**
         * Computes collision-safe coordinates (flip + shift + arrow) for #dict-popover
         */
        computePosition: function(targetEl, popoverEl, arrowEl, clickPoint) {
            if (!targetEl || !popoverEl) return false;
            const rect = this.getTargetRect(targetEl, clickPoint);
            if (!rect || (rect.width === 0 && rect.height === 0)) return false;

            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Check if target has scrolled completely out of visible viewport
            if (rect.bottom < 42 || rect.top > vh - 36 || rect.right < 0 || rect.left > vw) {
                return false;
            }

            const popWidth = popoverEl.offsetWidth || 260;
            const popHeight = popoverEl.offsetHeight || 115;
            const gap = 10;
            const edgePadding = 12;
            const safeTopLimit = 56; // leave room for top bar

            const targetCenterX = rect.left + rect.width / 2;

            // 1. Flip middleware: Prefer 'top', flip to 'bottom' if top space is insufficient
            let placement = 'top';
            let top = rect.top - popHeight - gap;
            if (top < safeTopLimit && (vh - rect.bottom) > (popHeight + gap)) {
                placement = 'bottom';
                top = rect.bottom + gap;
            } else if (top < 8) {
                placement = 'bottom';
                top = Math.min(vh - popHeight - 10, rect.bottom + gap);
            }

            // 2. Shift middleware: Clamp horizontal position within viewport margins
            let left = targetCenterX - popWidth / 2;
            left = Math.max(edgePadding, Math.min(left, vw - popWidth - edgePadding));

            popoverEl.style.top = `${Math.round(top)}px`;
            popoverEl.style.left = `${Math.round(left)}px`;
            popoverEl.setAttribute('data-placement', placement);

            // 3. Arrow middleware: Point arrow directly at targetCenterX
            if (arrowEl) {
                const arrowHalf = 6;
                const minArrowX = 16;
                const maxArrowX = Math.max(minArrowX, popWidth - 24);
                const rawArrowX = targetCenterX - left - arrowHalf;
                const clampedArrowX = Math.max(minArrowX, Math.min(rawArrowX, maxArrowX));
                arrowEl.style.left = `${Math.round(clampedArrowX)}px`;
            }
            return true;
        },

        /**
         * Tracks scroll & resize in real time to keep popover anchored to target word
         */
        startAutoUpdate: function(targetEl, popoverEl, arrowEl, clickPoint, onOutOfBounds) {
            this.stopAutoUpdate();
            if (!targetEl || !popoverEl) return;

            let rafId = 0;
            const self = this;

            function syncPosition() {
                rafId = 0;
                if (!document.body.contains(targetEl) || (!popoverEl.classList.contains('active') && !popoverEl.classList.contains('show'))) {
                    self.stopAutoUpdate();
                    if (typeof onOutOfBounds === 'function') onOutOfBounds();
                    return;
                }
                const stillVisible = self.computePosition(targetEl, popoverEl, arrowEl, clickPoint);
                if (!stillVisible) {
                    self.stopAutoUpdate();
                    if (typeof onOutOfBounds === 'function') onOutOfBounds();
                }
            }

            function scheduleSync() {
                if (!rafId) {
                    rafId = requestAnimationFrame(syncPosition);
                }
            }

            window.addEventListener('scroll', scheduleSync, { passive: true, capture: true });
            window.addEventListener('resize', scheduleSync, { passive: true });

            this._cleanupFn = function() {
                if (rafId) cancelAnimationFrame(rafId);
                window.removeEventListener('scroll', scheduleSync, { capture: true });
                window.removeEventListener('resize', scheduleSync);
            };
        },

        stopAutoUpdate: function() {
            if (typeof this._cleanupFn === 'function') {
                this._cleanupFn();
                this._cleanupFn = null;
            }
        }
    };

    // =========================================================================
    // TOP 2: UXRoughNotation — Organic SVG Hand-Drawn Pen & Evidence Engine
    // =========================================================================
    const UXRoughNotation = {
        /**
         * Generates an organic double-pass hand-drawn SVG path between (x1,y1) and (x2,y2)
         */
        _buildOrganicUnderlinePath: function(x1, y1, x2, y2, seed) {
            const len = Math.max(10, x2 - x1);
            const s1 = Math.sin(seed * 12.9898) * 1.1;
            const s2 = Math.cos(seed * 78.233) * 1.1;
            const midX = x1 + len * 0.5;
            const cp1X = x1 + len * 0.28;
            const cp2X = x1 + len * 0.72;

            // Primary ink stroke + subtle secondary feather stroke for fountain-pen realism
            const p1 = `M ${x1.toFixed(1)} ${(y1 + s1 * 0.4).toFixed(1)} C ${cp1X.toFixed(1)} ${(y1 - 1.1 + s2 * 0.5).toFixed(1)}, ${cp2X.toFixed(1)} ${(y2 + 1.0 - s1 * 0.4).toFixed(1)}, ${x2.toFixed(1)} ${(y2 - 0.3).toFixed(1)}`;
            const p2 = `M ${(x1 + 1.5).toFixed(1)} ${(y1 + 1.7 - s2 * 0.3).toFixed(1)} Q ${midX.toFixed(1)} ${(y1 + 2.4 + s1 * 0.5).toFixed(1)}, ${(x2 - 1.0).toFixed(1)} ${(y2 + 1.4).toFixed(1)}`;
            return { p1, p2, length: Math.ceil(len * 1.08) };
        },

        /**
         * Clears existing SVG rough annotations inside a container
         */
        clearAnnotations: function(containerEl) {
            if (!containerEl) return;
            containerEl.querySelectorAll('.ux-rough-svg-layer').forEach(node => node.remove());
        },

        _bindResizeObserver: function(containerEl) {
            if (!containerEl || containerEl._uxRoughResizeBound) return;
            containerEl._uxRoughResizeBound = true;
            let lastWidth = containerEl.clientWidth || 0;
            let rafId = 0;
            const self = this;

            const handleResize = () => {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    rafId = 0;
                    const curWidth = containerEl.clientWidth || 0;
                    if (curWidth > 0 && Math.abs(curWidth - lastWidth) > 2) {
                        lastWidth = curWidth;
                        if (containerEl.querySelector('mark.passage-evidence-highlight')) {
                            self.annotatePassageEvidence(containerEl, { instant: true });
                        }
                    }
                });
            };

            if (typeof ResizeObserver === 'function') {
                const ro = new ResizeObserver(handleResize);
                ro.observe(containerEl);
            } else {
                window.addEventListener('resize', handleResize, { passive: true });
            }
        },

        /**
         * Renders animated hand-drawn pen strokes under all mark.passage-evidence-highlight
         * inside containerEl (e.g., #written-passage-card)
         */
        annotatePassageEvidence: function(containerEl, opts = {}) {
            if (!containerEl) return;
            this.clearAnnotations(containerEl);
            this._bindResizeObserver(containerEl);

            const marks = containerEl.querySelectorAll('mark.passage-evidence-highlight');
            if (!marks || marks.length === 0) return;

            const containerRect = containerEl.getBoundingClientRect();
            if (containerRect.width <= 0 || containerRect.height <= 0) return;

            const computedPos = getComputedStyle(containerEl).position;
            if (computedPos === 'static') {
                containerEl.style.position = 'relative';
            }

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('class', 'ux-rough-svg-layer');
            svg.setAttribute('aria-hidden', 'true');
            svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2;';
            const isInstant = !!(opts && opts.instant);

            let strokeIdx = 0;
            marks.forEach((markEl) => {
                // Collect word rects inside markEl (excluding the pill badge) and merge rects per line
                const wordNodes = markEl.querySelectorAll('.dict-word, .dict-sep');
                let rawRects = [];
                if (wordNodes.length > 0) {
                    wordNodes.forEach(w => {
                        if (w.closest('.passage-evidence-badge')) return;
                        const r = w.getBoundingClientRect();
                        if (r.width > 1 && r.height > 6) rawRects.push(r);
                    });
                } else {
                    rawRects = Array.from(markEl.getClientRects()).filter(r => r.width > 6 && r.height > 6);
                }

                // Group rects into horizontal lines
                const lineGroups = [];
                rawRects.forEach(r => {
                    let group = lineGroups.find(g => Math.abs(g.bottom - r.bottom) < 7);
                    if (!group) {
                        group = { left: r.left, right: r.right, bottom: r.bottom, height: r.height };
                        lineGroups.push(group);
                    } else {
                        group.left = Math.min(group.left, r.left);
                        group.right = Math.max(group.right, r.right);
                        group.bottom = Math.max(group.bottom, r.bottom);
                    }
                });

                lineGroups.forEach((line) => {
                    const width = line.right - line.left;
                    if (width < 8) return;
                    const relLeft = line.left - containerRect.left + containerEl.scrollLeft;
                    const relBottom = line.bottom - containerRect.top + containerEl.scrollTop - 1.2;

                    const { p1, p2, length } = this._buildOrganicUnderlinePath(
                        relLeft + 1,
                        relBottom,
                        relLeft + width - 1,
                        relBottom,
                        strokeIdx + 1
                    );

                    const delayMs = Math.min(480, strokeIdx * 70);

                    const pathMain = document.createElementNS(svgNS, 'path');
                    pathMain.setAttribute('d', p1);
                    pathMain.setAttribute('class', 'ux-rough-stroke-main');
                    pathMain.style.cssText = isInstant
                        ? `fill:none;stroke:#0284c7;stroke-width:2px;stroke-linecap:round;`
                        : `fill:none;stroke:#0284c7;stroke-width:2px;stroke-linecap:round;stroke-dasharray:${length};stroke-dashoffset:${length};animation:uxRoughDraw 0.42s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms forwards;`;

                    const pathSub = document.createElementNS(svgNS, 'path');
                    pathSub.setAttribute('d', p2);
                    pathSub.setAttribute('class', 'ux-rough-stroke-sub');
                    pathSub.style.cssText = isInstant
                        ? `fill:none;stroke:rgba(2,132,199,0.42);stroke-width:1.15px;stroke-linecap:round;`
                        : `fill:none;stroke:rgba(2,132,199,0.42);stroke-width:1.15px;stroke-linecap:round;stroke-dasharray:${length};stroke-dashoffset:${length};animation:uxRoughDraw 0.46s cubic-bezier(0.22,1,0.36,1) ${delayMs + 45}ms forwards;`;

                    svg.appendChild(pathMain);
                    svg.appendChild(pathSub);
                    strokeIdx++;
                });
            });

            if (strokeIdx > 0) {
                containerEl.appendChild(svg);
            }
        }
    };

    // =========================================================================
    // TOP 1: UXSpringSheet — Cupertino-Pane / Vaul Physics Bottom Sheets
    //   1A: Universal Drag-to-Dismiss with Rubber-Band on all .drawer-box
    //   1B: Mobile Reading Split Bottom Sheet (Peek / Half / Full Detents)
    // =========================================================================
    const UXSpringSheet = {
        /**
         * 1A: Attaches physics drag-to-dismiss to a bottom sheet drawer
         */
        bindDismissableDrawer: function(maskId, boxSelector, closeCallback) {
            const maskEl = document.getElementById(maskId);
            if (!maskEl || (maskEl.getAttribute && maskEl.getAttribute('data-ux-spring-bound') === 'true')) return;
            const boxEl = (maskEl.querySelector && typeof maskEl.querySelector === 'function') ? maskEl.querySelector(boxSelector) : null;
            if (!boxEl) return;

            if (maskEl.setAttribute) maskEl.setAttribute('data-ux-spring-bound', 'true');
            if (maskEl.dataset) maskEl.dataset.uxSpringBound = 'true';

            let isDragging = false;
            let startY = 0;
            let startX = 0;
            let currentDy = 0;
            let lastY = 0;
            let lastTime = 0;
            let velocityY = 0;

            function canStartPull(target, deltaY) {
                // Always allow drag on top grabber bar or header
                if (target.closest('.drawer-bar, .drawer-top, .drawer-header, .rank-drawer-header, .rank-drawer-handle-bar')) {
                    if (target.closest('button, .drawer-close, .rank-drawer-close-btn')) return false;
                    return true;
                }
                // If inside scrollable list, only allow pull-down when scrolled to very top
                const scrollParent = target.closest('.drawer-q-grid, .q-grid, .rank-drawer-scroll, .rank-drawer-list, #dict-drawer-grid');
                if (scrollParent) {
                    return scrollParent.scrollTop <= 1 && deltaY > 4;
                }
                return deltaY > 4;
            }

            const onPointerDown = (clientX, clientY, target, isMouse) => {
                if (target.closest('button, .drawer-sec-pill, a, input, textarea')) return;
                if (isMouse && !target.closest('.drawer-bar, .drawer-top, .drawer-header, .rank-drawer-header, .rank-drawer-handle-bar')) return;
                startY = clientY;
                startX = clientX;
                lastY = startY;
                lastTime = performance.now();
                currentDy = 0;
                velocityY = 0;
                isDragging = false;
            };

            const onPointerMove = (clientX, clientY, target, e) => {
                if (!startY) return;
                const dy = clientY - startY;
                const dx = clientX - startX;

                if (!isDragging) {
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
                        startY = 0;
                        return;
                    }
                    if (Math.abs(dy) < 7) return;
                    if (!canStartPull(target, dy)) {
                        startY = 0;
                        return;
                    }
                    isDragging = true;
                    boxEl.style.transition = 'none';
                }

                const now = performance.now();
                const dt = Math.max(1, now - lastTime);
                velocityY = (clientY - lastY) / dt; // px/ms
                lastY = clientY;
                lastTime = now;

                if (dy >= 0) {
                    currentDy = dy;
                } else {
                    // iOS rubber-band damping when pulling upward above max height
                    currentDy = -24 * (1 - Math.exp(dy / 65));
                }

                boxEl.style.transform = `translate3d(0, ${currentDy.toFixed(1)}px, 0)`;
                if (e && e.cancelable && currentDy > 2) e.preventDefault();
            };

            boxEl.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target, false);
            }, { passive: true });

            boxEl.addEventListener('touchmove', (e) => {
                if (!e.touches || e.touches.length !== 1 || !startY) return;
                onPointerMove(e.touches[0].clientX, e.touches[0].clientY, e.target, e);
            }, { passive: false });

            boxEl.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                onPointerDown(e.clientX, e.clientY, e.target, true);
            });

            window.addEventListener('mousemove', (e) => {
                if (!startY) return;
                if (!(e.buttons & 1)) {
                    finishDrag();
                    return;
                }
                onPointerMove(e.clientX, e.clientY, e.target || boxEl, e);
            });

            function finishDrag() {
                if (!isDragging) {
                    startY = 0;
                    return;
                }
                isDragging = false;
                startY = 0;

                const shouldDismiss = (currentDy > 88) || (currentDy > 28 && velocityY > 0.55);
                if (shouldDismiss) {
                    triggerHaptic('light');
                    boxEl.style.transition = 'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)';
                    boxEl.style.transform = 'translate3d(0, 105%, 0)';
                    setTimeout(() => {
                        boxEl.style.transition = '';
                        boxEl.style.transform = '';
                        if (typeof closeCallback === 'function') {
                            closeCallback();
                        }
                    }, 220);
                } else {
                    if (Math.abs(currentDy) > 30) triggerHaptic('selection');
                    boxEl.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
                    boxEl.style.transform = 'translate3d(0, 0, 0)';
                    setTimeout(() => {
                        boxEl.style.transition = '';
                        boxEl.style.transform = '';
                    }, 280);
                }
                currentDy = 0;
            }

            boxEl.addEventListener('touchend', finishDrag, { passive: true });
            boxEl.addEventListener('touchcancel', finishDrag, { passive: true });
            window.addEventListener('mouseup', finishDrag);
        },

        initAllDrawers: function() {
            this.bindDismissableDrawer('drawer-mask', '.drawer-box', () => {
                if (typeof window.closeQuestionDrawer === 'function') {
                    window.closeQuestionDrawer();
                } else {
                    const m = document.getElementById('drawer-mask');
                    if (m) m.classList.remove('active');
                }
            });

            this.bindDismissableDrawer('dict-drawer-mask', '.drawer-box', () => {
                if (typeof window.closeDictationDrawer === 'function') {
                    window.closeDictationDrawer();
                } else {
                    const m = document.getElementById('dict-drawer-mask');
                    if (m) {
                        m.classList.remove('active');
                        m.style.display = 'none';
                    }
                }
            });

            this.bindDismissableDrawer('rank-modal-overlay', '.rank-drawer-content', () => {
                if (typeof window.closeRankModal === 'function') {
                    window.closeRankModal();
                } else {
                    const m = document.getElementById('rank-modal-overlay');
                    if (m) m.classList.remove('is-active');
                    document.body.classList.remove('rank-modal-open');
                }
            });
        }
    };

    // =========================================================================
    // TOP 1B: UXReadingSplitSheet — Silky Free-Stop Reading Split Sheet
    // Drag anywhere and release to lock at that exact split ratio; quick chips for Half / Full
    // =========================================================================
    const UXReadingSplitSheet = {
        _detents: {
            half: 0.50, // 50% of viewport height (balanced dual-screen reading + answering)
            full: 0.82  // 82% of viewport height (deep explanation reading)
        },
        _minRatio: 0.18,
        _maxRatio: 0.86,
        _customRatio: 0.50,
        _currentDetent: 'half',
        _isSheetEnabled: true, // Default enabled on mobile & tablet portrait for passage reading
        _initialized: false,
        _hasDraggedOnce: false,
        _suppressTouchZoneClickUntil: 0,
        _transitionClearTimer: null,

        isMobilePortrait: function() {
            const isLandscape = document.body.classList.contains('is-landscape') ||
                                document.documentElement.getAttribute('data-toy-orientation') === 'landscape' ||
                                (window.innerWidth > window.innerHeight && window.innerHeight <= 560);
            return window.innerWidth <= 899 && !isLandscape;
        },

        isViewportEligible: function(q) {
            this.loadSavedPreference();
            if (!this._isSheetEnabled || !this.isMobilePortrait() || !q) return false;
            const noSplitTypes = ['matching', 'translation', 'translation_en_zh', 'writing', 'proofread', 'fill_in'];
            if (noSplitTypes.includes(q.type)) return false;
            return Boolean(q.passage && String(q.passage).trim().length > 0);
        },

        loadSavedPreference: function() {
            try {
                const saved = window.__toyLS.getItem('toy_reading_split_sheet_v1');
                if (saved === 'false') this._isSheetEnabled = false;
                else if (saved === 'true') this._isSheetEnabled = true;

                const savedRatio = parseFloat(window.__toyLS.getItem('toy_reading_split_ratio_v2'));
                if (!isNaN(savedRatio) && savedRatio >= this._minRatio && savedRatio <= this._maxRatio) {
                    this._customRatio = savedRatio;
                }
                if (window.__toyLS.getItem('toy_reading_sheet_dragged_v1') === '1') {
                    this._hasDraggedOnce = true;
                }
            } catch (e) {}
        },

        markDraggedOnce: function() {
            if (this._hasDraggedOnce) return;
            this._hasDraggedOnce = true;
            try {
                window.__toyLS.setItem('toy_reading_sheet_dragged_v1', '1');
            } catch (e) {}
            this._refreshMiniIndicatorLabel();
        },

        _refreshMiniIndicatorLabel: function() {
            const miniLabel = document.getElementById('sheet-q-mini-indicator');
            const seqVal = document.getElementById('written-seq-val');
            if (!miniLabel) return;
            const qStr = (seqVal && seqVal.textContent) ? String(seqVal.textContent).trim() : '';
            const hintStr = this._hasDraggedOnce ? '自由悬停' : '拖拽分屏松手即固定';
            miniLabel.innerHTML = qStr
                ? `<span class="sheet-q-pill">Q${qStr}</span><span class="sheet-q-hint">${hintStr}</span>`
                : `<span class="sheet-q-hint">${hintStr}</span>`;
        },

        savePreference: function(val) {
            this._isSheetEnabled = !!val;
            try {
                window.__toyLS.setItem('toy_reading_split_sheet_v1', String(this._isSheetEnabled));
            } catch (e) {}
        },

        saveRatio: function(ratio) {
            const clamped = Math.min(this._maxRatio, Math.max(this._minRatio, Number(ratio) || 0.50));
            this._customRatio = clamped;
            if (Math.abs(clamped - this._detents.half) <= 0.02) {
                this._currentDetent = 'half';
            } else if (Math.abs(clamped - this._detents.full) <= 0.02) {
                this._currentDetent = 'full';
            } else {
                this._currentDetent = 'custom';
            }
            try {
                window.__toyLS.setItem('toy_reading_split_ratio_v2', clamped.toFixed(4));
            } catch (e) {}
            return clamped;
        },

        _getClampedMaxHeightPx: function(vh) {
            const safeVh = vh || window.innerHeight || 800;
            const minPx = Math.round(safeVh * this._minRatio);
            let maxPx = Math.round(safeVh * this._maxRatio);
            const hdr = document.querySelector('#view-written-arena .top-header, .top-header');
            if (hdr && typeof hdr.getBoundingClientRect === 'function') {
                const rect = hdr.getBoundingClientRect();
                if (rect && rect.bottom > 0 && rect.bottom < safeVh * 0.45) {
                    maxPx = Math.min(maxPx, Math.round(safeVh - rect.bottom - 44));
                }
            }
            return Math.max(minPx, maxPx);
        },

        ensureUIElements: function() {
            const stageCard = document.getElementById('written-stage-card');
            const splitContainer = stageCard ? stageCard.querySelector('.written-split-container') : null;
            const quizPane = splitContainer ? splitContainer.querySelector('.written-split-quiz') : null;
            const topBar = stageCard ? stageCard.querySelector('.quiz-card-top-bar') : null;
            if (!stageCard || !splitContainer || !quizPane || !topBar) return null;

            // 1. Ensure toggle button in top bar
            let toggleBtn = document.getElementById('btn-reading-sheet-mode');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.id = 'btn-reading-sheet-mode';
                toggleBtn.type = 'button';
                toggleBtn.className = 'reading-sheet-mode-btn';
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    triggerHaptic('selection');
                    this.savePreference(!this._isSheetEnabled);
                    this.syncSheetState();
                });
                topBar.appendChild(toggleBtn);
            }

            // 2. Ensure grabber handle bar at the top of .written-split-quiz (only 半屏 & 全屏; 微露 removed)
            let grabber = document.getElementById('written-sheet-grabber');
            if (!grabber) {
                grabber = document.createElement('div');
                grabber.id = 'written-sheet-grabber';
                grabber.className = 'written-sheet-grabber';
                grabber.innerHTML = `
                    <div class="sheet-grabber-TouchZone" title="上下拖动任意悬停固定高度，轻点切换半屏/全屏">
                        <span class="sheet-grabber-pill"></span>
                    </div>
                    <div class="sheet-detent-bar">
                        <span class="sheet-detent-label" id="sheet-q-mini-indicator">上下拖拽分屏 · 松手即固定</span>
                        <div class="sheet-detent-pills">
                            <button type="button" class="sheet-detent-chip active" data-detent="half">半屏</button>
                            <button type="button" class="sheet-detent-chip" data-detent="full">全屏</button>
                        </div>
                    </div>
                `;
                quizPane.insertBefore(grabber, quizPane.firstChild);

                // Bind preset chip clicks (半屏 / 全屏)
                grabber.querySelectorAll('.sheet-detent-chip').forEach(chip => {
                    chip.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const d = chip.getAttribute('data-detent') || 'half';
                        triggerHaptic('selection');
                        this.setDetent(d, true);
                    });
                });

                // Tapping the grabber pill (without dragging) toggles between half and full
                const touchZone = grabber.querySelector('.sheet-grabber-TouchZone');
                if (touchZone) {
                    touchZone.addEventListener('click', () => {
                        if (Date.now() < this._suppressTouchZoneClickUntil) return;
                        triggerHaptic('selection');
                        const nextDetent = (Math.abs(this._customRatio - this._detents.full) < 0.05) ? 'half' : 'full';
                        this.setDetent(nextDetent, true);
                    });
                }

                this._bindSheetDragPhysics(quizPane, grabber);
            } else {
                // Ensure legacy peek chip is removed if grabber existed
                const legacyPeek = grabber.querySelector('.sheet-detent-chip[data-detent="peek"]');
                if (legacyPeek) legacyPeek.remove();
            }

            return { stageCard, splitContainer, quizPane, toggleBtn, grabber };
        },

        _bindSheetDragPhysics: function(quizPane, grabber) {
            let hasPointerDown = false;
            let isDragging = false;
            let didDragMove = false;
            let startX = 0;
            let startY = 0;
            let startHeightPx = 0;
            let cachedVh = 0;
            let minH = 140;
            let maxH = 680;
            let lastAppliedHeightPx = 0;
            let splitContainerRef = null;

            const getPointX = (e) => (e.touches && e.touches.length ? e.touches[0].clientX : e.clientX);
            const getPointY = (e) => (e.touches && e.touches.length ? e.touches[0].clientY : e.clientY);

            const clearSheetTransition = () => {
                if (this._transitionClearTimer) {
                    clearTimeout(this._transitionClearTimer);
                    this._transitionClearTimer = null;
                }
                quizPane.style.transition = 'none';
            };

            const engageDragMode = () => {
                clearSheetTransition();
                quizPane.classList.add('is-sheet-dragging');
            };

            const onDragStart = (e, isMouse) => {
                splitContainerRef = quizPane.closest('.written-split-container');
                if (!splitContainerRef || !splitContainerRef.classList.contains('mobile-sheet-split-active')) return;
                if (e.target.closest('.sheet-detent-chip, .blank-quick-jump-pill, .blank-quick-next-btn, .opt-used-badge, .opt-btn, .word-bank-opt-btn, .tfng-btn, .sentence-insertion-opt-btn, button, a, input, textarea')) return;

                const isGrabber = !!e.target.closest('#written-sheet-grabber');
                if (isMouse && !isGrabber) return;
                if (!isGrabber && quizPane.scrollTop > 1) return;

                hasPointerDown = true;
                startX = getPointX(e);
                startY = getPointY(e);
                cachedVh = window.innerHeight || 800;
                minH = Math.round(cachedVh * this._minRatio);
                maxH = this._getClampedMaxHeightPx(cachedVh);
                startHeightPx = Math.round(quizPane.getBoundingClientRect().height || (cachedVh * this._customRatio));
                lastAppliedHeightPx = startHeightPx;
                this._pendingDragHeightPx = startHeightPx;
                didDragMove = false;
                isDragging = isGrabber;
                if (isDragging) {
                    engageDragMode();
                }
            };

            const onDragMove = (e) => {
                if (!hasPointerDown) return;
                if (!splitContainerRef || !splitContainerRef.classList.contains('mobile-sheet-split-active')) {
                    hasPointerDown = false;
                    isDragging = false;
                    return;
                }

                const x = getPointX(e);
                const y = getPointY(e);
                const dx = x - startX;
                const dy = y - startY; // dy > 0 means pulling down (shrinking sheet)

                if (!isDragging) {
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
                        hasPointerDown = false;
                        return;
                    }
                    if (quizPane.scrollTop <= 0 && dy > 8 && dy > Math.abs(dx) * 1.2) {
                        isDragging = true;
                        engageDragMode();
                    } else if (Math.abs(dy) > 9) {
                        hasPointerDown = false;
                        return;
                    } else {
                        return;
                    }
                }

                if (Math.abs(dy) > 2) {
                    if (!didDragMove) {
                        didDragMove = true;
                        engageDragMode();
                    }
                }

                // Direct 1:1 clamping within [minH, maxH] so releasing anywhere stays 100% still without bounce-back
                const nextHeightPx = Math.round(Math.min(maxH, Math.max(minH, startHeightPx - dy)));
                this._pendingDragHeightPx = nextHeightPx;

                if (!this._dragRafId) {
                    this._dragRafId = requestAnimationFrame(() => {
                        this._dragRafId = 0;
                        if (isDragging && this._pendingDragHeightPx && this._pendingDragHeightPx !== lastAppliedHeightPx) {
                            lastAppliedHeightPx = this._pendingDragHeightPx;
                            quizPane.style.height = `${lastAppliedHeightPx}px`;
                        }
                    });
                }
                if (e.cancelable) e.preventDefault();
            };

            const onDragEnd = () => {
                if (this._dragRafId) {
                    cancelAnimationFrame(this._dragRafId);
                    this._dragRafId = 0;
                }
                if (!hasPointerDown && !isDragging) return;
                hasPointerDown = false;

                if (!isDragging) return;
                const moved = didDragMove;
                isDragging = false;
                didDragMove = false;
                quizPane.classList.remove('is-sheet-dragging');
                quizPane.style.transition = 'none';

                if (!moved) {
                    return;
                }
                this._suppressTouchZoneClickUntil = Date.now() + 350;

                // Flush exact final pixel height where the user stopped — zero snapping, stays fixed right here!
                const vh = cachedVh || window.innerHeight || 800;
                const finalHeightPx = this._pendingDragHeightPx || lastAppliedHeightPx || Math.round(vh * this._customRatio);
                quizPane.style.height = `${finalHeightPx}px`;
                this._targetHeightPx = finalHeightPx;

                const stoppedRatio = this.saveRatio(finalHeightPx / vh);
                this.markDraggedOnce();
                this._syncGrabberChipsUI(grabber, splitContainerRef);

                const passagePane = splitContainerRef ? splitContainerRef.querySelector('.written-split-passage') : null;
                if (passagePane) {
                    passagePane.style.paddingBottom = `${finalHeightPx + 36}px`;
                }
            };

            grabber.addEventListener('touchstart', (e) => onDragStart(e, false), { passive: true });
            quizPane.addEventListener('touchstart', (e) => {
                if (e.target && e.target.closest && e.target.closest('#written-sheet-grabber')) return;
                onDragStart(e, false);
            }, { passive: true });
            window.addEventListener('touchmove', onDragMove, { passive: false });
            window.addEventListener('touchend', onDragEnd, { passive: true });
            window.addEventListener('touchcancel', onDragEnd, { passive: true });

            // Mouse / Trackpad / Stylus Drag Support for Tablet & PC
            grabber.addEventListener('mousedown', (e) => {
                if (e.button === 0) onDragStart(e, true);
            });
            window.addEventListener('mousemove', (e) => {
                if (!hasPointerDown) return;
                if (!(e.buttons & 1)) {
                    onDragEnd();
                    return;
                }
                onDragMove(e);
            });
            window.addEventListener('mouseup', onDragEnd);
        },

        _syncGrabberChipsUI: function(grabber, splitContainer) {
            if (splitContainer) {
                splitContainer.setAttribute('data-sheet-detent', this._currentDetent);
            }
            const g = grabber || document.getElementById('written-sheet-grabber');
            if (g) {
                g.querySelectorAll('.sheet-detent-chip').forEach(chip => {
                    const key = chip.getAttribute('data-detent');
                    chip.classList.toggle('active', key === this._currentDetent);
                });
                const pillsBar = typeof g.querySelector === 'function' ? g.querySelector('.sheet-detent-pills') : null;
                if (pillsBar && UXSegmentedGlider) {
                    UXSegmentedGlider.sync(pillsBar, true);
                }
            }
        },

        /**
         * Gentle visibility safeguard while respecting user's fixed split height:
         * Only adjusts if the user parked at an extreme edge where target content would be completely hidden.
         */
        ensureHalfForInteraction: function(reason) {
            const stageCard = document.getElementById('written-stage-card');
            const splitContainer = stageCard ? stageCard.querySelector('.written-split-container') : null;
            if (!splitContainer || !splitContainer.classList.contains('mobile-sheet-split-active')) return false;

            if (reason === 'blank' && this._customRatio < 0.22) {
                this.setDetent('half', true);
                return true;
            }
            if (reason === 'evidence' && this._customRatio > 0.80) {
                this.setDetent('half', true);
                return true;
            }
            return false;
        },

        applyRatio: function(ratio, animate = false) {
            const clampedRatio = this.saveRatio(ratio);
            const stageCard = document.getElementById('written-stage-card');
            const splitContainer = stageCard ? stageCard.querySelector('.written-split-container') : null;
            const quizPane = splitContainer ? splitContainer.querySelector('.written-split-quiz') : null;
            const passagePane = splitContainer ? splitContainer.querySelector('.written-split-passage') : null;
            const grabber = document.getElementById('written-sheet-grabber');

            if (!splitContainer || !quizPane) return;

            const vh = window.innerHeight || 800;
            const targetHeightPx = Math.min(this._getClampedMaxHeightPx(vh), Math.round(vh * clampedRatio));
            this._targetHeightPx = targetHeightPx;

            if (this._transitionClearTimer) {
                clearTimeout(this._transitionClearTimer);
                this._transitionClearTimer = null;
            }

            if (!animate) {
                quizPane.style.transition = 'none';
            } else {
                quizPane.style.transition = 'height 0.26s cubic-bezier(0.32, 0.72, 0, 1)';
                this._transitionClearTimer = setTimeout(() => {
                    quizPane.style.transition = 'none';
                    this._transitionClearTimer = null;
                }, 280);
            }
            quizPane.style.height = `${targetHeightPx}px`;

            if (passagePane) {
                passagePane.style.paddingBottom = `${targetHeightPx + 36}px`;
            }

            this._syncGrabberChipsUI(grabber, splitContainer);
        },

        setDetent: function(detentKey, animate = true) {
            const targetRatio = this._detents[detentKey] || this._detents.half;
            this.applyRatio(targetRatio, animate);
        },

        syncSheetState: function(options = {}) {
            this.loadSavedPreference();
            const refs = this.ensureUIElements();
            if (!refs) return;

            const { stageCard, splitContainer, quizPane, toggleBtn, grabber } = refs;
            const passagePane = splitContainer.querySelector('.written-split-passage');
            const curQ = (Array.isArray(window.currentWrittenQuestions) && typeof window.currentWrittenQIndex === 'number')
                ? window.currentWrittenQuestions[window.currentWrittenQIndex]
                : null;
            const isSubjOrInlineType = stageCard.classList.contains('proofread-mode') ||
                                       stageCard.classList.contains('grammar-fillin-mode') ||
                                       (curQ && (curQ.type === 'translation_en_zh' || curQ.type === 'translation' || curQ.type === 'writing' || curQ.type === 'proofread' || curQ.type === 'fill_in'));
            const hasPassage = !splitContainer.classList.contains('no-passage-mode') && !isSubjOrInlineType;
            const isMobile = this.isMobilePortrait();

            if (toggleBtn) {
                if (hasPassage && isMobile) {
                    toggleBtn.style.display = 'inline-flex';
                    toggleBtn.classList.toggle('is-active', this._isSheetEnabled);
                    toggleBtn.innerHTML = this._isSheetEnabled
                        ? '<svg class="sheet-mode-svg" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3"/><line x1="2" y1="8.5" x2="14" y2="8.5"/></svg><span>分屏抽屉</span>'
                        : '<svg class="sheet-mode-svg" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2" width="11" height="12" rx="2.5"/><line x1="5.2" y1="5.5" x2="10.8" y2="5.5"/><line x1="5.2" y1="8.2" x2="10.8" y2="8.2"/><line x1="5.2" y1="10.9" x2="8.8" y2="10.9"/></svg><span>经典滚动</span>';
                } else {
                    toggleBtn.style.display = 'none';
                }
            }

            const shouldActivateSheet = hasPassage && isMobile && this._isSheetEnabled;
            splitContainer.classList.toggle('mobile-sheet-split-active', shouldActivateSheet);

            if (shouldActivateSheet) {
                stageCard.classList.remove('card-slide-forward', 'card-slide-backward');
                if (grabber) {
                    grabber.style.display = 'flex';
                    const pillsBar = typeof grabber.querySelector === 'function' ? grabber.querySelector('.sheet-detent-pills') : null;
                    if (pillsBar && UXSegmentedGlider && !pillsBar._uxGliderCfg) {
                        UXSegmentedGlider.attach(pillsBar, { itemSelector: '.sheet-detent-chip', variant: 'light' });
                    }
                }
                this._refreshMiniIndicatorLabel();
                if (options.detent && this._detents[options.detent]) {
                    this.setDetent(options.detent, !!options.animate);
                } else {
                    // Always preserve the exact split ratio where the user stopped!
                    this.applyRatio(this._customRatio, false);
                }
            } else {
                this._targetHeightPx = 0;
                if (grabber) grabber.style.display = 'none';
                quizPane.style.height = '';
                quizPane.style.transition = '';
                if (passagePane) passagePane.style.paddingBottom = '';
            }
        }
    };

    // Initialize physics drawers on DOM ready and resize (idempotent)
    let _uxEnginesBound = false;
    function initUXEngines() {
        UXSpringSheet.initAllDrawers();
        UXSegmentedGlider.initAll();
        if (_uxEnginesBound) return;
        _uxEnginesBound = true;
        window.addEventListener('resize', () => {
            UXSegmentedGlider.syncAll(false);
            if (window.activeView === 'written-arena') {
                UXReadingSplitSheet.syncSheetState({ animate: false });
                const passageCard = document.getElementById('written-passage-card');
                if (passageCard && passageCard.querySelector('mark.passage-evidence-highlight')) {
                    UXRoughNotation.annotatePassageEvidence(passageCard);
                }
            }
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUXEngines);
    } else {
        initUXEngines();
    }

    window.UXAutoAnimate = UXAutoAnimate;
    window.UXFloatingUI = UXFloatingUI;
    window.UXRoughNotation = UXRoughNotation;
    window.UXSpringSheet = UXSpringSheet;
    window.UXReadingSplitSheet = UXReadingSplitSheet;
    window.UXSegmentedGlider = UXSegmentedGlider;

})(window, document);
