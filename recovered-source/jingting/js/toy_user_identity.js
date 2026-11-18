/* === js/toy_user_identity.js === */
window.DEFAULT_UNFETCHED_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='20' fill='%23E2E8F0'/%3E%3Ccircle cx='20' cy='14' r='6' fill='%2394A3B8'/%3E%3Cpath d='M9 33c0-6 5-9.5 11-9.5s11 3.5 11 9.5' fill='%2394A3B8'/%3E%3C/svg%3E";
/**
 * ==========================================================================
 * Bilibili Toy JS SDK Adapter & Cloud Storage Engine (v1.5.0 Spec)
 * ==========================================================================
 */

// ==========================================================================
// 🛠️ TESTING / DEBUG CONFIGURATION (Set to false to hide tester widget)
window.ENABLE_TEST_IDENTITY_SWITCHER = false;

window.currentUserProfile = { nickname: '同学', avatar: '', toyOpenId: '' };
try {
    const _cachedProfile = window.__toyLS.getItem('toy_cached_user_profile');
    if (_cachedProfile) {
        const _p = JSON.parse(_cachedProfile);
        if (_p && typeof _p === 'object') {
            const hasRealIdentity = Boolean(_p.toyOpenId || _p.avatar);
            if (_p.nickname && _p.nickname !== '同学' && _p.nickname !== '本地测试用户' && (hasRealIdentity || _p.nickname !== '幼稚园大队长丨')) {
                window.currentUserProfile.nickname = _p.nickname;
            }
            if (_p.avatar) {
                window.currentUserProfile.avatar = _p.avatar;
                try {
                    const img = new Image();
                    img.src = _p.avatar;
                    if ('decode' in img) img.decode().catch(() => {});
                } catch(e) {}
            }
            if (_p.toyOpenId) window.currentUserProfile.toyOpenId = _p.toyOpenId;
        }
    }
} catch(e) {}

window.completedExams = {};
window.streakInfo = { streak: 1, lastDate: "" };

/**
 * Multi-Account LocalStorage Isolation Engine
 * Prevents account data pollution when multiple users log in on the same physical device.
 */
function getCurrentUserKey() {
    if (window.currentUserProfile) {
        if (window.currentUserProfile.toyOpenId) {
            return 'u_' + String(window.currentUserProfile.toyOpenId).replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        if (window.currentUserProfile.nickname && window.currentUserProfile.nickname !== '同学' && window.currentUserProfile.nickname !== '本地测试用户') {
            return 'u_' + encodeURIComponent(window.currentUserProfile.nickname).replace(/[^a-zA-Z0-9_-]/g, '_');
        }
    }
    try {
        let guestId = window.__toyLS.getItem('toy_guest_device_id');
        if (!guestId) {
            guestId = 'guest_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
            window.__toyLS.setItem('toy_guest_device_id', guestId);
        }
        return 'u_' + guestId;
    } catch(e) {
        return 'u_guest';
    }
}

function getUserStorageKey(baseKey) {
    const uKey = getCurrentUserKey();
    return `toy_${uKey}_${baseKey}`;
}

/**
 * Quota-Safe LocalStorage Writer
 * Protects critical user progress from QuotaExceededError by evicting stale static exam JSON caches.
 */
function safeLocalStorageSet(key, value) {
    try {
        window.__toyLS.setItem(key, value);
        return true;
    } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)) {
            console.warn('[ToySDK] LocalStorage quota reached. Evicting non-essential exam/daily caches to save user progress...');
            try {
                const keysToEvict = [];
                for (let i = 0; i < window.__toyLS.length; i++) {
                    const k = window.__toyLS.key(i);
                    if (k && (k.startsWith('toy_exam_') || k.startsWith('toy_daily_'))) {
                        keysToEvict.push(k);
                    }
                }
                keysToEvict.forEach(k => window.__toyLS.removeItem(k));
                window.__toyLS.setItem(key, value);
                return true;
            } catch (evictErr) {
                console.error('[ToySDK] LocalStorage recovery failed:', evictErr);
            }
        }
        return false;
    }
}

window.getCurrentUserKey = getCurrentUserKey;
window.getUserStorageKey = getUserStorageKey;
window.safeLocalStorageSet = safeLocalStorageSet;

/**
 * Safe Timeout Wrapper for Bilibili Toy JSBridge Promises
 * Prevents a hung native WKWebView / Android WebView bridge callback from deadlocking startup or permission syncs.
 */
function callToySdkWithTimeout(fnOrPromise, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const err = new Error(`[ToySDK] Bridge call timed out after ${timeoutMs}ms`);
            err.code = 'SDK_TIMEOUT';
            reject(err);
        }, timeoutMs);
        if (timer && typeof timer.unref === 'function') timer.unref();

        try {
            const p = (typeof fnOrPromise === 'function') ? fnOrPromise() : fnOrPromise;
            Promise.resolve(p).then(
                (val) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(val);
                },
                (err) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                }
            );
        } catch (syncErr) {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(syncErr);
            }
        }
    });
}
window.callToySdkWithTimeout = callToySdkWithTimeout;

// Synchronous 0ms pre-hydration from user-isolated localStorage so first-frame renders never see empty state
try {
    const _initLocalExams = window.__toyLS.getItem(getUserStorageKey('completed_exams'));
    if (_initLocalExams) {
        const _parsedInitExams = JSON.parse(_initLocalExams);
        if (_parsedInitExams && typeof _parsedInitExams === 'object') {
            window.completedExams = _parsedInitExams;
        }
    }
    const _initLocalStreak = window.__toyLS.getItem(getUserStorageKey('streak_info'));
    if (_initLocalStreak) {
        const _parsedInitStreak = JSON.parse(_initLocalStreak);
        if (_parsedInitStreak && typeof _parsedInitStreak === 'object') {
            window.streakInfo = Object.assign({}, window.streakInfo, _parsedInitStreak);
        }
    }
} catch (e) {}


/**
 * Switch Active User: Complete memory isolation & state hydration
 */
async function switchActiveUser(prevUserKey, newUserKey) {
    console.log(`[ToySDK] 🔄 Switching active user from ${prevUserKey} to ${newUserKey}. Full memory isolation.`);

    // Capture fresh guest session progress if transitioning from initial guest to authenticated Bilibili user
    const isGuestToAuthUpgrade = Boolean(
        prevUserKey && prevUserKey.startsWith('u_guest') &&
        newUserKey && !newUserKey.startsWith('u_guest')
    );
    let guestExamsSnapshot = null;
    let guestTodayLogSnapshot = null;
    let guestTodayDurSec = 0;
    if (isGuestToAuthUpgrade) {
        try {
            if (window.completedExams && Object.keys(window.completedExams).length > 0) {
                guestExamsSnapshot = JSON.parse(JSON.stringify(window.completedExams));
            }
            const rawGuestLog = window.__toyLS.getItem(`toy_${prevUserKey}_today_practice_log`);
            if (rawGuestLog) guestTodayLogSnapshot = JSON.parse(rawGuestLog);
            const rawGuestDur = window.__toyLS.getItem(`toy_${prevUserKey}_today_practice_duration`);
            if (rawGuestDur) {
                const parsedDur = JSON.parse(rawGuestDur);
                if (parsedDur && parsedDur.date === getTodayDateStr() && typeof parsedDur.seconds === 'number') {
                    guestTodayDurSec = parsedDur.seconds;
                }
            }
        } catch (e) {}
    }

    // 1. Terminate ongoing practice sessions & debounce timers to prevent cross-account pollution
    if (typeof window.resetPracticeSessionTimersForSwitch === 'function') {
        window.resetPracticeSessionTimersForSwitch();
    }
    if (typeof window.resetCloudSyncTimersForSwitch === 'function') {
        window.resetCloudSyncTimersForSwitch();
    }

    // 2. Wipe in-memory session states
    window.completedExams = {};
    window.streakInfo = null;
    if (window._passageUnderlinesMap) window._passageUnderlinesMap = {};
    if (window._eliminatedOptionsMap) window._eliminatedOptionsMap = {};

    // 3. Cache current user profile & active key in localStorage
    try {
        window.__toyLS.setItem('toy_cached_user_profile', JSON.stringify({
            nickname: window.currentUserProfile.nickname,
            avatar: window.currentUserProfile.avatar,
            toyOpenId: window.currentUserProfile.toyOpenId
        }));
        window.__toyLS.setItem('toy_last_active_user_key', newUserKey);
    } catch(e) {}

    // 4. Update UI avatars & names
    updateUserAvatarDOM();
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const heroAvatarEl = document.getElementById('hero-user-avatar');
    const homeUserName = document.getElementById('home-user-name');
    if (nameEl) nameEl.textContent = window.currentUserProfile.nickname || '同学';
    if (homeUserName) homeUserName.textContent = window.currentUserProfile.nickname || '同学';
    if (avatarEl && window.currentUserProfile.avatar) avatarEl.src = window.currentUserProfile.avatar;
    if (heroAvatarEl && window.currentUserProfile.avatar) heroAvatarEl.src = window.currentUserProfile.avatar;

    // 5. Reload HabitStreak, HomeCalendar, VocabNotebookBridge, and ToyPermissions for the new user
    let liveGuestSdkPerms = null;
    if (isGuestToAuthUpgrade && window.ToyPermissions && !(window.ENABLE_TEST_IDENTITY_SWITCHER && window.ToyPermissions.isTestOverridden)) {
        liveGuestSdkPerms = {
            isCharged: !!window.ToyPermissions.isCharged,
            isFollowing: !!window.ToyPermissions.isFollowing,
            hasFanMedal: !!window.ToyPermissions.hasFanMedal,
            isAuthor: !!window.ToyPermissions.isAuthor,
            hasShared: !!window.ToyPermissions.hasShared,
            hasCoinCet4: !!window.ToyPermissions.hasCoinCet4,
            hasCoinCet6: !!window.ToyPermissions.hasCoinCet6,
            hasCoinGaokao: !!window.ToyPermissions.hasCoinGaokao,
            hasCoinDaily: !!window.ToyPermissions.hasCoinDaily,
            hasCoinIelts: !!window.ToyPermissions.hasCoinIelts,
            hasCoinKaoyan: !!window.ToyPermissions.hasCoinKaoyan,
            coinCountCet4: window.ToyPermissions.coinCountCet4 || 0,
            coinCountCet6: window.ToyPermissions.coinCountCet6 || 0,
            coinCountGaokao: window.ToyPermissions.coinCountGaokao || 0,
            coinCountDaily: window.ToyPermissions.coinCountDaily || 0,
            coinCountIelts: window.ToyPermissions.coinCountIelts || 0,
            coinCountKaoyan: window.ToyPermissions.coinCountKaoyan || 0
        };
    }
    if (window.ToyPermissions && typeof window.ToyPermissions.init === 'function') {
        window.ToyPermissions.init(true);
        if (liveGuestSdkPerms) {
            let anyLivePerm = false;
            ['isCharged', 'isFollowing', 'hasFanMedal', 'isAuthor', 'hasShared', 'hasCoinCet4', 'hasCoinCet6', 'hasCoinGaokao', 'hasCoinDaily', 'hasCoinIelts', 'hasCoinKaoyan'].forEach((k) => {
                if (liveGuestSdkPerms[k]) {
                    window.ToyPermissions[k] = true;
                    anyLivePerm = true;
                }
            });
            ['coinCountCet4', 'coinCountCet6', 'coinCountGaokao', 'coinCountDaily', 'coinCountIelts', 'coinCountKaoyan'].forEach((ck) => {
                if (liveGuestSdkPerms[ck] > 0) {
                    window.ToyPermissions[ck] = Math.max(window.ToyPermissions[ck] || 0, liveGuestSdkPerms[ck]);
                }
            });
            if (anyLivePerm) {
                window.ToyPermissions._saveCachedPermissions();
                window.ToyPermissions.updateUI({ forceLobbyRerender: false });
            }
        }
    }
    if (window.HabitStreak && typeof window.HabitStreak.reloadForUser === 'function') {
        window.HabitStreak.reloadForUser();
    }
    if (window.HomeCalendar && typeof window.HomeCalendar.reloadForUser === 'function') {
        window.HomeCalendar.reloadForUser();
    }
    if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.onUserSwitched === 'function') {
        window.VocabNotebookBridge.onUserSwitched(prevUserKey, newUserKey).catch(() => {});
    }

    // 6. Reload account-isolated cloud data and refresh dashboard stats
    if (typeof loadUserCloudData === 'function') {
        await loadUserCloudData().catch(() => {});
    }

    // 6.5 Seamless Guest -> Authenticated session progress merge (if user answered questions before SDK profile resolved)
    if (isGuestToAuthUpgrade) {
        let mergedAnyGuestData = false;
        if (guestExamsSnapshot && typeof guestExamsSnapshot === 'object') {
            if (!window.completedExams) window.completedExams = {};
            Object.entries(guestExamsSnapshot).forEach(([title, gExam]) => {
                window.completedExams[title] = mergeExamRecord(window.completedExams[title], gExam);
                mergedAnyGuestData = true;
            });
        }
        if (guestTodayLogSnapshot && guestTodayLogSnapshot.date === getTodayDateStr() && guestTodayLogSnapshot.questions) {
            const curLog = getTodayPracticeLog();
            Object.assign(curLog.questions, guestTodayLogSnapshot.questions);
            try {
                window.__toyLS.setItem(getUserStorageKey('today_practice_log'), JSON.stringify(curLog));
            } catch (e) {}
            recordDailyPracticeCount(getTodayDateStr(), Object.keys(curLog.questions).length);
            mergedAnyGuestData = true;
        }
        if (guestTodayDurSec > 0) {
            const curDur = getTodayPracticeDuration();
            if (guestTodayDurSec > curDur) {
                try {
                    window.__toyLS.setItem(getUserStorageKey('today_practice_duration'), JSON.stringify({
                        date: getTodayDateStr(),
                        seconds: guestTodayDurSec
                    }));
                } catch (e) {}
                mergedAnyGuestData = true;
            }
        }
        if (mergedAnyGuestData) {
            saveUserCloudData(null, true).catch(() => {});
        }
    }

    if (window.ToyPermissions && typeof window.ToyPermissions.syncSdkStatus === 'function') {
        window.ToyPermissions.syncSdkStatus(false).catch(() => {});
    }

    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof renderLobbyGrid === 'function') renderLobbyGrid('ALL');
    if (typeof renderWrittenLobbyGrid === 'function') renderWrittenLobbyGrid('ALL');
    if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid('ALL');
    if (typeof fetchAndRenderRankList === 'function') fetchAndRenderRankList().catch(() => {});
}
window.switchActiveUser = switchActiveUser;

/**
 * Fetch Bilibili User Profile via Toy JS SDK
 */
async function fetchUserProfile(isUserClick = false) {
    if (!window.toy) {
        const nameEl = document.getElementById('user-name');
        const homeUserName = document.getElementById('home-user-name');
        if (nameEl) nameEl.textContent = window.currentUserProfile.nickname || '同学';
        if (homeUserName) homeUserName.textContent = window.currentUserProfile.nickname || '同学';

        if (window.ToyPermissions) {
            window.ToyPermissions.updateUI();
        }
        if (isUserClick) {
            showToyToast('💡 请在哔哩哔哩 App 内打开以同步账号资料');
        }
        return;
    }

    if (!isUserClick && window._profileRequiresUserGesture) {
        return;
    }
    if (isUserClick) {
        window._profileRequiresUserGesture = false;
    }

    try {
        if (typeof window.toy.getUserProfile === 'function') {
            const prevUserKey = getCurrentUserKey();
            const profileTimeoutMs = isUserClick ? 25000 : 1500;
            const profile = await callToySdkWithTimeout(() => window.toy.getUserProfile(), profileTimeoutMs);
            if (profile && (profile.nickname || profile.avatar || profile.toyOpenId)) {
                window._profileRequiresUserGesture = false;
                if (profile.nickname) window.currentUserProfile.nickname = profile.nickname;
                if (profile.avatar) {
                    window.currentUserProfile.avatar = profile.avatar;
                    // Hardware Pre-decode avatar image (bounded at 800ms so slow CDN never stalls boot)
                    try {
                        const preImg = new Image();
                        preImg.src = profile.avatar;
                        if ('decode' in preImg) {
                            await Promise.race([
                                preImg.decode().catch(() => {}),
                                new Promise(r => setTimeout(r, 800))
                            ]);
                        }
                    } catch(e) {}
                }
                if (profile.toyOpenId) window.currentUserProfile.toyOpenId = profile.toyOpenId;
                const newUserKey = getCurrentUserKey();

                const isAccountSwitched = (prevUserKey !== newUserKey);
                if (isAccountSwitched) {
                    await switchActiveUser(prevUserKey, newUserKey);
                } else {
                    updateUserAvatarDOM();
                    const homeUserName = document.getElementById('home-user-name');
                    if (homeUserName) homeUserName.textContent = window.currentUserProfile.nickname;

                    try {
                        window.__toyLS.setItem('toy_cached_user_profile', JSON.stringify({
                            nickname: window.currentUserProfile.nickname,
                            avatar: window.currentUserProfile.avatar,
                            toyOpenId: window.currentUserProfile.toyOpenId
                        }));
                        window.__toyLS.setItem('toy_last_active_user_key', newUserKey);
                    } catch(e) {}

                    if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.onProfileUpdated === 'function') {
                        try { window.VocabNotebookBridge.onProfileUpdated(); } catch (e) {}
                    }

                    if (typeof updateDashboardStats === 'function') updateDashboardStats();
                    if (typeof submitUserScore === 'function') {
                        submitUserScore(false).catch(() => {});
                    }
                }

                if (window.ToyPermissions && !(window.ENABLE_TEST_IDENTITY_SWITCHER && window.ToyPermissions.isTestOverridden)) {
                    const currentUname = (window.currentUserProfile.nickname || '').trim();
                    if (window.ToyPermissions.authorName && currentUname === window.ToyPermissions.authorName) {
                        window.ToyPermissions.isAuthor = true;
                    }
                    window.ToyPermissions.syncSdkStatus(false).catch(() => {});
                    window.ToyPermissions.updateUI();
                }

                if (isUserClick) {
                    showToyToast(`🎉 授权成功！已同步账号：${window.currentUserProfile.nickname}`);
                }
            } else if (isUserClick) {
                showToyModal('💡 未获取到资料', '未能获取到公开数据，请在授权弹窗中点击“允许”。');
            }
        }
    } catch (e) {
        console.warn('[ToySDK] getUserProfile info:', e);
        const errMsg = (e && (e.message || e.errMsg || e.msg)) ? (e.message || e.errMsg || e.msg) : String(e);
        if (!isUserClick && (!e || e.code !== 'SDK_TIMEOUT')) {
            if (/gesture|user.?action|activation|confirm|authoriz|permission|denied|cancel/i.test(errMsg + ' ' + String((e && e.type) || ''))) {
                window._profileRequiresUserGesture = true;
            }
        }
        if (isUserClick) {
            showToyModal('💡 获取公开资料说明', `请在授权弹窗中点击“允许”以同步头像和昵称。<br><br><span style="font-size:12px; opacity:0.6;">(状态信息: ${errMsg})</span>`);
        }
    }
}

window.fetchUserProfile = fetchUserProfile;

/**
 * Migrate guest progress to newly authorized account if user started practicing as guest
 */
function migrateGuestDataIfNeeded() {
    // Handled seamlessly inside switchActiveUser when upgrading from initial guest session
}

window.migrateGuestDataIfNeeded = migrateGuestDataIfNeeded;

function updateUserAvatarDOM() {
    const avatarUrl = window.currentUserProfile && window.currentUserProfile.avatar;
    const placeholder = document.getElementById('home-avatar-placeholder');
    const imgEl = document.getElementById('home-user-avatar-img');
    const wrapEl = document.getElementById('home-user-avatar-wrap');

    if (avatarUrl) {
        if (imgEl) {
            imgEl.src = avatarUrl;
            imgEl.style.display = 'block';
        }
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        if (wrapEl) {
            wrapEl.style.background = 'transparent';
        }
    } else {
        if (imgEl) {
            imgEl.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        if (wrapEl) {
            wrapEl.style.background = 'rgba(18, 22, 28, 0.46)';
        }
    }
}
window.updateUserAvatarDOM = updateUserAvatarDOM;
