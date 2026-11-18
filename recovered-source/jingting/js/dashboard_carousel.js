/* === js/dashboard_carousel.js === */
/**
 * ==========================================================================
 * Bilibili Toy Home Dashboard 2-Page Carousel & Flame System (v4.0)
 *
 * 1. 2-Page Alternating Layout (严格仅这两页轮播):
 *    - Page 1 (Dot 0): [左: 今日排名(大卡片), 右: 学习统计(上下俩)]
 *    - Page 2 (Dot 1): [左: 学习统计(上下俩), 右: 连续打卡(大卡片)]
 *    - 无缝无限双向循环轮播 (Buffer 0: Page 2 克隆 | Page 1 | Page 2 | Buffer 3: Page 1 克隆)
 *    - 绝不存在两个大卡片并排！每页均为严格的 1个大卡片 + 2个上下小卡片。
 *
 * 2. 单词Toy 1:1 完整火焰进化系统:
 *    - 11级火候进化 (Level 0 初火待燃 到 Level 10 满月神火)
 *    - 纯净高透活力渐变与里程碑金芒星环绕
 *    - 轻触火焰逐级循环预览火候 (1 -> 2 -> 3 -> 5 -> 7 -> 10 -> 14 -> 21 -> 25 -> 30)
 * ==========================================================================
 */

(function() {
    'use strict';

    // =========================================================================
    // 🔥 1. 单词Toy 1:1 移植：火焰进化系统与火候计算规则
    // =========================================================================

    /**
     * 计算连续打卡天数对应的火焰等级与文案
     * @param {number|string} count 
     * @returns {Object} { level, stageText, title, desc }
     */
    function getFlameStage(count) {
        const days = parseInt(count, 10) || 0;
        if (days <= 0) {
            return {
                level: 0,
                stageText: '初火待燃',
                title: '点燃今日',
                desc: '每日打卡点燃火花'
            };
        } else if (days === 1) {
            return {
                level: 1,
                stageText: '第 1 天 · 小火苗初燃',
                title: '火苗初燃',
                desc: '万丈光芒起于微澜'
            };
        } else if (days === 2) {
            return {
                level: 2,
                stageText: '第 2 天 · 双芽微火',
                title: '双芽微火',
                desc: '微火成聚渐入佳境'
            };
        } else if (days < 5) {
            return {
                level: 3,
                stageText: `${days} 天 · 生机初显`,
                title: '生机初显',
                desc: '突破三日生机盎然'
            };
        } else if (days < 7) {
            return {
                level: 4,
                stageText: `${days} 天 · 跃动拔节`,
                title: '跃动拔节',
                desc: '五日连胜拔节生长'
            };
        } else if (days < 10) {
            return {
                level: 5,
                stageText: `${days} 天 · 满周破竹`,
                title: '满周破竹',
                desc: '满周达成势如破竹'
            };
        } else if (days < 14) {
            return {
                level: 6,
                stageText: `${days} 天 · 十日炽盛`,
                title: '十日炽盛',
                desc: '突破双位金星初升'
            };
        } else if (days < 21) {
            return {
                level: 7,
                stageText: `${days} 天 · 半月狂飙`,
                title: '半月狂飙',
                desc: '两周连胜凌空如炬'
            };
        } else if (days < 25) {
            return {
                level: 8,
                stageText: `${days} 天 · 三周成习`,
                title: '三周成习',
                desc: '廿一日定习惯成自然'
            };
        } else if (days < 30) {
            return {
                level: 9,
                stageText: `${days} 天 · 满月冲刺`,
                title: '满月冲刺',
                desc: '仙羽流光直抵圆满'
            };
        } else {
            return {
                level: 10,
                stageText: `${days} 天 · 满月神火`,
                title: '终极神火',
                desc: '满月封顶登峰造极'
            };
        }
    }

    /**
     * 生成对应等级的矢量 SVG 图标
     * @param {number} level 0 ~ 10
     * @returns {string} SVG HTML
     */
    function getFlameSvgHtml(level) {
        switch (level) {
            case 0:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l0">' +
                    '<path d="M50 28 C56 42 70 56 70 78 C70 96 61 110 50 110 C39 110 30 96 30 78 C30 56 44 42 50 28 Z" fill="#94A3B8" opacity="0.4" />' +
                    '<path d="M50 62 C53 70 60 78 60 88 C60 98 55 104 50 104 C45 104 40 98 40 88 C40 78 47 70 50 62 Z" fill="#CBD5E1" opacity="0.5" />' +
                    '</svg>';
            case 1:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l1">' +
                    '<path d="M52 26 C57 38 73 52 73 78 C73 98 62 112 50 112 C38 112 28 98 28 78 C28 60 40 46 46 34 C45 42 47 49 51 53 C50 42 48 32 52 26 Z" fill="url(#flame-l1-out)"/>' +
                    '<path d="M50 62 C54 72 63 80 63 92 C63 101 57 106 50 106 C43 106 37 101 37 92 C37 82 43 74 46 68 C46 72 48 76 50 62 Z" fill="url(#flame-l1-in)"/>' +
                    '</svg>';
            case 2:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l2">' +
                    '<path d="M52 22 C58 35 75 50 75 76 C75 97 63 113 50 113 C37 113 27 97 27 76 C27 58 39 44 46 32 C45 41 47 48 51 52 C50 40 48 29 52 22 Z" fill="url(#flame-l2-out)"/>' +
                    '<path d="M29 68 C24 73 21 80 21 87 C21 91 24 95 27 97 C25 94 24 90 24 86 C24 80 27 75 29 68 Z" fill="url(#flame-l2-out)"/>' +
                    '<path d="M50 58 C54 69 64 78 64 90 C64 100 58 107 50 107 C42 107 36 100 36 90 C36 79 43 71 46 65 C46 70 48 74 50 58 Z" fill="url(#flame-l2-in)"/>' +
                    '</svg>';
            case 3:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l3">' +
                    '<path d="M52 18 C59 32 78 47 78 74 C78 96 65 113 51 113 C35 113 25 96 25 74 C25 54 38 40 46 28 C44 38 46 46 51 50 C50 36 48 24 52 18 Z" fill="url(#flame-l3-out)"/>' +
                    '<path d="M26 58 C18 66 14 76 14 86 C14 92 18 98 22 101 C19 97 17 92 17 86 C17 78 21 70 26 58 Z" fill="url(#flame-l3-out)"/>' +
                    '<path d="M51 54 C55 65 65 75 65 89 C65 100 59 107 51 107 C43 107 36 100 36 89 C36 77 43 68 47 62 C47 67 49 72 51 54 Z" fill="url(#flame-l3-in)"/>' +
                    '</svg>';
            case 4:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l4">' +
                    '<path d="M52 14 C60 29 80 45 80 73 C80 96 66 114 51 114 C35 114 24 96 24 73 C24 53 37 38 45 25 C43 36 45 44 50 48 C49 34 47 21 52 14 Z" fill="url(#flame-l4-out)"/>' +
                    '<path d="M25 54 C17 62 13 72 13 83 C13 90 17 97 22 100 C19 95 17 89 17 83 C17 74 21 65 25 54 Z" fill="url(#flame-l4-out)"/>' +
                    '<path d="M76 58 C80 64 82 70 82 78 C82 82 80 86 77 89 C79 86 80 82 80 78 C80 72 78 66 76 58 Z" fill="url(#flame-l4-out)"/>' +
                    '<path d="M51 51 C56 63 66 73 66 88 C66 100 59 107 51 107 C43 107 36 100 36 88 C36 75 42 66 46 59 C46 65 48 70 51 51 Z" fill="url(#flame-l4-in)"/>' +
                    '</svg>';
            case 5:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l5">' +
                    '<path d="M52 12 C61 27 81 44 81 72 C81 96 66 114 51 114 C35 114 23 96 23 72 C23 52 36 37 45 23 C42 35 45 44 50 48 C49 33 46 20 52 12 Z" fill="url(#flame-l5-out)"/>' +
                    '<path d="M24 53 C16 61 12 71 12 82 C12 89 16 96 21 99 C18 94 16 88 16 82 C16 73 20 64 24 53 Z" fill="url(#flame-l5-out)"/>' +
                    '<path d="M77 52 C82 58 85 66 85 75 C85 80 83 85 79 88 C81 85 82 80 82 75 C82 68 79 61 77 52 Z" fill="url(#flame-l5-out)"/>' +
                    '<path d="M51 49 C56 61 67 72 67 87 C67 100 60 108 51 108 C42 108 35 100 35 87 C35 74 42 65 46 58 C46 64 48 70 51 49 Z" fill="url(#flame-l5-in)"/>' +
                    '</svg>';
            case 6:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l6">' +
                    '<path d="M52 11 C61 26 81 43 81 72 C81 96 66 114 51 114 C35 114 23 96 23 72 C23 51 36 36 45 22 C42 34 45 43 50 47 C49 32 46 19 52 11 Z" fill="url(#flame-l6-out)"/>' +
                    '<path d="M24 52 C16 60 12 70 12 81 C12 88 16 95 21 99 C18 94 16 88 16 81 C16 72 20 63 24 52 Z" fill="url(#flame-l6-out)"/>' +
                    '<path d="M78 48 C83 54 86 63 86 73 C86 78 84 83 80 86 C82 83 83 78 83 73 C83 65 80 57 78 48 Z" fill="url(#flame-l6-out)"/>' +
                    '<path d="M51 48 C56 60 67 72 67 87 C67 100 60 108 51 108 C42 108 35 100 35 87 C35 74 42 65 46 58 C46 64 48 69 51 48 Z" fill="url(#flame-l6-in)"/>' +
                    '<circle cx="84" cy="24" r="3.2" fill="#FDE047"/>' +
                    '</svg>';
            case 7:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l7">' +
                    '<path d="M52 10 C61 25 82 43 82 72 C82 96 67 114 51 114 C35 114 23 96 23 72 C23 51 36 36 45 22 C42 34 45 43 50 47 C49 32 46 19 52 10 Z" fill="url(#flame-l7-out)"/>' +
                    '<path d="M24 52 C16 60 12 70 12 81 C12 88 16 95 21 99 C18 94 16 88 16 81 C16 72 20 63 24 52 Z" fill="url(#flame-l7-out)"/>' +
                    '<path d="M78 46 C83 52 87 61 87 72 C87 78 85 83 81 86 C83 83 84 78 84 72 C84 64 81 56 78 46 Z" fill="url(#flame-l7-out)"/>' +
                    '<path d="M51 48 C56 60 67 72 67 87 C67 100 60 108 51 108 C42 108 35 100 35 87 C35 74 42 65 46 58 C46 64 48 69 51 48 Z" fill="url(#flame-l7-in)"/>' +
                    '<circle cx="84" cy="22" r="3.8" fill="#FDE047"/>' +
                    '</svg>';
            case 8:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l8">' +
                    '<path d="M52 7 C61 22 83 40 83 70 C83 95 68 114 51 114 C34 114 22 95 22 70 C22 49 35 34 44 20 C41 32 44 42 49 46 C48 31 45 18 52 7 Z" fill="url(#flame-l8-out)"/>' +
                    '<path d="M23 50 C15 58 11 68 11 80 C11 87 15 94 20 98 C17 93 15 87 15 80 C15 70 19 60 23 50 Z" fill="url(#flame-l8-out)"/>' +
                    '<path d="M27 72 C23 77 21 83 21 90 C21 94 24 98 27 100 C25 97 24 93 24 89 C24 84 26 79 27 72 Z" fill="url(#flame-l8-in)"/>' +
                    '<path d="M78 44 C84 50 88 59 88 70 C88 76 86 82 82 85 C84 82 85 77 85 71 C85 63 82 55 78 44 Z" fill="url(#flame-l8-out)"/>' +
                    '<path d="M51 46 C56 58 68 70 68 85 C68 99 61 107 51 107 C41 107 34 99 34 85 C34 71 41 62 45 55 C45 61 48 67 51 46 Z" fill="url(#flame-l8-in)"/>' +
                    '<circle cx="84" cy="20" r="3.8" fill="#FDE047"/>' +
                    '<circle cx="16" cy="42" r="3.0" fill="#FEF08A"/>' +
                    '</svg>';
            case 9:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l9">' +
                    '<path d="M52 4 C62 18 84 36 84 68 C84 94 69 115 51 115 C33 115 21 94 21 68 C21 47 35 32 44 18 C40 30 44 40 49 44 C48 29 45 16 52 4 Z" fill="url(#flame-l9-out)"/>' +
                    '<path d="M22 48 C14 56 10 66 10 78 C10 86 14 93 19 97 C16 92 14 86 14 78 C14 68 18 58 22 48 Z" fill="url(#flame-l9-out)"/>' +
                    '<path d="M28 70 C24 75 22 81 22 88 C22 92 25 96 28 99 C26 96 25 92 25 88 C25 83 27 78 28 70 Z" fill="url(#flame-l9-in)" opacity="0.9"/>' +
                    '<path d="M78 44 C84 50 88 58 88 68 C88 74 86 80 82 84 C84 80 85 75 85 70 C85 62 82 56 78 44 Z" fill="url(#flame-l9-out)"/>' +
                    '<path d="M51 44 C56 56 68 68 68 84 C68 98 61 106 51 106 C41 106 34 98 34 84 C34 70 41 61 45 54 C45 60 48 66 51 44 Z" fill="url(#flame-l9-in)"/>' +
                    '<circle cx="84" cy="18" r="4.0" fill="#FDE047"/>' +
                    '<circle cx="14" cy="40" r="3.2" fill="#FEF08A"/>' +
                    '<circle cx="90" cy="62" r="2.6" fill="#FBBF24"/>' +
                    '</svg>';
            case 10:
            default:
                return '<svg viewBox="0 0 100 120" class="flame-svg flame-svg-l10">' +
                    '<path d="M52 2 C63 16 88 34 88 66 C88 90 73 116 51 116 C29 116 15 90 15 66 C15 45 32 29 42 15 C38 27 42 37 48 41 C48 25 44 13 52 2 Z" fill="url(#flame-l10-out)"/>' +
                    '<path d="M20 44 C12 52 8 63 8 76 C8 85 13 93 18 97 C15 92 13 85 13 77 C13 66 17 55 20 44 Z" fill="url(#flame-l10-out)"/>' +
                    '<path d="M26 66 C21 72 18 79 18 87 C18 92 21 97 25 100 C23 97 22 93 22 88 C22 82 24 76 26 66 Z" fill="url(#flame-l10-in)"/>' +
                    '<path d="M78 38 C86 46 90 56 90 68 C90 76 87 83 83 87 C86 83 87 77 87 70 C87 60 83 52 78 38 Z" fill="url(#flame-l10-out)"/>' +
                    '<path d="M72 62 C77 68 80 75 80 83 C80 87 78 91 75 94 C77 91 78 88 78 84 C78 79 75 73 72 62 Z" fill="url(#flame-l10-in)"/>' +
                    '<path d="M51 40 C57 53 71 66 71 84 C71 99 63 108 51 108 C39 108 31 99 31 84 C31 69 39 59 44 51 C44 58 47 64 51 40 Z" fill="url(#flame-l10-in)"/>' +
                    '<circle cx="88" cy="18" r="4.2" fill="#FDE047"/>' +
                    '<circle cx="10" cy="36" r="3.5" fill="#FEF08A"/>' +
                    '<circle cx="92" cy="66" r="2.8" fill="#FBBF24"/>' +
                    '<circle cx="14" cy="80" r="2.2" fill="#FDE047"/>' +
                    '</svg>';
        }
    }

    /**
     * 更新页面所有连续打卡卡片上的火苗图标及悬浮提示
     * @param {number|string} count 
     */
    function updateFlame(count) {
        const stage = getFlameStage(count);
        const svgHtml = getFlameSvgHtml(stage.level);
        document.querySelectorAll('.streak-flame-box, #streak-flame-wrap').forEach(el => {
            el.innerHTML = svgHtml;
            el.setAttribute('title', stage.stageText);
        });
    }

    /**
     * 点击火焰图标逐级切换预览火候 (1 -> 2 -> 3 -> 5 -> 7 -> 10 -> 14 -> 21 -> 25 -> 30)
     */
    const PREVIEW_STREAK_STAGES = [1, 2, 3, 5, 7, 10, 14, 21, 25, 30];
    function cycleFlameStageForPreview(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const currentNumEl = document.getElementById('dashboard-streak-number');
        const currentCount = currentNumEl ? (parseInt(currentNumEl.textContent, 10) || 0) : 1;
        const currentIdx = PREVIEW_STREAK_STAGES.indexOf(currentCount);

        let nextCount = 1;
        if (currentIdx === -1) {
            nextCount = 1;
        } else {
            const nextIdx = (currentIdx + 1) % PREVIEW_STREAK_STAGES.length;
            nextCount = PREVIEW_STREAK_STAGES[nextIdx];
        }

        // 同步所有打卡天数显示
        document.querySelectorAll('#dashboard-streak-number, .home-streak-number-bind').forEach(el => {
            el.textContent = nextCount;
        });

        // 渲染新火苗
        updateFlame(nextCount);

        // 微触弹跳动画
        document.querySelectorAll('.streak-flame-box, #streak-flame-wrap').forEach(box => {
            box.style.transform = 'scale(1.28)';
            setTimeout(() => { box.style.transform = ''; }, 220);
        });
    }

    function initDashboardCarousel() {
        const container = document.getElementById('split-carousel-container');
        const track = document.getElementById('split-carousel-track');
        if (!container || !track) return;

        const currentNumEl = document.getElementById('dashboard-streak-number');
        const realStreak = (window.HabitStreak && typeof window.HabitStreak.calculateConsecutiveStreak === 'function')
            ? window.HabitStreak.calculateConsecutiveStreak()
            : (currentNumEl ? (parseInt(currentNumEl.textContent, 10) || 1) : 1);
        if (currentNumEl) currentNumEl.textContent = Math.max(1, realStreak);
        updateFlame(Math.max(1, realStreak));

        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
        if (!container.dataset.bentoFlameBound) {
            container.dataset.bentoFlameBound = '1';
            container.addEventListener('click', (e) => {
                const streakCard = e.target.closest('#card-streak-hero, .streak-flame-box');
                if (streakCard) {
                    document.querySelectorAll('.streak-flame-box, #streak-flame-wrap').forEach(box => {
                        box.style.transform = 'scale(1.18)';
                        setTimeout(() => { box.style.transform = ''; }, 220);
                    });
                }
            });
        }
    }

    window.updateDashboardFlame = updateFlame;
    window.cycleFlameStageForPreview = cycleFlameStageForPreview;
    window.goToDashboardCard = function() {};
    window.goToDashboardSlide = function() {};
    window.nextDashboardSlide = function() {};
    window.prevDashboardSlide = function() {};
    window.initDashboardCarousel = initDashboardCarousel;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardCarousel);
    } else {
        setTimeout(initDashboardCarousel, 30);
    }
})();
