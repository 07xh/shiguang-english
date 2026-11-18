/* === js/app.js === */
/**
 * ==========================================================================
 * Application Bootstrap & Main Entry Point (Bilibili Toy CET-4 Master)
 * ==========================================================================
 */

function updateDashboardStats() {
    let listeningQAnswered = 0;
    let listeningCorrectCount = 0;
    let listeningExamCount = 0;
    let listeningScoreSum = 0;

    let writtenQAnswered = 0;
    let writtenCorrectCount = 0;
    let writtenExamCount = 0;
    let writtenScoreSum = 0;

    if (window.completedExams && typeof window.completedExams === 'object') {
        Object.entries(window.completedExams).forEach(([title, data]) => {
            if (!data) return;
            // 1. Listening answers count & accuracy
            if (data.answers && typeof data.answers === 'object') {
                const ansList = Object.values(data.answers).filter(ans => ans && typeof ans === 'object' && !ans._deleted);
                listeningQAnswered += ansList.length;
                ansList.forEach(ans => {
                    if (ans.isCorrect) listeningCorrectCount++;
                });
            }
            if (typeof data.score === 'number' && !isNaN(data.score)) {
                listeningScoreSum += data.score;
                listeningExamCount++;
            }

            // 2. Written answers count & accuracy
            if (data.writtenAnswers && typeof data.writtenAnswers === 'object') {
                const wAnsList = Object.values(data.writtenAnswers).filter(ans => ans && typeof ans === 'object' && !ans._deleted);
                writtenQAnswered += wAnsList.length;
                wAnsList.forEach(ans => {
                    if (ans.isCorrect) writtenCorrectCount++;
                });
            }
            if (typeof data.writtenScore === 'number' && !isNaN(data.writtenScore)) {
                writtenScoreSum += data.writtenScore;
                writtenExamCount++;
            }
        });
    }

    const todayStats = (typeof getTodayPracticeStats === 'function') ? getTodayPracticeStats() : { todayTotalQ: 0, todayCorrect: 0, accuracy: 0 };
    const completedAllQ = listeningQAnswered + writtenQAnswered;
    const totalAllQ = (typeof getTotalCumulativeQuestions === 'function') ? getTotalCumulativeQuestions() : Math.max(completedAllQ, todayStats.todayTotalQ || 0);
    const totalAllCorrect = listeningCorrectCount + writtenCorrectCount + (totalAllQ > completedAllQ ? (todayStats.todayCorrect || 0) : 0);
    const overallAvgScore = totalAllQ > 0 ? Math.round((totalAllCorrect / totalAllQ) * 100) : (todayStats.accuracy || 0);

    const listeningAvgScore = listeningQAnswered > 0 ? Math.round((listeningCorrectCount / listeningQAnswered) * 100) : 0;
    const writtenAvgScore = writtenQAnswered > 0 ? Math.round((writtenCorrectCount / writtenQAnswered) * 100) : 0;

    // Cumulative Check-in Days calculation (登陆一天就累加计数一次，永不重置清零)
    try {
        if (typeof getUserStorageKey === 'function') {
            const localStr = window.__toyLS.getItem(getUserStorageKey('streak_info'));
            if (localStr) window.streakInfo = JSON.parse(localStr);
        }
    } catch(e) {}

    const todayDate = (typeof getTodayDateStr === 'function') 
        ? getTodayDateStr() 
        : (function() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();

    // 每日登录 Toy 自动静默打卡（无任何弹窗）
    if (window.HabitStreak && typeof window.HabitStreak.punchToday === 'function') {
        window.HabitStreak.punchToday(false);
    }

    if (!window.streakInfo || typeof window.streakInfo !== 'object') {
        const initStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
            ? window.HabitStreak.calculateConsecutiveStreak()
            : 1;
        window.streakInfo = { streak: Math.max(1, initStreak), days: 1, lastDate: todayDate };
        try {
            if (typeof getUserStorageKey === 'function') {
                const sKey = getUserStorageKey('streak_info');
                if (typeof safeLocalStorageSet === 'function') {
                    safeLocalStorageSet(sKey, JSON.stringify(window.streakInfo));
                } else {
                    window.__toyLS.setItem(sKey, JSON.stringify(window.streakInfo));
                }
            }
        } catch(e) {}
    } else {
        if (window.streakInfo.lastDate !== todayDate) {
            // New day login: increment total cumulative days
            const currentDays = (typeof window.getCalculatedTotalCumulativeDays === 'function')
                ? window.getCalculatedTotalCumulativeDays()
                : parseInt(window.streakInfo.days || window.streakInfo.streak || 0, 10);
            const newDays = Math.max(currentDays, (window.streakInfo.days || 0) + 1);
            window.streakInfo.days = newDays; // 累计天数递增
            window.streakInfo.lastDate = todayDate;
            if (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function') {
                window.streakInfo.streak = window.HabitStreak.calculateConsecutiveStreak();
            }
            try {
                if (typeof getUserStorageKey === 'function') {
                    const sKey = getUserStorageKey('streak_info');
                    if (typeof safeLocalStorageSet === 'function') {
                        safeLocalStorageSet(sKey, JSON.stringify(window.streakInfo));
                    } else {
                        window.__toyLS.setItem(sKey, JSON.stringify(window.streakInfo));
                    }
                }
            } catch(e) {}
            if (typeof saveUserCloudData === 'function') saveUserCloudData();
        }
    }

    const currentStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
        ? window.HabitStreak.calculateConsecutiveStreak()
        : (window.HabitStreak && window.HabitStreak.state ? window.HabitStreak.state.streakCount : 0);

    // Practice Duration Stats (Formatted strictly as XminXs / Xmin / Xs / 0s)
    const todaySec = (typeof getTodayPracticeDuration === 'function') ? getTodayPracticeDuration() : 0;
    const totalSec = (typeof getTotalLifetimePracticeDuration === 'function') ? getTotalLifetimePracticeDuration() : todaySec;

    // Multi-Theme Reactive Home Portal Stats Pills & User Profile Binds
    const totalDurationHTML = (typeof formatPracticeDurationHTML === 'function') 
        ? formatPracticeDurationHTML(totalSec) 
        : `${Math.floor(totalSec / 60)} <small>min</small>`;
    const todayDurationHTML = (typeof formatPracticeDurationHTML === 'function') 
        ? formatPracticeDurationHTML(todaySec) 
        : `${Math.floor(todaySec / 60)} <small>min</small>`;

    const sToday = Math.floor(Math.max(0, todaySec || 0));
    const todayMins = Math.floor(sToday / 60);
    const todayRemSec = sToday % 60;
    const todayLearningHTML = `${todayMins}<small>分</small>${todayRemSec}<small>秒</small>`;

    document.querySelectorAll('.stat-lifetime-duration, #home-pill-today').forEach(el => {
        el.innerHTML = totalDurationHTML;
    });
    document.querySelectorAll('.stat-lifetime-q, #home-pill-total, #home-pill-total-alt').forEach(el => {
        el.innerHTML = `${totalAllQ}<small>题</small>`;
    });
    document.querySelectorAll('.stat-today-duration, #home-pill-duration, #home-pill-duration-alt').forEach(el => {
        el.innerHTML = todayDurationHTML;
    });
    document.querySelectorAll('.stat-today-learning-time, .home-pill-today-learning-bind, #home-pill-today-learning').forEach(el => {
        el.innerHTML = todayLearningHTML;
    });
    document.querySelectorAll('.stat-streak-days, #home-pill-streak').forEach(el => {
        el.innerHTML = `${currentStreak}<small>天</small>`;
    });
    document.querySelectorAll('#dashboard-streak-number, .home-streak-number-bind').forEach(el => {
        el.textContent = currentStreak;
    });
    if (typeof window.updateDashboardFlame === 'function') {
        window.updateDashboardFlame(currentStreak);
    }

    const userNick = (window.currentUserProfile && window.currentUserProfile.nickname) ? window.currentUserProfile.nickname : '同学';
    document.querySelectorAll('.home-user-name-bind, #home-user-name').forEach(el => {
        el.textContent = userNick;
    });

    if (typeof updateHomeCalendar === 'function') {
        updateHomeCalendar();
    }
}

/**
 * ==========================================================================
 * Classic Dual-Cannon Confetti Fireworks Engine (2.2s ~ 2.5s)
 * Clean, Standard High-Impact Celebration Particle Burst
 * ==========================================================================
 */
let _activeConfettiAnimId = null;

function launchGrandConfettiShow() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    if (_activeConfettiAnimId) {
        cancelAnimationFrame(_activeConfettiAnimId);
        _activeConfettiAnimId = null;
    }

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = [
        '#007aff', '#34c759', '#ff9500', '#ff2d55', '#5856d6',
        '#ffcc00', '#00c7be', '#af52de', '#ff3b30', '#ffd60a'
    ];

    const particles = [];
    // Classic Dual-Cannon from bottom corners + center upward burst
    const origins = [
        { x: width * 0.10, y: height * 0.94, angleMin: -76, angleMax: -26, count: 60, speedMin: 22, speedMax: 42 },
        { x: width * 0.90, y: height * 0.94, angleMin: -154, angleMax: -104, count: 60, speedMin: 22, speedMax: 42 },
        { x: width * 0.50, y: height * 0.58, angleMin: -180, angleMax: 0, count: 50, speedMin: 14, speedMax: 32 }
    ];

    origins.forEach(orig => {
        for (let i = 0; i < orig.count; i++) {
            const angleDeg = orig.angleMin + Math.random() * (orig.angleMax - orig.angleMin);
            const angleRad = (angleDeg * Math.PI) / 180;
            const speed = orig.speedMin + Math.random() * (orig.speedMax - orig.speedMin);

            particles.push({
                x: orig.x,
                y: orig.y,
                vx: Math.cos(angleRad) * speed,
                vy: Math.sin(angleRad) * speed,
                w: Math.random() * 8 + 5,
                h: Math.random() * 5 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 16,
                tiltAngle: Math.random() * Math.PI,
                tiltSpeed: Math.random() * 0.14 + 0.07,
                drag: 0.948,
                gravity: 0.46,
                alpha: 1,
                decay: Math.random() * 0.0075 + 0.0065 // 2.2 ~ 2.5s duration
            });
        }
    });

    let frameCount = 0;
    function renderConfetti() {
        ctx.clearRect(0, 0, width, height);
        let hasAlive = false;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.rotation += p.vRot;
            p.tiltAngle += p.tiltSpeed;

            if (frameCount > 40) {
                p.alpha -= p.decay;
            }

            if (p.alpha > 0 && p.y < height + 60) {
                hasAlive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.scale(1, Math.cos(p.tiltAngle));
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        }

        frameCount++;
        if (hasAlive && frameCount < 160) {
            _activeConfettiAnimId = requestAnimationFrame(renderConfetti);
        } else {
            ctx.clearRect(0, 0, width, height);
            _activeConfettiAnimId = null;
        }
    }

    _activeConfettiAnimId = requestAnimationFrame(renderConfetti);
}

/**
 * Application Bootstrap with Preload (Hero Wallpaper + Auth + Permissions + Cloud Sync)
 * Returning Users: Instant Stale-While-Revalidate (SWR) path with ~350ms splash dismiss.
 * New Users: Polite onboarding path (~750ms) with full initial state resolution.
 */
async function initApp() {
    const startTime = Date.now();

    // Clear any external watchdog from index.html since app.js has safely taken over
    if (window.__splashWatchdog) {
        try { clearTimeout(window.__splashWatchdog); } catch(e) {}
    }

    let splashDissolved = false;
    const forceDissolveSplash = () => {
        if (splashDissolved) return;
        splashDissolved = true;
        if (typeof window.__dismissSplash === 'function') {
            window.__dismissSplash();
        } else {
            const splashEl = document.getElementById('app-splash-screen');
            if (splashEl) {
                splashEl.classList.add('dissolving');
                splashEl.style.opacity = '0';
                splashEl.style.pointerEvents = 'none';
                setTimeout(() => {
                    splashEl.classList.add('dissolved');
                    splashEl.style.display = 'none';
                    try { if (splashEl.parentNode) splashEl.parentNode.removeChild(splashEl); } catch(e) {}
                }, 350);
            }
        }
        if (typeof switchView === 'function' && (!window.activeView || window.activeView === 'home')) {
            try { switchView('home'); } catch(e) {}
        }
    };
    // Failsafe Watchdog: Splash screen is 100% guaranteed to dissolve within 1500ms even if network hangs
    const watchdogTimer = setTimeout(forceDissolveSplash, 1500);

    try {
        if (typeof initDictionaryEvents === 'function') initDictionaryEvents();
        if (typeof initNavigationEvents === 'function') initNavigationEvents();
        if (typeof initYearFilters === 'function') initYearFilters();
        if (typeof initWrittenFilters === 'function') initWrittenFilters();
    } catch(e) {
        console.warn('[App] Navigation init non-fatal error:', e);
    }

    // Phase 0: Instant Cache Pre-Hydration behind the splash screen (0ms paint)
    try {
        if (typeof restoreHomeRankCardPillFromCache === 'function') restoreHomeRankCardPillFromCache();
        if (typeof updateUserAvatarDOM === 'function') updateUserAvatarDOM();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof initHomeCalendar === 'function') initHomeCalendar();
        if (typeof updateHomeCalendar === 'function') updateHomeCalendar();
        if (typeof initDashboardCarousel === 'function') initDashboardCarousel();
        if (typeof renderLobbyGrid === 'function') renderLobbyGrid(window.currentListeningFilter || 'ALL');
        if (typeof renderWrittenLobbyGrid === 'function') renderWrittenLobbyGrid(window.currentWrittenFilterRange || 'ALL');
        if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid(window.currentDictationFilter || 'ALL');
        if (typeof renderDailyLobbyGrid === 'function') renderDailyLobbyGrid();
    } catch(e) {
        console.warn('[App] Phase 0 cache pre-hydration error:', e);
    }

    // Phase 1: Hero Cover Image Preload & Decode Promise (Capped at 1000ms)
    const preloadHeroPromise = new Promise((resolve) => {
        try {
            let savedHeroBg = window.__toyLS.getItem('cet4_custom_hero_bg') || 'assets/images/background1.jpg';
            if (savedHeroBg.includes('assets/images/background1.png')) {
                savedHeroBg = 'assets/images/background1.jpg';
                try { window.__toyLS.removeItem('cet4_custom_hero_bg'); } catch (e) {}
            }
            const heroCover = document.querySelector('.home-hero-cover');
            if (heroCover) {
                heroCover.style.backgroundImage = `url("${savedHeroBg}")`;
            }

            const img = new Image();
            img.src = savedHeroBg;

            const onDone = () => {
                if ('decode' in img) {
                    img.decode().then(resolve).catch(resolve);
                } else {
                    resolve();
                }
            };

            if (img.complete) {
                onDone();
            } else {
                img.onload = onDone;
                img.onerror = () => resolve();
                setTimeout(resolve, 400);
            }
        } catch (e) {
            resolve();
        }
    });

    // Phase 2: Authoritative Cloud & SDK Data Loading (parallelize relation/charge sync at t=0ms alongside profile key resolution)
    const cloudHydrationTasks = [
        preloadHeroPromise,
        (async () => {
            if (window.ToyPermissions && typeof window.ToyPermissions.syncSdkStatus === 'function') {
                await window.ToyPermissions.syncSdkStatus(false).catch(() => {});
            }
        })(),
        (async () => {
            const keyBefore = (typeof getCurrentUserKey === 'function') ? getCurrentUserKey() : '';
            if (typeof fetchUserProfile === 'function') {
                await Promise.race([
                    fetchUserProfile().catch(() => {}),
                    new Promise(r => setTimeout(r, 900))
                ]);
            }
            const keyAfter = (typeof getCurrentUserKey === 'function') ? getCurrentUserKey() : '';
            const didSwitch = (keyBefore !== keyAfter);
            if (!didSwitch && typeof loadUserCloudData === 'function') {
                await loadUserCloudData().catch(() => {});
            }
        })(),
        (async () => {
            if (typeof fetchAndRenderRankList === 'function') {
                await fetchAndRenderRankList().catch(() => {});
            }
        })()
    ];

    // Phase 3: Final Authoritative DOM Synchronization helper
    const syncHydratedDOM = () => {
        try {
            if (window.HabitStreak && typeof window.HabitStreak.punchToday === 'function') {
                window.HabitStreak.punchToday(true);
            }
            if (window.ToyPermissions && typeof window.ToyPermissions.updateUI === 'function') {
                window.ToyPermissions.updateUI();
            }
            if (typeof updateUserAvatarDOM === 'function') updateUserAvatarDOM();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            if (typeof updateHomeCalendar === 'function') updateHomeCalendar();
            if (window.updateDashboardFlame && typeof window.updateDashboardFlame === 'function') {
                window.updateDashboardFlame();
            }
            if (typeof renderLobbyGrid === 'function') renderLobbyGrid(window.currentListeningFilter || 'ALL');
            if (typeof renderWrittenLobbyGrid === 'function') renderWrittenLobbyGrid(window.currentWrittenFilterRange || 'ALL');
            if (typeof renderDictationLobbyGrid === 'function') renderDictationLobbyGrid(window.currentDictationFilter || 'ALL');
            if (typeof renderDailyLobbyGrid === 'function') renderDailyLobbyGrid();
        } catch(e) {
            console.warn('[App] Phase 3 final DOM sync error:', e);
        }
    };

    // Wait up to 550ms for cloud data before dissolving splash; if slower, finish hydration seamlessly in background
    const allCloudDone = Promise.allSettled(cloudHydrationTasks);
    let timedOutBeforeCloud = false;
    await Promise.race([
        allCloudDone,
        new Promise(r => setTimeout(() => { timedOutBeforeCloud = true; r(); }, 550))
    ]);

    syncHydratedDOM();
    if (timedOutBeforeCloud) {
        allCloudDone.then(() => { syncHydratedDOM(); }).catch(() => {});
    }

    // Phase 4: Guarantee layout calculation and GPU composite buffer are 100% painted
    await new Promise(r => {
        if ('requestAnimationFrame' in window) {
            requestAnimationFrame(() => requestAnimationFrame(r));
        } else {
            setTimeout(r, 32);
        }
    });

    // Phase 5: Smooth Crossfade Dissolve (0ms flicker, all data already loaded and painted)
    clearTimeout(watchdogTimer);
    forceDissolveSplash();

    // ⚡ Background Idle Prefetch for Top Exam & Dictionary (Zero impact on UI thread)
    const runIdlePrefetch = () => {
        // 1. Prefetch top exam of current level
        try {
            const manifest = (typeof getActiveExamManifest === 'function') ? getActiveExamManifest() : [];
            if (manifest && manifest.length > 0) {
                const topExam = manifest[0];
                if (topExam && typeof prefetchExamModule === 'function') {
                    prefetchExamModule(topExam.title, topExam.level, 'listening').catch(() => {});
                    prefetchExamModule(topExam.title, topExam.level, 'dictation').catch(() => {});
                    prefetchExamModule(topExam.title, topExam.level, 'written').catch(() => {});
                }
            }
        } catch(e) {}

        // 2. Preload offline dictionary in idle time
        if (typeof ensureDictionaryLoaded === 'function') {
            ensureDictionaryLoaded().catch(() => {});
        }
    };

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(runIdlePrefetch, { timeout: 2500 });
    } else {
        setTimeout(runIdlePrefetch, 600);
    }
}

window.initApp = initApp;

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
