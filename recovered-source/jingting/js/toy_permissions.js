/* === js/toy_permissions.js === */
/**
 * ==========================================================================
 * Bilibili Toy JS SDK 2.0.0 Permissions & Interactive Unlock Engine
 * ==========================================================================
 */
window.ToyPermissions = {
    isFollowing: false,
    hasFanMedal: false,
    isCharged: false,
    isAuthor: false, // UP 主本人直接拥有全通特权
    hasShared: false,
    hasCoinCet4: false,
    hasCoinCet6: false,
    hasCoinGaokao: false,
    hasCoinDaily: false,
    hasCoinIelts: false,
    hasCoinKaoyan: false,
    coinCountCet4: 0,
    coinCountCet6: 0,
    coinCountGaokao: 0,
    coinCountDaily: 0,
    coinCountIelts: 0,
    coinCountKaoyan: 0,
    authorMid: '8157388',
    authorName: '幼稚园大队长丨',
    videos: {
        cet4: { bvid: 'BV1oP411X7gX', aid: 313799856, title: '四级真题精讲视频' },
        cet6: { bvid: 'BV1Zu411x7k4', aid: 528927079, title: '六级真题精讲视频' },
        gaokao: { bvid: 'BV19M4y1j764', aid: 913305211, title: '【B站最全高考听力合集】历年高考英语听力真题' },
        daily: { bvid: 'BV1RsKj6QEVX', aid: 116930635700018, title: '每日英语听力精讲视频' },
        ielts: { bvid: 'BV1To4y1T7dT', aid: 402005500, title: '【B站最全IELTS雅思听力合集】剑桥雅思真题听力精听' },
        kaoyan: { bvid: 'BV1oP411X7gX', aid: 313799856, title: '考研真题精讲视频' }
    },
    isUnsupportedEnv: false,
    currentTargetType: 'all',
    unlockExtra: {},
    syncPromise: null,
    _hasCompletedInitialSync: false,
    _syncStartAt: 0,
    _sessionCoinLevels: new Set(),
    _sessionOptimisticFollow: false,

    _isEffectiveFollowing() {
        return !!(this.isFollowing || this._sessionOptimisticFollow);
    },

    _sdkCall(fn, timeoutMs = 3200) {
        if (typeof window.callToySdkWithTimeout === 'function') {
            return window.callToySdkWithTimeout(fn, timeoutMs);
        }
        return Promise.resolve().then(fn);
    },

    _saveCachedPermissions() {
        try {
            const payload = {
                isFollowing: this.isFollowing,
                isCharged: this.isCharged,
                isAuthor: this.isAuthor,
                hasCoinCet4: this.hasCoinCet4,
                hasCoinCet6: this.hasCoinCet6,
                hasCoinGaokao: this.hasCoinGaokao,
                hasCoinDaily: this.hasCoinDaily,
                hasCoinIelts: this.hasCoinIelts,
                hasCoinKaoyan: this.hasCoinKaoyan,
                hasFanMedal: this.hasFanMedal,
                hasShared: this.hasShared,
                isTestOverridden: !!this.isTestOverridden,
                timestamp: Date.now()
            };
            if (window.ToySecurity && typeof window.ToySecurity.saveSignedPermissions === 'function') {
                window.ToySecurity.saveSignedPermissions(getCurrentUserKey(), payload);
            } else {
                window.__toyLS.setItem(getUserStorageKey('cached_permissions'), JSON.stringify(payload));
            }
        } catch(e) {}
    },

    init(resetFirst = false) {
        try {
            if (resetFirst) {
                this.isFollowing = false;
                this.isCharged = false;
                this.isAuthor = false;
                this.hasFanMedal = false;
                this.hasShared = false;
                this.hasCoinCet4 = false;
                this.hasCoinCet6 = false;
                this.hasCoinGaokao = false;
                this.hasCoinDaily = false;
                this.hasCoinIelts = false;
                this.hasCoinKaoyan = false;
                this.coinCountCet4 = 0;
                this.coinCountCet6 = 0;
                this.coinCountGaokao = 0;
                this.coinCountDaily = 0;
                this.coinCountIelts = 0;
                this.coinCountKaoyan = 0;
                if (this._sessionCoinLevels) this._sessionCoinLevels.clear();
                this._sessionOptimisticFollow = false;
            }

            const uKey = getCurrentUserKey();
            let parsed = null;
            if (window.ToySecurity && typeof window.ToySecurity.loadSignedPermissions === 'function') {
                parsed = window.ToySecurity.loadSignedPermissions(uKey);
            } else {
                const cached = window.__toyLS.getItem(getUserStorageKey('cached_permissions'));
                if (cached) {
                    try { parsed = JSON.parse(cached); } catch (parseErr) { parsed = null; }
                }
            }

            if (parsed && typeof parsed === 'object') {
                // Check cache timestamp (TTL: 2 hours = 7200000ms)
                const now = Date.now();
                const cacheAge = now - (Number(parsed.timestamp) || 0);
                const isCacheExpired = !parsed.timestamp || cacheAge > 2 * 60 * 60 * 1000;

                if (window.ENABLE_TEST_IDENTITY_SWITCHER && parsed.isTestOverridden) {
                    this.isTestOverridden = true;
                    this.isAuthor = !!parsed.isAuthor;
                }
                this.isFollowing = this.isFollowing || !!parsed.isFollowing;
                // Only trust cached VIP/Charged status if within 2-hour TTL
                this.isCharged = this.isCharged || (isCacheExpired ? false : !!parsed.isCharged);
                this.hasCoinCet4 = this.hasCoinCet4 || !!parsed.hasCoinCet4;
                this.hasCoinCet6 = this.hasCoinCet6 || !!parsed.hasCoinCet6;
                this.hasCoinGaokao = this.hasCoinGaokao || !!parsed.hasCoinGaokao;
                this.hasCoinDaily = this.hasCoinDaily || !!parsed.hasCoinDaily;
                this.hasCoinIelts = this.hasCoinIelts || !!parsed.hasCoinIelts;
                this.hasCoinKaoyan = this.hasCoinKaoyan || !!parsed.hasCoinKaoyan;
                this.hasFanMedal = this.hasFanMedal || !!parsed.hasFanMedal;
                this.hasShared = this.hasShared || !!parsed.hasShared;
            }

            const sharedFlag = window.__toyLS.getItem(getUserStorageKey('has_shared_app'));
            if (sharedFlag) {
                const expectedSharedSig = (window.ToySecurity && typeof window.ToySecurity.computeSig === 'function')
                    ? window.ToySecurity.computeSig(uKey, 'SHARED_OK')
                    : 'true';
                if (sharedFlag === expectedSharedSig) {
                    this.hasShared = true;
                } else if (sharedFlag === 'true' && expectedSharedSig !== 'true') {
                    // Migrate legacy shared flag once and sign it
                    this.hasShared = true;
                    try { window.__toyLS.setItem(getUserStorageKey('has_shared_app'), expectedSharedSig); } catch(e) {}
                    this._saveCachedPermissions();
                }
            }

            this._lastKnownGlobalState = {
                isCharged: this.isCharged,
                hasShared: this.hasShared,
                hasCoinCet4: this.hasCoinCet4,
                hasCoinCet6: this.hasCoinCet6,
                hasCoinGaokao: this.hasCoinGaokao,
                hasCoinDaily: this.hasCoinDaily,
                hasCoinIelts: this.hasCoinIelts,
                hasCoinKaoyan: this.hasCoinKaoyan,
                isAuthor: this.isAuthor,
                isFollowing: this.isFollowing,
                hasFanMedal: this.hasFanMedal
            };

            if (!this.canUsePracticeMode()) {
                window.isExamMode = true;
            }
        } catch(e) {}
    },

    hasUnlockedTrack(level = null) {
        if (this.isAuthor || this.isCharged) return true;
        const lvl = this._normalizeLevel(level);
        return !!(this._isEffectiveFollowing() && this._hasCoinForLevel(lvl));
    },

    _normalizeLevel(level = null) {
        let lvl = level;
        if (!lvl) {
            if ((typeof isDailyListeningActive === 'function' && isDailyListeningActive()) || window._isDailyListening || window.activeView === 'daily-lobby') {
                return 'daily';
            }
            const modalEl = document.getElementById('membership-unlock-modal');
            if (modalEl && modalEl.classList.contains('active') && this.currentTargetType === 'daily') {
                return 'daily';
            }
            lvl = window.currentExamLevel;
        }
        if (!lvl && window.currentDictExamTitle) {
            const t = window.currentDictExamTitle;
            if (t.includes('雅思') || t.toLowerCase().includes('ielts')) return 'ielts';
            if (t.includes('六级')) return 'cet6';
            if (t.includes('高考')) return 'gaokao';
            if (t.includes('每日英语听力')) return 'daily';
            if (t.includes('四级')) return 'cet4';
        }
        if (!lvl && window.currentWrittenExamTitle) {
            const t = window.currentWrittenExamTitle;
            if (t.includes('考研') || t.toLowerCase().includes('kaoyan')) return 'kaoyan';
            if (t.includes('六级')) return 'cet6';
            if (t.includes('高考')) return 'gaokao';
            if (t.includes('四级')) return 'cet4';
        }
        if (!lvl && window.currentExamTitle) {
            const t = window.currentExamTitle;
            if (t.includes('考研') || t.toLowerCase().includes('kaoyan')) return 'kaoyan';
            if (t.includes('六级')) return 'cet6';
            if (t.includes('高考')) return 'gaokao';
            if (t.includes('四级')) return 'cet4';
        }
        const str = String(lvl || 'cet4').toLowerCase().trim();
        if (str.includes('kaoyan') || str.includes('考研')) return 'kaoyan';
        if (str.includes('ielts') || str.includes('雅思')) return 'ielts';
        if (str.includes('cet6') || str.includes('六级')) return 'cet6';
        if (str.includes('gaokao') || str.includes('高考')) return 'gaokao';
        if (str.includes('daily') || str.includes('每日')) return 'daily';
        return 'cet4';
    },

    getTier(level = null) {
        if (this.isAuthor || this.isCharged) return 3; // 充电专享：包月充电
        const lvl = this._normalizeLevel(level);
        if (this.hasUnlockedTrack(lvl)) return 2; // 投币对应视频 + 关注 UP 主
        return 1; // 普通学员：原 Tier 0 与 Tier 1 合并，零门槛免费畅学
    },

    canAccessListening(examIndex = 0, questionIndex = 0, level = null) {
        // 听力刷题全板块 100% 全开放：所有普通学员（原 Tier 0/1 合并）皆可无限制免费畅刷所有年份真题全卷
        return true;
    },

    canAccessDaily(dayIndex = 0, sentenceIndex = 0) {
        if (this.isAuthor || this.isCharged) return true;
        if (this.hasUnlockedTrack('daily')) {
            // 合并 Tier 1+2: 投币关注解锁 Day 01 完整篇章全部句子
            return (typeof dayIndex !== 'number' || dayIndex <= 0);
        }
        // 0. 零门槛 (新用户): 仅免费体验 Day 01 前 2 句 (sentenceIndex 0, 1)
        return ((typeof dayIndex !== 'number' || dayIndex <= 0) && (typeof sentenceIndex !== 'number' || sentenceIndex <= 1));
    },

    canAccessDictation(examIndex = 0, sentenceIndex = 0, level = null, examTitle = null) {
        const isDaily = (level === 'daily') || (typeof isDailyListeningActive === 'function' && isDailyListeningActive()) || (window._isDailyListening) || (window.currentDictExamTitle && window.currentDictExamTitle.includes('每日英语听力'));
        if (isDaily) {
            const dayIdx = (typeof window._currentDailyDay === 'number' && window._currentDailyDay > 0)
                ? (window._currentDailyDay - 1)
                : (typeof examIndex === 'number' ? examIndex : 0);
            return this.canAccessDaily(dayIdx, sentenceIndex);
        }
        if (this.isAuthor || this.isCharged) return true;
        const lvl = this._normalizeLevel(level);
        if (this.hasUnlockedTrack(lvl)) {
            // 第 2 套及之后试卷: 需包月充电解锁
            if (typeof examIndex === 'number' && examIndex > 0) {
                return false;
            }
            // 第 1 套试卷: 合并 Tier 1+2 投币关注即可解锁第 1 套完整第一章节（Part 1）的全部句子
            // Part 2/3/4 需包月充电解锁
            if (typeof sentenceIndex !== 'number') return true;
            return sentenceIndex <= this._getPart1EndIndex(lvl, examTitle);
        }
        // 0. 零门槛 (新用户): 仅免费体验第 1 套前 2 句 (sentenceIndex 0, 1)
        return ((typeof examIndex !== 'number' || examIndex <= 0) && (typeof sentenceIndex !== 'number' || sentenceIndex <= 1));
    },

    _getPart1EndIndex(level = null, examTitle = null) {
        const title = examTitle || window.currentDictExamTitle;
        const sents = (window.CLOZE_EXAMS_MAP && title && window.CLOZE_EXAMS_MAP[title])
            ? window.CLOZE_EXAMS_MAP[title]
            : (window.currentDictSentences || []);
        const normalizeSecKey = (s) => {
            const str = String(s || '').trim();
            if (!str) return '';
            if (/^(?:part|section)\s*\d+/i.test(str)) {
                return str.toLowerCase().replace(/\s+/g, ' ');
            }
            return str.replace(/[\s\d_#\-（）()]+$/g, '').trim().toLowerCase() || str.toLowerCase();
        };
        if (sents && sents.length > 0) {
            const firstSec = (sents[0].group || sents[0].sec || '').trim();
            const firstCatKey = normalizeSecKey(firstSec);
            for (let i = 0; i < sents.length; i++) {
                const curSec = (sents[i].group || sents[i].sec || '').trim();
                const curCatKey = normalizeSecKey(curSec);
                if (curCatKey && firstCatKey && curCatKey !== firstCatKey) {
                    return i - 1;
                }
            }
            return sents.length - 1;
        }
        const lvl = this._normalizeLevel(level || window.currentExamLevel);
        if (lvl === 'cet6') return 34;
        if (lvl === 'gaokao') return 13;
        if (lvl === 'ielts') return 20;
        return 27;
    },

    canAccessWrittenExam(examIndex = 0, questionIndex = 0, level = null) {
        if (this.isAuthor || this.isCharged) return true;
        const lvl = this._normalizeLevel(level);
        if (this.hasUnlockedTrack(lvl)) {
            // 第 1 套试卷: 合并 Tier 1+2 投币关注解锁全套真题 (所有大题小题)
            // 第 2 套及之后试卷: 需包月充电解锁
            return (typeof examIndex !== 'number' || examIndex <= 0);
        }
        // 0. 零门槛 (新用户): 仅免费试做第 1 套前 2 小题 (Q26, Q27 / 高考 Q21, Q22)
        return ((typeof examIndex !== 'number' || examIndex <= 0) && (typeof questionIndex !== 'number' || questionIndex <= 1));
    },

    canUseLookupMode() {
        return !!(this.isAuthor || this.isCharged);
    },

    canUseBilingualMode() {
        return !!(this.isAuthor || this.isCharged);
    },

    canUsePracticeMode() {
        return !!(this.isAuthor || this.isCharged || this._isEffectiveFollowing());
    },

    shouldAwaitInitialSync() {
        if (this._hasCompletedInitialSync) return false;
        if (window.toy) return true;
        try {
            return /bili/i.test((navigator && navigator.userAgent) || '');
        } catch (e) {
            return false;
        }
    },

    async ensureSynced(maxWaitMs = 1200) {
        const deadline = Date.now() + maxWaitMs;
        // If the async toy-sdk.js has not arrived yet, briefly wait for it (bounded) before syncing
        while (!window.toy && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 80));
        }
        if (!window.toy) return;
        if (!this._hasCompletedInitialSync && (!this.syncPromise || !this._isSyncing)) {
            this.syncSdkStatus(false);
        }
        const remaining = Math.max(0, deadline - Date.now());
        if (this.syncPromise && remaining > 0) {
            try {
                await Promise.race([
                    this.syncPromise,
                    new Promise(r => setTimeout(r, remaining))
                ]);
            } catch(e) {}
        }
    },

    triggerStaggeredSync() {
        this.syncSdkStatus(false);
        if (this._staggerTimer1) clearTimeout(this._staggerTimer1);
        this._staggerTimer1 = setTimeout(async () => {
            if (this.getTier() < 3) {
                await this.syncSdkStatus(false);
            }
        }, 1800);
        if (this._staggerTimer2) clearTimeout(this._staggerTimer2);
        this._staggerTimer2 = setTimeout(async () => {
            if (this.getTier() < 3) {
                await this.syncSdkStatus(false);
            }
        }, 4500);
    },

    syncSdkStatus(showToast = false) {
        const now = Date.now();
        if (this._isSyncing && this.syncPromise && !showToast && (now - (this._syncStartAt || 0) < 6000)) {
            return this.syncPromise;
        }
        this._isSyncing = true;
        this._syncStartAt = now;
        const hadSdkAtStart = !!window.toy;
        const syncTask = Promise.race([
            this._doSyncSdkStatus(showToast),
            new Promise((resolve) => {
                const t = setTimeout(resolve, 7500);
                if (t && typeof t.unref === 'function') t.unref();
            })
        ]);
        this.syncPromise = syncTask.finally(() => {
            this._isSyncing = false;
            // Only an SDK-backed sync counts as authoritative (a pre-SDK local pass must not skip later gating)
            if (hadSdkAtStart) this._hasCompletedInitialSync = true;
        });
        return this.syncPromise;
    },

    async _doSyncSdkStatus(showToast = false) {
        if (window.ENABLE_TEST_IDENTITY_SWITCHER && this.isTestOverridden) {
            this.updateUI({ forceLobbyRerender: false });
            return;
        }

        const currentUname = ((window.currentUserProfile && window.currentUserProfile.nickname) || '').trim();
        if (this.authorName && currentUname !== '同学' && currentUname !== 'B站学员' && currentUname === this.authorName) {
            this.isAuthor = true;
        }

        if (!window.toy) {
            this.updateUI({ forceLobbyRerender: false });
            if (showToast) {
                const tier = this.getTier();
                showToyToast(tier === 3 ? '👑 [本地环境] 识别为充电专享！' : (tier === 2 ? '🎉 [本地环境] 识别为投币+关注！' : (tier === 1 ? '🔗 [本地环境] 识别为转发+关注！' : '🔒 [本地环境] 识别为新用户！')));
                this.closeUnlockModal();
            }
            return;
        }

        try {
            const prevCoinState = {
                c4: this.hasCoinCet4,
                c6: this.hasCoinCet6,
                cg: this.hasCoinGaokao,
                cd: this.hasCoinDaily,
                ci: this.hasCoinIelts,
                ck: this.hasCoinKaoyan,
                fl: this.isFollowing
            };

            // 1. Check Author Relation (Following, Charging, Fan Medal)
            if (typeof window.toy.getAuthorRelation === 'function') {
                try {
                    const relRes = await this._sdkCall(() => window.toy.getAuthorRelation(), 3200);
                    if (relRes) {
                        if (relRes.status === 'unsupported') {
                            this.isUnsupportedEnv = true;
                        } else {
                            const extractedFollow = this._extractFollowingState(relRes);
                            if (extractedFollow) {
                                this.isFollowing = true;
                            } else if (this._isValidRelationPayload(relRes)) {
                                this.isFollowing = false;
                            }
                            const extractedCharge = this._extractChargedState(relRes);
                            if (extractedCharge) {
                                this.isCharged = true;
                            } else if (this._isValidRelationPayload(relRes)) {
                                this.isCharged = false;
                            }
                            this.hasFanMedal = this._extractFanMedalState(relRes) || this.hasFanMedal;
                        }
                    }
                } catch(e) {
                    console.log('[ToySDK] getAuthorRelation error:', e);
                    // If user is explicitly not logged in, they cannot have active sponsor perks
                    if (e && (e.type === 'not_logged_in' || e.code === -101)) {
                        this.isCharged = false;
                        this.isFollowing = false;
                    }
                }
            }

            // 2. Check Author Profile for author mid and author name
            if (typeof window.toy.getAuthorProfile === 'function') {
                try {
                    const profRes = await this._sdkCall(() => window.toy.getAuthorProfile(), 2500);
                    if (profRes && profRes.status === 'ok' && profRes.data) {
                        this.authorMid = profRes.data.mid || this.authorMid;
                        this.authorName = profRes.data.nickname || profRes.data.name || this.authorName;
                    } else if (profRes && (profRes.mid || profRes.nickname || profRes.name)) {
                        this.authorMid = profRes.mid || this.authorMid;
                        this.authorName = profRes.nickname || profRes.name || this.authorName;
                    }
                } catch(e) {}
            }

            // 2.1 Verify if current authenticated user is the UP author
            const latestUname = ((window.currentUserProfile && window.currentUserProfile.nickname) || '').trim();
            if (this.authorName && latestUname !== '同学' && latestUname !== 'B站学员' && latestUname === this.authorName) {
                this.isAuthor = true;
            }

            // 3. Resolve video aids and query coin actions
            const aidsToQuery = [];
            const cet4Aid = Number(this.videos.cet4.aid);
            const cet6Aid = Number(this.videos.cet6.aid);
            const gaokaoAid = Number(this.videos.gaokao?.aid);
            const dailyAid = Number(this.videos.daily.aid);
            const ieltsAid = Number(this.videos.ielts?.aid);
            const kaoyanAid = Number(this.videos.kaoyan?.aid);
            if (cet4Aid) aidsToQuery.push(cet4Aid);
            if (cet6Aid && !aidsToQuery.includes(cet6Aid)) aidsToQuery.push(cet6Aid);
            if (gaokaoAid && !aidsToQuery.includes(gaokaoAid)) aidsToQuery.push(gaokaoAid);
            if (dailyAid && !aidsToQuery.includes(dailyAid)) aidsToQuery.push(dailyAid);
            if (ieltsAid && !aidsToQuery.includes(ieltsAid)) aidsToQuery.push(ieltsAid);
            if (kaoyanAid && !aidsToQuery.includes(kaoyanAid)) aidsToQuery.push(kaoyanAid);

            const extractItemsFromActRes = (res) => {
                if (!res) return [];
                if (Array.isArray(res.items)) return res.items;
                if (res.data && Array.isArray(res.data.items)) return res.data.items;
                if (res.data && res.data.data && Array.isArray(res.data.data.items)) return res.data.data.items;
                if (Array.isArray(res.data)) return res.data;
                if (Array.isArray(res)) return res;
                return [];
            };

            if (typeof window.toy.getVideoUserActions === 'function' && aidsToQuery.length > 0) {
                let items = [];
                try {
                    const actRes = await this._sdkCall(() => window.toy.getVideoUserActions({ aids: aidsToQuery }), 3200);
                    items = extractItemsFromActRes(actRes);
                } catch(e) {
                    console.log('[ToySDK] getVideoUserActions(aids) error:', e);
                }

                // Fallback to querying by bvid if aids returned empty
                if (!items || items.length === 0) {
                    try {
                        const videosToQuery = [
                            { bvid: this.videos.cet4.bvid },
                            { bvid: this.videos.cet6.bvid },
                            { bvid: this.videos.gaokao?.bvid },
                            { bvid: this.videos.daily.bvid },
                            { bvid: this.videos.ielts?.bvid },
                            { bvid: this.videos.kaoyan?.bvid }
                        ].filter(v => v && v.bvid);
                        const actResBvid = await this._sdkCall(() => window.toy.getVideoUserActions({ videos: videosToQuery }), 3200);
                        items = extractItemsFromActRes(actResBvid);
                    } catch(e2) {}
                }

                items.forEach((item, index) => {
                    if (!item) return;
                    const target = (item.data && typeof item.data === 'object') ? item.data : item;
                    const itemAid = Number(target.aid || item.aid || item.ref?.aid) || aidsToQuery[index];
                    const itemBvid = String(target.bvid || item.bvid || item.ref?.bvid || '').trim();
                    const rawCoins = Number(target.coinCount ?? target.coin ?? target.coins ?? target.multiply ?? item.coinCount ?? item.coin ?? 0);
                    const hasCoinedBool = !!(target.coined || target.hasCoin || target.has_coin || item.coined || item.hasCoin);
                    const coins = rawCoins > 0 ? rawCoins : (hasCoinedBool ? 1 : 0);

                    // B站视频投币是不可撤回的永久操作：一旦投币成功 (coins >= 1)，绝不因为后续单次网关异常覆盖回 false
                    if (itemAid === cet4Aid || itemBvid === this.videos.cet4.bvid) {
                        this.coinCountCet4 = Math.max(this.coinCountCet4 || 0, coins);
                        this.hasCoinCet4 = this.hasCoinCet4 || (coins >= 1);
                    }
                    if (itemAid === cet6Aid || itemBvid === this.videos.cet6.bvid) {
                        this.coinCountCet6 = Math.max(this.coinCountCet6 || 0, coins);
                        this.hasCoinCet6 = this.hasCoinCet6 || (coins >= 1);
                    }
                    if (itemAid === gaokaoAid || itemBvid === this.videos.gaokao?.bvid) {
                        this.coinCountGaokao = Math.max(this.coinCountGaokao || 0, coins);
                        this.hasCoinGaokao = this.hasCoinGaokao || (coins >= 1);
                    }
                    if (itemAid === dailyAid || itemBvid === this.videos.daily.bvid) {
                        this.coinCountDaily = Math.max(this.coinCountDaily || 0, coins);
                        this.hasCoinDaily = this.hasCoinDaily || (coins >= 1);
                    }
                    if (itemAid === ieltsAid || itemBvid === this.videos.ielts?.bvid) {
                        this.coinCountIelts = Math.max(this.coinCountIelts || 0, coins);
                        this.hasCoinIelts = this.hasCoinIelts || (coins >= 1);
                    }
                    if (itemAid === kaoyanAid || itemBvid === this.videos.kaoyan?.bvid) {
                        this.coinCountKaoyan = Math.max(this.coinCountKaoyan || 0, coins);
                        this.hasCoinKaoyan = this.hasCoinKaoyan || (coins >= 1);
                    }
                });
            }

            this._saveCachedPermissions();

            // Persist newly unlocked coin/follow states to Cloud Storage & Server
            if ((!prevCoinState.c4 && this.hasCoinCet4) ||
                (!prevCoinState.c6 && this.hasCoinCet6) ||
                (!prevCoinState.cg && this.hasCoinGaokao) ||
                (!prevCoinState.cd && this.hasCoinDaily) ||
                (!prevCoinState.ci && this.hasCoinIelts) ||
                (!prevCoinState.ck && this.hasCoinKaoyan) ||
                (!prevCoinState.fl && this.isFollowing)) {
                if (typeof saveUserCloudData === 'function') {
                    saveUserCloudData().catch(() => {});
                }
            }

            const prevState = this._lastKnownGlobalState;
            const stateChanged = !prevState ||
                prevState.isCharged !== this.isCharged ||
                prevState.hasShared !== this.hasShared ||
                prevState.hasCoinCet4 !== this.hasCoinCet4 ||
                prevState.hasCoinCet6 !== this.hasCoinCet6 ||
                prevState.hasCoinGaokao !== this.hasCoinGaokao ||
                prevState.hasCoinDaily !== this.hasCoinDaily ||
                prevState.hasCoinIelts !== this.hasCoinIelts ||
                prevState.hasCoinKaoyan !== this.hasCoinKaoyan ||
                prevState.isAuthor !== this.isAuthor ||
                prevState.isFollowing !== this.isFollowing ||
                prevState.hasFanMedal !== this.hasFanMedal;

            this._lastKnownGlobalState = {
                isCharged: this.isCharged,
                hasShared: this.hasShared,
                hasCoinCet4: this.hasCoinCet4,
                hasCoinCet6: this.hasCoinCet6,
                hasCoinGaokao: this.hasCoinGaokao,
                hasCoinDaily: this.hasCoinDaily,
                hasCoinIelts: this.hasCoinIelts,
                hasCoinKaoyan: this.hasCoinKaoyan,
                isAuthor: this.isAuthor,
                isFollowing: this.isFollowing,
                hasFanMedal: this.hasFanMedal
            };

            this.updateUI({ forceLobbyRerender: stateChanged });
            const modal = document.getElementById('membership-unlock-modal');
            const isModalVisible = modal && modal.classList.contains('active');

            if (isModalVisible && this._isCurrentTargetUnlocked()) {
                this.closeUnlockModal();
                this.updateUI({ forceLobbyRerender: true });
                if (typeof launchGrandConfettiShow === 'function') {
                    launchGrandConfettiShow();
                }
            }
        } catch (e) {
            console.log('[ToySDK] syncSdkStatus error:', e);
            this.updateUI({ forceLobbyRerender: false });
        }
    },

    _isValidRelationPayload(res) {
        if (!res || typeof res !== 'object') return false;
        if (res.status === 'error' || res.status === 'fail' || res.status === 'unavailable' || res.status === 'unsupported') {
            return false;
        }
        if (typeof res.code === 'number' && res.code !== 0) {
            return false;
        }
        if (res.status === 'ok') return true;

        let target = res;
        if (target.data && typeof target.data === 'object') {
            target = target.data;
            if (target.data && typeof target.data === 'object') {
                target = target.data;
            }
        }
        const knownKeys = [
            'isFollowing', 'is_following', 'following', 'followed', 'hasFanMedal', 'has_fan_medal',
            'isCharging', 'is_charging', 'isMonthlyCharging', 'is_monthly_charging',
            'isMonthlyCharged', 'is_monthly_charged', 'isCharged', 'is_charged',
            'hasCharging', 'has_charging', 'hasMonthlyCharge', 'has_monthly_charge',
            'isUpower', 'is_upower', 'hasUpower', 'has_upower', 'isSponsor', 'is_sponsor',
            'charging', 'charge', 'upower', 'elec', 'sponsor', 'relation'
        ];
        return knownKeys.some(k => Object.prototype.hasOwnProperty.call(target, k));
    },

    _extractChargedState(res) {
        if (!res) return false;
        if (res.status === 'unsupported') {
            this.isUnsupportedEnv = true;
            return false;
        }

        // Deep unnesting: support res?.data?.data (double wrapped gateway) || res?.data || res
        let target = res;
        if (target.data && typeof target.data === 'object') {
            target = target.data;
            if (target.data && typeof target.data === 'object') {
                target = target.data;
            }
        }

        // 1. Strict monthly charging / UPOWER / active sponsor fields
        // DO NOT use historical single-charge / battery fields like hasCharged / has_charged / charged!
        const monthlyChargingFields = [
            target.isCharging, target.is_charging,
            target.hasCharging, target.has_charging,
            target.isMonthlyCharging, target.is_monthly_charging,
            target.monthlyCharging, target.monthly_charging,
            target.isMonthlyCharged, target.is_monthly_charged,
            target.monthlyCharged, target.monthly_charged,
            target.hasMonthlyCharge, target.has_monthly_charge,
            target.isCharged, target.is_charged,
            target.isUpower, target.is_upower,
            target.hasUpower, target.has_upower,
            target.isUpowerMember, target.is_upower_member,
            target.isSponsor, target.is_sponsor,
            target.isMonthlySponsor, target.is_monthly_sponsor,
            target.isElec, target.is_elec,
            target.isMonthlyElec, target.is_monthly_elec
        ];

        for (const val of monthlyChargingFields) {
            if (val === true || val === 1 || val === '1' || val === 'true') {
                return true;
            }
        }

        // 2. Charging / UPOWER status code (status === 1 indicates active sponsor)
        const statusCandidates = [
            target.chargingStatus, target.charging_status,
            target.upowerState, target.upower_state,
            target.elecStatus, target.elec_status
        ];
        for (const st of statusCandidates) {
            if (st === 1 || st === '1' || st === 'true' || st === 'active') {
                return true;
            }
        }

        // 3. Object-wrapped charging / charge / upower / elec / sponsor objects
        const subObjects = [target.charging, target.charge, target.upower, target.elec, target.sponsor];
        for (const sub of subObjects) {
            if (typeof sub === 'object' && sub !== null) {
                if (sub.is_charging === true || sub.isCharging === true ||
                    sub.is_monthly === true || sub.isMonthly === true ||
                    sub.is_upower === true || sub.isUpower === true ||
                    sub.status === 1 || sub.status === true || sub.status === '1' || sub.status === 'active' ||
                    sub.state === 1 || sub.state === '1' ||
                    sub.active === true || sub.is_active === true || sub.isActive === true) {
                    return true;
                }
            }
        }

        // 4. Object-wrapped relation object
        if (typeof target.relation === 'object' && target.relation !== null) {
            const rel = target.relation;
            if (rel.isCharging === true || rel.is_charging === true ||
                rel.hasCharging === true || rel.has_charging === true ||
                rel.isMonthlyCharging === true || rel.is_monthly_charging === true ||
                rel.isMonthlyCharged === true || rel.is_monthly_charged === true ||
                rel.hasMonthlyCharge === true || rel.has_monthly_charge === true ||
                rel.isCharged === true || rel.is_charged === true ||
                rel.isUpower === true || rel.is_upower === true ||
                rel.hasUpower === true || rel.has_upower === true ||
                rel.isSponsor === true || rel.is_sponsor === true ||
                rel.charging_status === 1 || rel.chargingStatus === 1) {
                return true;
            }
        }

        return false;
    },

    _extractFollowingState(res) {
        if (!res) return false;
        if (res.status === 'unsupported') return false;

        let target = res;
        if (target.data && typeof target.data === 'object') {
            target = target.data;
            if (target.data && typeof target.data === 'object') {
                target = target.data;
            }
        }

        const candidates = [
            target.isFollowing, target.is_following,
            target.following, target.followed,
            target.isFollowed, target.is_followed,
            target.hasFollowed, target.has_followed
        ];
        for (const val of candidates) {
            if (val === true || val === 1 || val === '1' || val === 'true') {
                return true;
            }
        }
        if (typeof target.relation === 'object' && target.relation !== null) {
            const rel = target.relation;
            if (rel.isFollowing || rel.is_following || rel.following) return true;
        }
        return false;
    },

    _extractFanMedalState(res) {
        if (!res) return false;
        if (res.status === 'unsupported') return false;

        let target = res;
        if (target.data && typeof target.data === 'object') {
            target = target.data;
            if (target.data && typeof target.data === 'object') {
                target = target.data;
            }
        }

        const candidates = [
            target.hasFanMedal, target.has_fan_medal,
            target.fanMedal, target.fan_medal, target.medal
        ];
        for (const val of candidates) {
            if (val === true || val === 1 || val === '1' || val === 'true') {
                return true;
            }
        }
        return false;
    },

    updateUI(options = {}) {
        const forceLobbyRerender = options && options.forceLobbyRerender === true;
        const tier = this.getTier();
        const badgeEl = document.getElementById('user-tier-badge');
        if (badgeEl) {
            let tierClass = 'tier-guest';
            let tierText = '普通学员';
            if (tier === 3) {
                tierClass = 'tier-svip';
                tierText = '充电专享';
            } else if (tier === 2) {
                tierClass = 'tier-vip';
                tierText = '投币解锁';
            } else if (tier === 1) {
                tierClass = 'tier-guest';
                tierText = '普通学员';
            }
            badgeEl.className = `user-tier-watermark ${tierClass}`;
            badgeEl.textContent = tierText;
        }

        // 实时强制同步充电专享特权开关（双语对照 / 划词查词），防止降级或未授权状态下残留开启状态
        if (!this.canUseBilingualMode()) {
            window.showBilingual = false;
            window.showDictBilingual = false;
            window.showWrittenBilingual = false;
            const transCard = document.getElementById('written-translation-card');
            if (transCard) transCard.style.display = 'none';
            const dictZhBox = document.getElementById('dict-zh-box');
            if (dictZhBox && !window.dictAnswerModeActive) dictZhBox.style.display = 'none';
        }
        if (!this.canUseLookupMode() && window.isLookupMode) {
            if (typeof window.applyLookupMode === 'function') {
                window.applyLookupMode(false);
            } else {
                window.isLookupMode = false;
                document.body.classList.remove('lookup-mode-active');
            }
        }

        // 实时同步【随刷随解】模式权限：仅已关注 UP 主（或充电/作者本人）可使用随刷随解，未关注游客强制为【全真模考】
        const prevExamMode = !!window.isExamMode;
        if (!this.canUsePracticeMode()) {
            window.isExamMode = true;
            if (typeof window.syncWrittenModeRevealedState === 'function') {
                window.syncWrittenModeRevealedState(true);
            }
        } else if (!window._userExplicitExamMode && window.isExamMode) {
            window.isExamMode = false;
            if (typeof window.syncWrittenModeRevealedState === 'function') {
                window.syncWrittenModeRevealedState(false);
            }
        }
        const tabPractice = document.getElementById('tab-mode-practice');
        const tabExam = document.getElementById('tab-mode-exam');
        if (tabPractice && tabExam) {
            tabPractice.classList.toggle('active', !window.isExamMode);
            tabExam.classList.toggle('active', !!window.isExamMode);
        }
        if (prevExamMode !== !!window.isExamMode && !forceLobbyRerender) {
            if (window.activeView === 'quiz' && typeof renderQuestion === 'function' && typeof currentQIndex === 'number') {
                renderQuestion(currentQIndex, { preserveAudio: true, preserveScroll: true });
            } else if (window.activeView === 'written-arena' && typeof renderWrittenQuestion === 'function' && typeof currentWrittenQIndex === 'number') {
                const passageCard = document.getElementById('written-passage-card');
                if (passageCard) passageCard._renderedPassageKey = '';
                renderWrittenQuestion(currentWrittenQIndex, { preserveScroll: true });
            }
        }

        updateUserAvatarDOM();
        this.refreshModalDOM();

        // 仅在显式请求或权限状态发生实质性变化时才重新渲染试题大厅
        // 彻底杜绝无操作状态下因后台心跳轮询导致试题大厅 DOM 被周期性清空重建、年份筛选被重置回 ALL、页面突发闪烁与滚动位置丢失
        if (forceLobbyRerender) {
            if (typeof window.reRenderActiveLobbies === 'function') {
                window.reRenderActiveLobbies();
            }
        }
    },

    _completeShareAction() {
        if (this.hasShared) return;
        this.hasShared = true;
        try {
            const uKey = getCurrentUserKey();
            const sharedSig = (window.ToySecurity && typeof window.ToySecurity.computeSig === 'function')
                ? window.ToySecurity.computeSig(uKey, 'SHARED_OK')
                : 'true';
            window.__toyLS.setItem(getUserStorageKey('has_shared_app'), sharedSig);
            this._saveCachedPermissions();
        } catch(e) {}

        this.updateUI({ forceLobbyRerender: true });
        if (typeof saveUserCloudData === 'function') {
            saveUserCloudData();
        }
        if (typeof showToyToast === 'function') {
            showToyToast(this.isFollowing ? '🎉 转发与关注已完成！第一套 Part 1 已解锁！' : '🔗 转发成功！请同时关注 UP 主即可解锁 Part 1！');
        }
        if (this.canAccessDictation(0, 2)) {
            this.closeUnlockModal();
        } else {
            this.refreshModalDOM();
        }
    },

    async triggerShareApp() {
        if (this.hasShared) {
            if (typeof showToyToast === 'function') showToyToast('✅ 您已完成转发分享');
            return;
        }

        const isPreviewEnv = window.location.pathname.includes('/preview/') || !window.location.pathname.includes('/toy/');
        const btnShare = document.getElementById('btn-share-action');
        const originalBtnText = btnShare ? btnShare.innerHTML : '';
        if (btnShare) {
            btnShare.innerHTML = '⏳ 正在调起分享...';
            btnShare.style.opacity = '0.7';
            btnShare.style.pointerEvents = 'none';
        }

        const resetButton = () => {
            if (btnShare && !this.hasShared) {
                btnShare.innerHTML = originalBtnText;
                btnShare.style.opacity = '1';
                btnShare.style.pointerEvents = 'auto';
            }
        };

        if (window.toy && typeof window.toy.share === 'function') {
            const shareStartTime = Date.now();
            let didLeavePage = false;

            const onVisibilityChange = () => {
                if (document.hidden) {
                    didLeavePage = true;
                } else if (didLeavePage) {
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                    window.removeEventListener('focus', onFocusReturn);
                    this._completeShareAction();
                }
            };

            const onFocusReturn = () => {
                if (didLeavePage) {
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                    window.removeEventListener('focus', onFocusReturn);
                    this._completeShareAction();
                }
            };

            document.addEventListener('visibilitychange', onVisibilityChange);
            window.addEventListener('focus', onFocusReturn);

            setTimeout(() => {
                document.removeEventListener('visibilitychange', onVisibilityChange);
                window.removeEventListener('focus', onFocusReturn);
                resetButton();
            }, 20000);

            try {
                await window.toy.share({ path: 'index.html' });
                const elapsed = (Date.now() - shareStartTime) / 1000;
                if (elapsed >= 1.8 || didLeavePage) {
                    this._completeShareAction();
                } else {
                    setTimeout(() => {
                        if (!this.hasShared) {
                            resetButton();
                            if (typeof showToyToast === 'function') {
                                showToyToast('💡 请选择好友并发送分享后再返回哦～');
                            }
                        }
                    }, 500);
                }
                return;
            } catch(e) {
                if (isPreviewEnv || (e && (e.type === 'unsupported' || (e.message && e.message.includes('unsupported'))))) {
                    const shareUrl = window.location.href;
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(shareUrl).catch(() => {});
                    }
                    resetButton();
                    if (typeof showToyConfirm === 'function') {
                        showToyConfirm(
                            '🔗 分享链接已复制',
                            '请将已复制的链接发送给微信/QQ好友或群聊，发送完毕后点击下方“我已分享”。',
                            () => {
                                this._completeShareAction();
                            },
                            '我已分享',
                            '稍后分享'
                        );
                    } else {
                        this._completeShareAction();
                    }
                    return;
                }

                resetButton();
                if (typeof showToyToast === 'function') {
                    showToyToast('⚠️ 未完成分享，请发送给好友后再试哦～');
                }
                return;
            }
        }

        const shareUrl = window.location.href;
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareUrl).catch(() => {});
        }
        resetButton();
        if (typeof showToyConfirm === 'function') {
            showToyConfirm(
                '🔗 分享链接已复制',
                '请将已复制的链接发送给微信/QQ好友或群聊，发送完毕后点击下方“我已分享”。',
                () => {
                    this._completeShareAction();
                },
                '我已分享',
                '稍后分享'
            );
        } else {
            this._completeShareAction();
        }
    },

    _markCoinUnlockedForLevel(lvl) {
        if (lvl === 'daily') {
            this.hasCoinDaily = true;
            this.coinCountDaily = Math.max(this.coinCountDaily || 0, 1);
        } else if (lvl === 'cet6') {
            this.hasCoinCet6 = true;
            this.coinCountCet6 = Math.max(this.coinCountCet6 || 0, 1);
        } else if (lvl === 'gaokao') {
            this.hasCoinGaokao = true;
            this.coinCountGaokao = Math.max(this.coinCountGaokao || 0, 1);
        } else if (lvl === 'ielts') {
            this.hasCoinIelts = true;
            this.coinCountIelts = Math.max(this.coinCountIelts || 0, 1);
        } else if (lvl === 'kaoyan') {
            this.hasCoinKaoyan = true;
            this.coinCountKaoyan = Math.max(this.coinCountKaoyan || 0, 1);
        } else {
            this.hasCoinCet4 = true;
            this.coinCountCet4 = Math.max(this.coinCountCet4 || 0, 1);
        }
    },

    _hasCoinForLevel(lvl) {
        if (this._sessionCoinLevels && this._sessionCoinLevels.has(lvl)) return true;
        if (lvl === 'kaoyan' && this._sessionCoinLevels && this._sessionCoinLevels.has('cet4')) return true;
        if (lvl === 'daily') return !!this.hasCoinDaily;
        if (lvl === 'cet6') return !!this.hasCoinCet6;
        if (lvl === 'gaokao') return !!this.hasCoinGaokao;
        if (lvl === 'ielts') return !!this.hasCoinIelts;
        if (lvl === 'kaoyan') return !!(this.hasCoinKaoyan || this.hasCoinCet4);
        return !!this.hasCoinCet4;
    },

    _isCurrentTargetChargeOnly() {
        const currentLevel = this._normalizeLevel(this.unlockExtra?.level || window.currentExamLevel);
        const isLookup = (this.currentTargetType === 'lookup');
        const isBilingual = (this.currentTargetType === 'bilingual');
        const examIdx = (typeof this.unlockExtra?.examIndex === 'number') ? this.unlockExtra.examIndex : 0;
        const sentIdx = (typeof this.unlockExtra?.sentenceIndex === 'number') ? this.unlockExtra.sentenceIndex : 0;
        const dayNum = (typeof this.unlockExtra?.dayNum === 'number') ? this.unlockExtra.dayNum : (examIdx + 1);

        const isWrittenLater = (this.currentTargetType === 'written' && examIdx > 0);
        const isDictationLater = (this.currentTargetType === 'dictation' && (examIdx > 0 || sentIdx > this._getPart1EndIndex(currentLevel, this.unlockExtra?.examTitle)));
        const isDailyLater = (this.currentTargetType === 'daily' && (dayNum > 1 || examIdx > 0));

        return !!(isLookup || isBilingual || isWrittenLater || isDictationLater || isDailyLater);
    },

    _isCurrentTargetUnlocked() {
        if (this.isCharged || this.isAuthor) return true;
        if (this.currentTargetType === 'practice_mode') return this.canUsePracticeMode();
        if (this._isCurrentTargetChargeOnly()) return false;
        const currentLevel = this._normalizeLevel(this.unlockExtra?.level || window.currentExamLevel);
        return this.hasUnlockedTrack(currentLevel);
    },

    goToFollow() {
        const curLvl = this._normalizeLevel(this.unlockExtra?.level || window.currentExamLevel);
        if (this._isEffectiveFollowing()) {
            if (this.currentTargetType === 'practice_mode') {
                this.closeUnlockModal();
                window._userExplicitExamMode = false;
                if (typeof window.setExamMode === 'function') window.setExamMode(false);
                this.updateUI({ forceLobbyRerender: true });
                if (typeof showToyToast === 'function') showToyToast('🎉 已关注 UP 主，【练习】模式已为您开启！');
                return;
            }
            if (this.hasUnlockedTrack(curLvl)) {
                this.closeUnlockModal();
                this.updateUI({ forceLobbyRerender: true });
                if (typeof showToyToast === 'function') showToyToast('🎉 关注与投币均已验证通过，已为您解锁！');
                return;
            }
            if (typeof showToyToast === 'function') {
                showToyToast('✅ 您已关注 UP 主！请点击下方【2. 投币视频】即可解锁～');
            }
            return;
        }

        const navStartTime = Date.now();
        let didLeavePage = false;
        let handledReturn = false;

        const applyFollowUnlockedUI = () => {
            if (!this._isEffectiveFollowing()) return;
            if (this.currentTargetType === 'practice_mode') {
                window._userExplicitExamMode = false;
                if (typeof window.setExamMode === 'function') window.setExamMode(false);
            }
            this.updateUI({ forceLobbyRerender: true });
            if (this._isCurrentTargetUnlocked()) {
                this.closeUnlockModal();
                if (typeof launchGrandConfettiShow === 'function') launchGrandConfettiShow();
            }
        };

        const onReturn = async () => {
            if (handledReturn) return;
            const elapsed = (Date.now() - navStartTime) / 1000;
            if (!didLeavePage && elapsed < 1.5) return;
            handledReturn = true;
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener('focus', onFocus);

            await this.syncSdkStatus(false);
            if (!this.isFollowing) {
                if (!window.toy || this.isUnsupportedEnv) {
                    if (didLeavePage || elapsed >= 1.8) {
                        this.isFollowing = true;
                        this._saveCachedPermissions();
                        if (typeof saveUserCloudData === 'function') {
                            saveUserCloudData().catch(() => {});
                        }
                    }
                } else if (didLeavePage && elapsed >= 3.0) {
                    // Session-only optimistic fallback for Bilibili gateway lag — never permanently written to cloud unless SDK confirms
                    this._sessionOptimisticFollow = true;
                }
            }
            applyFollowUnlockedUI();

            // Polite delayed SDK re-verification (+1.8s and +4.5s) in case Bilibili relation gateway had brief propagation lag
            if (window.toy && !this.isUnsupportedEnv && !this.isFollowing) {
                setTimeout(async () => {
                    if (this.isFollowing) return;
                    await this.syncSdkStatus(false);
                    applyFollowUnlockedUI();
                }, 1800);
                setTimeout(async () => {
                    if (this.isFollowing) return;
                    await this.syncSdkStatus(false);
                    applyFollowUnlockedUI();
                }, 4500);
            }
        };

        const onVisChange = () => {
            if (document.visibilityState === 'hidden') {
                didLeavePage = true;
            } else if (document.visibilityState === 'visible' && didLeavePage) {
                onReturn();
            }
        };
        const onFocus = () => {
            if (didLeavePage || (Date.now() - navStartTime) >= 1800) {
                onReturn();
            }
        };

        document.addEventListener('visibilitychange', onVisChange);
        window.addEventListener('focus', onFocus);
        setTimeout(() => {
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener('focus', onFocus);
        }, 120000);

        if (window.toy && typeof window.toy.navigate === 'function') {
            window.toy.navigate({ type: 'space', id: this.authorMid || '8157388' }).catch(e => console.log(e));
        } else {
            showToyToast('💡 网页端提示：正在拉起 UP 主个人空间...');
        }
    },

    goToCoin(level = null) {
        let lvl = this._normalizeLevel(level);
        if (this._hasCoinForLevel(lvl)) {
            if (this.hasUnlockedTrack(lvl)) {
                this.closeUnlockModal();
                this.updateUI({ forceLobbyRerender: true });
                if (typeof showToyToast === 'function') showToyToast('🎉 关注与投币均已验证通过，已为您解锁！');
                return;
            }
            if (typeof showToyToast === 'function') {
                showToyToast('✅ 您已完成本视频投币！只需点击上方【1. 一键前往 关注 UP 主】即可解锁～');
            }
            return;
        }

        let targetBvid = this.videos.cet4.bvid;
        if (lvl === 'daily') targetBvid = this.videos.daily.bvid;
        else if (lvl === 'cet6') targetBvid = this.videos.cet6.bvid;
        else if (lvl === 'gaokao') targetBvid = this.videos.gaokao.bvid;
        else if (lvl === 'ielts') targetBvid = this.videos.ielts.bvid;
        else if (lvl === 'kaoyan') targetBvid = (this.videos.kaoyan && this.videos.kaoyan.bvid) || this.videos.cet4.bvid;

        const navStartTime = Date.now();
        let didLeavePage = false;
        let handledReturn = false;

        const applyCoinUnlockedUI = () => {
            if (!this._hasCoinForLevel(lvl)) return;
            this.updateUI({ forceLobbyRerender: true });
            if (this._isCurrentTargetUnlocked() || this.hasUnlockedTrack(lvl)) {
                this.closeUnlockModal();
                if (typeof launchGrandConfettiShow === 'function') launchGrandConfettiShow();
            }
        };

        const onReturn = async () => {
            if (handledReturn) return;
            const elapsed = (Date.now() - navStartTime) / 1000;
            if (!didLeavePage && elapsed < 1.5) return;
            handledReturn = true;
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener('focus', onFocus);

            await this.syncSdkStatus(false);
            if (!this._hasCoinForLevel(lvl)) {
                if (!window.toy || this.isUnsupportedEnv) {
                    if (didLeavePage || elapsed >= 1.8) {
                        this._markCoinUnlockedForLevel(lvl);
                        this._saveCachedPermissions();
                        if (typeof saveUserCloudData === 'function') {
                            saveUserCloudData().catch(() => {});
                        }
                    }
                } else if (didLeavePage && elapsed >= 3.0) {
                    // Session-only fallback for Bilibili gateway lag / 2-coin ceiling — never permanently written to cloud unless SDK confirms
                    if (this._sessionCoinLevels) this._sessionCoinLevels.add(lvl);
                }
            }
            applyCoinUnlockedUI();

            if (window.toy && !this.isUnsupportedEnv) {
                setTimeout(async () => {
                    await this.syncSdkStatus(false);
                    applyCoinUnlockedUI();
                }, 1800);
                setTimeout(async () => {
                    await this.syncSdkStatus(false);
                    applyCoinUnlockedUI();
                }, 4500);
            }
        };

        const onVisChange = () => {
            if (document.visibilityState === 'hidden') {
                didLeavePage = true;
            } else if (document.visibilityState === 'visible' && didLeavePage) {
                onReturn();
            }
        };
        const onFocus = () => {
            if (didLeavePage || (Date.now() - navStartTime) >= 1800) {
                onReturn();
            }
        };

        document.addEventListener('visibilitychange', onVisChange);
        window.addEventListener('focus', onFocus);
        setTimeout(() => {
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener('focus', onFocus);
        }, 120000);

        if (window.toy && typeof window.toy.navigate === 'function') {
            window.toy.navigate({ type: 'video', id: targetBvid }).catch(e => console.log(e));
        } else {
            showToyToast(`💡 正在跳转精讲视频 (${targetBvid})...`);
        }
    },

    goToCharge() {
        if (this.isCharged || this.isAuthor) {
            this.closeUnlockModal();
            this.updateUI({ forceLobbyRerender: true });
            if (typeof showToyToast === 'function') {
                showToyToast('👑 您已是充电专享学员，全部特权均已解锁！');
            }
            return;
        }

        const chargeUrl = 'https://b23.tv/vmXUfYs';
        const navStartTime = Date.now();
        let didLeavePage = false;
        let handledReturn = false;

        const celebrateIfCharged = () => {
            if (this.isCharged || this.isAuthor) {
                this._saveCachedPermissions();
                this.closeUnlockModal();
                this.updateUI({ forceLobbyRerender: true });
                if (typeof launchGrandConfettiShow === 'function') launchGrandConfettiShow();
                if (typeof showToyToast === 'function') {
                    showToyToast('🎉 包月充电验证成功！已为您解锁全站全部特权！');
                }
                return true;
            }
            return false;
        };

        const cleanupListeners = () => {
            document.removeEventListener('visibilitychange', onVisChange);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('pageshow', onPageShow);
        };

        const onReturn = async () => {
            if (handledReturn) return;
            const elapsed = (Date.now() - navStartTime) / 1000;
            if (!didLeavePage && elapsed < 1.5) return;
            handledReturn = true;
            cleanupListeners();

            await this.syncSdkStatus(false);
            if (celebrateIfCharged()) return;

            // Polite staggered verification for Bilibili payment webhook propagation (1.6s & 4.2s)
            setTimeout(async () => {
                if (this.isCharged || this.isAuthor) { celebrateIfCharged(); return; }
                await this.syncSdkStatus(false);
                celebrateIfCharged();
            }, 1600);
            setTimeout(async () => {
                if (this.isCharged || this.isAuthor) { celebrateIfCharged(); return; }
                await this.syncSdkStatus(false);
                celebrateIfCharged();
            }, 4200);
        };

        const onVisChange = () => {
            if (document.visibilityState === 'hidden') {
                didLeavePage = true;
            } else if (document.visibilityState === 'visible' && didLeavePage) {
                onReturn();
            }
        };
        const onFocus = () => {
            if (didLeavePage || (Date.now() - navStartTime) >= 1800) {
                onReturn();
            }
        };
        const onPageShow = () => {
            if (didLeavePage || (Date.now() - navStartTime) >= 1800) {
                onReturn();
            }
        };

        document.addEventListener('visibilitychange', onVisChange);
        window.addEventListener('focus', onFocus);
        window.addEventListener('pageshow', onPageShow);
        const expireTimer = setTimeout(cleanupListeners, 300000);
        if (expireTimer && typeof expireTimer.unref === 'function') expireTimer.unref();

        const openExternalChargeSafe = () => {
            let opened = null;
            try {
                opened = window.open(chargeUrl, '_blank', 'noopener,noreferrer');
            } catch (e) {
                opened = null;
            }
            if (!opened && typeof showToyToast === 'function') {
                showToyToast('💡 请在哔哩哔哩 App 内前往 UP 主主页【充电】开启包月充电特权');
            }
        };

        if (window.toy && typeof window.toy.navigate === 'function') {
            window.toy.navigate({ type: 'space', id: this.authorMid || '8157388' }).catch(() => {
                openExternalChargeSafe();
            });
        } else {
            openExternalChargeSafe();
        }
    },

    async showUnlockModal(targetType = 'all', extra = {}) {
        let modal = document.getElementById('membership-unlock-modal');
        if (!modal) return;
        this.currentTargetType = targetType;
        this.unlockExtra = extra || {};
        const forcePreview = !!(this.unlockExtra && this.unlockExtra.forcePreview);

        if (!forcePreview && this._isCurrentTargetUnlocked()) {
            this.updateUI({ forceLobbyRerender: true });
            return;
        }

        // Pause active dictation or listening audio when paywall appears
        if (window.DictAudioEngine && typeof window.DictAudioEngine.pause === 'function') {
            window.DictAudioEngine.pause();
        }
        if (typeof clearDictAutoAdvance === 'function') {
            clearDictAutoAdvance();
        }
        const dictAudio = document.getElementById('dictation-audio-player');
        if (dictAudio && !dictAudio.paused) {
            dictAudio.pause();
        }

        this.refreshModalDOM();
        modal.classList.add('active');

        if (this.isUnsupportedEnv && typeof showToyToast === 'function') {
            showToyToast('💡 提示：在哔哩哔哩 App 内打开可自动验证包月充电特权');
        }

        await this.syncSdkStatus(false);
        if (!forcePreview && this._isCurrentTargetUnlocked()) {
            this.closeUnlockModal();
            this.updateUI({ forceLobbyRerender: true });
            if (typeof showToyToast === 'function') {
                showToyToast('🎉 已同步解锁状态，请直接开始练习！');
            }
            return;
        }
        this.refreshModalDOM();

        if (this.modalPollInterval) clearInterval(this.modalPollInterval);
        let pollCount = 0;
        const maxPolls = 6; // Max 6 polls (~24s) to strictly prevent Bilibili 307044 rate limit
        this.modalPollInterval = setInterval(async () => {
            pollCount++;
            if (pollCount > maxPolls) {
                clearInterval(this.modalPollInterval);
                this.modalPollInterval = null;
                return;
            }
            const curLevel = this.unlockExtra?.level;
            const prevTier = this.getTier(curLevel);
            await this.syncSdkStatus(false);
            const currentTier = this.getTier(curLevel);
            if (this._isCurrentTargetUnlocked() || currentTier > prevTier) {
                clearInterval(this.modalPollInterval);
                this.modalPollInterval = null;
                this.closeUnlockModal();
                this.updateUI({ forceLobbyRerender: true });
                if (typeof launchGrandConfettiShow === 'function') {
                    launchGrandConfettiShow();
                }
            }
        }, 4000);
    },

    closeUnlockModal() {
        const modal = document.getElementById('membership-unlock-modal');
        if (modal) modal.classList.remove('active');
        this.currentTargetType = 'all';
        this.unlockExtra = {};
        if (this.modalPollInterval) {
            clearInterval(this.modalPollInterval);
            this.modalPollInterval = null;
        }
    },

    _getUnifiedChargeCardHtml(customStyle = '') {
        return `
            <div class="ios-channel-card channel-vip-ios" style="${customStyle}">
                <div class="ios-card-header">
                    <div class="ios-card-icon-box vip-icon">👑</div>
                    <div class="ios-card-title-group">
                        <span class="ios-card-title">为 UP 主充电 · 解锁全部权益</span>
                    </div>
                </div>
                <ul class="ios-perk-list" style="margin-bottom: 4px;">
                    <li><span class="perk-check vip-check">✓</span><span>解锁全场实时双语对照、划词/点词查词模式</span></li>
                    <li><span class="perk-check vip-check">✓</span><span>解锁全站所有试卷逐句精听</span></li>
                    <li><span class="perk-check vip-check">✓</span><span>解锁全站笔试特训后续试卷全部真题</span></li>
                    <li><span class="perk-check vip-check">✓</span><span>赠送《新闻/演讲英语精听系列》当月中英文电子文稿(月更15期)</span></li>
                    <li><span class="perk-check vip-check">✓</span><span>赠送价值30元的《每日英语听力第1期英音版》电子文稿和音频</span></li>
                </ul>
                <div class="ios-card-actions">
                    <button class="ios-primary-cta" id="btn-vip-charge-action" onclick="window.ToyPermissions && window.ToyPermissions.goToCharge()">
                        ⚡ 一键前往 包月充电
                    </button>
                </div>
                <div style="font-size: 11.5px; color: #8e8e93; text-align: center; margin-top: 8px; line-height: 1.4;">
                    💡 提示: 选择【包月充电】(¥15/月)充电后，即可解锁全部权益
                </div>
            </div>
        `;
    },

    refreshModalDOM() {
        const modal = document.getElementById('membership-unlock-modal');
        if (!modal) return;

        let currentLevel = this._normalizeLevel(this.unlockExtra?.level || window.currentExamLevel);
        let levelName = '四级';
        let manifestList = (window.EXAMS_MANIFEST && Array.isArray(window.EXAMS_MANIFEST[currentLevel])) ? window.EXAMS_MANIFEST[currentLevel] : [];
        let examCount = manifestList.length || 74;
        let hasCoin = this.hasCoinCet4;
        let videoTitle = '四级真题精讲视频';

        if (currentLevel === 'daily') {
            levelName = '每日听力';
            examCount = 30;
            hasCoin = this.hasCoinDaily;
            videoTitle = '每日听力精讲视频';
        } else if (currentLevel === 'cet6') {
            levelName = '六级';
            examCount = manifestList.length || 51;
            hasCoin = this.hasCoinCet6;
            videoTitle = '六级真题精讲视频';
        } else if (currentLevel === 'gaokao') {
            levelName = '高考';
            examCount = manifestList.length || 62;
            hasCoin = this.hasCoinGaokao;
            videoTitle = '高考真题精讲视频';
        } else if (currentLevel === 'kaoyan') {
            levelName = (window.currentKaoyanSubjectFilter === 'ENG2') ? '考研英语(二)' : '考研英语(一)';
            examCount = 17;
            hasCoin = !!(this.hasCoinKaoyan || this.hasCoinCet4);
            videoTitle = '考研真题精讲视频';
        } else if (currentLevel === 'ielts') {
            levelName = '雅思';
            examCount = manifestList.length || 72;
            hasCoin = this.hasCoinIelts;
            videoTitle = '雅思剑桥真题视频';
        }

        const forcePreview = !!(this.unlockExtra && this.unlockExtra.forcePreview);
        hasCoin = forcePreview ? false : this._hasCoinForLevel(currentLevel);
        const isFollowing = forcePreview ? false : this._isEffectiveFollowing();
        const isCharged = forcePreview ? false : (this.isCharged || this.isAuthor);
        const isTrackUnlocked = forcePreview ? false : this.hasUnlockedTrack(currentLevel);

        const titleEl = document.getElementById('unlock-modal-target-title');
        const descEl = document.getElementById('unlock-modal-target-desc');
        const container = document.getElementById('unlock-channels-group');
        if (!container) return;

        const isLookup = (this.currentTargetType === 'lookup');
        const isBilingual = (this.currentTargetType === 'bilingual');
        const isPracticeMode = (this.currentTargetType === 'practice_mode');

        // Check if the intercepted action is strictly charge-only (Tier 3)
        const examIdx = (typeof this.unlockExtra?.examIndex === 'number') ? this.unlockExtra.examIndex : 0;
        const sentIdx = (typeof this.unlockExtra?.sentenceIndex === 'number') ? this.unlockExtra.sentenceIndex : 0;
        const dayNum = (typeof this.unlockExtra?.dayNum === 'number') ? this.unlockExtra.dayNum : (examIdx + 1);

        const isWrittenLater = (this.currentTargetType === 'written' && examIdx > 0);
        const isDictationLater = (this.currentTargetType === 'dictation' && (examIdx > 0 || sentIdx > this._getPart1EndIndex(currentLevel, this.unlockExtra?.examTitle)));
        const isDailyLater = (this.currentTargetType === 'daily' && (dayNum > 1 || examIdx > 0));

        const isChargeOnly = isLookup || isBilingual || isWrittenLater || isDictationLater || isDailyLater;

        let html = '';

        if (isCharged) {
            // Already fully unlocked
            html = `
                <div class="ios-channel-card channel-vip-ios">
                    <div class="ios-card-header">
                        <div class="ios-card-icon-box vip-icon">👑</div>
                        <div class="ios-card-title-group">
                            <span class="ios-card-title">充电专享特权</span>
                            <span class="ios-badge basic-badge unlocked">已激活</span>
                        </div>
                    </div>
                    <p style="font-size: 13.5px; color: #2c2c2e; margin: 0 0 10px 0;">全站四六级、高考、考研、雅思及每日听力全部试卷与精听已全部解锁！</p>
                </div>
            `;
        } else if (isChargeOnly) {
            if (titleEl) titleEl.textContent = '👑 包月充电专享特权';
            if (descEl) descEl.textContent = '该部分内容为充电专享权益，包月充电即可全部解锁';
            html = this._getUnifiedChargeCardHtml();
        } else if (isPracticeMode) {
            if (titleEl) titleEl.textContent = '✨ 关注 UP 主 · 开启练习模式';
            if (descEl) descEl.textContent = '未关注游客仅支持【模考】，关注 UP 主即可免费使用【练习】';
            html = `
                <div class="ios-channel-card channel-basic-ios">
                    <div class="ios-card-header">
                        <div class="ios-card-icon-box basic-icon">🎯</div>
                        <div class="ios-card-title-group">
                            <span class="ios-card-title">关注 UP 主 · 免费开启练习模式</span>
                            <span class="ios-badge basic-badge ${isFollowing ? 'unlocked' : ''}">${isFollowing ? '已解锁' : '免费解锁'}</span>
                        </div>
                    </div>
                    <ul class="ios-perk-list" style="margin-bottom: 12px;">
                        <li><span class="perk-check">✓</span><span>做完单题即刻核对正误，告别盲目刷题</span></li>
                        <li><span class="perk-check">✓</span><span>实时展开深度考点解析、原文证据句定位与同义替换</span></li>
                        <li><span class="perk-check">✓</span><span>支持随时查看高分参考范文、参考译文与短文改错详解</span></li>
                    </ul>
                    <div class="ios-card-actions">
                        <button class="ios-task-primary-btn ${isFollowing ? 'done' : ''}" onclick="window.ToyPermissions && window.ToyPermissions.goToFollow()">
                            <span>${isFollowing ? '✅' : '➕'}</span> ${isFollowing ? '已关注 UP 主（点击立即开启）' : '一键前往 关注 UP 主'}
                        </button>
                    </div>
                </div>

                ${this._getUnifiedChargeCardHtml('margin-top: 10px;')}
            `;
        } else {
            // Task Card for current track (Merged Tier 1 + Tier 2)
            if (titleEl) titleEl.textContent = '🎁 解锁' + levelName + '学习特权';
            if (descEl) descEl.textContent = '完成关注与视频投币，即刻免费解锁';

            const isTaskDone = isTrackUnlocked;
            let perkListHtml = '';
            if (currentLevel === 'daily') {
                perkListHtml = `
                    <li><span class="perk-check">✓</span><span>解锁每日英语听力 Day 01 完整篇章逐句精听与原声</span></li>
                    <li><span class="perk-check">✓</span><span>支持生词双向点词、智能填空与极速复听</span></li>
                `;
            } else if (currentLevel === 'kaoyan') {
                perkListHtml = `
                    <li><span class="perk-check">✓</span><span>解锁${levelName}第 1 套（2026年）完整全卷全部真题</span></li>
                    <li><span class="perk-check">✓</span><span>涵盖完形填空、传统阅读、新题型、英译汉及大小作文精析</span></li>
                `;
            } else {
                perkListHtml = `
                    <li><span class="perk-check">✓</span><span>解锁${levelName}第 1 套真题完整第一章节（Part 1）逐句精听与填词</span></li>
                    <li><span class="perk-check">✓</span><span>解锁${levelName}第 1 套全套完整笔试真题与深度考点解析</span></li>
                `;
            }

            html = `
                <div class="ios-channel-card channel-basic-ios">
                    <div class="ios-card-header">
                        <div class="ios-card-icon-box basic-icon">🎯</div>
                        <div class="ios-card-title-group">
                            <span class="ios-card-title">投币${levelName}视频 + 关注 UP 主</span>
                            <span class="ios-badge basic-badge ${isTaskDone ? 'unlocked' : ''}">${isTaskDone ? '已解锁' : '免费解锁'}</span>
                        </div>
                    </div>
                    <ul class="ios-perk-list" style="margin-bottom: 12px;">
                        ${perkListHtml}
                    </ul>
                    <div class="ios-card-actions">
                        <button class="ios-task-primary-btn ${isFollowing ? 'done' : ''}" onclick="window.ToyPermissions && window.ToyPermissions.goToFollow()">
                            <span>${isFollowing ? '✅' : '➕'}</span> ${isFollowing ? '已关注 UP 主' : '1. 一键前往 关注 UP 主'}
                        </button>
                        <button class="ios-task-primary-btn ${hasCoin ? 'done' : ''}" onclick="window.ToyPermissions && window.ToyPermissions.goToCoin('${currentLevel}')">
                            <span>${hasCoin ? '✅' : '🪙'}</span> ${hasCoin ? `已投币 ${levelName}指定视频` : `2. 投币 ${videoTitle}`}
                        </button>
                    </div>
                </div>

                ${this._getUnifiedChargeCardHtml('margin-top: 10px;')}
            `;
        }

        container.innerHTML = html;
    }
};
