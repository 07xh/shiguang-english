/* === js/rank_modal.js === */
const DEFAULT_UNFETCHED_AVATAR = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';
/**
 * ==========================================================================
 * Bilibili Toy Leaderboard Modal (1:1 照搬 单词Toy RankModal 抽屉弹窗规范)
 * Upward popup bottom sheet drawer displaying Top 100 Daily Study Duration
 * Production Ready: 100% Real-time Bilibili SDK & Authoritative Server Data
 * ==========================================================================
 */

(function() {
    'use strict';

    let isModalOpen = false;
    let _rankModalBound = false;
    let _inFlightLoadPromise = null;

    function callRankSdkBounded(fn, ms = 2500) {
        if (typeof window.callToySdkWithTimeout === 'function') {
            return window.callToySdkWithTimeout(fn, ms);
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('timeout'));
                }
            }, ms);
            if (timer && typeof timer.unref === 'function') timer.unref();
            Promise.resolve().then(fn).then(
                (val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } },
                (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } }
            );
        });
    }

    function openRankModal() {
        const overlay = document.getElementById('rank-modal-overlay');
        if (!overlay) return;

        isModalOpen = true;
        overlay.classList.add('is-active');
        document.body.classList.add('rank-modal-open');

        // Immediate 0ms subtitle update from active stats cache
        const subtitleEl = document.querySelector('.rank-header-subtitle');
        if (subtitleEl) {
            const serverCount = (typeof window._serverTodayActiveUsers === 'number' && window._serverTodayActiveUsers > 0)
                ? window._serverTodayActiveUsers
                : 0;
            if (serverCount > 0) {
                subtitleEl.textContent = `今日 ${serverCount} 人正在学习 · 每日零点重置`;
            }
        }

        // Load real leaderboard data immediately (deduplicated via _inFlightLoadPromise)
        return loadRankModalData();
    }

    function closeRankModal() {
        const overlay = document.getElementById('rank-modal-overlay');
        if (!overlay) return;

        isModalOpen = false;
        overlay.classList.remove('is-active');
        document.body.classList.remove('rank-modal-open');
    }

    function loadRankModalData() {
        if (_inFlightLoadPromise) return _inFlightLoadPromise;
        _inFlightLoadPromise = _executeLoadRankModalData().finally(() => {
            _inFlightLoadPromise = null;
        });
        return _inFlightLoadPromise;
    }

    async function _executeLoadRankModalData() {
        const listContainer = document.getElementById('rank-drawer-list');
        if (!listContainer) return;

        // Commit active practice time before reading
        if (typeof commitActivePracticeTime === 'function') {
            commitActivePracticeTime();
        }

        const myScore = (typeof getTodayPracticeDuration === 'function')
            ? Math.floor(getTodayPracticeDuration())
            : 0;

        // Proactively register active user's score if changed (skipCloudSave avoids full cloud dump on drawer open)
        if (typeof submitUserScore === 'function' && myScore > 0) {
            try {
                await callRankSdkBounded(() => submitUserScore(true, { skipCloudSave: true }), 800).catch(() => {});
            } catch(e) {}
        }

        const myName = (window.currentUserProfile && window.currentUserProfile.nickname) || "B站学员";
        const myAvatar = (window.currentUserProfile && window.currentUserProfile.avatar) || (window.DEFAULT_UNFETCHED_AVATAR || DEFAULT_UNFETCHED_AVATAR);

        let rankList = [];
        let myRankData = { ranked: false, rank: 0, score: myScore };
        const rateLimited = (typeof window.isToySdkRateLimited === 'function' && window.isToySdkRateLimited());

        // 1 & 2. Concurrently fetch real rank list and personal rank from Bilibili Toy SDK (in parallel, bounded & rate-limit aware)
        const rankPromise = (!rateLimited && window.toy && typeof window.toy.getRankList === 'function')
            ? callRankSdkBounded(() => window.toy.getRankList({ board: 1, period: 'day', limit: 100 }), 2500).then(res => {
                if (res && (res.code === 307044 || res.code === '307044')) {
                    if (typeof window.markToySdkRateLimited === 'function') window.markToySdkRateLimited(10000);
                    return [];
                }
                return res;
            }).catch(e => {
                if (e && (e.code === 307044 || e.code === '307044') && typeof window.markToySdkRateLimited === 'function') {
                    window.markToySdkRateLimited(10000);
                }
                console.log('[ToySDK] getRankList info:', e);
                return [];
            })
            : Promise.resolve([]);

        const myRankPromise = (!rateLimited && window.toy && typeof window.toy.getMyRank === 'function')
            ? callRankSdkBounded(() => window.toy.getMyRank({ board: 1, period: 'day' }), 2500).then(res => {
                if (res && (res.code === 307044 || res.code === '307044')) {
                    if (typeof window.markToySdkRateLimited === 'function') window.markToySdkRateLimited(10000);
                    return null;
                }
                return res;
            }).catch(e => {
                if (e && (e.code === 307044 || e.code === '307044') && typeof window.markToySdkRateLimited === 'function') {
                    window.markToySdkRateLimited(10000);
                }
                return null;
            })
            : Promise.resolve(null);

        const statsPromise = (typeof fetchTodayActiveUserCount === 'function')
            ? callRankSdkBounded(() => fetchTodayActiveUserCount(), 1500).catch(() => 0)
            : Promise.resolve(0);

        try {
            const [res, myRes] = await Promise.all([rankPromise, myRankPromise, statsPromise]);
            if (Array.isArray(res) && res.length > 0) {
                rankList = res.filter(item => {
                    const s = parseInt(item.score || 0, 10);
                    return s > 0;
                });
            }
            if (myRes && myRes.ranked !== false && typeof myRes.rank === 'number' && myRes.rank > 0) {
                const srvScore = (typeof myRes.score === 'number' && myRes.score > 0) ? Math.floor(myRes.score) : myScore;
                if (srvScore > 0) {
                    myRankData = {
                        ranked: true,
                        rank: myRes.rank,
                        score: srvScore
                    };
                }
            }
        } catch (e) {
            console.log('[ToySDK] rank fetch error:', e);
        }

        // 3. Merge current active user into list ONLY when real practice score > 0 (never fabricate 1s for 0s users)
        const realMyScore = Math.max(myScore, myRankData.score || 0);
        let existingIdx = rankList.findIndex(item => item.isMe || item.nickname === myName);
        if (existingIdx >= 0) {
            if (realMyScore > rankList[existingIdx].score) {
                rankList[existingIdx].score = realMyScore;
            }
            rankList[existingIdx].isMe = true;
            rankList[existingIdx].nickname = myName;
            if (!rankList[existingIdx].avatar && myAvatar) {
                rankList[existingIdx].avatar = myAvatar;
            }
        } else if (realMyScore > 0) {
            rankList.push({
                nickname: myName,
                avatar: myAvatar,
                score: realMyScore,
                isMe: true
            });
        }

        // Re-sort descending by today's practice duration
        rankList.sort((a, b) => b.score - a.score);
        if (rankList.length > 100) rankList = rankList.slice(0, 100);
        rankList.forEach((item, idx) => { item.rank = idx + 1; });

        const foundMe = rankList.find(item => item.isMe || item.nickname === myName);
        if (foundMe && foundMe.score > 0) {
            myRankData.ranked = true;
            myRankData.rank = foundMe.rank;
            myRankData.score = foundMe.score;
        }

        // 4. Render HTML rows or empty state
        window.lastRenderedRankList = rankList;
        renderRankModalRows(rankList, myRankData);

        // Keep Home Rank Card Pill synchronized with latest drawer rank data
        if (typeof updateHomeRankCardPill === 'function') {
            const serverCount = (typeof window._serverTodayActiveUsers === 'number') ? window._serverTodayActiveUsers : 0;
            const knownTotal = Math.max(
                (myRankData && myRankData.ranked && myRankData.rank > rankList.length) ? myRankData.rank : rankList.length,
                serverCount
            );
            updateHomeRankCardPill(rankList, knownTotal);
        }

        // Update rank drawer subtitle to reflect authoritative today's active count
        const subtitleEl = document.querySelector('.rank-header-subtitle');
        if (subtitleEl) {
            const serverCount = (typeof window._serverTodayActiveUsers === 'number' && window._serverTodayActiveUsers > 0)
                ? window._serverTodayActiveUsers
                : (rankList.length || 0);
            if (serverCount > 0) {
                subtitleEl.textContent = `今日 ${serverCount} 人正在学习 · 每日零点重置`;
            } else {
                subtitleEl.textContent = '每日零点重置';
            }
        }
    }

    window._handleRankModalRowAvatarError = function(imgEl) {
        if (!imgEl) return;
        imgEl.onerror = null;
        const rawUrl = imgEl.getAttribute('data-raw-avatar') || imgEl.getAttribute('src') || '';
        if (rawUrl && typeof window._recordBrokenRankAvatar === 'function') {
            window._recordBrokenRankAvatar(rawUrl);
        }
        imgEl.src = window.DEFAULT_UNFETCHED_AVATAR || DEFAULT_UNFETCHED_AVATAR;
        if (typeof window.updateHomeRankCardPill === 'function' && Array.isArray(window.lastRenderedRankList) && window.lastRenderedRankList.length > 0) {
            window.updateHomeRankCardPill(window.lastRenderedRankList);
        }
    };

    function renderRankModalRows(list, myRank) {
        const listContainer = document.getElementById('rank-drawer-list');
        if (!listContainer) return;

        if (!list || list.length === 0) {
            listContainer.innerHTML = `
                <div class="rank-empty-box" style="text-align: center; padding: 56px 20px 48px; color: #8e8e93;">
                    <div style="font-size: 44px; margin-bottom: 14px; line-height: 1;">🏆</div>
                    <div style="font-weight: 700; font-size: 16px; color: #1c1c1e; margin-bottom: 8px;">今日排行榜虚位以待</div>
                    <div style="font-size: 13px; color: #8a8a8e; line-height: 1.6; max-width: 270px; margin: 0 auto;">
                        今日打卡记录已于零点重置<br>完成听力跟写或真题练习，立即成为首位登顶学员！
                    </div>
                </div>
            `;
            return;
        }

        const fallbackAvatar = window.DEFAULT_UNFETCHED_AVATAR || DEFAULT_UNFETCHED_AVATAR;
        let html = '';
        list.forEach(item => {
            const isMe = !!item.isMe || (myRank && myRank.ranked && item.rank === myRank.rank);
            const scoreSec = Math.max(0, parseInt(item.score || 0, 10));
            const mins = Math.floor(scoreSec / 60);
            const secs = String(scoreSec % 60).padStart(2, '0');

            // Rank Badge / Emoji
            let rankBadgeHtml = '';
            if (item.rank === 1) {
                rankBadgeHtml = '<span class="rank-medal-emoji">🥇</span>';
            } else if (item.rank === 2) {
                rankBadgeHtml = '<span class="rank-medal-emoji">🥈</span>';
            } else if (item.rank === 3) {
                rankBadgeHtml = '<span class="rank-medal-emoji">🥉</span>';
            } else {
                rankBadgeHtml = `<span class="rank-num-text">#${item.rank}</span>`;
            }

            const escHtml = (typeof window.escapeRankHtml === 'function')
                ? window.escapeRankHtml
                : (s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            const rawAvatar = (item && typeof item.avatar === 'string') ? item.avatar.trim() : '';
            const normalizedAvatar = (typeof window.normalizeRankAvatarUrl === 'function')
                ? window.normalizeRankAvatarUrl(rawAvatar)
                : (/^(https?:\/\/|\/\/|data:image\/|assets\/)/i.test(rawAvatar) ? rawAvatar : '');
            const displayAvatar = escHtml(normalizedAvatar || fallbackAvatar);
            const safeRawAttr = normalizedAvatar ? escHtml(normalizedAvatar) : '';
            const safeNick = escHtml(item.nickname || 'B站学员');

            html += `
                <div class="rank-item-row ${isMe ? 'is-me' : ''}" data-rank="${item.rank}">
                    <!-- 排名徽章 / 数字 -->
                    <div class="rank-num-box">
                        ${rankBadgeHtml}
                    </div>

                    <!-- 用户头像 -->
                    <div class="rank-avatar-wrap ${item.rank === 1 ? 'rank-top-1' : ''}">
                        <img src="${displayAvatar}" data-raw-avatar="${safeRawAttr}" class="rank-avatar-img" alt="" onerror="window._handleRankModalRowAvatarError(this);">
                    </div>

                    <!-- 昵称与身份标识 -->
                    <div class="rank-info-col">
                        <span class="rank-user-name">${safeNick}</span>
                        ${isMe ? '<span class="rank-me-tag">我</span>' : ''}
                    </div>

                    <!-- 得分数值 (今日学习时长：不到1分钟去掉前置0分，只保留秒) -->
                    <div class="rank-score-col">
                        ${mins > 0 ? `
                            <span class="rank-score-num">${mins}</span>
                            <span class="rank-score-unit">分</span>
                            <span class="rank-score-num">${secs}</span>
                            <span class="rank-score-unit">秒</span>
                        ` : `
                            <span class="rank-score-num">${scoreSec % 60}</span>
                            <span class="rank-score-unit">秒</span>
                        `}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    // Attach listeners once (idempotent)
    function initRankModal() {
        const overlay = document.getElementById('rank-modal-overlay');
        if (overlay && overlay.dataset && overlay.dataset.rankModalBound === '1') return;
        if (_rankModalBound) return;
        _rankModalBound = true;
        if (overlay && overlay.dataset) overlay.dataset.rankModalBound = '1';

        const closeBtn = overlay ? overlay.querySelector('.rank-drawer-close-btn') : null;
        const backdrop = overlay ? overlay.querySelector('.rank-modal-backdrop') : null;

        if (closeBtn) closeBtn.addEventListener('click', closeRankModal);
        if (backdrop) backdrop.addEventListener('click', closeRankModal);

        // Bind all rank card click entries and home avatar (deduplicated via Set)
        const seenEls = new Set();
        document.querySelectorAll('.btn-entry-rank, #top-card-entry-rank, #card-entry-rank-2, #home-user-avatar-wrap').forEach(el => {
            if (!el || seenEls.has(el)) return;
            seenEls.add(el);
            if (el.dataset && el.dataset.rankEntryBound === '1') return;
            if (el.dataset) el.dataset.rankEntryBound = '1';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                openRankModal();
            });
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeRankModal();
            }
        });
    }

    // Export to window
    window.openRankModal = openRankModal;
    window.closeRankModal = closeRankModal;
    window.initRankModal = initRankModal;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRankModal);
    } else {
        setTimeout(initRankModal, 40);
    }
})();
