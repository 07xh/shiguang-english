/* === js/toy_rank_view.js === */
// Demo mock leaderboard users removed as requested
const MOCK_LEADERBOARD_USERS = [];

// Permanently locked to user favorite: Style 1 (🌟 星芒晶透 2-1-3 浮空台)
let currentRankStyle = 1;
try {
    window.__toyLS.setItem('toy_rank_selected_style', '1');
} catch (e) {}

let lastRenderedRankList = [];
let _lastRankFetchStartedAt = 0;

function escapeRankHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeRankAvatarAttr(url, fallback) {
    if (!url || typeof url !== 'string') return fallback || '';
    const trimmed = url.trim();
    if (!/^https:\/\//i.test(trimmed) && !/^http:\/\//i.test(trimmed) && !/^\/\//.test(trimmed) && !/^data:image\//i.test(trimmed) && !/^assets\//i.test(trimmed)) {
        return fallback || '';
    }
    return escapeRankHtml(trimmed);
}
window.escapeRankHtml = escapeRankHtml;

function switchRankStyle(styleId) {
    currentRankStyle = 1;
    try {
        window.__toyLS.setItem('toy_rank_selected_style', '1');
    } catch (e) {}

    if (lastRenderedRankList && lastRenderedRankList.length > 0) {
        renderRankItems(lastRenderedRankList);
    } else {
        fetchAndRenderRankList();
    }
}
window.switchRankStyle = switchRankStyle;

/**
 * Fetch and Render Daily Leaderboard List (Strictly period: 'day', ranked by today's practice duration)
 */
async function fetchAndRenderRankList() {
    window._initialRankFetchTriggered = true;
    const nowTs = Date.now();
    if (nowTs >= _lastRankFetchStartedAt && (nowTs - _lastRankFetchStartedAt) < 1200 && Array.isArray(lastRenderedRankList) && lastRenderedRankList.length > 0) {
        return;
    }
    _lastRankFetchStartedAt = nowTs;
    commitActivePracticeTime();
    const rankContainer = document.getElementById('rank-list-container');
    if (!rankContainer) return;

    // Sync switcher active state
    const tabs = document.querySelectorAll('.rank-style-tab');
    tabs.forEach(tab => {
        const s = parseInt(tab.getAttribute('data-style'), 10);
        if (s === currentRankStyle) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    rankContainer.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--ink-sub); font-size: 14px;">加载今日实时时长榜单中...</div>';

    // 1. Calculate today's real practice duration
    const todaySec = getTodayPracticeDuration();
    const myScore = Math.floor(todaySec);

    // Proactively register active user's score if changed (skipCloudSave avoids full 45-key cloud dump on rank open)
    try {
        await submitUserScore(true, { skipCloudSave: true });
    } catch (e) {}

    // 2. Fetch My Authoritative Server Rank & Global Daily Leaderboard from SDK (strictly period: 'day')
    let serverList = [];
    let serverMyRank = null;
    const rateLimited = (typeof window.isToySdkRateLimited === 'function' && window.isToySdkRateLimited());

    if (!rateLimited && window.toy && typeof window.toy.getMyRank === 'function') {
        try {
            serverMyRank = await (window.callToySdkWithTimeout
                ? window.callToySdkWithTimeout(() => window.toy.getMyRank({ board: 1, period: 'day' }), 2500)
                : window.toy.getMyRank({ board: 1, period: 'day' }));
            if (serverMyRank && (serverMyRank.code === 307044 || serverMyRank.code === '307044')) {
                if (typeof window.markToySdkRateLimited === 'function') window.markToySdkRateLimited(10000);
                serverMyRank = null;
            }
        } catch (e) {
            if (e && (e.code === 307044 || e.code === '307044') && typeof window.markToySdkRateLimited === 'function') {
                window.markToySdkRateLimited(10000);
            }
        }
    }

    if (!(typeof window.isToySdkRateLimited === 'function' && window.isToySdkRateLimited()) && window.toy && typeof window.toy.getRankList === 'function') {
        try {
            const res = await (window.callToySdkWithTimeout
                ? window.callToySdkWithTimeout(() => window.toy.getRankList({ board: 1, period: 'day', limit: 100 }), 3000)
                : window.toy.getRankList({ board: 1, period: 'day', limit: 100 }));
            if (Array.isArray(res)) {
                serverList = res;
            } else if (res && (res.code === 307044 || res.code === '307044') && typeof window.markToySdkRateLimited === 'function') {
                window.markToySdkRateLimited(10000);
            }
        } catch (e) {
            if (e && (e.code === 307044 || e.code === '307044') && typeof window.markToySdkRateLimited === 'function') {
                window.markToySdkRateLimited(10000);
            }
            console.log('[ToySDK] getRankList info:', e);
        }
    }

    // 3. Assemble and Merge current user real practice data (never fabricate 1s for 0s users)
    const myName = (window.currentUserProfile && window.currentUserProfile.nickname) || "B站学员";
    const defaultAvatar = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';
    const myAvatar = (window.currentUserProfile && window.currentUserProfile.avatar) || defaultAvatar;

    let combinedList = serverList.filter(item => {
        const p = parseRankScore(item.score);
        return p.durationSec > 0 || (typeof item.score === 'number' && item.score > 0);
    });

    // Authoritative user rank & score from B站 server
    let myRankNum = 0;
    let serverAuthoritativeMyScore = 0;
    if (serverMyRank && serverMyRank.ranked && typeof serverMyRank.rank === 'number' && serverMyRank.rank > 0) {
        myRankNum = serverMyRank.rank;
        if (typeof serverMyRank.score === 'number' && serverMyRank.score > 0) {
            serverAuthoritativeMyScore = Math.floor(serverMyRank.score);
        }
    }

    const realMyScore = Math.max(myScore, serverAuthoritativeMyScore);
    let userIndex = combinedList.findIndex(item => item.nickname === myName || item.isMe);

    if (userIndex >= 0) {
        if (realMyScore > combinedList[userIndex].score) {
            combinedList[userIndex].score = realMyScore;
        }
        combinedList[userIndex].isMe = true;
        if (!combinedList[userIndex].avatar && myAvatar) combinedList[userIndex].avatar = myAvatar;
    } else if (realMyScore > 0) {
        // Only merge current user into the leaderboard when they actually practiced (> 0s)
        const minScoreInTop = (combinedList.length >= 100) ? combinedList[combinedList.length - 1].score : 0;
        if (combinedList.length < 100 || realMyScore >= minScoreInTop || (myRankNum > 0 && myRankNum <= 100)) {
            combinedList.push({
                nickname: myName,
                score: realMyScore,
                avatar: myAvatar,
                isMe: true
            });
        }
    }

    // Sort descending by today's practice duration (longest first)
    combinedList.sort((a, b) => b.score - a.score);
    if (combinedList.length > 100) {
        combinedList = combinedList.slice(0, 100);
    }
    combinedList.forEach((item, idx) => item.rank = idx + 1);

    // If user is inside the top 100 list, verify their exact position
    const meItem = combinedList.find(item => item.isMe || item.nickname === myName);
    let authoritativeScore = realMyScore;
    if (meItem && meItem.score > 0) {
        myRankNum = meItem.rank;
        if (meItem.score > myScore) {
            authoritativeScore = meItem.score;
            try {
                const currentToday = getTodayDateStr();
                window.__toyLS.setItem(getUserStorageKey('today_practice_duration'), JSON.stringify({ date: currentToday, seconds: authoritativeScore }));
            } catch(e) {}
        }
    } else if (!myRankNum && realMyScore > 0) {
        myRankNum = combinedList.length >= 100 ? (serverMyRank && serverMyRank.rank ? serverMyRank.rank : 100) : combinedList.length + 1;
    }

    renderMyRankCard({
        ranked: myRankNum > 0 && authoritativeScore > 0,
        rank: myRankNum,
        score: authoritativeScore
    });

    // Determine total active users from server leaderboard & authoritative active stats
    let knownTotalUsers = combinedList.length;
    if (serverMyRank && serverMyRank.ranked && typeof serverMyRank.rank === 'number' && serverMyRank.rank > knownTotalUsers) {
        knownTotalUsers = serverMyRank.rank;
    }
    if (typeof window._serverTodayActiveUsers === 'number' && window._serverTodayActiveUsers > knownTotalUsers) {
        knownTotalUsers = window._serverTodayActiveUsers;
    }

    // Update Home Rank Carousel Card Avatar Stack & Pill Count with real leaderboard data
    lastRenderedRankList = combinedList;
    window.lastRenderedRankList = combinedList;
    updateHomeRankCardPill(combinedList, knownTotalUsers);

    // Only build 100-user DOM & avatar <img> nodes if legacy #view-rank is actively visible
    const rankViewEl = document.getElementById('view-rank');
    if (rankViewEl && rankViewEl.classList.contains('active')) {
        renderRankItems(combinedList);
    }
}

// Track avatar URLs that failed to load (e.g. users who did not authorize avatar submission)
window._brokenRankAvatarUrls = window._brokenRankAvatarUrls || new Set();
try {
    const savedBroken = window.__toySS.getItem('toy_broken_rank_avatars_v1') || window.__toyLS.getItem('toy_broken_rank_avatars_v1');
    if (savedBroken) {
        const arr = JSON.parse(savedBroken);
        if (Array.isArray(arr)) {
            arr.forEach(u => { if (u && typeof u === 'string') window._brokenRankAvatarUrls.add(u); });
        }
    }
} catch (e) {}

function normalizeRankAvatarUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let s = rawUrl.trim();
    if (!s || s === 'null' || s === 'undefined' || s === 'none' || s === 'false') return '';
    const lower = s.toLowerCase();
    if (
        lower.includes('avatar_user') ||
        lower.includes('avatar_bunny') ||
        lower.includes('avatar_cat') ||
        lower.includes('noface') ||
        lower.startsWith('data:image/svg')
    ) {
        return '';
    }
    if (s.startsWith('//')) s = 'https:' + s;
    else if (s.startsWith('http://')) s = 'https://' + s.slice(7);
    if (!s.startsWith('https://') && !s.startsWith('data:image/')) return '';
    // Reject bare domain or directory URLs without a filename
    if (/^https:\/\/[^\/]+\/?$/i.test(s) || s.endsWith('/')) return '';
    if (window._brokenRankAvatarUrls && window._brokenRankAvatarUrls.has(s)) return '';
    return s;
}
window.normalizeRankAvatarUrl = normalizeRankAvatarUrl;

function recordBrokenRankAvatar(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    const trimmed = rawUrl.trim();
    let norm = trimmed;
    if (norm.startsWith('//')) norm = 'https:' + norm;
    else if (norm.startsWith('http://')) norm = 'https://' + norm.slice(7);
    window._brokenRankAvatarUrls.add(trimmed);
    window._brokenRankAvatarUrls.add(norm);
    try {
        const serialized = JSON.stringify(Array.from(window._brokenRankAvatarUrls).slice(-120));
        window.__toySS.setItem('toy_broken_rank_avatars_v1', serialized);
        window.__toyLS.setItem('toy_broken_rank_avatars_v1', serialized);
    } catch (e) {}
}
window._recordBrokenRankAvatar = recordBrokenRankAvatar;

window._handleRankStackAvatarError = function(imgEl) {
    if (!imgEl) return;
    imgEl.onerror = null;
    const failedUrl = imgEl.getAttribute('data-avatar-url') || imgEl.getAttribute('src') || '';
    if (failedUrl) {
        recordBrokenRankAvatar(failedUrl);
    }
    // Cascade (顺延) to the next ranked user with a valid avatar
    const sourceList = (Array.isArray(window.lastRenderedRankList) && window.lastRenderedRankList.length > 0)
        ? window.lastRenderedRankList
        : (Array.isArray(window._cachedRankCandidateUsers) ? window._cachedRankCandidateUsers : []);
    if (sourceList.length > 0) {
        updateHomeRankCardPill(sourceList);
    } else {
        imgEl.src = window.DEFAULT_UNFETCHED_AVATAR;
    }
};

/**
 * Dynamically update the Home Page Leaderboard Card pill:
 * 1. Avatars: strictly pick top 3 users who have a valid custom avatar, cascading down
 *    the ranking list (e.g., if Rank #2 and #4 have no avatar, automatically use #1, #3, #5).
 * 2. Count:
 *    - 0 users: '虚位以待'
 *    - >=1 users: `+${totalCount}人`
 */
function updateHomeRankCardPill(list, overrideTotalCount) {
    const effectiveInputList = (Array.isArray(list) && list.length > 0)
        ? list
        : (Array.isArray(window.lastRenderedRankList) && window.lastRenderedRankList.length > 0
            ? window.lastRenderedRankList
            : (Array.isArray(window._cachedRankCandidateUsers) ? window._cachedRankCandidateUsers : []));

    if (Array.isArray(list) && list.length > 0) {
        lastRenderedRankList = list;
        window.lastRenderedRankList = list;
    }

    const validList = effectiveInputList.filter(item => {
        if (!item) return false;
        const p = (typeof parseRankScore === 'function') ? parseRankScore(item.score) : { durationSec: Number(item.score) || 0 };
        return p.durationSec > 0 || (typeof item.score === 'number' && item.score > 0) || !!item.avatar;
    });

    const computedCount = validList.length;
    const serverCount = (typeof window._serverTodayActiveUsers === 'number') ? window._serverTodayActiveUsers : 0;
    let cachedCount = 0;
    try {
        const rawCached = window.__toyLS.getItem('toy_cached_rank_pill_v2');
        if (rawCached) {
            const parsedCached = JSON.parse(rawCached);
            const todayStr = typeof getTodayDateStr === 'function' ? getTodayDateStr() : new Date().toISOString().slice(0, 10);
            if (parsedCached && parsedCached.date === todayStr && typeof parsedCached.totalCount === 'number') {
                cachedCount = parsedCached.totalCount;
            }
        }
    } catch (e) {}

    const totalCount = Math.max(
        computedCount,
        (typeof overrideTotalCount === 'number' ? overrideTotalCount : 0),
        serverCount,
        cachedCount
    );

    let countText = '虚位以待';
    if (totalCount > 0) {
        countText = `+${totalCount}人`;
    }

    // Cascade (顺延) through validList in rank order to collect users with real, non-broken avatars
    const candidateUsers = [];
    const seenAvatarUrls = new Set();
    for (let i = 0; i < validList.length; i++) {
        const u = validList[i];
        const cleanAvatar = normalizeRankAvatarUrl(u && u.avatar);
        if (!cleanAvatar) continue;
        if (seenAvatarUrls.has(cleanAvatar)) continue;
        seenAvatarUrls.add(cleanAvatar);
        candidateUsers.push({
            avatar: cleanAvatar,
            nickname: (u && u.nickname) || '学员',
            score: (u && u.score) || 1,
            rank: (u && u.rank) || (i + 1)
        });
        if (candidateUsers.length >= 25) break;
    }

    if (candidateUsers.length > 0) {
        window._cachedRankCandidateUsers = candidateUsers;
    }

    const topUsers = candidateUsers.slice(0, 3);
    const defaultAvatar = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';

    if (topUsers.length > 0) {
        topUsers.forEach(u => {
            try {
                const img = new Image();
                img.onload = function() {
                    if (img.naturalWidth === 0) {
                        recordBrokenRankAvatar(u.avatar);
                        updateHomeRankCardPill(window.lastRenderedRankList || candidateUsers);
                    }
                };
                img.onerror = function() {
                    recordBrokenRankAvatar(u.avatar);
                    updateHomeRankCardPill(window.lastRenderedRankList || candidateUsers);
                };
                img.src = u.avatar;
            } catch(e) {}
        });
        const avatarsHtml = topUsers.map(u => {
            const safeName = escapeRankHtml((u && u.nickname) || '学员');
            const safeAv = sanitizeRankAvatarAttr(u.avatar, defaultAvatar);
            return `<img src="${safeAv}" data-avatar-url="${safeAv}" class="rank-stack-avatar" alt="${safeName}" onerror="window._handleRankStackAvatarError(this);">`;
        }).join('');

        document.querySelectorAll('.rank-avatar-stack').forEach(el => {
            el.innerHTML = avatarsHtml;
        });
    } else if (validList.length === 0) {
        // Keep existing DOM avatars if we only received a count update before rank list arrived
    } else {
        const fallbackHtml = `<img src="${defaultAvatar}" class="rank-stack-avatar" alt="Avatar">`;
        document.querySelectorAll('.rank-avatar-stack').forEach(el => {
            el.innerHTML = fallbackHtml;
        });
    }

    document.querySelectorAll('.rank-pill-count').forEach(el => {
        el.textContent = countText;
    });

    // Cache summary & cascading candidate pool to localStorage for 0ms first-screen rendering
    try {
        const today = typeof getTodayDateStr === 'function' ? getTodayDateStr() : new Date().toISOString().slice(0, 10);
        const prevRaw = window.__toyLS.getItem('toy_cached_rank_pill_v2');
        const prevParsed = prevRaw ? JSON.parse(prevRaw) : null;
        const savedCandidates = candidateUsers.length > 0
            ? candidateUsers
            : ((prevParsed && prevParsed.date === today && Array.isArray(prevParsed.candidateAvatars)) ? prevParsed.candidateAvatars : []);
        const savedTop = topUsers.length > 0
            ? topUsers
            : savedCandidates.filter(u => normalizeRankAvatarUrl(u && u.avatar)).slice(0, 3);

        window.__toyLS.setItem('toy_cached_rank_pill_v2', JSON.stringify({
            date: today,
            totalCount: totalCount,
            topAvatars: savedTop,
            candidateAvatars: savedCandidates
        }));
    } catch(e) {}
}

function restoreHomeRankCardPillFromCache() {
    try {
        const raw = window.__toyLS.getItem('toy_cached_rank_pill_v2');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const today = typeof getTodayDateStr === 'function' ? getTodayDateStr() : new Date().toISOString().slice(0, 10);
        if (parsed && parsed.date === today) {
            const count = Math.max(parsed.totalCount || 0, window._serverTodayActiveUsers || 0);
            let countText = '虚位以待';
            if (count > 0) {
                countText = `+${count}人`;
            }
            const pool = Array.isArray(parsed.candidateAvatars) && parsed.candidateAvatars.length > 0
                ? parsed.candidateAvatars
                : (Array.isArray(parsed.topAvatars) ? parsed.topAvatars : []);
            const validPool = [];
            const seen = new Set();
            for (let i = 0; i < pool.length; i++) {
                const u = pool[i];
                const clean = normalizeRankAvatarUrl(u && u.avatar);
                if (!clean || seen.has(clean)) continue;
                seen.add(clean);
                validPool.push({
                    avatar: clean,
                    nickname: (u && u.nickname) || '学员',
                    score: (u && u.score) || 1
                });
            }
            if (validPool.length > 0) {
                window._cachedRankCandidateUsers = validPool;
                const top3 = validPool.slice(0, 3);
                const avatarsHtml = top3.map(u => {
                    const safeName = escapeRankHtml((u && u.nickname) || '学员');
                    const safeAv = sanitizeRankAvatarAttr(u.avatar, '');
                    return `<img src="${safeAv}" data-avatar-url="${safeAv}" class="rank-stack-avatar" alt="${safeName}" onerror="window._handleRankStackAvatarError(this);">`;
                }).join('');
                document.querySelectorAll('.rank-avatar-stack').forEach(el => {
                    el.innerHTML = avatarsHtml;
                });
            }
            document.querySelectorAll('.rank-pill-count').forEach(el => {
                el.textContent = countText;
            });
        }
    } catch(e) {}
}

window.updateHomeRankCardPill = updateHomeRankCardPill;
window.restoreHomeRankCardPillFromCache = restoreHomeRankCardPillFromCache;

// Restore cached rank pill on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreHomeRankCardPillFromCache);
} else {
    restoreHomeRankCardPillFromCache();
}

// Automatically fetch authoritative active stats on launch and keep pill fresh
if (typeof fetchTodayActiveUserCount === 'function') {
    fetchTodayActiveUserCount().then(cnt => {
        if (cnt > 0 && typeof updateHomeRankCardPill === 'function') {
            updateHomeRankCardPill(window.lastRenderedRankList || [], cnt);
        }
    }).catch(() => {});
}

function renderMyRankCard(data) {
    const card = document.getElementById('my-rank-card');

    const defaultAvatar = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';
    const isAuth = !!(window.currentUserProfile && window.currentUserProfile.nickname && window.currentUserProfile.nickname !== '同学' && window.currentUserProfile.nickname !== '本地测试用户');
    const myAvatar = (window.currentUserProfile && window.currentUserProfile.avatar) || defaultAvatar;
    const myName = (window.currentUserProfile && window.currentUserProfile.nickname) || "B站学员";

    const todaySec = (data && typeof data.score === 'number' && data.score > 0) ? data.score : getTodayPracticeDuration();
    const durationFormatted = formatRankDuration(todaySec);
    const durationHTML = formatRankDurationHTML(todaySec);
    const hasTodayPractice = todaySec > 0;

    // Optimization 5: Guest / Unauthenticated graceful fallback with interactive login button
    if (!isAuth && !hasTodayPractice && (!window.toy || !window.toyOpenId)) {
        const defaultRankVal = (window.__toyLS.getItem(getUserStorageKey('cached_rank')) || '-');
        document.querySelectorAll('.home-user-rank-bind, #home-user-rank').forEach(el => {
            el.textContent = defaultRankVal;
        });
        if (card) {
            card.innerHTML = `
                <div class="my-rank-left" style="cursor: pointer;" onclick="fetchUserProfile(true)">
                    <img class="my-rank-avatar" src="${defaultAvatar}" alt="avatar">
                    <div class="my-rank-info">
                        <div class="my-rank-name">未登录学员</div>
                        <div class="my-rank-pos" style="color: #007aff; font-weight: 600;">👉 点击同步B站账号，参与今日全站排名</div>
                    </div>
                </div>
                <div class="my-rank-score" style="cursor: pointer;" onclick="fetchUserProfile(true)">
                    <button class="btn-pill-action" style="padding: 6px 14px; font-size: 12px; border-radius: 100px; background: #007aff; color: #fff; border: none; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(0,122,255,0.25);">去登录</button>
                </div>
            `;
        }
        return;
    }

    const isRanked = (data && data.ranked && data.rank > 0 && hasTodayPractice);
    const userRankNumber = isRanked ? data.rank : 0;

    if (userRankNumber > 0) {
        try { window.__toyLS.setItem(getUserStorageKey('cached_rank'), String(userRankNumber)); } catch(e) {}
    }

    const cachedRank = window.__toyLS.getItem(getUserStorageKey('cached_rank'));
    const rankDisplayText = userRankNumber > 0 
        ? (userRankNumber > 100 ? `${userRankNumber}` : String(userRankNumber)) 
        : (hasTodayPractice ? (cachedRank || '1') : (cachedRank || '-'));

    document.querySelectorAll('.home-user-rank-bind, #home-user-rank').forEach(el => {
        el.textContent = rankDisplayText;
    });
    if (!card) return;

    const posText = isRanked
        ? `全站第 ${data.rank} 名`
        : (hasTodayPractice ? `全站第 ${rankDisplayText} 名` : '暂未上榜 · 开启刷题即可冲榜');

    let scoreText = hasTodayPractice ? `${durationHTML}` : `0<small>s</small>`;

    card.innerHTML = `
        <div class="my-rank-left">
            <img class="my-rank-avatar" src="${sanitizeRankAvatarAttr(myAvatar, defaultAvatar)}" alt="avatar">
            <div class="my-rank-info">
                <div class="my-rank-name">${escapeRankHtml(myName)} <span style="font-size:12px; font-weight:500; color:var(--ink-sub); margin-left: 2px;">(我)</span></div>
                <div class="my-rank-pos">${posText}</div>
            </div>
        </div>
        <div class="my-rank-score">${scoreText}</div>
    `;
}

/**
 * Render Leaderboard with 5 Distinct Visual Styles
 */
function renderRankItems(list) {
    const rankContainer = document.getElementById('rank-list-container');
    if (!rankContainer) return;
    rankContainer.innerHTML = '';

    const isTotallyEmpty = (!Array.isArray(list) || list.length === 0);
    const defaultAvatar = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';
    const emptyAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
    const myName = (window.currentUserProfile && window.currentUserProfile.nickname) || "B站学员";

    const displayList = Array.isArray(list)
        ? list.map(raw => Object.assign({}, raw, {
            avatar: sanitizeRankAvatarAttr(raw && raw.avatar, defaultAvatar)
        }))
        : [];
    displayList.sort((a, b) => b.score - a.score);
    displayList.forEach((item, idx) => item.rank = idx + 1);

    const top1 = displayList[0] || null;
    const top2 = displayList[1] || null;
    const top3 = displayList[2] || null;
    const restList = displayList.slice(3);

    const formatName = (item) => {
        const isMe = item.isMe || item.nickname === myName;
        const safeNick = escapeRankHtml(item.nickname || 'B站学员');
        return isMe ? `${safeNick} <span style="font-size:11.5px; font-weight:600; color:#007aff;">(我)</span>` : safeNick;
    };

    // Branch into 5 distinct V2 visual styles
    if (currentRankStyle === 1) {
        // ==========================================
        // STYLE 1: 🌟【B站星芒晶透殿堂】(Starlight Glass)
        // ==========================================
        const wrap = document.createElement('div');
        wrap.className = 'rank-style-1-wrap';

        let stageHtml = `
            <div class="star-stage-card">
                <div class="star-stage-row">
        `;

        // Rank 2 (Left - Always rendered to preserve 2-1-3 podium geometry)
        if (top2) {
            const p2 = parseRankScore(top2.score);
            stageHtml += `
                <div class="star-col star-col-2">
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${top2.avatar || defaultAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥈</span>
                    </div>
                    <div class="star-name">${formatName(top2)}</div>
                    <div class="star-time-pill">${p2.durationHTML}</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">2</div>
                    </div>
                </div>
            `;
        } else {
            stageHtml += `
                <div class="star-col star-col-2 is-empty">
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${emptyAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥈</span>
                    </div>
                    <div class="star-name">&nbsp;</div>
                    <div class="star-time-pill">&nbsp;</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">2</div>
                    </div>
                </div>
            `;
        }

        // Rank 1 (Center - Raised)
        if (top1) {
            const p1 = parseRankScore(top1.score);
            stageHtml += `
                <div class="star-col star-col-1">
                    <div class="star-crown-float">👑</div>
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${top1.avatar || defaultAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥇</span>
                    </div>
                    <div class="star-name">${formatName(top1)}</div>
                    <div class="star-time-pill">✨ ${p1.durationHTML}</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">1</div>
                    </div>
                </div>
            `;
        } else {
            stageHtml += `
                <div class="star-col star-col-1 is-empty">
                    <div class="star-crown-float" style="opacity: 0.25;">👑</div>
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${emptyAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥇</span>
                    </div>
                    <div class="star-name">&nbsp;</div>
                    <div class="star-time-pill">&nbsp;</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">1</div>
                    </div>
                </div>
            `;
        }

        // Rank 3 (Right - Always rendered to preserve 2-1-3 podium geometry)
        if (top3) {
            const p3 = parseRankScore(top3.score);
            stageHtml += `
                <div class="star-col star-col-3">
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${top3.avatar || defaultAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥉</span>
                    </div>
                    <div class="star-name">${formatName(top3)}</div>
                    <div class="star-time-pill">${p3.durationHTML}</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">3</div>
                    </div>
                </div>
            `;
        } else {
            stageHtml += `
                <div class="star-col star-col-3 is-empty">
                    <div class="star-avatar-wrap">
                        <img class="star-avatar" src="${emptyAvatar}" alt="avatar">
                        <span class="star-badge-pin">🥉</span>
                    </div>
                    <div class="star-name">&nbsp;</div>
                    <div class="star-time-pill">&nbsp;</div>
                    <div class="star-pedestal">
                        <div class="star-pedestal-tag">3</div>
                    </div>
                </div>
            `;
        }

        stageHtml += `
                </div>
            </div>
        `;

        // Rest list (Rank 4+) or empty hint
        let restHtml = '';
        if (isTotallyEmpty) {
            restHtml = `
                <div class="empty-rank-state" style="text-align: center; padding: 22px 18px; background: rgba(255, 255, 255, 0.7); border-radius: 18px; border: 1px solid rgba(0, 0, 0, 0.05); margin-top: 14px;">
                    <div style="font-size: 24px; margin-bottom: 6px;">⏱️</div>
                    <div style="font-size: 14.5px; font-weight: 700; color: var(--ink-primary); margin-bottom: 3px;">今日全站榜单虚位以待</div>
                    <div style="font-size: 12.5px; color: var(--ink-sub);">立即进入题目开始精练，抢占今日全站时长第 1 名！</div>
                </div>
            `;
        } else if (restList.length > 0) {
            restHtml = '<div class="star-rest-list">';
            restList.forEach(item => {
                const p = parseRankScore(item.score);
                restHtml += `
                    <div class="star-rest-item">
                        <div class="star-rest-left">
                            <div class="star-rest-rank">${item.rank}</div>
                            <img class="star-rest-avatar" src="${item.avatar || defaultAvatar}" alt="avatar">
                            <div class="star-rest-name">${formatName(item)}</div>
                        </div>
                        <div class="star-rest-score">${p.durationHTML}</div>
                    </div>
                `;
            });
            restHtml += '</div>';
        }

        wrap.innerHTML = stageHtml + restHtml;
        rankContainer.appendChild(wrap);

    }
}

/**
 * Toast & Modals
 */
function showToyToast(msg) {
    let toast = document.getElementById('toy-toast-bar');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toy-toast-bar';
        toast.className = 'toy-toast-bar';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showToyModal(title, contentHtml) {
    let modal = document.getElementById('custom-toy-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-toy-modal';
        modal.className = 'modal-mask active';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 440px; text-align: left;">
                <h3 id="custom-modal-title" style="font-size: 17px; font-weight: 800; margin-bottom: 10px; color: var(--ink-primary);"></h3>
                <div id="custom-modal-body" style="font-size: 13.5px; line-height: 1.6; color: var(--ink-sub); margin-bottom: 20px;"></div>
                <button class="btn-modal-primary" id="btn-custom-modal-close" style="width: 100%;">我知道了</button>
            </div>
        `;
        document.body.appendChild(modal);
        const closeBtn = document.getElementById('btn-custom-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
    }
    const titleEl = document.getElementById('custom-modal-title');
    const bodyEl = document.getElementById('custom-modal-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = contentHtml;
    modal.classList.add('active');
}

function showConfirmModal({ title, desc, confirmText = '确定重刷', cancelText = '取消', onConfirm }) {
    let modal = document.getElementById('custom-toy-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-toy-confirm-modal';
        modal.className = 'modal-mask';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 360px; text-align: center; padding: 28px 24px; border-radius: 24px;">
                <h3 id="confirm-modal-title" style="font-size: 17px; font-weight: 800; margin-bottom: 10px; color: var(--ink-primary);"></h3>
                <p id="confirm-modal-desc" style="font-size: 13.5px; line-height: 1.5; color: var(--ink-sub); margin-bottom: 22px;"></p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="btn-confirm-cancel" style="flex: 1; height: 42px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.12); background: #ffffff; color: var(--ink-primary); font-weight: 700; font-size: 14px; cursor: pointer;">取消</button>
                    <button id="btn-confirm-ok" style="flex: 1; height: 42px; border-radius: 999px; border: none; background: #1c1c1e; color: #ffffff; font-weight: 700; font-size: 14px; cursor: pointer;">确定重刷</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = document.getElementById('confirm-modal-title');
    const descEl = document.getElementById('confirm-modal-desc');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');
    if (btnCancel) btnCancel.textContent = cancelText;
    if (btnOk) btnOk.textContent = confirmText;

    const closeModal = () => modal.classList.remove('active');
    if (btnCancel) btnCancel.onclick = closeModal;
    if (btnOk) {
        btnOk.onclick = () => {
            closeModal();
            if (typeof onConfirm === 'function') onConfirm();
        };
    }

    modal.classList.add('active');
}

window.showToyToast = showToyToast;
window.showToyModal = showToyModal;
window.showConfirmModal = showConfirmModal;
