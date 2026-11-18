/* === js/orientation_manager.js === */
/**
 * ==========================================================================
 * Toy Orientation Manager (Bilibili Toy SDK Pure Automatic Gyroscope Sensing)
 * Conforms to Toy JS SDK 2026-09-18 Official Specification.
 *
 * Core Principles:
 * 1. ZERO UI Clutter: No visible buttons on Home hero, no buttons on Quiz header.
 * 2. True Hardware Gyroscope & Accelerometer Sensing: Detects how the user holds the phone.
 * 3. Official Bilibili Container Control:
 *    - Automatically calls toy.setContainerMode({ orientation: 'landscape', immersive: true })
 *    - Automatically calls toy.setContainerMode({ orientation: 'portrait', immersive: false })
 * 4. Listens to SDK toy.onContainerChange & toy.getContainerState()
 * 5. Completely hidden on PC desktop.
 * ==========================================================================
 */

(function() {
    'use strict';

    const ToyOrientationManager = {
        currentOrientation: 'portrait',
        isTransitioning: false,
        candidateOrientation: null,
        candidateStartTime: 0,

        isTablet() {
            if (typeof window.isTabletDevice === 'function') {
                return window.isTabletDevice();
            }
            const toyDevice = document.documentElement.getAttribute('data-toy-device') || window._toyDeviceType;
            if (toyDevice === 'tablet' || toyDevice === 'pad') return true;
            if (toyDevice === 'desktop' || toyDevice === 'pc' || toyDevice === 'phone' || toyDevice === 'mobile') return false;

            const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
            const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
            if (isIPadOS || /iPad|Tablet|PlayBook|Silk/i.test(ua)) return true;
            if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;

            const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const minSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
            return !!(hasCoarsePointer && minSide >= 600);
        },

        isPCDesktop() {
            if (typeof window.isPCDesktopDevice === 'function') {
                return window.isPCDesktopDevice();
            }
            const toyDevice = document.documentElement.getAttribute('data-toy-device') || window._toyDeviceType;
            if (toyDevice === 'desktop' || toyDevice === 'pc') return true;
            if (toyDevice === 'phone' || toyDevice === 'mobile' || toyDevice === 'tablet' || toyDevice === 'pad') return false;

            const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
            const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
            if (isIPadOS) return false;

            const isMobileOrTabletUA = /Android|webOS|iPhone|iPad|iPod|Tablet|PlayBook|Silk|BlackBerry|IEMobile|Opera Mini|Mobile|BiliApp|bili-universal/i.test(ua);
            if (isMobileOrTabletUA) return false;

            if (navigator && navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
                if (navigator.userAgentData.mobile) return false;
            }

            const isCoarsePrimary = window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
            if (isCoarsePrimary) return false;

            const isDesktopOS = /Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(ua);
            if (isDesktopOS && !isMobileOrTabletUA) return true;

            const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
            const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
            return !!(hasFinePointer && hasHover && window.innerWidth >= 900);
        },

        applyDeviceTypeState(deviceType) {
            if (!deviceType) return;
            window._toyDeviceType = deviceType;
            document.documentElement.setAttribute('data-toy-device', deviceType);
            if (deviceType === 'desktop' || deviceType === 'pc') {
                document.body.classList.add('is-pc-device');
                document.body.classList.remove('is-tablet-device');
            } else if (deviceType === 'tablet' || deviceType === 'pad') {
                document.body.classList.add('is-tablet-device');
                document.body.classList.remove('is-pc-device');
            } else {
                document.body.classList.remove('is-pc-device');
                document.body.classList.remove('is-tablet-device');
            }
        },

        init() {
            if (this.isTablet()) {
                this.applyDeviceTypeState('tablet');
            }

            // 🖥️ PC Desktop: Strictly keep orientation controls hidden and inert, ensure portrait phone shell on home
            if (this.isPCDesktop()) {
                this.applyDeviceTypeState('desktop');
                document.body.classList.remove('is-landscape');
                document.body.classList.add('is-portrait');
                const popItem = document.getElementById('pop-item-orientation');
                if (popItem) popItem.style.setProperty('display', 'none', 'important');
                return;
            }

            // 1. Initial orientation check from viewport aspect ratio
            const isInitialLandscape = (window.innerWidth > window.innerHeight);
            const initMode = isInitialLandscape ? 'landscape' : 'portrait';
            this.currentOrientation = initMode;
            this.applyDomState(initMode);

            // 2. Query official Bilibili Toy SDK Container State on launch
            if (window.toy && typeof window.toy.getContainerState === 'function') {
                try {
                    const stPromise = (typeof window.callToySdkWithTimeout === 'function')
                        ? window.callToySdkWithTimeout(() => window.toy.getContainerState(), 2500)
                        : window.toy.getContainerState();
                    Promise.resolve(stPromise).then((state) => {
                        if (state && state.deviceType) {
                            this.applyDeviceTypeState(state.deviceType);
                        }
                        if (state && state.orientation) {
                            this.currentOrientation = state.orientation;
                            this.applyDomState(state.orientation);
                            this.updateMenuText(state.orientation);
                        }
                    }).catch(() => {});
                } catch(e) {}
            }

            // 3. Listen to official Bilibili Toy SDK Container State changes
            if (window.toy && typeof window.toy.onContainerChange === 'function') {
                const bindContainerChange = () => {
                    try {
                        window.toy.onContainerChange((state) => {
                            if (!state) return;
                            if (state.deviceType) {
                                this.applyDeviceTypeState(state.deviceType);
                            }
                            if (state.orientation && state.orientation !== this.currentOrientation) {
                                this.currentOrientation = state.orientation;
                                this.applyDomState(state.orientation);
                                this.updateMenuText(state.orientation);
                            } else if (state.viewport && state.viewport.width && state.viewport.height) {
                                const isLand = state.viewport.width > state.viewport.height;
                                const mode = isLand ? 'landscape' : 'portrait';
                                if (mode !== this.currentOrientation) {
                                    this.currentOrientation = mode;
                                    this.applyDomState(mode);
                                    this.updateMenuText(mode);
                                }
                            }
                        });
                    } catch(e) {}
                };
                if (typeof window.toy.isSupport === 'function') {
                    const suppPromise = (typeof window.callToySdkWithTimeout === 'function')
                        ? window.callToySdkWithTimeout(() => window.toy.isSupport('onContainerChange'), 1500)
                        : Promise.resolve(window.toy.isSupport('onContainerChange'));
                    suppPromise.then((ok) => {
                        if (ok) bindContainerChange();
                    }).catch(() => {});
                } else {
                    bindContainerChange();
                }
            }

            // 4. Setup Hardware Motion Sensors (陀螺仪、加速度计、Generic Sensor API)
            this.setupOrientationSensors();

            // 5. Setup Browser Viewport & Orientation Listeners
            this.setupBrowserOrientationListeners();

            // 6. Bind quiet popover settings item
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            } else {
                this.bindEvents();
            }
        },

        setupOrientationSensors() {
            const handleOrientation = (e) => this.handleDeviceOrientation(e);
            const handleMotion = (e) => this.handleDeviceMotion(e);
            this._handleOrientation = handleOrientation;
            this._handleMotion = handleMotion;
            this._motionPermRequested = false;

            // Direct non-intrusive binding for Android / WebViews that do not require explicit permission alerts.
            // On iOS 13+, never trigger DeviceOrientationEvent.requestPermission() on passive home clicks,
            // because popping a system alert during touchstart cancels the user's tap!
            const requiresExplicitIosPrompt = (
                typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function'
            );
            if (!requiresExplicitIosPrompt) {
                try {
                    window.addEventListener('deviceorientation', handleOrientation, true);
                } catch(e) {}
                try {
                    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
                } catch(e) {}
                try {
                    window.addEventListener('devicemotion', handleMotion, true);
                } catch(e) {}
            }

            // Generic Sensor API (Chrome / Android WebView)
            if (typeof Accelerometer !== 'undefined') {
                try {
                    const acl = new Accelerometer({ frequency: 20 });
                    acl.addEventListener('reading', () => {
                        this.processAccValues(acl.x, acl.y, acl.z);
                    });
                    acl.start();
                } catch(e) {}
            }
        },

        requestMotionPermissionOnce() {
            if (this._motionPermRequested) return;
            this._motionPermRequested = true;
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    DeviceOrientationEvent.requestPermission().then((res) => {
                        if (res === 'granted' && this._handleOrientation && this._handleMotion) {
                            window.addEventListener('deviceorientation', this._handleOrientation, true);
                            window.addEventListener('devicemotion', this._handleMotion, true);
                        }
                    }).catch(() => {});
                } catch(e) {}
            }
        },

        handleDeviceOrientation(event) {
            const beta = event.beta;   // -180 to +180 (pitch)
            const gamma = event.gamma; // -90 to +90 (roll)
            if (beta === null || gamma === null || typeof beta === 'undefined' || typeof gamma === 'undefined') return;

            const absBeta = Math.abs(beta);
            const absGamma = Math.abs(gamma);

            // 1. Flat on desk check (<14° tilt on both axes)
            if (absBeta < 14 && absGamma < 14) return;

            // 2. Orientation determination:
            // Landscape: phone turned sideways
            if (absGamma >= 34 || (absGamma >= 25 && absGamma > absBeta * 0.75)) {
                this.onSensorReading('landscape');
            } else if (absGamma <= 18 && absBeta >= 20) {
                // Portrait: phone held upright
                this.onSensorReading('portrait');
            }
        },

        handleDeviceMotion(event) {
            const acc = event.accelerationIncludingGravity || event.acceleration;
            if (!acc) return;
            this.processAccValues(acc.x, acc.y, acc.z);
        },

        processAccValues(x, y, z) {
            if (x === null || y === null || typeof x === 'undefined' || typeof y === 'undefined') return;
            const absX = Math.abs(x);
            const absY = Math.abs(y);
            const planeMag = Math.sqrt(absX * absX + absY * absY);

            // Ignore when device is flat on a table
            if (planeMag < 1.4) return;

            if (absX > absY * 1.08 && absX > 1.8) {
                this.onSensorReading('landscape');
            } else if (absY > absX * 1.08 && absY > 1.8) {
                this.onSensorReading('portrait');
            }
        },

        onSensorReading(detectedMode) {
            if (this.isPCDesktop() || this.isTablet()) return;
            if (this.isTransitioning) return;
            if (detectedMode === this.currentOrientation) {
                this.candidateOrientation = null;
                return;
            }

            const now = Date.now();
            if (this.candidateOrientation !== detectedMode) {
                this.candidateOrientation = detectedMode;
                this.candidateStartTime = now;
                return;
            }

            // Must hold the new physical orientation continuously for >= 180ms to avoid jitter
            if (now - this.candidateStartTime >= 180) {
                this.candidateOrientation = null;
                this.autoSwitchTo(detectedMode);
            }
        },

        setupBrowserOrientationListeners() {
            // 1. screen.orientation API
            if (window.screen && window.screen.orientation) {
                try {
                    window.screen.orientation.addEventListener('change', () => {
                        const type = window.screen.orientation.type || '';
                        const isLand = type.includes('landscape');
                        this.autoSwitchTo(isLand ? 'landscape' : 'portrait');
                    });
                } catch(e) {}
            }

            // 2. window.orientation / orientationchange fallback
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    const isLand = Math.abs(window.orientation || 0) === 90;
                    this.autoSwitchTo(isLand ? 'landscape' : 'portrait');
                }, 80);
            }, { passive: true });

            // 3. CSS media query orientation listener
            if (window.matchMedia) {
                try {
                    const mql = window.matchMedia('(orientation: landscape)');
                    const handleMql = (e) => {
                        this.autoSwitchTo(e.matches ? 'landscape' : 'portrait');
                    };
                    if (mql.addEventListener) {
                        mql.addEventListener('change', handleMql);
                    } else if (mql.addListener) {
                        mql.addListener(handleMql);
                    }
                } catch(e) {}
            }

            // 4. Viewport resize listener: sync if aspect ratio changed
            window.addEventListener('resize', () => {
                if (window.innerWidth > window.innerHeight && this.currentOrientation === 'portrait') {
                    this.autoSwitchTo('landscape');
                } else if (window.innerWidth < window.innerHeight && this.currentOrientation === 'landscape') {
                    this.autoSwitchTo('portrait');
                }
            }, { passive: true });
        },

        bindEvents() {
            // Quiet Popover Menu Item (tucked away in settings, optional manual override)
            const popItem = document.getElementById('pop-item-orientation');
            if (popItem) {
                popItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleOrientation();
                    const popCard = document.getElementById('popover-quiz-actions');
                    if (popCard) popCard.classList.remove('show', 'active');
                });
            }
            this.updateMenuText(this.currentOrientation);
        },

        applyDomState(mode) {
            const root = document.documentElement;
            const body = document.body;
            root.setAttribute('data-toy-orientation', mode);
            if (mode === 'landscape') {
                body.classList.add('is-landscape');
                body.classList.remove('is-portrait');
            } else {
                body.classList.add('is-portrait');
                body.classList.remove('is-landscape');
            }
        },

        updateMenuText(mode) {
            const popText = document.getElementById('pop-text-orientation');
            if (popText) {
                popText.textContent = (mode === 'landscape') ? '屏幕方向: 横屏 🔄' : '屏幕方向: 竖屏 📱';
            }
        },

        async toggleOrientation() {
            if (this.isTransitioning) return;
            this.requestMotionPermissionOnce();
            const nextMode = (this.currentOrientation === 'landscape') ? 'portrait' : 'landscape';
            await this.autoSwitchTo(nextMode);
        },

        async autoSwitchTo(targetMode) {
            if (this.isTransitioning) return;
            if (this.currentOrientation === targetMode) return;
            this.isTransitioning = true;

            this.currentOrientation = targetMode;
            this.applyDomState(targetMode);
            this.updateMenuText(targetMode);

            // Instruct Bilibili Toy Container to switch orientation & immersive mode
            if (window.toy) {
                try {
                    const callSdk = (fn, ms) => (typeof window.callToySdkWithTimeout === 'function')
                        ? window.callToySdkWithTimeout(fn, ms)
                        : Promise.resolve().then(fn);
                    let canSet = true;
                    if (typeof window.toy.isSupport === 'function') {
                        canSet = await callSdk(() => window.toy.isSupport('setContainerMode'), 1500).catch(() => false);
                    }
                    if (canSet && typeof window.toy.setContainerMode === 'function') {
                        const isLandscape = (targetMode === 'landscape');
                        await callSdk(() => window.toy.setContainerMode({
                            orientation: targetMode,
                            immersive: isLandscape // 手机横屏同时开启全屏沉浸 (immersive: true)
                        }), 2500);
                        console.log(`[ToyOrientationManager] setContainerMode applied: ${targetMode} (immersive: ${isLandscape})`);
                    }
                } catch(err) {
                    console.log('[ToyOrientationManager] setContainerMode call notice:', err);
                }
            }

            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new CustomEvent('toyorientationchange', { detail: { orientation: targetMode } }));

            setTimeout(() => {
                this.isTransitioning = false;
            }, 600);
        },

        // Backward-compatible alias
        setOrientation(mode) {
            return this.autoSwitchTo(mode);
        }
    };

    // Auto initialize
    ToyOrientationManager.init();

    // Export to global scope
    window.ToyOrientationManager = ToyOrientationManager;
    window.toggleToyOrientation = () => ToyOrientationManager.toggleOrientation();
})();
