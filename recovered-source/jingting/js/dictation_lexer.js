/* === js/dictation_lexer.js === */
// ==========================================================================
// Dictation State Store, Smart Blanking Lexer & Cloze DOM Fusion (js/dictation_lexer.js)
// ==========================================================================

let currentDictExamTitle = '';
let currentDictSentences = [];
let currentDictIndex = 0;
let dictPlaybackRate = 1.0;
let isDictZhVisible = false;
let dictHintLevel = 0;
let dictSkeletonModeActive = false;
let dictAnswerModeActive = false;
let dictAudioTimeUpdateHandler = null;
let dictationStreak = 0;
let dictDifficultyMode = 'basic';
let currentSentenceChosenIndices = null;
let lastRenderedSentIdx = -1;

try {
    const savedMode = window.__toyLS.getItem('toy_dict_difficulty_mode');
    if (savedMode === 'advanced' || savedMode === 'basic') {
        dictDifficultyMode = savedMode;
    }
} catch (e) {}

// Expose shared dictation state on window via bidirectional getters/setters
(function bridgeDictationStateToWindow() {
    const bindings = {
        currentDictExamTitle: [() => currentDictExamTitle, (v) => { currentDictExamTitle = v; }],
        currentDictSentences: [() => currentDictSentences, (v) => { currentDictSentences = v; }],
        currentDictIndex: [() => currentDictIndex, (v) => { currentDictIndex = v; }],
        dictPlaybackRate: [() => dictPlaybackRate, (v) => { dictPlaybackRate = v; }],
        isDictZhVisible: [() => isDictZhVisible, (v) => { isDictZhVisible = v; }],
        dictHintLevel: [() => dictHintLevel, (v) => { dictHintLevel = v; }],
        dictSkeletonModeActive: [() => dictSkeletonModeActive, (v) => { dictSkeletonModeActive = v; }],
        dictAnswerModeActive: [() => dictAnswerModeActive, (v) => { dictAnswerModeActive = v; }],
        dictAudioTimeUpdateHandler: [() => dictAudioTimeUpdateHandler, (v) => { dictAudioTimeUpdateHandler = v; }],
        dictationStreak: [() => dictationStreak, (v) => { dictationStreak = v; }],
        dictDifficultyMode: [() => dictDifficultyMode, (v) => { dictDifficultyMode = v; }],
        currentSentenceChosenIndices: [() => currentSentenceChosenIndices, (v) => { currentSentenceChosenIndices = v; }],
        lastRenderedSentIdx: [() => lastRenderedSentIdx, (v) => { lastRenderedSentIdx = v; }]
    };
    Object.keys(bindings).forEach((key) => {
        try {
            Object.defineProperty(window, key, {
                get: bindings[key][0],
                set: bindings[key][1],
                configurable: true
            });
        } catch (e) {
            window[key] = bindings[key][0]();
        }
    });
})();

const DICT_STOP_WORDS = new Set([
    'the', 'and', 'with', 'from', 'that', 'this', 'have', 'were', 'been', 'what', 'when',
    'where', 'which', 'who', 'whom', 'whose', 'does', 'did', 'doing', 'your', 'ours',
    'their', 'there', 'into', 'onto', 'over', 'under', 'about', 'after', 'before',
    'will', 'would', 'could', 'should', 'might', 'must', 'they', 'them', 'these', 'those',
    'some', 'many', 'more', 'most', 'such', 'only', 'very', 'just', 'also', 'than',
    'then', 'here', 'both', 'each', 'other', 'being', 'having', 'first', 'second',
    'is', 'am', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
    'an', 'a', 'or', 'but', 'nor', 'so', 'yet', 'it', 'its', 'as', 'if'
]);

// Proper Nouns, Places, Countries, Cities, Months, Days, Names Dictionary
const PROPER_NOUNS_AND_PLACES = new Set([
    // Honorifics / Titles
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'madam', 'lady', 'lord',
    // Days of the week & Months
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    // Countries, Continents, Regions & Nationalities
    'america', 'american', 'americans', 'britain', 'british', 'england', 'english', 'france', 'french',
    'germany', 'german', 'germans', 'china', 'chinese', 'japan', 'japanese', 'russia', 'russian', 'russians',
    'canada', 'canadian', 'canadians', 'australia', 'australian', 'australians', 'india', 'indian', 'indians',
    'africa', 'african', 'africans', 'asia', 'asian', 'asians', 'europe', 'european', 'europeans',
    'italy', 'italian', 'spain', 'spanish', 'brazil', 'brazilian', 'mexico', 'mexican', 'egypt', 'egyptian',
    // Major Cities & Geographical Landmarks
    'london', 'paris', 'tokyo', 'beijing', 'shanghai', 'washington', 'york', 'boston', 'chicago', 'california',
    'texas', 'florida', 'oxford', 'cambridge', 'harvard', 'stanford', 'seattle', 'sydney', 'rome', 'berlin',
    // Common First & Last Names (Comprehensive Coverage)
    'leo', 'peter', 'lucy', 'tom', 'mike', 'jack', 'jerry', 'kate', 'lily', 'sam', 'bob', 'ben', 'dan', 'tim',
    'jim', 'joe', 'ron', 'bill', 'ted', 'max', 'ned', 'ken', 'roy', 'guy', 'ian', 'luke', 'paul', 'mark',
    'eric', 'alex', 'tony', 'andy', 'adam', 'alan', 'brian', 'chris', 'clark', 'colin', 'craig', 'derek',
    'eddie', 'elvis', 'frank', 'gavin', 'george', 'harry', 'henry', 'isaac', 'jason', 'kevin', 'lucas', 'mason',
    'noah', 'oliver', 'oscar', 'philip', 'ralph', 'roger', 'simon', 'steve', 'terry', 'victor', 'wayne',
    'alexander', 'benjamin', 'charles', 'daniel', 'edward', 'felix', 'gabriel', 'harrison', 'julian', 'louis',
    'marcus', 'nathan', 'patrick', 'richard', 'samuel', 'vincent', 'zachary', 'chloe', 'ella', 'mia', 'zoe',
    'clara', 'eva', 'nora', 'stella', 'ruby', 'hazel', 'ellie', 'violet', 'aurora', 'savannah', 'audrey',
    'brooklyn', 'bella', 'claire', 'skylar', 'paisley', 'everly', 'caroline', 'nova', 'genesis', 'emilia',
    'kennedy', 'maya', 'madelyn', 'elena', 'allison', 'gabriella', 'cora', 'serenity', 'autumn', 'adeline',
    'hailey', 'gianna', 'valentina', 'isla', 'eliana', 'quinn', 'nevaeh', 'ivy', 'sadie', 'piper', 'lydia',
    'alexa', 'josephine', 'emery', 'delilah', 'arianna', 'vivian', 'kaylee', 'sophie', 'brielle', 'madeline',
    'john', 'david', 'michael', 'james', 'robert', 'william', 'mary', 'patricia', 'jennifer', 'linda', 'elizabeth',
    'barbara', 'susan', 'jessica', 'sarah', 'karen', 'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley',
    'kimberly', 'emily', 'donna', 'michelle', 'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie',
    'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen', 'amy', 'shirley', 'angela', 'helen', 'anna', 'brenda',
    'pamela', 'nicole', 'emma', 'samantha', 'katherine', 'christine', 'debra', 'rachel', 'catherine', 'carolyn',
    'janet', 'ruth', 'maria', 'heather', 'diane', 'virginia', 'julie', 'joyce', 'victoria', 'olivia', 'kelly',
    'christina', 'lauren', 'joan', 'evelyn', 'judith', 'megan', 'cheryl', 'andrea', 'hannah', 'martha', 'jacqueline',
    'frances', 'gloria', 'ann', 'teresa', 'kathryn', 'sara', 'janice', 'jean', 'alice', 'madison', 'doris',
    'abigail', 'julia', 'judy', 'grace', 'denise', 'amber', 'marilyn', 'beverly', 'danielle', 'theresa', 'sophia',
    'marie', 'diana', 'brittany', 'natalie', 'isabella', 'charlotte', 'rose', 'alexis', 'kayla', 'smith', 'johnson',
    'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez',
    'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson',
    'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king',
    'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall', 'rivera',
    'campbell', 'mitchell', 'carter', 'roberts'
]);

function getDictWordStem(w) {
    let s = w.toLowerCase();
    if (s.endsWith('ing') && s.length > 5) return s.slice(0, -3);
    if (s.endsWith('ed') && s.length > 4) return s.slice(0, -2);
    if (s.endsWith('es') && s.length > 4) return s.slice(0, -2);
    if (s.endsWith('s') && s.length > 3 && !s.endsWith('ss')) return s.slice(0, -1);
    if (s.endsWith('ly') && s.length > 4) return s.slice(0, -2);
    return s;
}

window.getDictWordStem = getDictWordStem;

function setDictDifficultyMode(mode) {
    const nextMode = (mode === 'advanced') ? 'advanced' : 'basic';
    const changed = (dictDifficultyMode !== nextMode);
    dictDifficultyMode = nextMode;
    window.dictDifficultyMode = dictDifficultyMode;
    try {
        window.__toyLS.setItem('toy_dict_difficulty_mode', dictDifficultyMode);
    } catch(e) {}
    updateDictModeButtonUI(changed);
}
window.setDictDifficultyMode = setDictDifficultyMode;

function updateDictModeButtonUI(animate = false) {
    const tabBasic = document.getElementById('tab-dict-basic');
    const tabAdv = document.getElementById('tab-dict-advanced');
    if (tabBasic && tabAdv) {
        tabBasic.classList.toggle('active', dictDifficultyMode === 'basic');
        tabAdv.classList.toggle('active', dictDifficultyMode === 'advanced');
        if (window.UXSegmentedGlider) {
            window.UXSegmentedGlider.sync('#header-dict-segmented', animate === true);
        }
    }
}

// (Dual audio accent/repeat settings & modal are modularized in js/dict_audio_engine.js)

window.updateDictModeButtonUI = updateDictModeButtonUI;

/**
 * Smart Proportional Dynamic Blanking Algorithm (基础模式 ~35% / 进阶模式 ~60% 强挑战)
 * - 绝对禁止将人名、地名、专有名词作为挖空
 * - 进阶模式设定严格的最少挖空保底数量
 * - 允许对句子核心实词（如末尾名词、句中形容词等）进行挖空
 */
function selectSmartBlankTokenIndices(rawSentence, mode = dictDifficultyMode, randomSeed = true) {
    const tokens = rawSentence.split(/([a-zA-Z]+(?:[\'\-][a-zA-Z]+)*)/);
    const wordEntries = [];

    tokens.forEach((token, idx) => {
        if (/^[a-zA-Z]+(?:[\'\-][a-zA-Z]+)*$/.test(token)) {
            // Find preceding punctuation to know if this word starts a sentence
            let prevChar = '';
            for (let p = idx - 1; p >= 0; p--) {
                const prev = tokens[p].trim();
                if (prev) {
                    prevChar = prev.slice(-1);
                    break;
                }
            }
            const isAfterSentenceEnd = !prevChar || ['.', '!', '?', ':', ';', '"', '”', '’'].includes(prevChar);

            wordEntries.push({
                tokenIdx: idx,
                word: token,
                lower: token.toLowerCase(),
                pos: wordEntries.length,
                isAfterSentenceEnd: isAfterSentenceEnd
            });
        }
    });

    const totalWords = wordEntries.length;
    if (totalWords === 0) return new Set();

    const isAdvanced = (mode === 'advanced');

    // Strict Tiering: Person names and proper nouns are 100% EXCLUDED from all tiers!
    // 1-letter words ('I', 'a') are strictly demoted to last-resort Tier 4.
    const tier1 = []; // Core Content Words (len >= 3, non-stop, non-name)
    const tier2 = []; // Secondary Words (len >= 3, non-name)
    const tier3 = []; // Short Words (len === 2, non-name, e.g. am, is, in, to, he, we)
    const tier4 = []; // 1-Letter Words (len <= 1, e.g. I, a) - ONLY as absolute last resort
    const seenStems = new Set();

    wordEntries.forEach((entry, i) => {
        const lower = entry.lower;
        const rawWord = entry.word;
        const stem = getDictWordStem(lower);

        // 1. Strict Person Name / Proper Noun Detection
        const isKnownProperNoun = PROPER_NOUNS_AND_PLACES.has(lower);
        const isCapitalized = /^[A-Z][a-zA-Z0-9\'-]*$/.test(rawWord);
        const isMidSentenceCapital = isCapitalized && !entry.isAfterSentenceEnd && i > 0 && lower !== 'i';
        const isPersonNameOrProperNoun = isKnownProperNoun || isMidSentenceCapital;

        if (isPersonNameOrProperNoun) {
            // STRICTLY FORBIDDEN TO BLANK PERSON NAMES
            return;
        }

        // Single letter words ('I', 'a') are NEVER prioritized for blanks
        if (rawWord.length <= 1) {
            tier4.push(entry);
            return;
        }

        const isFirstWord = (i === 0);
        const isStopWord = DICT_STOP_WORDS.has(lower);

        if (!isStopWord && rawWord.length >= 3 && !isFirstWord) {
            if (!seenStems.has(stem)) {
                tier1.push(entry);
                seenStems.add(stem);
            } else {
                tier2.push(entry);
            }
        } else if (rawWord.length >= 3) {
            tier2.push(entry);
        } else if (rawWord.length === 2) {
            tier3.push(entry);
        } else {
            tier4.push(entry);
        }
    });

    const eligibleTotal = tier1.length + tier2.length + tier3.length + tier4.length;
    if (eligibleTotal === 0) {
        // If all words are proper nouns/names, no blanks
        return new Set();
    }

    // Determine target blank count with strict minimum guarantees based on eligible words (excluding 1-letter words if possible)
    const nonSingleCount = tier1.length + tier2.length + tier3.length;
    const baseTotal = nonSingleCount > 0 ? nonSingleCount : eligibleTotal;

    let targetCount = 1;
    if (isAdvanced) {
        if (baseTotal <= 2) targetCount = 1;
        else if (baseTotal === 3) targetCount = 2;
        else if (baseTotal <= 5) targetCount = Math.max(2, Math.round(baseTotal * 0.60));
        else if (baseTotal <= 8) targetCount = Math.max(3, Math.round(baseTotal * 0.55));
        else targetCount = Math.max(4, Math.round(baseTotal * 0.55));
    } else {
        if (baseTotal <= 3) targetCount = 1;
        else if (baseTotal <= 6) targetCount = Math.max(1, Math.round(baseTotal * 0.35));
        else if (baseTotal <= 9) targetCount = Math.max(2, Math.round(baseTotal * 0.35));
        else targetCount = Math.max(3, Math.round(baseTotal * 0.35));
    }
    targetCount = Math.min(targetCount, baseTotal);

    // Helper to pick items with random seed
    function pickFromPool(pool, count) {
        if (pool.length <= count) return [...pool];
        const shuffled = [...pool];
        if (randomSeed) {
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        }
        return shuffled.slice(0, count);
    }

    const chosenEntries = [];

    // Step 1: Pick from Tier 1 (core content words >= 3 letters)
    const fromTier1 = pickFromPool(tier1, targetCount);
    chosenEntries.push(...fromTier1);

    // Step 2: Pick from Tier 2 (secondary words >= 3 letters)
    if (chosenEntries.length < targetCount) {
        const remainingNeeded = targetCount - chosenEntries.length;
        const fromTier2 = pickFromPool(tier2.filter(e => !chosenEntries.includes(e)), remainingNeeded);
        chosenEntries.push(...fromTier2);
    }

    // Step 3: Pick from Tier 3 (2-letter words)
    if (chosenEntries.length < targetCount) {
        const remainingNeeded = targetCount - chosenEntries.length;
        const fromTier3 = pickFromPool(tier3.filter(e => !chosenEntries.includes(e)), remainingNeeded);
        chosenEntries.push(...fromTier3);
    }

    // Step 4: ONLY if there are literally zero other words available, pick from Tier 4 (1-letter words)
    if (chosenEntries.length < targetCount && chosenEntries.length === 0) {
        const remainingNeeded = targetCount - chosenEntries.length;
        const fromTier4 = pickFromPool(tier4.filter(e => !chosenEntries.includes(e)), remainingNeeded);
        chosenEntries.push(...fromTier4);
    }

    // Sort selected blanks in natural sentence order
    chosenEntries.sort((a, b) => a.tokenIdx - b.tokenIdx);

    const resultSet = new Set();
    chosenEntries.forEach(e => resultSet.add(e.tokenIdx));
    return resultSet;
}
window.selectSmartBlankTokenIndices = selectSmartBlankTokenIndices;

function showPauseBreathingToast() {}
function removePauseBreathingToast() {}

function getHintPlaceholder(token) {
    if (!token) return '';
    if (token.length <= 2) return token;
    return `${token[0]}  ${token[token.length - 1]}`;
}

function measureClozeWordWidth(word) {
    if (!word) return 56;
    const isMobile = (typeof window !== 'undefined' && (window.innerWidth <= 600 || document.body.classList.contains('pc-phone-frame-mode')));
    const isLandscape = (typeof document !== 'undefined') && (
        document.documentElement.getAttribute('data-toy-orientation') === 'landscape' ||
        document.body.classList.contains('is-landscape')
    );

    let fontSize = isLandscape ? 15.5 : (isMobile ? 26 : 30);
    let fontFamily = '"Inter", "Noto Sans SC", "Source Han Sans SC", "LXGW WenKai GB Screen", sans-serif';
    let fontWeight = '500';
    let letterSpacing = 'normal';

    const clozeCard = (typeof document !== 'undefined') ? document.getElementById('dict-cloze-card') : null;
    if (clozeCard && typeof window.getComputedStyle === 'function') {
        try {
            const cs = window.getComputedStyle(clozeCard);
            const parsedFs = parseFloat(cs.fontSize);
            if (parsedFs && parsedFs > 10) fontSize = parsedFs;
            if (cs.fontFamily) fontFamily = cs.fontFamily;
            if (cs.fontWeight) fontWeight = cs.fontWeight;
            if (cs.letterSpacing) letterSpacing = cs.letterSpacing;
        } catch (e) {}
    }

    // 1. Canvas measurement with "Inter" included
    const canvas = measureClozeWordWidth.canvas || (measureClozeWordWidth.canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const canvasMeasured = ctx.measureText(word).width;

    // 2. Real DOM span measurement to capture exact webfont & subpixel advance widths
    let domMeasured = 0;
    if (typeof document !== 'undefined' && document.body) {
        try {
            let span = measureClozeWordWidth._span;
            if (!span || !document.body.contains(span)) {
                span = document.createElement('span');
                span.setAttribute('aria-hidden', 'true');
                span.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;white-space:nowrap;padding:0;margin:0;border:0;';
                document.body.appendChild(span);
                measureClozeWordWidth._span = span;
            }
            span.style.fontFamily = fontFamily;
            span.style.fontSize = `${fontSize}px`;
            span.style.fontWeight = fontWeight;
            span.style.letterSpacing = letterSpacing;
            span.textContent = word;
            domMeasured = span.getBoundingClientRect().width;
        } catch (e) {}
    }

    const measured = Math.max(canvasMeasured, domMeasured);
    // Extra safety buffer for compound/long words (e.g. "six-year-old") and answer/skeleton modes
    const charSafetyBuffer = Math.ceil(word.length * (isLandscape ? 0.6 : 1.0));
    const modeExtra = (dictAnswerModeActive || dictSkeletonModeActive) ? (isLandscape ? 6 : 10) : 0;
    const horizPadding = (isLandscape ? 18 : (isMobile ? 24 : 30)) + charSafetyBuffer + modeExtra;
    const minWidth = isLandscape ? 44 : (isMobile ? 54 : 64);
    return Math.max(minWidth, Math.ceil(measured) + horizPadding);
}

function fuseClozeInputIntoText(input, word) {
    try {
        const wrap = input.closest('.cloze-input-wrap');
        if (!wrap || !wrap.parentNode) return;

        const tokenIdx = parseInt(input.dataset.tokenIdx);
        const sentIdx = parseInt(input.dataset.sentIdx) || currentDictIndex;

        if (!window.currentSentenceSolvedTokens) {
            window.currentSentenceSolvedTokens = {};
        }
        if (!window.currentSentenceSolvedTokens[sentIdx]) {
            window.currentSentenceSolvedTokens[sentIdx] = new Set();
        }
        if (!isNaN(tokenIdx)) {
            window.currentSentenceSolvedTokens[sentIdx].add(tokenIdx);
        }

        const doneSpan = document.createElement('span');
        doneSpan.className = 'cloze-word-done';
        if (wrap.classList.contains('cloze-has-punct')) {
            doneSpan.classList.add('cloze-has-punct');
        }
        doneSpan.dataset.tokenIdx = String(tokenIdx);
        doneSpan.dataset.sentIdx = String(sentIdx);
        doneSpan.style.minWidth = `${measureClozeWordWidth(word)}px`;
        doneSpan.style.width = 'auto';
        doneSpan.style.whiteSpace = 'nowrap';
        if (typeof makeTextClickable === 'function') {
            doneSpan.innerHTML = makeTextClickable(word);
        } else {
            doneSpan.textContent = word;
        }

        wrap.parentNode.replaceChild(doneSpan, wrap);
    } catch(err) {
        console.error('[DictationEngine] fuseClozeInputIntoText error:', err);
    }
}

window.getHintPlaceholder = getHintPlaceholder;
window.measureClozeWordWidth = measureClozeWordWidth;
window.fuseClozeInputIntoText = fuseClozeInputIntoText;

function getActiveDictExamLevel() {
    let curLvl = null;
    if (currentDictExamTitle) {
        let meta = (typeof findExamMeta === 'function') ? findExamMeta(currentDictExamTitle) : null;
        curLvl = meta ? meta.level : null;
        if (!curLvl) {
            if (currentDictExamTitle.includes('雅思') || currentDictExamTitle.toLowerCase().includes('ielts')) curLvl = 'ielts';
            else if (currentDictExamTitle.includes('高考')) curLvl = 'gaokao';
            else if (currentDictExamTitle.includes('六级')) curLvl = 'cet6';
            else if (currentDictExamTitle.includes('四级')) curLvl = 'cet4';
        }
    }
    return curLvl || window.currentExamLevel || 'cet4';
}
window.getActiveDictExamLevel = getActiveDictExamLevel;
