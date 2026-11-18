/* === Bulletproof iOS WKWebView Cross-Origin Iframe Storage Engine === */
(function() {
    if (window.__toyLS && window.__toySS) return;
    function createSafeStorage(nativeName) {
        var mem = Object.create(null);
        var nativeStore = null;
        try {
            var s = window[nativeName];
            if (s) {
                var probe = '__toy_st_probe__';
                s.setItem(probe, '1');
                s.removeItem(probe);
                nativeStore = s;
            }
        } catch (e) {
            nativeStore = null;
        }
        return {
            getItem: function(k) {
                var key = String(k);
                if (nativeStore) {
                    try { return nativeStore.getItem(key); } catch (e) {}
                }
                return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
            },
            setItem: function(k, v) {
                var key = String(k), val = String(v);
                mem[key] = val;
                if (nativeStore) {
                    try {
                        nativeStore.setItem(key, val);
                    } catch (e) {
                        try {
                            var toDel = [];
                            for (var i = 0; i < nativeStore.length; i++) {
                                var nk = nativeStore.key(i);
                                if (nk && nk !== 'toy_exam_mode' && nk !== 'toy_daily_accent' && nk !== 'toy_daily_repeat_count' && nk !== 'toy_daily_design_variant' && (nk.indexOf('toy_exam_') === 0 || nk.indexOf('toy_daily_') === 0)) {
                                    toDel.push(nk);
                                }
                            }
                            for (var j = 0; j < toDel.length; j++) nativeStore.removeItem(toDel[j]);
                            nativeStore.setItem(key, val);
                        } catch (e2) {}
                    }
                }
            },
            removeItem: function(k) {
                var key = String(k);
                delete mem[key];
                if (nativeStore) {
                    try { nativeStore.removeItem(key); } catch (e) {}
                }
            },
            clear: function() {
                mem = Object.create(null);
                if (nativeStore) {
                    try { nativeStore.clear(); } catch (e) {}
                }
            },
            key: function(i) {
                if (nativeStore) {
                    try { return nativeStore.key(i); } catch (e) {}
                }
                var keys = Object.keys(mem);
                return (i >= 0 && i < keys.length) ? keys[i] : null;
            },
            get length() {
                if (nativeStore) {
                    try { return nativeStore.length; } catch (e) {}
                }
                return Object.keys(mem).length;
            }
        };
    }
    window.__toyLS = window.__toyLS || createSafeStorage('localStorage');
    window.__toySS = window.__toySS || createSafeStorage('sessionStorage');
})();
