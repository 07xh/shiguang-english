/* === js/share_card.js === */
/**
 * ==========================================================================
 * Bilibili Toy Share Achievement Postcard Card Engine
 * Renders the HTML/CSS achievement postcard preview & forwards via Bilibili Toy SDK:
 * - Cumulative study time (累计学习时长)
 * - Consecutive streak days (连续打卡天数)
 * - Current ranking (目前排名)
 * - Hero cover illustration (同头图风格插画)
 * - Toy QR Code for instant jump/sharing
 * ==========================================================================
 */

(function() {
    'use strict';

    let targetMakeupDay = null;
    let targetMakeupMonth = null;
    let targetMakeupYear = null;
    let _shareCardBound = false;
    let shareWatcherCleanup = null;

    function callShareSdkBounded(fn, timeoutMs = 8000) {
        if (typeof window.callToySdkWithTimeout === 'function') {
            return window.callToySdkWithTimeout(fn, timeoutMs);
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Toy SDK call timed out'));
                }
            }, timeoutMs);
            if (timer && typeof timer.unref === 'function') timer.unref();
            Promise.resolve().then(fn).then(
                (val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } },
                (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } }
            );
        });
    }

    function openShareCardModal(makeupDay, makeupMonth, makeupYear) {
        const modal = document.getElementById('share-card-modal-overlay');
        if (!modal) return;

        const now = new Date();
        targetMakeupDay = (typeof makeupDay === 'number' && makeupDay > 0) ? makeupDay : null;
        targetMakeupMonth = (typeof makeupMonth === 'number') ? makeupMonth : null;
        targetMakeupYear = (typeof makeupYear === 'number') ? makeupYear : null;

        // 1. Current Date or Target Makeup Date (严格按所点击的实际历史年月日显示)
        const displayYear = (targetMakeupYear !== null) ? targetMakeupYear : now.getFullYear();
        const displayMonth = (targetMakeupMonth !== null) ? targetMakeupMonth + 1 : (now.getMonth() + 1);
        const displayDate = (targetMakeupDay !== null) ? targetMakeupDay : now.getDate();
        const dateStr = `${displayYear}年${displayMonth}月${displayDate}日`;
        const dateEl = document.getElementById('share-card-date');
        if (dateEl) dateEl.textContent = dateStr;

        // 1.1 Dynamic Button Text: "分享并补签" vs "转发给朋友"
        const forwardBtnText = document.getElementById('share-card-forward-btn-text');
        if (forwardBtnText) {
            forwardBtnText.textContent = targetMakeupDay ? '分享并补签' : '转发给朋友';
        }

        // 2. Sync Hero illustration with current home cover background
        const heroImgEl = document.getElementById('share-card-hero-img');
        const heroCover = document.querySelector('.home-hero-cover');
        if (heroImgEl) {
            const bgMatch = heroCover && heroCover.style && heroCover.style.backgroundImage
                ? heroCover.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/)
                : null;
            if (bgMatch && bgMatch[1] && !bgMatch[1].includes('background1.png')) {
                heroImgEl.src = bgMatch[1];
            } else {
                heroImgEl.src = 'assets/images/background1.jpg';
            }
        }

        // 3. Sync Metrics
        // A. 累计学习时长
        const durEl = document.getElementById('share-card-duration');
        if (durEl) {
            const totalSec = (typeof getTotalLifetimePracticeDuration === 'function')
                ? getTotalLifetimePracticeDuration()
                : ((typeof getTodayPracticeDuration === 'function') ? getTodayPracticeDuration() : 0);
            if (typeof formatPracticeDuration === 'function') {
                durEl.textContent = formatPracticeDuration(totalSec);
            } else {
                const s = Math.floor(Math.max(0, totalSec || 0));
                durEl.textContent = s >= 60 ? `${Math.floor(s / 60)}min${s % 60 > 0 ? (s % 60) + 's' : ''}` : `${s}s`;
            }
        }

        // B. 连续打卡天数
        const streakEl = document.getElementById('share-card-streak');
        const streakNum = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
            ? window.HabitStreak.calculateConsecutiveStreak()
            : ((window.HabitStreak && window.HabitStreak.state && window.HabitStreak.state.streakCount) || 1);
        if (streakEl) {
            streakEl.textContent = `${Math.max(1, streakNum)}天`;
        }

        // C. 目前排名
        const rankEl = document.getElementById('share-card-rank');
        const homeRank = document.getElementById('home-user-rank');
        if (rankEl) {
            const rVal = (homeRank && homeRank.textContent.trim() && homeRank.textContent.trim() !== '-') ? homeRank.textContent.trim() : '-';
            rankEl.textContent = `第 ${rVal} 名`;
        }

        // 4. Sync User Profile (Nickname & Avatar)
        const userEl = document.getElementById('share-card-username');
        const avatarEl = document.getElementById('share-card-avatar');
        const nick = (window.currentUserProfile && window.currentUserProfile.nickname) ? window.currentUserProfile.nickname : '背词同学';
        if (userEl) userEl.textContent = nick;
        if (avatarEl) {
            if (window.currentUserProfile && window.currentUserProfile.avatar) {
                avatarEl.src = window.currentUserProfile.avatar;
            } else {
                avatarEl.src = window.DEFAULT_UNFETCHED_AVATAR || 'assets/images/default_avatar.svg';
            }
        }

        // 5. Toy QR Code (Toy JS SDK or fallback)
        const qrImg = document.getElementById('share-card-qr-img');
        if (qrImg) {
            if (window.toy && typeof window.toy.getQrCode === 'function') {
                callShareSdkBounded(() => window.toy.getQrCode({ size: 240 }), 3000).then(res => {
                    if (res && (res.base64 || res.url)) {
                        qrImg.src = res.base64 || res.url;
                    }
                }).catch(() => {
                    qrImg.src = 'assets/images/toy_qr.png';
                });
            } else {
                qrImg.src = 'assets/images/toy_qr.png';
            }
        }

        // Open Modal Animation
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('is-active');
        });
    }

    function closeShareCardModal() {
        const modal = document.getElementById('share-card-modal-overlay');
        if (!modal) return;
        modal.classList.remove('is-active');
        if (typeof shareWatcherCleanup === 'function') {
            shareWatcherCleanup();
        }
        targetMakeupDay = null;
        targetMakeupMonth = null;
        targetMakeupYear = null;
        setTimeout(() => {
            modal.style.display = 'none';
        }, 280);
    }

    /**
     * 核心安全机制：监听切出到微信/QQ等第三方应用并返回的状态
     * 绝不在调起分享面板时立即提前触发奖励与弹窗！
     * 只有当用户确实切出到外部应用 (visibilityState hidden) 且停留足够时间再返回 (visible) 时才发放奖励！
     */
    function setupShareReturnWatcher(day, month, year) {
        if (typeof shareWatcherCleanup === 'function') {
            shareWatcherCleanup();
        }

        let departureTime = 0;
        let isWatching = true;

        const onVisibilityChange = () => {
            if (!isWatching) return;
            if (document.visibilityState === 'hidden') {
                departureTime = Date.now();
            } else if (document.visibilityState === 'visible') {
                if (departureTime > 0) {
                    const elapsed = Date.now() - departureTime;
                    departureTime = 0;
                    if (elapsed >= 800) {
                        isWatching = false;
                        cleanup();
                        handleShareSuccessReward(day, month, year);
                    }
                }
            }
        };

        const onPageHide = () => {
            if (!isWatching) return;
            departureTime = Date.now();
        };

        const cleanup = () => {
            isWatching = false;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            clearTimeout(timer);
            shareWatcherCleanup = null;
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', onPageHide);

        const timer = setTimeout(() => {
            cleanup();
        }, 180000);
        if (timer && typeof timer.unref === 'function') timer.unref();

        shareWatcherCleanup = cleanup;
    }

    /**
     * Handle reward granting & automatic makeup punch after successful card share
     */
    function handleShareSuccessReward(targetDay, targetMonth, targetYear) {
        if (!window.HabitStreak) return;

        const dayToMakeup = (targetDay !== undefined && targetDay !== null) ? targetDay : targetMakeupDay;
        const monthToMakeup = (targetMonth !== undefined && targetMonth !== null) ? targetMonth : targetMakeupMonth;
        const yearToMakeup = (targetYear !== undefined && targetYear !== null) ? targetYear : targetMakeupYear;

        targetMakeupDay = null;
        targetMakeupMonth = null;
        targetMakeupYear = null;

        if (dayToMakeup) {
            if (window.HabitStreak.state.makeupCardsCount <= 0) {
                const reward = window.HabitStreak.grantMakeupCardViaShare();
                if (!reward.success && window.HabitStreak.state.makeupCardsCount <= 0) {
                    if (typeof showToyToast === 'function') {
                        showToyToast(`分享成功！${reward.message}`);
                    }
                    return;
                }
            }

            const makeupRes = window.HabitStreak.useMakeupCard(dayToMakeup, monthToMakeup, yearToMakeup);
            if (makeupRes.success) {
                const mDisplay = (typeof monthToMakeup === 'number') ? monthToMakeup + 1 : (new Date().getMonth() + 1);
                if (typeof showToyToast === 'function') {
                    showToyToast(`🎉 分享成功！已为您成功补签 ${mDisplay}月${dayToMakeup}日 打卡！连胜天数已延续至 ${window.HabitStreak.state.streakCount} 天 ✨`);
                }
                if (typeof window.launchGrandConfettiShow === 'function') {
                    window.launchGrandConfettiShow();
                }
                if (window.HomeCalendar) {
                    if (typeof window.HomeCalendar.renderMonthGrid === 'function') window.HomeCalendar.renderMonthGrid();
                    if (typeof window.HomeCalendar.renderWeekStrip === 'function') window.HomeCalendar.renderWeekStrip();
                    if (typeof window.HomeCalendar.syncMonthStatsCard === 'function') window.HomeCalendar.syncMonthStatsCard();
                }
                setTimeout(() => {
                    closeShareCardModal();
                }, 1100);
            } else {
                if (typeof showToyToast === 'function') {
                    showToyToast(`分享成功！补签提示：${makeupRes.message}`);
                }
            }
        } else {
            if (typeof showToyToast === 'function') {
                showToyToast('🎉 分享成功！已成功分享给好友');
            }
            setTimeout(() => {
                closeShareCardModal();
            }, 1000);
        }
    }

    /**
     * Handle "转发给朋友" / "分享并补签" Click
     */
    async function shareToFriend() {
        const btn = document.getElementById('btn-forward-share-card');
        if (btn) btn.disabled = true;

        const day = targetMakeupDay;
        const month = targetMakeupMonth;
        const year = targetMakeupYear;

        try {
            if (window.toy) {
                let isSupport = false;
                if (typeof window.toy.isSupport === 'function') {
                    try {
                        isSupport = await callShareSdkBounded(() => window.toy.isSupport('share'), 3000);
                    } catch (e) {}
                } else {
                    isSupport = typeof window.toy.share === 'function';
                }

                if (isSupport && typeof window.toy.share === 'function') {
                    setupShareReturnWatcher(day, month, year);
                    await callShareSdkBounded(() => window.toy.share({ path: 'index.html' }), 8000);
                    return;
                }
            }

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: '听什么听 · 英语特训',
                        text: '我在 听什么听 已经打卡，快来和我一起特训吧！',
                        url: window.location.href
                    });
                    handleShareSuccessReward(day, month, year);
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') console.warn(err);
                    return;
                }
            }

            let copied = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    copied = true;
                } catch (cErr) {}
            }
            if (!copied) {
                try {
                    const input = document.createElement('input');
                    input.value = window.location.href;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    copied = true;
                } catch (e2) {}
            }

            if (copied) {
                if (typeof showToyToast === 'function') {
                    showToyToast('🔗 链接已复制，可直接发送给好友');
                }
                setupShareReturnWatcher(day, month, year);
            }
        } catch (e) {
            console.error('[ShareCard] Share failed:', e);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function generateCardCanvas() { return null; }
    async function saveShareCard() { return false; }

    function initShareCard() {
        const modal = document.getElementById('share-card-modal-overlay');
        if (modal && modal.dataset && modal.dataset.shareCardBound === '1') return;
        if (_shareCardBound) return;
        _shareCardBound = true;
        if (modal && modal.dataset) modal.dataset.shareCardBound = '1';

        const btnOpen = document.getElementById('btn-hero-share-card');
        const btnClose = document.getElementById('btn-close-share-card');
        const btnForward = document.getElementById('btn-forward-share-card');

        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.stopPropagation();
                openShareCardModal();
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', (e) => {
                e.stopPropagation();
                closeShareCardModal();
            });
        }

        if (btnForward) {
            btnForward.addEventListener('click', (e) => {
                e.stopPropagation();
                shareToFriend();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeShareCardModal();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShareCard);
    } else {
        initShareCard();
    }

    window.openShareCardModal = openShareCardModal;
    window.closeShareCardModal = closeShareCardModal;
    window.generateCardCanvas = generateCardCanvas;
    window.saveShareCard = saveShareCard;
    window.shareToFriend = shareToFriend;
})();
