/* === js/feedback_engine.js === */
// ==========================================================================
// 🔔 FeedbackEngine: Silent Tactile Haptic System (Sound & Badges Disabled)
// ==========================================================================

(function(window) {
    'use strict';

    // Sound effects are disabled to prevent interfering with listening audio
    const isSoundEnabled = false;

    // Clean up any lingering badge if exists
    try {
        const oldBadge = document.getElementById('duo-combo-badge');
        if (oldBadge && oldBadge.parentNode) {
            oldBadge.parentNode.removeChild(oldBadge);
        }
    } catch (e) {}

    // =========================================================================
    // TOP 3: ios-haptics Engine (iOS 17.4+ WebKit <input switch> Taptic Bridge)
    // =========================================================================
    let _iosHapticLabel = null;
    let _lastHapticTime = 0;

    function ensureIOSHapticBridge() {
        if (_iosHapticLabel && document.body && document.body.contains(_iosHapticLabel)) {
            return _iosHapticLabel;
        }
        if (typeof document === 'undefined' || !document.body) return null;
        try {
            let existing = document.getElementById('ios-taptic-switch-bridge');
            if (existing) {
                _iosHapticLabel = existing;
                return _iosHapticLabel;
            }
            const label = document.createElement('label');
            label.id = 'ios-taptic-switch-bridge';
            label.setAttribute('aria-hidden', 'true');
            label.setAttribute('data-haptic-bridge', '1');
            label.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.setAttribute('switch', '');
            input.setAttribute('data-haptic-bridge', '1');
            input.tabIndex = -1;
            const stopSyntheticBubble = (ev) => {
                if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            };
            label.addEventListener('click', stopSyntheticBubble);
            input.addEventListener('click', stopSyntheticBubble);
            label.appendChild(input);
            document.body.appendChild(label);
            _iosHapticLabel = label;
            return _iosHapticLabel;
        } catch (e) {
            return null;
        }
    }

    function pulseIOSSwitchHaptic() {
        try {
            const bridge = ensureIOSHapticBridge();
            if (bridge) {
                bridge.click();
                return true;
            }
        } catch (e) {}
        return false;
    }

    const FeedbackEngine = {
        isEnabled: function() {
            return false;
        },

        toggleSound: function() {
            return false;
        },

        updateMenuUI: function() {},

        triggerHaptic: function(type = 'tap') {
            const now = Date.now();
            if (now - _lastHapticTime < 18) return; // debounce ultra-rapid duplicate triggers
            _lastHapticTime = now;

            const hasVibrate = (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
            if (hasVibrate) {
                try {
                    if (type === 'selection' || type === 'light') {
                        navigator.vibrate(6);
                    } else if (type === 'tap') {
                        navigator.vibrate(8);
                    } else if (type === 'medium') {
                        navigator.vibrate(14);
                    } else if (type === 'heavy') {
                        navigator.vibrate(22);
                    } else if (type === 'correct' || type === 'success') {
                        navigator.vibrate([10, 40, 16]);
                    } else if (type === 'wrong' || type === 'error') {
                        navigator.vibrate([18, 35, 18]);
                    } else if (type === 'complete') {
                        navigator.vibrate([20, 35, 20, 35]);
                    } else {
                        navigator.vibrate(8);
                    }
                    return;
                } catch (e) {}
            }

            // Fallback & iOS 17.4+ Safari / WKWebView Taptic Engine via <input switch>
            pulseIOSSwitchHaptic();
            if (type === 'correct' || type === 'success' || type === 'complete') {
                setTimeout(pulseIOSSwitchHaptic, 65);
            } else if (type === 'wrong' || type === 'error') {
                setTimeout(pulseIOSSwitchHaptic, 55);
            }
        },

        /**
         * Safe silent hooks for quiz & exam engines
         */
        playCorrect: function() {
            this.triggerHaptic('correct');
        },

        playWrong: function() {
            this.triggerHaptic('wrong');
        },

        playComplete: function() {
            this.triggerHaptic('complete');
        },

        playTap: function() {
            this.triggerHaptic('tap');
        },

        getCombo: function() {
            return 0;
        },

        resetCombo: function() {},

        showComboBadge: function() {},

        hideComboBadge: function() {}
    };

    window.openSfxSchemesModal = function() {};
    window.closeSfxSchemesModal = function() {};
    window.renderSfxSchemesList = function() {};
    window.playSuccessBellChime = function() {};
    window.FeedbackEngine = FeedbackEngine;

})(window);
