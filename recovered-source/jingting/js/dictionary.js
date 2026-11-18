/* === js/dictionary.js === */
/**
 * ==========================================================================
 * Offline Dictionary & Click-to-Lookup Engine (4.4万+ 词库支持)
 * ==========================================================================
 */

let activeHoverTarget = null;
let hoverHideTimeout = null;
let dictMode = false;

const COMPOUND_DICT_MAP = {
    'up-to-date': { d: 'adj. 最新的；及时的；现代的；跟上时代的', us: '[ˌʌp tə ˈdeɪt]', uk: '[ˌʌp tə ˈdeɪt]' },
    'out-of-date': { d: 'adj. 过时的；陈旧的；废弃的', us: '[ˌaʊt əv ˈdeɪt]', uk: '[ˌaʊt əv ˈdeɪt]' },
    'self-doubt': { d: 'n. 自我怀疑；缺乏自信', us: '[ˌself ˈdaʊt]', uk: '[ˌself ˈdaʊt]' },
    'self-esteem': { d: 'n. 自尊心；自尊', us: '[ˌself ɪˈstiːm]', uk: '[ˌself ɪˈstiːm]' },
    'self-confidence': { d: 'n. 自信；自信心', us: '[ˌself ˈkɑːnfɪdəns]', uk: '[ˌself ˈkɒnfɪdəns]' },
    'self-control': { d: 'n. 自我控制；自制力', us: '[ˌself kənˈtroʊl]', uk: '[ˌself kənˈtrəʊl]' },
    'self-conscious': { d: 'adj. 局促不安的；不自然的', us: '[ˌself ˈkɑːnʃəs]', uk: '[ˌself ˈkɒnʃəs]' },
    'well-known': { d: 'adj. 著名的；众所周知的', us: '[ˌwel ˈnoʊn]', uk: '[ˌwel ˈnəʊn]' },
    'well-being': { d: 'n. 幸福；康乐；安康', us: '[ˌwel ˈbiːɪŋ]', uk: '[ˌwel ˈbiːɪŋ]' },
    'well-educated': { d: 'adj. 受过良好教育的', us: '[ˌwel ˈedʒukeɪtɪd]', uk: '[ˌwel ˈedʒukeɪtɪd]' },
    'part-time': { d: 'adj./adv. 兼职的（地）；部分时间的', us: '[ˌpɑːrt ˈtaɪm]', uk: '[ˌpɑːt ˈtaɪm]' },
    'full-time': { d: 'adj./adv. 全职的（地）；全日制的', us: '[ˌfʊl ˈtaɪm]', uk: '[ˌfʊl ˈtaɪm]' },
    'long-term': { d: 'adj. 长期的；长远的', us: '[ˌlɔːŋ ˈtɜːrm]', uk: '[ˌlɒŋ ˈtɜːm]' },
    'short-term': { d: 'adj. 短期的；近期的', us: '[ˌʃɔːrt ˈtɜːrm]', uk: '[ˌʃɔːt ˈtɜːm]' },
    'hard-working': { d: 'adj. 勤奋的；努力工作的', us: '[ˌhɑːrd ˈwɜːrkɪŋ]', uk: '[ˌhɑːd ˈwɜːkɪŋ]' },
    'easy-going': { d: 'adj. 随和的；好相处的；悠闲的', us: '[ˌiːzi ˈɡoʊɪŋ]', uk: '[ˌiːzi ˈɡəʊɪŋ]' },
    'open-minded': { d: 'adj. 思想开明的；虚心的', us: '[ˌoʊpən ˈmaɪndɪd]', uk: '[ˌəʊpən ˈmaɪndɪd]' },
    'face-to-face': { d: 'adj./adv. 面对面的（地）', us: '[ˌfeɪs tə ˈfeɪs]', uk: '[ˌfeɪs tə ˈfeɪs]' },
    'step-by-step': { d: 'adj./adv. 逐步的（地）；按部就班的', us: '[ˌstep baɪ ˈstep]', uk: '[ˌstep baɪ ˈstep]' },
    'day-to-day': { d: 'adj. 日常的；天天的', us: '[ˌdeɪ tə ˈdeɪ]', uk: '[ˌdeɪ tə ˈdeɪ]' },
    'world-famous': { d: 'adj. 举世闻名的；世界著名的', us: '[ˌwɜːrld ˈfeɪməs]', uk: '[ˌwɜːld ˈfeɪməs]' },
    'first-class': { d: 'adj./adv. 头等的；第一流的', us: '[ˌfɜːrst ˈklæs]', uk: '[ˌfɜːst ˈklɑːs]' },
    'high-tech': { d: 'adj. 高科技的；尖端技术的', us: '[ˌhaɪ ˈtek]', uk: '[ˌhaɪ ˈtek]' },
    'state-of-the-art': { d: 'adj. 最先进的；前沿的', us: '[ˌsteɪt əv ði ˈɑːrt]', uk: '[ˌsteɪt əv ði ˈɑːt]' },
    'eco-friendly': { d: 'adj. 环保的；对生态环境无害的', us: '[ˌiːkoʊ ˈfrendli]', uk: '[ˌiːkəʊ ˈfrendli]' },
    'peer-reviewed': { d: 'adj. 同行评审的', us: '[ˌpɪr rɪˈvjuːd]', uk: '[ˌpɪə rɪˈvjuːd]' },
    'middle-aged': { d: 'adj. 中年的', us: '[ˌmɪdl ˈeɪdʒd]', uk: '[ˌmɪdl ˈeɪdʒd]' },
    'far-reaching': { d: 'adj. 影响深远的', us: '[ˌfɑːr ˈriːtʃɪŋ]', uk: '[ˌfɑː ˈriːtʃɪŋ]' },
    'all-inclusive': { d: 'adj. 全包的；包括一切的', us: '[ˌɔːl ɪnˈkluːsɪv]', uk: '[ˌɔːl ɪnˈkluːsɪv]' },
    'cutting-edge': { d: 'adj. 尖端的；前沿的', us: '[ˌkʌtɪŋ ˈedʒ]', uk: '[ˌkʌtɪŋ ˈedʒ]' },
    'brand-new': { d: 'adj. 崭新的；全新的', us: '[ˌbrænd ˈnuː]', uk: '[ˌbrænd ˈnjuː]' },
    'problem-solving': { d: 'n./adj. 解决问题（的）', us: '[ˈprɑːbləm sɑːlvɪŋ]', uk: '[ˈprɒbləm sɒlvɪŋ]' },
    'decision-making': { d: 'n./adj. 决策；决策制定', us: '[dɪˈsɪʒn meɪkɪŋ]', uk: '[dɪˈsɪʒn meɪkɪŋ]' },
    'heart-warming': { d: 'adj. 暖心的；令人欣慰的', us: '[ˈhɑːrtwɔːrmɪŋ]', uk: '[ˈhɑːtwɔːmɪŋ]' },
    'cost-effective': { d: 'adj. 性价比高的；合算的', us: '[ˌkɔːst ɪˈfektɪv]', uk: '[ˌkɒst ɪˈfektɪv]' },
    'energy-saving': { d: 'adj. 节能的；节省能源的', us: '[ˈenərdʒi seɪvɪŋ]', uk: '[ˈenədʒi seɪvɪŋ]' },
    'time-consuming': { d: 'adj. 耗费时间的；费时的', us: '[ˈtaɪm kənsuːmɪŋ]', uk: '[ˈtaɪm kənsjuːmɪŋ]' },
    'eye-catching': { d: 'adj. 引人注目的；耀眼的', us: '[ˈaɪ kætʃɪŋ]', uk: '[ˈaɪ kætʃɪŋ]' },
    'thought-provoking': { d: 'adj. 发人深省的；引起深思的', us: '[ˈθɔːt prəvoʊkɪŋ]', uk: '[ˈθɔːt prəvəʊkɪŋ]' },
    'user-friendly': { d: 'adj. 用户友好的；易于使用的', us: '[ˌjuːzər ˈfrendli]', uk: '[ˌjuːzə ˈfrendli]' },
    'record-breaking': { d: 'adj. 破纪录的', us: '[ˈrekərd breɪkɪŋ]', uk: '[ˈrekɔːd breɪkɪŋ]' },
    'over-the-counter': { d: 'adj. 非处方的；柜台直接购买的', us: '[ˌoʊvər ðə ˈkaʊntər]', uk: '[ˌəʊvə ðə ˈkaʊntə]' }
};

let isDictLoading = false;
let isDictLoaded = false;
let dictLoadPromise = null;

function ensureDictionaryLoaded() {
    if (window.DICT_MAP && typeof window.DICT_MAP === 'object') {
        isDictLoaded = true;
        return Promise.resolve(window.DICT_MAP);
    }
    if (dictLoadPromise) {
        return dictLoadPromise;
    }

    isDictLoading = true;
    dictLoadPromise = new Promise((resolve, reject) => {
        const notifyBridgeBackfill = () => {
            if (window.VocabNotebookBridge && typeof window.VocabNotebookBridge.backfillMissingDefinitions === 'function') {
                try { window.VocabNotebookBridge.backfillMissingDefinitions(); } catch (e) {}
            }
        };

        // 1. If window.DICT_MAP already exists
        if (window.DICT_MAP && typeof window.DICT_MAP === 'object') {
            isDictLoaded = true;
            isDictLoading = false;
            notifyBridgeBackfill();
            resolve(window.DICT_MAP);
            return;
        }

        const hasValidDictMap = () => Boolean(
            window.DICT_MAP &&
            typeof window.DICT_MAP === 'object' &&
            Object.keys(window.DICT_MAP).length > 0
        );

        // 2. Check if dictionary_data.js script is already in DOM
        const existingScript = document.querySelector('script[src*="dictionary_data.js"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => {
                if (hasValidDictMap()) {
                    isDictLoaded = true;
                    isDictLoading = false;
                    notifyBridgeBackfill();
                    resolve(window.DICT_MAP);
                } else {
                    isDictLoaded = false;
                    isDictLoading = false;
                    dictLoadPromise = null;
                    try { existingScript.remove(); } catch (e) {}
                    reject(new Error('DICT_MAP empty or invalid after script load'));
                }
            });
            existingScript.addEventListener('error', (err) => {
                isDictLoaded = false;
                isDictLoading = false;
                dictLoadPromise = null;
                try { existingScript.remove(); } catch (e) {}
                reject(err);
            });
            return;
        }

        // 3. Fallback: dynamically load local dictionary_data.js from package
        const script = document.createElement('script');
        script.src = window.__TOY_DICT_URL || 'dictionary_data.js';
        script.async = true;
        script.onload = () => {
            if (hasValidDictMap()) {
                isDictLoaded = true;
                isDictLoading = false;
                notifyBridgeBackfill();
                resolve(window.DICT_MAP);
            } else {
                isDictLoaded = false;
                isDictLoading = false;
                dictLoadPromise = null;
                try { script.remove(); } catch (e) {}
                reject(new Error('DICT_MAP empty or invalid after script load'));
            }
        };
        script.onerror = (err) => {
            isDictLoaded = false;
            isDictLoading = false;
            dictLoadPromise = null;
            try { script.remove(); } catch (e) {}
            reject(err);
        };
        document.head.appendChild(script);
    });

    return dictLoadPromise;
}

// Graceful background idle preload:
// Triggers gently after user opens the page and browser finishes rendering the lobby.
// By the time the user clicks into an exam and selects questions, the dictionary is already quietly ready.
if (typeof window !== 'undefined') {
    const triggerGentlePreload = () => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => {
                ensureDictionaryLoaded().catch(() => {});
            }, { timeout: 5000 });
        } else {
            setTimeout(() => {
                ensureDictionaryLoaded().catch(() => {});
            }, 2500);
        }
    };

    if (document.readyState === 'complete') {
        setTimeout(triggerGentlePreload, 1500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(triggerGentlePreload, 1500);
        });
    }
}

function hasOwnDictKey(obj, key) {
    return Boolean(obj && typeof obj === 'object' && key !== '__proto__' && Object.prototype.hasOwnProperty.call(obj, key));
}

const IRREGULAR_HEADWORD_MAP = Object.assign(Object.create(null), {
    went: 'go', gone: 'go', goes: 'go',
    took: 'take', taken: 'take',
    bought: 'buy', thought: 'think', taught: 'teach', caught: 'catch',
    brought: 'bring', sought: 'seek', fought: 'fight',
    wrote: 'write', written: 'write',
    spoke: 'speak', spoken: 'speak',
    broke: 'break', broken: 'break',
    chose: 'choose', chosen: 'choose',
    drove: 'drive', driven: 'drive',
    rode: 'ride', ridden: 'ride',
    rose: 'rise', risen: 'rise', arose: 'arise', arisen: 'arise',
    grew: 'grow', grown: 'grow', knew: 'know', known: 'know',
    threw: 'throw', thrown: 'throw', blew: 'blow', blown: 'blow',
    flew: 'fly', flown: 'fly', drew: 'draw', drawn: 'draw',
    withdrew: 'withdraw', withdrawn: 'withdraw',
    wore: 'wear', worn: 'wear', tore: 'tear', torn: 'tear',
    swore: 'swear', sworn: 'swear', bore: 'bear', borne: 'bear',
    began: 'begin', begun: 'begin', sang: 'sing', sung: 'sing',
    sank: 'sink', sunk: 'sink', swam: 'swim', swum: 'swim',
    rang: 'ring', rung: 'ring', drank: 'drink', drunk: 'drink',
    shrank: 'shrink', shrunk: 'shrink', sprang: 'spring', sprung: 'spring',
    ran: 'run', came: 'come', became: 'become', overcame: 'overcome',
    ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall',
    gave: 'give', given: 'give', forgave: 'forgive', forgiven: 'forgive',
    forbade: 'forbid', forbidden: 'forbid', forgot: 'forget', forgotten: 'forget',
    got: 'get', gotten: 'get', saw: 'see', seen: 'see',
    hid: 'hide', hidden: 'hide', bit: 'bite', bitten: 'bite',
    shook: 'shake', shaken: 'shake',
    mistook: 'mistake', mistaken: 'mistake',
    undertook: 'undertake', undertaken: 'undertake',
    withheld: 'withhold',
    led: 'lead', held: 'hold', told: 'tell', sold: 'sell',
    paid: 'pay', laid: 'lay', said: 'say', made: 'make',
    stood: 'stand', understood: 'understand',
    lost: 'lose', won: 'win', built: 'build',
    spent: 'spend', sent: 'send', lent: 'lend', meant: 'mean',
    kept: 'keep', slept: 'sleep', felt: 'feel', left: 'leave',
    met: 'meet', sat: 'sit', shot: 'shoot',
    woke: 'wake', woken: 'wake', stole: 'steal', stolen: 'steal',
    froze: 'freeze', frozen: 'freeze',
    children: 'child', men: 'man', women: 'woman',
    feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose', oxen: 'ox',
    phenomena: 'phenomenon', criteria: 'criterion',
    analyses: 'analysis', crises: 'crisis', theses: 'thesis',
    hypotheses: 'hypothesis', diagnoses: 'diagnosis',
    emphases: 'emphasis', syntheses: 'synthesis',
    stimuli: 'stimulus', fungi: 'fungus', alumni: 'alumnus',
    nuclei: 'nucleus', curricula: 'curriculum',
    wolves: 'wolf', knives: 'knife', wives: 'wife', lives: 'life',
    halves: 'half', leaves: 'leaf', shelves: 'shelf', thieves: 'thief',
    loaves: 'loaf', calves: 'calf', scarves: 'scarf'
});

const INFLECTION_STUB_RE = /(?:过去式|过去分词|现在分词|复数|第三人称单数|比较级|最高级)/;

function makeSafeVocabStem(word) {
    if (!word) return 'word';
    const stem = String(word)
        .trim()
        .toLowerCase()
        .replace(/[^\w-]/g, '_')
        .replace(/-/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return (!stem || stem === '__proto__') ? 'word' : stem;
}

function getDictEntry(wordKey) {
    if (!wordKey) return null;
    const clean = wordKey.trim().toLowerCase();
    if (!clean || clean === '__proto__') return null;
    if (hasOwnDictKey(COMPOUND_DICT_MAP, clean)) return COMPOUND_DICT_MAP[clean];
    if (window.DICT_MAP && hasOwnDictKey(window.DICT_MAP, clean)) {
        return window.DICT_MAP[clean];
    }
    const noHyphen = clean.replace(/-/g, '');
    if (window.DICT_MAP && hasOwnDictKey(window.DICT_MAP, noHyphen)) {
        return window.DICT_MAP[noHyphen];
    }
    const spaceKey = clean.replace(/-/g, ' ');
    if (window.DICT_MAP && hasOwnDictKey(window.DICT_MAP, spaceKey)) {
        return window.DICT_MAP[spaceKey];
    }
    return null;
}

function resolveCanonicalWordEntry(rawWord) {
    if (!rawWord) return null;
    // 先剥离首尾标点以及名词所有格 's / ’s / 词尾撇号（如 researcher's / researchers'）
    const clean = String(rawWord)
        .trim()
        .toLowerCase()
        .replace(/^(?:[^a-z0-9]+)|(?:[^a-z0-9']+)$/g, '')
        .replace(/(?:'s|\u2019s|'|\u2019)$/i, '')
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (!clean || clean === '__proto__') return null;

    const tryCandidate = (cand) => {
        if (!cand || cand.length < 2 || cand === '__proto__') return null;
        const e = getDictEntry(cand);
        return e ? { headword: cand, entry: e } : null;
    };

    let matched = tryCandidate(clean);

    // 若直接命中的是不规则变形（如 bought: "v. buy的过去式"），优先归一到标准原型词头，使生词本直接对齐单词Toy主词条
    if (hasOwnDictKey(IRREGULAR_HEADWORD_MAP, clean)) {
        const lemma = IRREGULAR_HEADWORD_MAP[clean];
        const lemmaMatch = tryCandidate(lemma);
        if (lemmaMatch && (!matched || INFLECTION_STUB_RE.test(String(matched.entry.d || '')))) {
            matched = lemmaMatch;
        }
    }

    if (!matched && clean.endsWith('ves') && clean.length > 4) {
        matched = tryCandidate(clean.slice(0, -3) + 'f') || tryCandidate(clean.slice(0, -3) + 'fe');
    }
    if (!matched && clean.endsWith('ies') && clean.length > 4) {
        matched = tryCandidate(clean.slice(0, -3) + 'y');
    }
    if (!matched && clean.endsWith('es') && clean.length > 3) {
        matched = tryCandidate(clean.slice(0, -2)) || tryCandidate(clean.slice(0, -1));
    }
    if (!matched && clean.endsWith('s') && !clean.endsWith('ss') && clean.length > 2) {
        matched = tryCandidate(clean.slice(0, -1));
    }
    if (!matched && clean.endsWith('ied') && clean.length > 4) {
        matched = tryCandidate(clean.slice(0, -3) + 'y');
    }
    if (!matched && clean.endsWith('ed') && clean.length > 3) {
        matched = tryCandidate(clean.slice(0, -1)) ||
                  tryCandidate(clean.slice(0, -2)) ||
                  (clean.length > 5 && clean[clean.length - 3] === clean[clean.length - 4] ? tryCandidate(clean.slice(0, -3)) : null);
    }
    if (!matched && clean.endsWith('ing') && clean.length > 4) {
        matched = tryCandidate(clean.slice(0, -3) + 'e') ||
                  tryCandidate(clean.slice(0, -3)) ||
                  (clean.length > 6 && clean[clean.length - 4] === clean[clean.length - 5] ? tryCandidate(clean.slice(0, -4)) : null);
    }
    if (!matched && clean.endsWith('ly') && clean.length > 4) {
        matched = tryCandidate(clean.slice(0, -2)) ||
                  (clean.endsWith('ily') ? tryCandidate(clean.slice(0, -3) + 'y') : null);
    }

    if (!matched && clean.includes('-')) {
        const parts = clean.split('-').filter(Boolean);
        const partEntries = parts.map(p => ({ word: p, entry: getDictEntry(p) })).filter(p => p.entry);
        if (partEntries.length > 0) {
            matched = {
                headword: clean,
                entry: {
                    d: partEntries.map(p => `phrase. 【${p.word}】${p.entry.d}`).join(' '),
                    us: partEntries[0].entry.us || partEntries[0].entry.p || '',
                    uk: partEntries[0].entry.uk || partEntries[0].entry.p || ''
                }
            };
        }
    }

    if (!matched) return null;
    const entry = matched.entry;
    const headword = matched.headword;
    const wordId = makeSafeVocabStem(headword);
    const rawPhonetic = entry.p || entry.us || entry.uk || '';
    const cleanPhonetic = rawPhonetic ? `[${rawPhonetic.replace(/[\[\]\/]/g, '')}]` : '';
    const posMatch = (entry.d || '').match(/\b(n|v|adj|adv|prep|conj|pron|num|art|vt|vi|aux|phrase|abbr|det)\./i);
    const partOfSpeech = posMatch ? posMatch[1].toLowerCase() : '';

    return {
        rawWord: String(rawWord).trim(),
        headword,
        wordId,
        entry,
        phonetic: cleanPhonetic,
        partOfSpeech
    };
}

function findWordEntry(rawWord) {
    const res = resolveCanonicalWordEntry(rawWord);
    return res ? res.entry : null;
}

/**
 * ==========================================================================
 * ⭐ VocabNotebookBridge V2 — 与「单词Toy (背什么背)」1:1 双向实时互通生词本引擎
 *   1. 星标状态独立单调时钟 LWW (entries[wordKey] = { w, f: 0|1, ts, add, tr, ph, pos, bk })，不跨写不破坏单词Toy错词/复习排期
 *   2. 同源毫秒级桥接 (`window.__toyLS.getItem('toy_shared_vocab_bridge_v2')` 分槽隔离 + BroadcastChannel + storage 事件)
 *   3. 跨 WebView / 跨设备双轨云桶 (`u_sv2_<SHA256(nick)>` 隐私哈希桶 + `u_svst_<128bit_vst>` 配对桶，严格 Pull-Before-Push)
 * ==========================================================================
 */
const VocabNotebookBridge = (function() {
    const SHARED_BRIDGE_V2_KEY = 'toy_shared_vocab_bridge_v2';
    const LEGACY_SHARED_BRIDGE_V1_KEY = 'toy_shared_vocab_notebook_v1';
    const SHARED_ANON_VST_KEY = 'toy_shared_anon_vst_v2';
    const BROADCAST_CHANNEL_NAME = 'toy_shared_vocab_v2';
    const SERVER_API_URL = 'https://bilibilitoyassets.top/api/user_data';
    const VOCAB_EPOCH_SEC = 1735689600; // 2025-01-01T00:00:00Z
    const VALID_VST_RE = /^vst_[a-f0-9]{16,40}$/i;
    const VALID_HASH_KEY_RE = /^u_sv2_[a-f0-9]{32}$/;
    const VALID_RAW_OH_HEX_RE = /^[a-f0-9]{32}$/i;
    const MAX_SAFE_BEACON_STALENESS_MS = 15000;
    const PLACEHOLDER_NICKS = Object.assign(Object.create(null), {
        '': 1, '同学': 1, '本地测试用户': 1, '背词同学': 1, 'B站学员': 1, '游客': 1
    });

    const SHA256_K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);

    function utf8ToBytes(str) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }
        const out = [];
        for (let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            if (c < 0x80) {
                out.push(c);
            } else if (c < 0x800) {
                out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
            } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
                const c2 = str.charCodeAt(++i);
                const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
                out.push(
                    0xf0 | (cp >> 18),
                    0x80 | ((cp >> 12) & 0x3f),
                    0x80 | ((cp >> 6) & 0x3f),
                    0x80 | (cp & 0x3f)
                );
            } else {
                out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
            }
        }
        return new Uint8Array(out);
    }

    function sha256HexSync(input) {
        const msg = utf8ToBytes(String(input || ''));
        const bitLenHi = Math.floor((msg.length * 8) / 0x100000000);
        const bitLenLo = (msg.length * 8) >>> 0;
        const padLen = ((msg.length + 9 + 63) & ~63);
        const buf = new Uint8Array(padLen);
        buf.set(msg);
        buf[msg.length] = 0x80;
        const view = new DataView(buf.buffer);
        view.setUint32(padLen - 8, bitLenHi, false);
        view.setUint32(padLen - 4, bitLenLo, false);

        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
        let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
        const w = new Uint32Array(64);

        for (let offset = 0; offset < padLen; offset += 64) {
            for (let i = 0; i < 16; i++) {
                w[i] = view.getUint32(offset + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                const v0 = w[i - 15];
                const s0 = ((v0 >>> 7) | (v0 << 25)) ^ ((v0 >>> 18) | (v0 << 14)) ^ (v0 >>> 3);
                const v1 = w[i - 2];
                const s1 = ((v1 >>> 17) | (v1 << 15)) ^ ((v1 >>> 19) | (v1 << 13)) ^ (v1 >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 64; i++) {
                const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
                const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) >>> 0;

                h = g; g = f; f = e; e = (d + temp1) >>> 0;
                d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
        }

        const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
        return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
    }

    let _entriesMap = Object.create(null); // wordKey -> { w, f: 0|1, ts, add, tr, ph, pos, bk }
    let _lastLocalSec = 0;
    let _cloudSyncTimer = null;
    let _inflightCloudSync = null;
    const _pulledBucketKeys = new Set();
    const _lastPullAtByBucket = new Map();
    let _dirtySinceLastPush = false;
    let _hasCompletedInitialBiliCloudRead = false;
    const _senderId = 'lt_' + Math.random().toString(36).slice(2, 10);
    let _broadcastCh = null;

    function getActiveUserKeySafe() {
        if (typeof window.getCurrentUserKey === 'function') {
            return window.getCurrentUserKey();
        }
        return 'u_guest';
    }

    function getScopedKey(base) {
        return `toy_${getActiveUserKeySafe()}_${base}`;
    }

    function normalizeSharedWordKey(rawWord) {
        if (!rawWord) return '';
        const cleaned = String(rawWord).trim().toLowerCase().replace(/\s+/g, ' ');
        return (!cleaned || cleaned === '__proto__') ? '' : cleaned;
    }

    function toEpochSec(val, fallbackSec) {
        const n = Number(val) || 0;
        if (!Number.isFinite(n) || n <= 0) return fallbackSec || 0;
        return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
    }

    function nextMutationSec(prevSec) {
        let target = Math.max(Math.floor(Date.now() / 1000), _lastLocalSec + 1);
        const p = Number(prevSec) || 0;
        if (p >= target) target = p + 1;
        _lastLocalSec = target;
        return target;
    }

    function trimStrSafe(s, maxLen) {
        if (typeof s !== 'string') return '';
        const t = s.trim();
        if (!t) return '';
        return t.length > maxLen ? Array.from(t).slice(0, maxLen).join('') : t;
    }

    function getAuthorizedNicknameSafe() {
        try {
            const p = window.currentUserProfile;
            if (!p || typeof p !== 'object') return '';
            const nick = String(p.nickname || '').trim();
            if (!nick || hasOwnDictKey(PLACEHOLDER_NICKS, nick)) return '';
            const hasRealIdentity = Boolean(
                (typeof p.toyOpenId === 'string' && p.toyOpenId.trim()) ||
                (typeof p.avatar === 'string' && p.avatar.trim().indexOf('http') === 0)
            );
            if (nick === '幼稚园大队长丨' && !hasRealIdentity) return '';
            return nick;
        } catch (e) {
            return '';
        }
    }

    function normalizeOwnerHash(raw) {
        if (!raw || typeof raw !== 'string') return '';
        const trimmed = raw.trim().toLowerCase();
        if (VALID_HASH_KEY_RE.test(trimmed)) return trimmed;
        if (VALID_RAW_OH_HEX_RE.test(trimmed)) return 'u_sv2_' + trimmed;
        return '';
    }

    function getActiveOwnerHash() {
        const nick = getAuthorizedNicknameSafe();
        if (nick) {
            const computed = 'u_sv2_' + sha256HexSync('bili_toy_vocab_v2|' + nick).slice(0, 32);
            try {
                const scopedOhKey = getScopedKey('vocab_oh_v2');
                if (normalizeOwnerHash(window.__toyLS.getItem(scopedOhKey)) !== computed) {
                    window.__toyLS.setItem(scopedOhKey, computed);
                }
            } catch (e) {}
            return computed;
        }
        try {
            return normalizeOwnerHash(window.__toyLS.getItem(getScopedKey('vocab_oh_v2')));
        } catch (e) {
            return '';
        }
    }

    function bindOwnerHash(incomingOh, triggerSync = true) {
        const clean = normalizeOwnerHash(incomingOh);
        if (!clean) return false;
        const liveNick = getAuthorizedNicknameSafe();
        if (liveNick) {
            const liveOh = 'u_sv2_' + sha256HexSync('bili_toy_vocab_v2|' + liveNick).slice(0, 32);
            if (liveOh !== clean) return false;
        }
        try {
            const scopedOhKey = getScopedKey('vocab_oh_v2');
            const cur = normalizeOwnerHash(window.__toyLS.getItem(scopedOhKey));
            if (cur === clean) return false;
            window.__toyLS.setItem(scopedOhKey, clean);
            if (triggerSync) {
                pullFromSharedCloudServer().catch(() => {});
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function clearSharedAnonVst() {
        try {
            window.__toyLS.removeItem(SHARED_ANON_VST_KEY);
        } catch (e) {}
    }

    function isAnonVstConflictFree(candidateVst, activeOh) {
        if (!activeOh) return true;
        try {
            const raw = window.__toyLS.getItem(SHARED_BRIDGE_V2_KEY);
            if (!raw) return true;
            const parsed = JSON.parse(raw);
            const slot = parsed && parsed.slots && parsed.slots['vst:' + candidateVst];
            if (slot && typeof slot.ownerHash === 'string' && slot.ownerHash && slot.ownerHash !== activeOh) {
                return false;
            }
        } catch (e) {}
        return true;
    }

    function generateFreshVst() {
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
                const bytes = new Uint8Array(12);
                crypto.getRandomValues(bytes);
                return 'vst_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {}
        let hex = '';
        for (let i = 0; i < 24; i++) {
            hex += Math.floor(Math.random() * 16).toString(16);
        }
        return 'vst_' + hex;
    }

    function isValidVst(vst) {
        return Boolean(vst && typeof vst === 'string' && VALID_VST_RE.test(vst.trim()));
    }

    function markInitialCloudReadDone() {
        _hasCompletedInitialBiliCloudRead = true;
    }

    function canSyncVstToBiliCloud() {
        if (_hasCompletedInitialBiliCloudRead) return true;
        if (!window.toy || typeof window.toy.getCloudStorage !== 'function') return true;
        try {
            return window.__toyLS.getItem(getScopedKey('vocab_vst_confirmed_v2')) === '1';
        } catch (e) {
            return false;
        }
    }

    function getOrInitVst() {
        const activeOh = getActiveOwnerHash();
        const scopedKey = getScopedKey('vocab_vst_v2');
        const confirmedKey = getScopedKey('vocab_vst_confirmed_v2');
        try {
            const existing = (window.__toyLS.getItem(scopedKey) || '').trim().toLowerCase();
            const isConfirmed = window.__toyLS.getItem(confirmedKey) === '1';
            if (!isConfirmed) {
                const sharedAnon = (window.__toyLS.getItem(SHARED_ANON_VST_KEY) || '').trim().toLowerCase();
                if (isValidVst(sharedAnon) && isAnonVstConflictFree(sharedAnon, activeOh)) {
                    if (existing !== sharedAnon) {
                        window.__toyLS.setItem(scopedKey, sharedAnon);
                    }
                    return sharedAnon;
                }
            }
            if (isValidVst(existing)) {
                if (!window.__toyLS.getItem(SHARED_ANON_VST_KEY) && isAnonVstConflictFree(existing, activeOh)) {
                    window.__toyLS.setItem(SHARED_ANON_VST_KEY, existing);
                }
                return existing;
            }
        } catch (e) {}

        const fresh = generateFreshVst();
        try {
            window.__toyLS.setItem(scopedKey, fresh);
            if (isAnonVstConflictFree(fresh, activeOh)) {
                window.__toyLS.setItem(SHARED_ANON_VST_KEY, fresh);
            }
        } catch (e) {}
        return fresh;
    }

    function bindVst(incomingVst, triggerSync = true) {
        if (!isValidVst(incomingVst)) return false;
        const clean = incomingVst.trim().toLowerCase();
        const scopedKey = getScopedKey('vocab_vst_v2');
        const confirmedKey = getScopedKey('vocab_vst_confirmed_v2');
        try {
            const cur = (window.__toyLS.getItem(scopedKey) || '').trim().toLowerCase();
            window.__toyLS.setItem(confirmedKey, '1');
            const activeOh = getActiveOwnerHash();
            if (isAnonVstConflictFree(clean, activeOh)) {
                window.__toyLS.setItem(SHARED_ANON_VST_KEY, clean);
            }
            if (cur === clean) return false;
            window.__toyLS.setItem(scopedKey, clean);
            if (triggerSync) {
                pullFromSharedCloudServer().catch(() => {});
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function markLocalVocabDirty() {
        _dirtySinceLastPush = true;
        try {
            window.__toyLS.setItem(getScopedKey('pending_vocab_push_v2'), '1');
        } catch (e) {}
    }

    function hasPendingVocabPush() {
        if (_dirtySinceLastPush) return true;
        try {
            return window.__toyLS.getItem(getScopedKey('pending_vocab_push_v2')) === '1';
        } catch (e) {
            return false;
        }
    }

    function clearPendingVocabPush() {
        _dirtySinceLastPush = false;
        try {
            window.__toyLS.setItem(getScopedKey('pending_vocab_push_v2'), '0');
        } catch (e) {}
    }

    function getSharedCloudBucketKeys() {
        const keys = [];
        const ownerHash = getActiveOwnerHash();
        if (ownerHash && VALID_HASH_KEY_RE.test(ownerHash)) {
            keys.push(ownerHash);
        }
        const vst = getOrInitVst();
        if (isValidVst(vst)) {
            keys.push('u_svst_' + vst.slice(4));
        }
        return Array.from(new Set(keys));
    }

    function mergeEntriesMap(base, incoming) {
        const merged = Object.create(null);
        let changed = false;

        if (base && typeof base === 'object') {
            Object.keys(base).forEach((k) => {
                if (!hasOwnDictKey(base, k)) return;
                const item = base[k];
                const nk = normalizeSharedWordKey((item && item.w) || k);
                if (nk && item) merged[nk] = Object.assign({}, item);
            });
        }

        if (!incoming || typeof incoming !== 'object') {
            return { merged, changed };
        }

        Object.keys(incoming).forEach((rawKey) => {
            if (!hasOwnDictKey(incoming, rawKey)) return;
            const item = incoming[rawKey];
            if (!item || typeof item !== 'object') return;
            const wKey = normalizeSharedWordKey(item.w || rawKey);
            if (!wKey) return;
            const inTs = toEpochSec(item.ts, 0);
            if (inTs <= 0) return;
            if (inTs > _lastLocalSec) _lastLocalSec = inTs;
            const inFav = item.f ? 1 : 0;
            const cur = hasOwnDictKey(merged, wKey) ? merged[wKey] : null;

            if (!cur) {
                const nextObj = {
                    w: String(item.w || wKey).trim(),
                    f: inFav,
                    ts: inTs
                };
                if (inFav === 1) {
                    nextObj.add = toEpochSec(item.add, inTs) || inTs;
                    const tr = trimStrSafe(item.tr, 180);
                    const ph = trimStrSafe(item.ph, 64);
                    const pos = trimStrSafe(item.pos, 24);
                    const bk = trimStrSafe(item.bk, 32);
                    if (tr) nextObj.tr = tr;
                    if (ph) nextObj.ph = ph;
                    if (pos) nextObj.pos = pos;
                    if (bk) nextObj.bk = bk;
                }
                merged[wKey] = nextObj;
                changed = true;
                return;
            }

            const curTs = toEpochSec(cur.ts, 0);
            if (inTs > curTs || (inTs === curTs && inFav > cur.f)) {
                const nextObj = {
                    w: String(item.w || cur.w || wKey).trim(),
                    f: inFav,
                    ts: inTs
                };
                if (inFav === 1) {
                    nextObj.add = Math.min(toEpochSec(cur.add, inTs) || inTs, toEpochSec(item.add, inTs) || inTs);
                    const tr = trimStrSafe(item.tr, 180) || trimStrSafe(cur.tr, 180);
                    const ph = trimStrSafe(item.ph, 64) || trimStrSafe(cur.ph, 64);
                    const pos = trimStrSafe(item.pos, 24) || trimStrSafe(cur.pos, 24);
                    const bk = trimStrSafe(item.bk, 32) || trimStrSafe(cur.bk, 32);
                    if (tr) nextObj.tr = tr;
                    if (ph) nextObj.ph = ph;
                    if (pos) nextObj.pos = pos;
                    if (bk) nextObj.bk = bk;
                }
                if (cur.f !== nextObj.f || cur.ts !== nextObj.ts || (cur.tr || '') !== (nextObj.tr || '')) {
                    changed = true;
                }
                merged[wKey] = nextObj;
            } else if (cur.f === 1 && inFav === 1) {
                if (!cur.tr && trimStrSafe(item.tr, 180)) {
                    cur.tr = trimStrSafe(item.tr, 180);
                    changed = true;
                }
                if (!cur.ph && trimStrSafe(item.ph, 64)) {
                    cur.ph = trimStrSafe(item.ph, 64);
                    changed = true;
                }
                if (!cur.pos && trimStrSafe(item.pos, 24)) {
                    cur.pos = trimStrSafe(item.pos, 24);
                    changed = true;
                }
            }
        });

        return { merged, changed };
    }

    function pruneEntriesMap(entries) {
        const favs = [];
        const tombs = [];
        Object.keys(entries || {}).forEach((k) => {
            if (!hasOwnDictKey(entries, k)) return;
            const e = entries[k];
            if (!e || !e.w || !(e.ts > 0)) return;
            if (e.f === 1) favs.push([k, e]);
            else tombs.push([k, e]);
        });
        favs.sort((a, b) => b[1].ts - a[1].ts);
        tombs.sort((a, b) => b[1].ts - a[1].ts);
        const out = Object.create(null);
        favs.slice(0, 1200).forEach(([k, e]) => { out[k] = e; });
        tombs.slice(0, 240).forEach(([k, e]) => { out[k] = e; });
        return out;
    }

    function parseAnyBridgePayload(raw) {
        const empty = { ownerHash: '', vst: '', entries: Object.create(null) };
        if (!raw || typeof raw !== 'object') return empty;
        const ownerHash = (typeof raw.ownerHash === 'string' && VALID_HASH_KEY_RE.test(raw.ownerHash)) ? raw.ownerHash : '';
        const vst = isValidVst(raw.vst) ? raw.vst.trim().toLowerCase() : '';

        if (raw.v === 2 && raw.entries && typeof raw.entries === 'object') {
            return {
                ownerHash,
                vst,
                entries: mergeEntriesMap(Object.create(null), raw.entries).merged
            };
        }

        // 兼容 V1 bridge ({ records, tombstones }) 及单词Toy 10/11元紧凑数组
        const converted = Object.create(null);
        const rawRecs = (raw.records && typeof raw.records === 'object')
            ? raw.records
            : ((raw.favorites && typeof raw.favorites === 'object') ? raw.favorites : raw);

        if (rawRecs && typeof rawRecs === 'object') {
            Object.keys(rawRecs).forEach((k) => {
                if (!hasOwnDictKey(rawRecs, k)) return;
                if (k === 'tombstones' || k === 'updatedAt' || k === 'records' || k === 'v' || k === 'slots') return;
                const v = rawRecs[k];
                if (!v) return;

                if (Array.isArray(v) && v[0] === 1 && v[1]) {
                    const favBit = Boolean(v[5]);
                    if (!favBit) return;
                    const word = String(v[1]).trim();
                    const wKey = normalizeSharedWordKey(word);
                    if (!wKey) return;
                    const lastSec = toEpochSec(v[8], Math.floor(Date.now() / 1000));
                    const favSec = toEpochSec(v[10], lastSec) || lastSec;
                    const firstSec = toEpochSec(v[7], favSec) || favSec;
                    converted[wKey] = {
                        w: word,
                        f: 1,
                        ts: favSec,
                        add: firstSec,
                        bk: trimStrSafe(v[2], 32) || 'cet4'
                    };
                    return;
                }

                if (typeof v === 'object' && !Array.isArray(v) && v.word) {
                    const isFav = typeof v.isFavorite === 'boolean' ? v.isFavorite : true;
                    if (!isFav && (v.wrongCount > 0 || v.stage > 0 || v.isMastered)) return;
                    const wKey = normalizeSharedWordKey(v.word);
                    if (!wKey) return;
                    const tsSec = toEpochSec(v.favUpdatedAt || v.lastReviewedAt || v.addedAt || v.firstAddedAt, Math.floor(Date.now() / 1000));
                    const item = {
                        w: String(v.word).trim(),
                        f: isFav ? 1 : 0,
                        ts: tsSec
                    };
                    if (isFav) {
                        item.add = toEpochSec(v.firstAddedAt || v.addedAt, tsSec) || tsSec;
                        const tr = trimStrSafe(v.translation, 180);
                        const ph = trimStrSafe(v.phonetic, 64);
                        const pos = trimStrSafe(v.partOfSpeech, 24);
                        const bk = trimStrSafe(v.bookId, 32);
                        if (tr) item.tr = tr;
                        if (ph) item.ph = ph;
                        if (pos) item.pos = pos;
                        if (bk) item.bk = bk;
                    }
                    converted[wKey] = item;
                }
            });
        }

        if (raw.tombstones && typeof raw.tombstones === 'object') {
            Object.keys(raw.tombstones).forEach((tk) => {
                if (!hasOwnDictKey(raw.tombstones, tk)) return;
                const tSec = toEpochSec(raw.tombstones[tk], 0);
                if (tSec <= 0) return;
                [normalizeSharedWordKey(tk), normalizeSharedWordKey(tk.replace(/_/g, ' '))].forEach((wKey) => {
                    if (!wKey) return;
                    const prev = hasOwnDictKey(converted, wKey) ? converted[wKey] : null;
                    if (!prev || tSec > prev.ts) {
                        converted[wKey] = { w: (prev && prev.w) || wKey, f: 0, ts: tSec };
                    }
                });
            });
        }

        return { ownerHash, vst, entries: converted };
    }

    function getActiveSlotIds() {
        const slots = [];
        const ownerHash = getActiveOwnerHash();
        const vst = getOrInitVst();
        if (ownerHash) slots.push('acct:' + ownerHash);
        if (vst) slots.push('vst:' + vst);
        if (!ownerHash && getActiveUserKeySafe().indexOf('u_guest') === 0) {
            slots.push('anon:default');
        }
        return Array.from(new Set(slots));
    }

    function readSharedBridgeEnvelope() {
        try {
            const raw = window.__toyLS.getItem(SHARED_BRIDGE_V2_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.v === 2 && parsed.slots && typeof parsed.slots === 'object') {
                    return parsed;
                }
            }
        } catch (e) {}
        return { v: 2, slots: {} };
    }

    function writeToSharedBridgeSlots(entries, broadcast) {
        const ownerHash = getActiveOwnerHash();
        const vst = getOrInitVst();
        const slotIds = getActiveSlotIds();
        if (slotIds.length === 0) return;

        const env = readSharedBridgeEnvelope();
        const now = Date.now();
        const pruned = pruneEntriesMap(entries);

        slotIds.forEach((sid) => {
            const existingSlot = hasOwnDictKey(env.slots, sid) ? env.slots[sid] : null;
            if (ownerHash && existingSlot && existingSlot.ownerHash && existingSlot.ownerHash !== ownerHash) {
                return;
            }
            const baseEntries = existingSlot ? parseAnyBridgePayload(existingSlot).entries : Object.create(null);
            const merged = mergeEntriesMap(baseEntries, pruned).merged;
            const slotObj = {
                v: 2,
                updatedAt: now,
                entries: pruneEntriesMap(merged)
            };
            if (ownerHash) slotObj.ownerHash = ownerHash;
            if (vst) slotObj.vst = vst;
            env.slots[sid] = slotObj;
        });

        const allSlotKeys = Object.keys(env.slots);
        if (allSlotKeys.length > 6) {
            allSlotKeys
                .sort((a, b) => ((env.slots[b] && env.slots[b].updatedAt) || 0) - ((env.slots[a] && env.slots[a].updatedAt) || 0))
                .slice(6)
                .forEach((dropK) => { delete env.slots[dropK]; });
        }

        try {
            if (typeof window.safeLocalStorageSet === 'function') {
                window.safeLocalStorageSet(SHARED_BRIDGE_V2_KEY, JSON.stringify(env));
            } else {
                window.__toyLS.setItem(SHARED_BRIDGE_V2_KEY, JSON.stringify(env));
            }
        } catch (e) {}

        if (broadcast) {
            broadcastSharedUpdate();
        }
    }

    function getBroadcastChannel() {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
        if (!_broadcastCh) {
            try {
                _broadcastCh = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            } catch (e) {
                _broadcastCh = null;
            }
        }
        return _broadcastCh;
    }

    function broadcastSharedUpdate() {
        const ch = getBroadcastChannel();
        if (!ch) return;
        try {
            ch.postMessage({
                type: 'vocab_bridge_v2_updated',
                sender: _senderId,
                ts: Date.now()
            });
        } catch (e) {}
    }

    function loadFromLocal() {
        let combined = Object.create(null);
        const ownerHash = getActiveOwnerHash();
        const scopedFavsKey = getScopedKey('vocab_favs_v2');

        // 1. 读取本端当前账号专属 V2 存储
        let hasScopedV2 = false;
        try {
            const rawScoped = window.__toyLS.getItem(scopedFavsKey);
            if (rawScoped) {
                hasScopedV2 = true;
                const parsed = parseAnyBridgePayload(JSON.parse(rawScoped));
                combined = mergeEntriesMap(combined, parsed.entries).merged;
            }
        } catch (e) {}

        // 2. 一次性只读迁移当前账号旧版数据（绝不跨账号扫描，绝不反写 word_toy_*）
        if (!hasScopedV2) {
            const legacyKeys = [getScopedKey('ebbinghaus_mistakes_v1')];
            if (!ownerHash && getActiveUserKeySafe().indexOf('u_guest') === 0) {
                legacyKeys.push(LEGACY_SHARED_BRIDGE_V1_KEY);
                const wtLast = window.__toyLS.getItem('word_toy_last_active_user_key') || '';
                if (wtLast && wtLast.indexOf('u_guest') === 0) {
                    legacyKeys.push(`word_toy_${wtLast}_ebbinghaus_mistakes_v1`);
                }
            }
            legacyKeys.forEach((lk) => {
                try {
                    const raw = window.__toyLS.getItem(lk);
                    if (!raw) return;
                    const parsedV1 = parseAnyBridgePayload(JSON.parse(raw));
                    if (!ownerHash || !parsedV1.ownerHash || parsedV1.ownerHash === ownerHash) {
                        combined = mergeEntriesMap(combined, parsedV1.entries).merged;
                    }
                } catch (e) {}
            });
        }

        // 3. 吸收同源共享桥 V2 对应当前账号槽位的最新状态
        const env = readSharedBridgeEnvelope();
        getActiveSlotIds().forEach((sid) => {
            if (!hasOwnDictKey(env.slots, sid)) return;
            const slot = env.slots[sid];
            if (!slot || typeof slot !== 'object') return;
            if (ownerHash && slot.ownerHash && slot.ownerHash !== ownerHash) return;
            const parsedSlot = parseAnyBridgePayload(slot);
            combined = mergeEntriesMap(combined, parsedSlot.entries).merged;
        });

        _entriesMap = pruneEntriesMap(combined);
        refreshAllPageWordBadges();
    }

    function persistToLocal(broadcast = true) {
        const pruned = pruneEntriesMap(_entriesMap);
        _entriesMap = pruned;
        const ownerHash = getActiveOwnerHash();
        const vst = getOrInitVst();
        const scopedPayload = {
            v: 2,
            updatedAt: Date.now(),
            entries: pruned
        };
        if (ownerHash) scopedPayload.ownerHash = ownerHash;
        if (vst) scopedPayload.vst = vst;

        try {
            const scopedKey = getScopedKey('vocab_favs_v2');
            const serialized = JSON.stringify(scopedPayload);
            if (typeof window.safeLocalStorageSet === 'function') {
                window.safeLocalStorageSet(scopedKey, serialized);
            } else {
                window.__toyLS.setItem(scopedKey, serialized);
            }
        } catch (e) {}

        writeToSharedBridgeSlots(pruned, broadcast);
        refreshAllPageWordBadges();
    }

    function exportCloudPayload() {
        const ownerHash = getActiveOwnerHash();
        const vst = getOrInitVst();
        const payload = {
            v: 2,
            updatedAt: Date.now(),
            entries: pruneEntriesMap(_entriesMap)
        };
        if (ownerHash) payload.ownerHash = ownerHash;
        if (vst) payload.vst = vst;
        return payload;
    }

    function mergeCloudPayload(bridge, persistIfChanged = true, triggerFollowupPull = true) {
        if (!bridge || typeof bridge !== 'object') return false;
        const parsed = parseAnyBridgePayload(bridge);
        let bucketIdentityChanged = false;
        if (parsed.ownerHash) {
            if (bindOwnerHash(parsed.ownerHash, false)) bucketIdentityChanged = true;
        }
        if (parsed.vst) {
            if (bindVst(parsed.vst, false)) bucketIdentityChanged = true;
        }
        const res = mergeEntriesMap(_entriesMap, parsed.entries);
        if (res.changed) {
            _entriesMap = pruneEntriesMap(res.merged);
            if (persistIfChanged) {
                persistToLocal(true);
            } else {
                refreshAllPageWordBadges();
            }
        }
        if (bucketIdentityChanged && triggerFollowupPull) {
            pullFromSharedCloudServer().catch(() => {});
        }
        return res.changed;
    }

    function exportCompactFavoritesForCloud() {
        const vst = getOrInitVst();
        const ownerHash = getActiveOwnerHash();
        const ohHex = (ownerHash && ownerHash.indexOf('u_sv2_') === 0) ? ownerHash.slice(6) : '';
        const favs = [];
        const tombs = [];
        Object.keys(_entriesMap).forEach((k) => {
            if (!hasOwnDictKey(_entriesMap, k)) return;
            const e = _entriesMap[k];
            if (!e || !e.w || !(e.ts > 0)) return;
            if (e.f === 1) favs.push(e);
            else tombs.push(e);
        });
        favs.sort((a, b) => b.ts - a.ts);
        tombs.sort((a, b) => b.ts - a.ts);

        const compact = { v: 2, f: {}, u: {} };
        if (canSyncVstToBiliCloud() && vst) compact.vst = vst;
        if (ohHex) compact.oh = ohHex;
        const byteLen = (s) => (typeof window.utf8ByteLength === 'function') ? window.utf8ByteLength(s) : s.length * 3;

        for (let i = 0; i < favs.length; i++) {
            const e = favs[i];
            const rel = Math.max(1, e.ts - VOCAB_EPOCH_SEC).toString(36);
            compact.f[e.w] = rel;
            if (byteLen(JSON.stringify(compact)) > 740) {
                delete compact.f[e.w];
                break;
            }
        }
        for (let i = 0; i < tombs.length; i++) {
            const e = tombs[i];
            const rel = Math.max(1, e.ts - VOCAB_EPOCH_SEC).toString(36);
            compact.u[e.w] = rel;
            if (byteLen(JSON.stringify(compact)) > 960) {
                delete compact.u[e.w];
                break;
            }
        }
        return JSON.stringify(compact);
    }

    function mergeCompactFavoritesFromCloud(compactStr, triggerRemotePull = true) {
        markInitialCloudReadDone();
        if (!compactStr || typeof compactStr !== 'string') return false;
        try {
            const parsed = JSON.parse(compactStr);
            if (!parsed || typeof parsed !== 'object') return false;
            let boundChanged = false;
            if (parsed.oh) {
                if (bindOwnerHash(parsed.oh, false)) boundChanged = true;
            }
            if (parsed.vst) {
                if (bindVst(parsed.vst, false)) boundChanged = true;
            }

            let mergedChanged = false;
            if (parsed.v === 2) {
                const incoming = Object.create(null);
                if (parsed.f && typeof parsed.f === 'object') {
                    Object.keys(parsed.f).forEach((rawWord) => {
                        if (!hasOwnDictKey(parsed.f, rawWord)) return;
                        const rel = parseInt(String(parsed.f[rawWord]), 36);
                        if (!Number.isFinite(rel) || rel < 0) return;
                        const tsSec = VOCAB_EPOCH_SEC + rel;
                        const resolved = resolveCanonicalWordEntry(rawWord);
                        const w = resolved ? resolved.headword : rawWord;
                        const wKey = normalizeSharedWordKey(w);
                        if (!wKey) return;
                        incoming[wKey] = {
                            w,
                            f: 1,
                            ts: tsSec,
                            add: tsSec,
                            tr: resolved?.entry?.d || '',
                            ph: resolved?.phonetic || '',
                            pos: resolved?.partOfSpeech || ''
                        };
                    });
                }
                if (parsed.u && typeof parsed.u === 'object') {
                    Object.keys(parsed.u).forEach((rawWord) => {
                        if (!hasOwnDictKey(parsed.u, rawWord)) return;
                        const rel = parseInt(String(parsed.u[rawWord]), 36);
                        if (!Number.isFinite(rel) || rel < 0) return;
                        const tsSec = VOCAB_EPOCH_SEC + rel;
                        const wKey = normalizeSharedWordKey(rawWord);
                        if (!wKey) return;
                        incoming[wKey] = { w: rawWord, f: 0, ts: tsSec };
                    });
                }
                mergedChanged = mergeCloudPayload({ v: 2, entries: incoming }, true, false);
            } else {
                // 兼容旧版 { f: { word: tsMs }, t: { wordId: tsMs } }
                const legacyIncoming = Object.create(null);
                if (parsed.f && typeof parsed.f === 'object') {
                    Object.keys(parsed.f).forEach((rawWord) => {
                        if (!hasOwnDictKey(parsed.f, rawWord)) return;
                        const tsSec = toEpochSec(parsed.f[rawWord], Math.floor(Date.now() / 1000));
                        const resolved = resolveCanonicalWordEntry(rawWord);
                        const w = resolved ? resolved.headword : rawWord;
                        const wKey = normalizeSharedWordKey(w);
                        if (!wKey) return;
                        legacyIncoming[wKey] = {
                            w,
                            f: 1,
                            ts: tsSec,
                            add: tsSec,
                            tr: resolved?.entry?.d || '',
                            ph: resolved?.phonetic || '',
                            pos: resolved?.partOfSpeech || ''
                        };
                    });
                }
                if (parsed.t && typeof parsed.t === 'object') {
                    Object.keys(parsed.t).forEach((wId) => {
                        if (!hasOwnDictKey(parsed.t, wId)) return;
                        const tsSec = toEpochSec(parsed.t[wId], 0);
                        const wKey = normalizeSharedWordKey(wId);
                        if (wKey && tsSec > 0) {
                            legacyIncoming[wKey] = { w: wKey, f: 0, ts: tsSec };
                        }
                    });
                }
                mergedChanged = mergeCloudPayload({ v: 2, entries: legacyIncoming }, true, false);
            }

            if (triggerRemotePull && (boundChanged || getSharedCloudBucketKeys().length > 0)) {
                pullFromSharedCloudServer().catch(() => {});
            }
            return mergedChanged;
        } catch (e) {
            return false;
        }
    }

    async function fetchSingleBucket(bKey) {
        if (typeof fetch !== 'function') return { ok: false, entries: Object.create(null), vst: '', ownerHash: '' };
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 3800) : null;
        try {
            const resp = await fetch(`${SERVER_API_URL}?user_key=${encodeURIComponent(bKey)}`, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/json', 'X-User-Key': bKey },
                signal: controller ? controller.signal : undefined
            });
            if (!resp.ok) return { ok: false, entries: Object.create(null), vst: '', ownerHash: '' };
            const resJson = await resp.json().catch(() => null);
            if (!resJson || typeof resJson !== 'object') {
                return { ok: false, entries: Object.create(null), vst: '', ownerHash: '' };
            }
            _pulledBucketKeys.add(bKey);
            _lastPullAtByBucket.set(bKey, Date.now());
            const bridge = resJson?.data?.vocabNotebookBridge;
            if (!bridge || typeof bridge !== 'object') {
                return { ok: true, entries: Object.create(null), vst: '', ownerHash: '' };
            }
            const parsed = parseAnyBridgePayload(bridge);
            return { ok: true, entries: parsed.entries, vst: parsed.vst, ownerHash: parsed.ownerHash };
        } catch (e) {
            return { ok: false, entries: Object.create(null), vst: '', ownerHash: '' };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function postSingleBucket(bKey, payloadData, useBeacon) {
        const bodyStr = JSON.stringify({
            user_key: bKey,
            timestamp: payloadData.updatedAt || Date.now(),
            data: { vocabNotebookBridge: payloadData }
        });
        if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && bodyStr.length < 58000) {
            try {
                const blob = new Blob([bodyStr], { type: 'application/json' });
                if (navigator.sendBeacon(`${SERVER_API_URL}?user_key=${encodeURIComponent(bKey)}`, blob)) {
                    return true;
                }
            } catch (e) {}
        }
        if (typeof fetch !== 'function') return false;
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
        try {
            const resp = await fetch(SERVER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Key': bKey },
                body: bodyStr,
                keepalive: bodyStr.length < 58000,
                signal: controller ? controller.signal : undefined
            });
            return resp.ok;
        } catch (e) {
            return false;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function syncWithSharedCloudInternal(pushAfterMerge, useBeacon) {
        if (useBeacon) {
            // 严防无本地新改动或陈旧快照通过 sendBeacon 盲写覆盖另一台设备刚刚新增的收藏词
            if (!hasPendingVocabPush()) return false;
            const now = Date.now();
            const allKeys = getSharedCloudBucketKeys();
            const freshKeys = allKeys.filter((k) => _pulledBucketKeys.has(k) && (now - (_lastPullAtByBucket.get(k) || 0) <= MAX_SAFE_BEACON_STALENESS_MS));
            if (freshKeys.length === 0 || Object.keys(_entriesMap).length === 0) {
                return false;
            }
            const payloadData = exportCloudPayload();
            const pushResults = await Promise.allSettled(freshKeys.map((bKey) => postSingleBucket(bKey, payloadData, true)));
            const allOk = freshKeys.length === allKeys.length && pushResults.every((r) => r.status === 'fulfilled' && r.value === true);
            if (allOk) {
                clearPendingVocabPush();
            }
            return true;
        }

        if (_inflightCloudSync) {
            await _inflightCloudSync.catch(() => false);
        }

        const effectivePush = Boolean(pushAfterMerge || hasPendingVocabPush());
        const startUKey = getActiveUserKeySafe();
        const run = (async () => {
            const bucketKeys = getSharedCloudBucketKeys();
            if (bucketKeys.length === 0) return false;

            let remoteCombined = Object.create(null);
            let discoveredVst = '';
            let discoveredOh = '';
            const pullResults = await Promise.all(bucketKeys.map((k) => fetchSingleBucket(k)));
            pullResults.forEach((r) => {
                if (!discoveredVst && r.vst) discoveredVst = r.vst;
                if (!discoveredOh && r.ownerHash) discoveredOh = r.ownerHash;
                remoteCombined = mergeEntriesMap(remoteCombined, r.entries).merged;
            });

            // 一次性只读兼容旧版明文昵称桶迁移（迁移后不再写入旧明文桶）
            const nick = getAuthorizedNicknameSafe();
            const migFlagKey = getScopedKey('vocab_v1_nick_migrated');
            if (nick && window.__toyLS.getItem(migFlagKey) !== '1') {
                const legacyCleanNick = encodeURIComponent(nick).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
                if (legacyCleanNick) {
                    const legacyRes = await fetchSingleBucket('u_shared_vocab_nick_' + legacyCleanNick);
                    if (legacyRes.ok) {
                        remoteCombined = mergeEntriesMap(remoteCombined, legacyRes.entries).merged;
                        try { window.__toyLS.setItem(migFlagKey, '1'); } catch (e) {}
                    }
                }
            }

            const extraBuckets = [];
            if (discoveredOh && !getActiveOwnerHash() && bindOwnerHash(discoveredOh, false)) {
                if (!bucketKeys.includes(discoveredOh)) {
                    extraBuckets.push(discoveredOh);
                }
            }
            const activeOhAfter = getActiveOwnerHash();
            if (
                discoveredVst &&
                (!activeOhAfter || !discoveredOh || discoveredOh === activeOhAfter) &&
                bindVst(discoveredVst, false)
            ) {
                const vstBucket = 'u_svst_' + discoveredVst.slice(4);
                if (!bucketKeys.includes(vstBucket)) {
                    extraBuckets.push(vstBucket);
                }
            }
            if (extraBuckets.length > 0) {
                const extraPulls = await Promise.all(extraBuckets.map((k) => fetchSingleBucket(k)));
                extraPulls.forEach((er) => {
                    remoteCombined = mergeEntriesMap(remoteCombined, er.entries).merged;
                });
            }

            if (getActiveUserKeySafe() !== startUKey) return false;

            const mergedRes = mergeEntriesMap(_entriesMap, remoteCombined);
            if (mergedRes.changed) {
                _entriesMap = pruneEntriesMap(mergedRes.merged);
                persistToLocal(true);
            }

            const allFinalKeys = getSharedCloudBucketKeys();
            const finalKeys = allFinalKeys.filter((k) => _pulledBucketKeys.has(k));
            const hasLocalData = Object.keys(_entriesMap).length > 0;
            const remoteMissingLocal = hasLocalData && mergeEntriesMap(remoteCombined, _entriesMap).changed;

            if ((effectivePush || remoteMissingLocal) && hasLocalData && finalKeys.length > 0) {
                const payloadData = exportCloudPayload();
                const postRes = await Promise.allSettled(finalKeys.map((k) => postSingleBucket(k, payloadData, false)));
                const allOk = finalKeys.length === allFinalKeys.length && postRes.every((r) => r.status === 'fulfilled' && r.value === true);
                if (allOk) {
                    clearPendingVocabPush();
                }
            } else if (!hasLocalData && finalKeys.length === allFinalKeys.length) {
                clearPendingVocabPush();
            }

            return mergedRes.changed;
        })();

        _inflightCloudSync = run;
        try {
            return await run;
        } finally {
            if (_inflightCloudSync === run) {
                _inflightCloudSync = null;
            }
        }
    }

    async function pullFromSharedCloudServer() {
        return syncWithSharedCloudInternal(false, false);
    }

    async function pushToSharedCloudServer(useBeacon = false) {
        return syncWithSharedCloudInternal(true, useBeacon);
    }

    function flushPendingSync(useBeacon = false) {
        if (_cloudSyncTimer) {
            clearTimeout(_cloudSyncTimer);
            _cloudSyncTimer = null;
        }
        pushToSharedCloudServer(useBeacon).catch(() => {});
    }

    function scheduleSharedCloudSync(immediate = false) {
        if (_cloudSyncTimer) {
            clearTimeout(_cloudSyncTimer);
            _cloudSyncTimer = null;
        }
        if (immediate) {
            pushToSharedCloudServer(false).catch(() => {});
        } else {
            _cloudSyncTimer = setTimeout(() => {
                _cloudSyncTimer = null;
                pushToSharedCloudServer(false).catch(() => {});
            }, 320);
        }
    }

    function backfillMissingDefinitions() {
        if (!window.DICT_MAP || typeof window.DICT_MAP !== 'object') return false;
        let mutated = false;
        const nextMap = Object.create(null);
        Object.keys(_entriesMap).forEach((k) => {
            if (!hasOwnDictKey(_entriesMap, k)) return;
            const cur = _entriesMap[k];
            if (!cur || !cur.w) return;
            if (cur.f !== 1 || cur.tr) {
                const prev = hasOwnDictKey(nextMap, k) ? nextMap[k] : null;
                if (!prev || cur.ts >= prev.ts) nextMap[k] = cur;
                return;
            }
            const enriched = resolveCanonicalWordEntry(cur.w);
            if (!enriched || !enriched.entry || !enriched.entry.d) {
                nextMap[k] = cur;
                return;
            }
            const canonKey = normalizeSharedWordKey(enriched.headword) || k;
            const upgraded = {
                w: enriched.headword || cur.w,
                f: 1,
                ts: cur.ts,
                add: cur.add || cur.ts,
                tr: trimStrSafe(enriched.entry.d, 180),
                ph: trimStrSafe(enriched.phonetic || cur.ph || '', 64),
                pos: trimStrSafe(enriched.partOfSpeech || cur.pos || '', 24),
                bk: cur.bk || 'cet4'
            };
            const existing = hasOwnDictKey(nextMap, canonKey) ? nextMap[canonKey] : null;
            if (!existing || upgraded.ts >= existing.ts) {
                nextMap[canonKey] = upgraded;
            }
            mutated = true;
        });
        if (mutated) {
            _entriesMap = pruneEntriesMap(nextMap);
            persistToLocal(true);
        }
        return mutated;
    }

    function onProfileUpdated() {
        const nick = getAuthorizedNicknameSafe();
        if (!nick) return false;
        const oh = 'u_sv2_' + sha256HexSync('bili_toy_vocab_v2|' + nick).slice(0, 32);
        try {
            window.__toyLS.setItem(getScopedKey('vocab_oh_v2'), oh);
        } catch (e) {}
        loadFromLocal();
        syncWithSharedCloudInternal(Object.keys(_entriesMap).length > 0, false).catch(() => {});
        if (typeof window.saveUserCloudData === 'function') {
            Promise.resolve(window.saveUserCloudData(null, false)).catch(() => {});
        }
        return true;
    }

    async function onUserSwitched(prevUserKey, newUserKey) {
        const isGuestUpgrade = Boolean(
            prevUserKey && String(prevUserKey).indexOf('u_guest') === 0 &&
            newUserKey && String(newUserKey).indexOf('u_guest') !== 0
        );
        const isDistinctRealAccountSwitch = Boolean(
            prevUserKey && String(prevUserKey).indexOf('u_guest') !== 0 &&
            newUserKey && prevUserKey !== newUserKey
        );
        if (isDistinctRealAccountSwitch) {
            clearSharedAnonVst();
        }
        const guestSnapshot = isGuestUpgrade ? Object.assign(Object.create(null), _entriesMap) : null;

        if (_cloudSyncTimer) {
            clearTimeout(_cloudSyncTimer);
            _cloudSyncTimer = null;
        }
        _pulledBucketKeys.clear();
        _lastPullAtByBucket.clear();
        _dirtySinceLastPush = false;
        _hasCompletedInitialBiliCloudRead = false;
        _lastLocalSec = 0;
        loadFromLocal();

        if (guestSnapshot && Object.keys(guestSnapshot).length > 0) {
            const merged = mergeEntriesMap(_entriesMap, guestSnapshot);
            if (merged.changed) {
                _entriesMap = pruneEntriesMap(merged.merged);
                markLocalVocabDirty();
                persistToLocal(true);
            }
        }

        await syncWithSharedCloudInternal(Object.keys(_entriesMap).length > 0, false).catch(() => {});
    }

    function isWordFavorited(rawWord) {
        if (!rawWord) return false;
        const directKey = normalizeSharedWordKey(rawWord);
        if (directKey && hasOwnDictKey(_entriesMap, directKey) && _entriesMap[directKey].f === 1) {
            return true;
        }
        const resolved = resolveCanonicalWordEntry(rawWord);
        if (resolved) {
            const headKey = normalizeSharedWordKey(resolved.headword);
            if (headKey && hasOwnDictKey(_entriesMap, headKey) && _entriesMap[headKey].f === 1) {
                return true;
            }
        }
        return false;
    }

    function toggleFavoriteWord(rawWord) {
        const cleanInput = String(rawWord || '').trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        if (!cleanInput) return { favorited: false, wordId: '', headword: rawWord };

        const resolved = resolveCanonicalWordEntry(cleanInput) || {
            headword: cleanInput.toLowerCase(),
            wordId: makeSafeVocabStem(cleanInput.toLowerCase()),
            entry: {},
            phonetic: '',
            partOfSpeech: ''
        };

        const { headword, wordId, entry, phonetic, partOfSpeech } = resolved;
        const wKey = normalizeSharedWordKey(headword);
        if (!wKey) return { favorited: false, wordId: '', headword };

        const existing = hasOwnDictKey(_entriesMap, wKey) ? _entriesMap[wKey] : null;
        const nowSec = nextMutationSec(existing ? existing.ts : 0);
        const curBook = (window.currentExamLevel && ['cet4', 'cet6', 'gaokao', 'kaoyan', 'ielts'].includes(window.currentExamLevel))
            ? window.currentExamLevel
            : 'cet4';

        let nextFav = true;
        if (existing && existing.f === 1) {
            nextFav = false;
            _entriesMap[wKey] = {
                w: existing.w || headword,
                f: 0,
                ts: nowSec
            };
        } else {
            nextFav = true;
            const nextEntry = {
                w: headword,
                f: 1,
                ts: nowSec,
                add: (existing && existing.add) ? existing.add : nowSec,
                bk: (existing && existing.bk) || curBook
            };
            const tr = trimStrSafe(entry.d || (existing && existing.tr) || '', 180);
            const ph = trimStrSafe(phonetic || (existing && existing.ph) || '', 64);
            const pos = trimStrSafe(partOfSpeech || (existing && existing.pos) || '', 24);
            if (tr) nextEntry.tr = tr;
            if (ph) nextEntry.ph = ph;
            if (pos) nextEntry.pos = pos;
            _entriesMap[wKey] = nextEntry;

            // 若词典尚在异步预热，加载完成后自动补齐词头归一、释义与音标
            if (!entry.d && typeof ensureDictionaryLoaded === 'function') {
                ensureDictionaryLoaded().then(() => {
                    const enriched = resolveCanonicalWordEntry(headword);
                    if (!enriched) return;
                    const canonKey = normalizeSharedWordKey(enriched.headword);
                    if (!canonKey) return;
                    const cur = hasOwnDictKey(_entriesMap, wKey) ? _entriesMap[wKey] : null;
                    if (!cur || cur.f !== 1) return;
                    if (canonKey !== wKey) {
                        delete _entriesMap[wKey];
                    }
                    _entriesMap[canonKey] = {
                        w: enriched.headword,
                        f: 1,
                        ts: cur.ts,
                        add: cur.add || cur.ts,
                        tr: trimStrSafe(enriched.entry?.d || cur.tr || '', 180),
                        ph: trimStrSafe(enriched.phonetic || cur.ph || '', 64),
                        pos: trimStrSafe(enriched.partOfSpeech || cur.pos || '', 24),
                        bk: cur.bk || curBook
                    };
                    markLocalVocabDirty();
                    persistToLocal(true);
                    scheduleSharedCloudSync(false);
                }).catch(() => {});
            }
        }

        markLocalVocabDirty();
        persistToLocal(true);
        scheduleSharedCloudSync(true);
        if (typeof window.saveUserCloudData === 'function') {
            Promise.resolve(window.saveUserCloudData(null, false)).catch(() => {});
        }
        return { favorited: nextFav, wordId, headword, record: _entriesMap[wKey] };
    }

    function getFavoriteList() {
        const list = [];
        Object.keys(_entriesMap).forEach((k) => {
            if (!hasOwnDictKey(_entriesMap, k)) return;
            const e = _entriesMap[k];
            if (!e || e.f !== 1 || !e.w) return;
            list.push({
                wordId: makeSafeVocabStem(e.w),
                word: e.w,
                translation: e.tr || '',
                phonetic: e.ph || '',
                partOfSpeech: e.pos || '',
                bookId: e.bk || 'cet4',
                isFavorite: true,
                favUpdatedAt: e.ts * 1000,
                firstAddedAt: (e.add || e.ts) * 1000,
                lastReviewedAt: e.ts * 1000
            });
        });
        return list.sort((a, b) => (b.favUpdatedAt || 0) - (a.favUpdatedAt || 0));
    }

    function updateNotebookMenuCountUI() {
        const count = getFavoriteList().length;
        const badge = document.getElementById('hero-word-toy-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function refreshAllPageWordBadges() {
        updateNotebookMenuCountUI();
        // 实时刷新当前已打开的查词气泡收藏按钮状态
        const popover = document.getElementById('dict-popover');
        if (popover && popover.classList && popover.classList.contains('active') && popover._currentLookupWord) {
            const favBtn = document.getElementById('popover-fav-btn');
            if (favBtn) {
                const canViewDef = !!(window.ToyPermissions && typeof window.ToyPermissions.canUseLookupMode === 'function' && window.ToyPermissions.canUseLookupMode());
                const isFav = isWordFavorited(popover._currentLookupWord);
                favBtn.classList.toggle('is-favorited', isFav);
                favBtn.textContent = isFav ? '✓ 已加生词本' : (canViewDef ? '☆ 生词本' : '☆ 加入生词本');
            }
        }
        // 若用户正停留在「统计」Tab，实时刷新「生词积累」计数
        if (window.activeHomeTab === 'stats' && window.HomeTabs && typeof window.HomeTabs.refreshActivePage === 'function') {
            try { window.HomeTabs.refreshActivePage(); } catch (e) {}
        }
    }

    function buildJumpExtraAndUrl() {
        const vst = getOrInitVst();
        const favTokens = [];
        const unfavTokens = [];

        const favEntries = [];
        const tombEntries = [];
        Object.keys(_entriesMap).forEach((k) => {
            if (!hasOwnDictKey(_entriesMap, k)) return;
            const e = _entriesMap[k];
            if (!e || !e.w || !(e.ts > 0)) return;
            if (e.f === 1) favEntries.push(e);
            else tombEntries.push(e);
        });
        favEntries.sort((a, b) => b.ts - a.ts);
        tombEntries.sort((a, b) => b.ts - a.ts);

        favEntries.slice(0, 60).forEach((e) => {
            const rel = Math.max(1, e.ts - VOCAB_EPOCH_SEC).toString(36);
            favTokens.push(`${encodeURIComponent(e.w)}:${rel}`);
        });
        tombEntries.slice(0, 40).forEach((e) => {
            const rel = Math.max(1, e.ts - VOCAB_EPOCH_SEC).toString(36);
            unfavTokens.push(`${encodeURIComponent(e.w)}:${rel}`);
        });

        const extra = {
            from: 'listening_toy',
            vst
        };
        if (favTokens.length > 0) extra.favDelta = favTokens.join(',');
        if (unfavTokens.length > 0) extra.unfavDelta = unfavTokens.join(',');

        const qs = Object.keys(extra)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(extra[k])}`)
            .join('&');
        const targetUrl = `https://www.bilibili.com/toy/CL2Plz4HgDfed3Il/index.html?${qs}`;
        return { extra, targetUrl };
    }

    async function openWordToyApp() {
        try {
            const currentVst = getOrInitVst();
            if (currentVst) {
                bindVst(currentVst, false);
            }
            persistToLocal(true);
            // 严禁传 useBeacon=true 跳过拉取，统一走带 keepalive 的 Pull-Before-Push 安全合并
            const syncTasks = [pushToSharedCloudServer(false)];
            if (typeof window.saveUserCloudData === 'function') {
                syncTasks.push(Promise.resolve(window.saveUserCloudData(null, true)));
            }
            await Promise.race([
                Promise.allSettled(syncTasks),
                new Promise(resolve => setTimeout(resolve, 260))
            ]);
        } catch (e) {}

        const { extra, targetUrl } = buildJumpExtraAndUrl();
        if (window.toy && typeof window.toy.navigate === 'function') {
            window.toy.navigate({
                type: 'toy',
                id: 'CL2Plz4HgDfed3Il',
                extra
            }).catch(() => {
                try {
                    const win = window.open(targetUrl, '_blank');
                    if (!win) window.location.href = targetUrl;
                } catch (e) {
                    window.location.href = targetUrl;
                }
            });
            return;
        }
        try {
            const win = window.open(targetUrl, '_blank');
            if (!win) window.location.href = targetUrl;
        } catch (e) {
            window.location.href = targetUrl;
        }
    }

    const HERO_WORD_GUIDE_KEY = 'toy_hero_word_guide_seen_v1';

    function dismissHeroWordToyGuide(markSeen = false) {
        if (markSeen) {
            try {
                window.__toyLS.setItem(HERO_WORD_GUIDE_KEY, '1');
            } catch (e) {}
        }
        const guide = document.getElementById('hero-word-toy-guide');
        const btn = document.getElementById('btn-hero-word-toy');
        if (btn) btn.classList.remove('is-guide-pulsing');
        if (!guide) return;
        guide.classList.remove('show');
        setTimeout(() => {
            if (guide.parentNode) guide.parentNode.removeChild(guide);
        }, 280);
    }

    function maybeShowHeroWordToyGuide(force = false) {
        if (!force) return;
        const wrap = document.getElementById('hero-word-toy-wrap');
        const btn = document.getElementById('btn-hero-word-toy');
        if (!wrap || !btn) return;

        let guide = document.getElementById('hero-word-toy-guide');
        if (!guide) {
            guide = document.createElement('div');
            guide.id = 'hero-word-toy-guide';
            guide.className = 'hero-word-toy-guide';
            guide.setAttribute('role', 'status');
            guide.innerHTML = `
                <div class="hero-word-guide-arrow"></div>
                <div class="hero-word-guide-body" id="hero-word-guide-body">
                    <div class="hero-word-guide-title">
                        <span class="hero-word-guide-icon">📖</span>
                        <span>生词本联动「单词Toy」</span>
                    </div>
                    <div class="hero-word-guide-sub">题内点词收藏 · 点此直达背词 <span class="hero-word-guide-hand">👉</span></div>
                </div>
                <button type="button" class="hero-word-guide-close" id="hero-word-guide-close" aria-label="关闭引导">✕</button>
            `;
            wrap.appendChild(guide);

            const closeBtn = guide.querySelector('#hero-word-guide-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dismissHeroWordToyGuide(true);
                });
            }
            const bodyEl = guide.querySelector('#hero-word-guide-body');
            if (bodyEl) {
                bodyEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dismissHeroWordToyGuide(true);
                    openWordToyApp();
                });
            }
        }

        const showNow = () => {
            if (!guide.parentNode) return;
            btn.classList.add('is-guide-pulsing');
            guide.classList.add('show');
        };

        const splash = document.getElementById('app-splash-screen');
        if (splash && !splash.classList.contains('dissolved') && splash.style.display !== 'none') {
            setTimeout(showNow, 520);
        } else {
            requestAnimationFrame(() => setTimeout(showNow, 120));
        }
    }

    function ensureHeroWordToyButtonMounted() {
        const popLookup = document.getElementById('pop-item-lookup');
        if (popLookup) {
            popLookup.style.display = 'none';
        }
        const hintTextEl = document.querySelector('#top-menu-hint-popover .top-menu-hint-text span');
        if (hintTextEl) {
            hintTextEl.innerHTML = '点击右上角可随时开启 <b class="kbd-highlight">双语对照</b>、切换 <b class="kbd-highlight">横竖屏</b>';
        }

        const stack = document.querySelector('.hero-right-action-stack');
        if (!stack) return;
        let wrap = document.getElementById('hero-word-toy-wrap');
        let btn = document.getElementById('btn-hero-word-toy');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'hero-word-toy-wrap';
            wrap.id = 'hero-word-toy-wrap';
            const avatarWrap = document.getElementById('home-user-avatar-wrap');
            if (avatarWrap && avatarWrap.parentNode === stack) {
                stack.insertBefore(wrap, avatarWrap);
            } else {
                stack.appendChild(wrap);
            }
        }
        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'hero-glass-menu-btn';
            btn.id = 'btn-hero-word-toy';
            btn.title = '前往单词Toy · 生词本';
            btn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    <path d="M9 7h6"></path>
                    <path d="M9 11h4"></path>
                </svg>
                <span class="hero-btn-micro-label">生词本</span>
                <span class="hero-word-toy-badge" id="hero-word-toy-badge" style="display:none;">0</span>
            `;
            wrap.appendChild(btn);
        } else if (btn.parentNode !== wrap) {
            wrap.appendChild(btn);
        }
        if (!btn._wordToyBound) {
            btn._wordToyBound = true;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismissHeroWordToyGuide(true);
                openWordToyApp();
            });
        }
        updateNotebookMenuCountUI();
    }

    if (typeof window !== 'undefined') {
        loadFromLocal();
        window.openWordToyApp = openWordToyApp;
        window.showHeroWordToyGuide = maybeShowHeroWordToyGuide;
        window.dismissHeroWordToyGuide = dismissHeroWordToyGuide;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', ensureHeroWordToyButtonMounted);
        } else {
            ensureHeroWordToyButtonMounted();
        }
        window.addEventListener('storage', (e) => {
            if (!e.key || e.key === SHARED_BRIDGE_V2_KEY || e.key.endsWith('_vocab_favs_v2')) {
                loadFromLocal();
            }
        });
        const ch = getBroadcastChannel();
        if (ch) {
            ch.addEventListener('message', (evt) => {
                if (evt?.data?.sender === _senderId) return;
                if (evt?.data?.type === 'vocab_bridge_v2_updated') {
                    loadFromLocal();
                }
            });
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                loadFromLocal();
                pullFromSharedCloudServer().catch(() => {});
            }
        });
        window.addEventListener('pageshow', () => {
            loadFromLocal();
            pullFromSharedCloudServer().catch(() => {});
        });
        window.addEventListener('focus', () => {
            loadFromLocal();
            pullFromSharedCloudServer().catch(() => {});
        });
        setTimeout(() => {
            if (!window._initialBootCloudLoadDone) {
                pullFromSharedCloudServer().catch(() => {});
            }
        }, 450);
    }

    return {
        loadFromLocal,
        persistToLocal,
        pullFromSharedCloudServer,
        pushToSharedCloudServer,
        flushPendingSync,
        exportCloudPayload,
        mergeCloudPayload,
        exportCompactFavoritesForCloud,
        mergeCompactFavoritesFromCloud,
        getVst: getOrInitVst,
        bindVst,
        getOwnerHash: getActiveOwnerHash,
        bindOwnerHash,
        canSyncVstToBiliCloud,
        markInitialCloudReadDone,
        clearSharedAnonVst,
        onProfileUpdated,
        backfillMissingDefinitions,
        onUserSwitched,
        isFavorited: isWordFavorited,
        toggleFavorite: toggleFavoriteWord,
        getFavoriteList,
        openWordToyApp,
        updateNotebookMenuCountUI,
        refreshAllPageWordBadges
    };
})();
window.VocabNotebookBridge = VocabNotebookBridge;

function makeTextClickable(text) {
    if (!text) return '';
    return text.replace(/([a-zA-Z]+(?:(?:'|-)[a-zA-Z]+)*)/g, '<span class="dict-word" data-word="$1">$1</span>');
}

function formatPosDefinitions(defText) {
    if (!defText) return '暂无详细释义';
    const posTagRegex = /(?=\b(?:n|v|adj|adv|prep|conj|pron|num|art|vt|vi|aux|phrase|abbr|det)\.\s*)/gi;
    const parts = defText.split(posTagRegex).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return defText;

    return parts.map(part => {
        const styledPart = part.replace(/^((?:n|v|adj|adv|prep|conj|pron|num|art|vt|vi|aux|phrase|abbr|det)\.)/i, '<strong class="popover-pos-tag">$1</strong>');
        return `<div class="popover-def-line">${styledPart}</div>`;
    }).join('');
}

let _lastDictClickPoint = null;

function positionPopoverAtTarget(dictPopover, targetEl) {
    if (!dictPopover || !targetEl) return;
    const arrowEl = dictPopover.querySelector('#dict-popover-arrow');

    if (window.UXFloatingUI && typeof window.UXFloatingUI.computePosition === 'function') {
        dictPopover.style.position = 'fixed';
        window.UXFloatingUI.computePosition(targetEl, dictPopover, arrowEl, _lastDictClickPoint);
        window.UXFloatingUI.startAutoUpdate(targetEl, dictPopover, arrowEl, _lastDictClickPoint, hideContextualPopover);
        return;
    }

    const rect = targetEl.getBoundingClientRect();
    const popoverRect = dictPopover.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX + (rect.width / 2) - (popoverRect.width / 2);

    // Horizontal viewport clamp
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popoverRect.width - 10;
    }

    // Vertical viewport flip if overflowing bottom screen
    if (rect.bottom + popoverRect.height + 10 > window.innerHeight && rect.top - popoverRect.height - 10 > 0) {
        top = rect.top + window.scrollY - popoverRect.height - 6;
    }

    dictPopover.style.top = `${top}px`;
    dictPopover.style.left = `${left}px`;
}

function getOrCreateDictPopover() {
    let popover = document.getElementById('dict-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'dict-popover';
        popover.className = 'dict-popover-bubble';
        document.body.appendChild(popover);
    }

    if (!popover.querySelector('#popover-fav-btn')) {
        popover.innerHTML = `
            <div class="dict-popover-arrow" id="dict-popover-arrow"></div>
            <div class="popover-header">
                <div class="popover-word-group">
                    <span class="popover-word" id="popover-word"></span>
                    <span class="popover-phonetic" id="popover-phonetic"></span>
                </div>
                <div class="popover-actions-group">
                    <button type="button" class="popover-fav-btn" id="popover-fav-btn" title="加入或移出单词Toy生词本">☆ 加入生词本</button>
                    <button type="button" class="popover-unlock-def-btn" id="popover-unlock-def-btn" style="display:none;">⚡ 充电解锁释义</button>
                    <button type="button" class="popover-underline-btn" id="popover-underline-btn" style="display:none;"></button>
                </div>
            </div>
            <div class="popover-def" id="popover-def"></div>
        `;
    }

    if (!popover._eventsBound) {
        popover._eventsBound = true;
        const underlineBtn = popover.querySelector('#popover-underline-btn');
        if (underlineBtn) {
            underlineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const targetWordEl = popover._activeWordEl;
                const passageCard = targetWordEl && targetWordEl.closest ? targetWordEl.closest('#written-passage-card') : null;
                if (targetWordEl && passageCard && typeof window.eraseContiguousUnderlineSpan === 'function') {
                    window.eraseContiguousUnderlineSpan(targetWordEl, passageCard);
                    underlineBtn.classList.remove('is-active');
                    underlineBtn.style.display = 'none';
                }
            });
        }

        const unlockDefBtn = popover.querySelector('#popover-unlock-def-btn');
        if (unlockDefBtn) {
            unlockDefBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                hideContextualPopover();
                if (window.ToyPermissions && typeof window.ToyPermissions.showUnlockModal === 'function') {
                    window.ToyPermissions.showUnlockModal('lookup');
                }
            });
        }

        const favBtn = popover.querySelector('#popover-fav-btn');
        if (favBtn) {
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const rawW = popover._currentLookupWord || document.getElementById('popover-word')?.textContent || '';
                if (!rawW || !window.VocabNotebookBridge) return;
                const res = window.VocabNotebookBridge.toggleFavorite(rawW);
                const canViewDef = !!(window.ToyPermissions && typeof window.ToyPermissions.canUseLookupMode === 'function' && window.ToyPermissions.canUseLookupMode());
                favBtn.classList.toggle('is-favorited', res.favorited);
                favBtn.textContent = res.favorited ? '✓ 已加生词本' : (canViewDef ? '☆ 生词本' : '☆ 加入生词本');
                window.VocabNotebookBridge.updateNotebookMenuCountUI();
                if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                    window.FeedbackEngine.triggerHaptic('selection');
                }
            });
        }

        popover.addEventListener('mouseenter', () => {
            if (hoverHideTimeout) {
                clearTimeout(hoverHideTimeout);
                hoverHideTimeout = null;
            }
        });

        popover.addEventListener('mouseleave', () => {
            activeHoverTarget = null;
            hideContextualPopover();
        });
    }
    return popover;
}

function clearDictWordHighlights() {
    document.querySelectorAll('.dict-word.valid-entry, .dict-word.dict-active-highlight').forEach(el => {
        el.classList.remove('valid-entry', 'dict-active-highlight');
    });
}

function showContextualPopover(rawWord, targetEl, _retried = false) {
    const dictPopover = getOrCreateDictPopover();
    if (!rawWord || !targetEl || !dictPopover) return;
    
    const resolved = resolveCanonicalWordEntry(rawWord);
    const entry = resolved ? resolved.entry : null;

    // If dictionary map is not yet loaded in memory and not found in compound dictionary
    if (!entry && !window.DICT_MAP && !_retried) {
        ensureDictionaryLoaded().then(() => {
            if (window.DICT_MAP && activeHoverTarget === targetEl) {
                showContextualPopover(rawWord, targetEl, true);
            }
        }).catch(() => {});
        return;
    }

    // If word is NOT in dictionary, do nothing at all! (无事发生，不弹出也不高亮)
    if (!entry) {
        clearDictWordHighlights();
        hideContextualPopover();
        return;
    }

    clearDictWordHighlights();
    if (typeof window.dismissGestureWhisperPill === 'function') {
        window.dismissGestureWhisperPill(false);
    }
    if (typeof window.closeTopMenuHint === 'function') {
        window.closeTopMenuHint(false);
    }
    targetEl.classList.add('valid-entry', 'dict-active-highlight');
    dictPopover._currentLookupWord = resolved ? resolved.headword : rawWord;

    const popWord = document.getElementById('popover-word');
    const popPhonetic = document.getElementById('popover-phonetic');
    const popDef = document.getElementById('popover-def');
    const favBtn = document.getElementById('popover-fav-btn');
    const unlockDefBtn = document.getElementById('popover-unlock-def-btn');

    const canViewDef = !!(window.ToyPermissions && typeof window.ToyPermissions.canUseLookupMode === 'function' && window.ToyPermissions.canUseLookupMode());
    dictPopover.classList.toggle('is-locked-def', !canViewDef);

    const displayWord = (canViewDef && resolved && resolved.headword && resolved.headword !== rawWord.toLowerCase())
        ? `${rawWord} (${resolved.headword})`
        : rawWord;
    if (popWord) popWord.textContent = displayWord;

    if (canViewDef) {
        const rawPhonetic = entry.p || entry.us || entry.uk || '';
        const phoneticStr = rawPhonetic ? `美 [${rawPhonetic.replace(/[\[\]\/]/g, '')}]` : '';
        if (popPhonetic) {
            popPhonetic.textContent = phoneticStr;
            popPhonetic.style.display = phoneticStr ? 'inline' : 'none';
        }
        if (popDef) {
            popDef.innerHTML = formatPosDefinitions(entry.d);
            popDef.style.display = 'block';
        }
        if (unlockDefBtn) unlockDefBtn.style.display = 'none';
    } else {
        // 非充电用户：仅显示「加入生词本」与「充电解锁释义」按钮，不显示音标与释义
        if (popPhonetic) {
            popPhonetic.textContent = '';
            popPhonetic.style.display = 'none';
        }
        if (popDef) {
            popDef.innerHTML = '';
            popDef.style.display = 'none';
        }
        if (unlockDefBtn) unlockDefBtn.style.display = 'inline-flex';
    }

    if (favBtn && window.VocabNotebookBridge) {
        const isFav = window.VocabNotebookBridge.isFavorited(rawWord);
        favBtn.classList.toggle('is-favorited', isFav);
        favBtn.textContent = isFav ? '✓ 已加生词本' : (canViewDef ? '☆ 生词本' : '☆ 加入生词本');
        window.VocabNotebookBridge.updateNotebookMenuCountUI();
    }

    const underlineBtn = document.getElementById('popover-underline-btn');
    const inPassage = !!(targetEl && typeof targetEl.closest === 'function' && targetEl.closest('#written-passage-card') && !targetEl.closest('.proof-word, .corr-item'));
    dictPopover._activeWordEl = inPassage ? targetEl : null;
    if (underlineBtn) {
        const isUnderlined = inPassage && targetEl.classList.contains('is-user-underlined');
        if (isUnderlined) {
            underlineBtn.style.display = 'inline-flex';
            underlineBtn.classList.add('is-active');
            underlineBtn.textContent = '✕ 擦除画线';
        } else {
            underlineBtn.classList.remove('is-active');
            underlineBtn.style.display = 'none';
        }
    }

    dictPopover.classList.add('active');
    positionPopoverAtTarget(dictPopover, targetEl);
}

function hideContextualPopover() {
    if (window.UXFloatingUI && typeof window.UXFloatingUI.stopAutoUpdate === 'function') {
        window.UXFloatingUI.stopAutoUpdate();
    }
    const dictPopover = document.getElementById('dict-popover');
    if (dictPopover) dictPopover.classList.remove('active');
    clearDictWordHighlights();
}

/**
 * 判断某单词节点是否处于「零冲突直点查词安全区」（方案 A：原文横划=画线，轻点单词=直接查词/加生词本）：
 * - 阅读原文 (#written-passage-card，排除挖空徽章与改错词)
 * - 题干 (#q-h2, #written-q-h2)
 * - 解析正文与全文译文 (#exp-body-p, #written-exp-body-p, #written-translation-card，排除点击回跳定位框 .exp-evidence-box / .exp-synonym-box)
 * - 随刷随解已作答完毕锁定的选项 (.opt-btn.disabled, .word-bank-opt-btn.disabled，排除已划掉待恢复态 .opt-eliminated)
 * 注意：未作答选项 (.opt-btn:not(.disabled)) 单击为「选答案」，故绝不在直点安全区内！
 */
function isZeroConflictDirectClickWord(wordEl) {
    if (!wordEl || typeof wordEl.closest !== 'function') return false;
    if (wordEl.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected, .sentence-insert-square, .trans-marker-badge, .passage-evidence-badge, .proof-word, .corr-item, .cloze-input')) {
        return false;
    }
    if (wordEl.closest('#written-explanation-card .exp-evidence-box, #written-explanation-card .exp-synonym-box')) {
        return false; // 笔试解析证据框单击用于回跳定位原文，长按单词可查词
    }
    const optBtn = wordEl.closest('.opt-btn, .word-bank-opt-btn, .matching-paragraph-opt-btn');
    if (optBtn) {
        // 随刷随解：作答后其余选项仍可随时改选，故仅「当前已选中」的选项允许直接点击单词查词加生词本
        return !window.isExamMode && optBtn.classList.contains('opt-current-pick') && !optBtn.classList.contains('opt-eliminated');
    }
    if (wordEl.closest('#written-passage-card, #q-h2, #written-q-h2, #explanation-card, #exp-body-p, #written-exp-body-p, #written-translation-card, .subj-analysis-text, .subj-model-essay, .writing-en-para, .sheet-starter-line, .ios-subj-body')) {
        return true;
    }
    return false;
}

/**
 * 仅对「单击被回跳定位占用」的笔试解析证据框 (.exp-evidence-box / .exp-synonym-box) 保留静止长按查词：
 * 阅读原文 (#written-passage-card) 已改为「轻点直接查词、按住横划画线」，不设长按定时器，防止用户按住思考准备横划画线时误弹词典！
 */
function isZeroConflictLongPressWord(wordEl) {
    if (!wordEl || typeof wordEl.closest !== 'function') return false;
    return !!wordEl.closest('#written-explanation-card .exp-evidence-box, #written-explanation-card .exp-synonym-box');
}

function initDictionaryEvents() {
    getOrCreateDictPopover();

    // Hover (Desktop - only in explicit Lookup Mode)
    document.addEventListener('mouseover', (e) => {
        if (!window.isLookupMode || (window.ToyPermissions && !window.ToyPermissions.canUseLookupMode())) return;
        const wordEl = e.target.closest('.dict-word');
        if (wordEl) {
            const rawWord = wordEl.dataset.word || wordEl.textContent;
            const entry = findWordEntry(rawWord);
            if (!entry && window.DICT_MAP) return;

            if (hoverHideTimeout) {
                clearTimeout(hoverHideTimeout);
                hoverHideTimeout = null;
            }

            _lastDictClickPoint = { x: e.clientX, y: e.clientY };
            activeHoverTarget = wordEl;
            showContextualPopover(rawWord, wordEl);
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (!window.isLookupMode || (window.ToyPermissions && !window.ToyPermissions.canUseLookupMode())) return;
        const wordEl = e.target.closest('.dict-word');
        if (wordEl && wordEl === activeHoverTarget) {
            const related = e.relatedTarget;
            if (related && (related.closest('#dict-popover') || related.closest('.dict-word'))) return;
            hoverHideTimeout = setTimeout(() => {
                activeHoverTarget = null;
                hideContextualPopover();
            }, 180);
        }
    });

    // Stationary Long-Press (0.42s) on words in Passage / Stem / Analysis (Zero conflict with passage tap-underline, swipe-underline, or option elimination)
    let lpTimer = null;
    let lpWordEl = null;
    let lpStartX = 0;
    let lpStartY = 0;

    const cancelWordLongPress = () => {
        if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
        }
        lpWordEl = null;
    };

    const startWordLongPress = (wordEl, clientX, clientY) => {
        cancelWordLongPress();
        if (window.isLookupMode || !isZeroConflictLongPressWord(wordEl)) return;
        lpWordEl = wordEl;
        lpStartX = clientX;
        lpStartY = clientY;
        lpTimer = setTimeout(() => {
            lpTimer = null;
            const target = lpWordEl;
            lpWordEl = null;
            if (!target || window.isLookupMode) return;
            const rawWord = target.dataset.word || target.textContent;
            const entry = findWordEntry(rawWord);
            if (!entry && window.DICT_MAP) return;

            // Suppress the subsequent mouseup/touchend click so passage tap-underline does NOT fire!
            window._suppressNextLookupClickUntil = Date.now() + 580;
            _lastDictClickPoint = { x: lpStartX, y: lpStartY };
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
            activeHoverTarget = target;
            showContextualPopover(rawWord, target);
        }, 420);
    };

    const moveWordLongPress = (clientX, clientY) => {
        if (!lpTimer) return;
        if (Math.abs(clientX - lpStartX) > 6 || Math.abs(clientY - lpStartY) > 6) {
            cancelWordLongPress();
        }
    };

    document.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            const wordEl = e.target && e.target.closest ? e.target.closest('.dict-word') : null;
            if (wordEl) {
                startWordLongPress(wordEl, e.touches[0].clientX, e.touches[0].clientY);
            }
        } else {
            cancelWordLongPress();
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length === 1) {
            moveWordLongPress(e.touches[0].clientX, e.touches[0].clientY);
        } else {
            cancelWordLongPress();
        }
    }, { passive: true });

    document.addEventListener('touchend', cancelWordLongPress, { passive: true });
    document.addEventListener('touchcancel', cancelWordLongPress, { passive: true });

    document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const wordEl = e.target && e.target.closest ? e.target.closest('.dict-word') : null;
        if (wordEl) {
            startWordLongPress(wordEl, e.clientX, e.clientY);
        }
    });
    document.addEventListener('mousemove', (e) => moveWordLongPress(e.clientX, e.clientY));
    document.addEventListener('mouseup', cancelWordLongPress);

    // Click / Tap (Mobile & Desktop)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#dict-popover, #vocab-notebook-drawer-mask, [data-haptic-bridge], #ios-taptic-switch-bridge')) {
            return;
        }
        // 绝不拦截原文内交互式挖空/题号徽章及快捷跳题胶囊的点击（无论是否开启查词模式或刚结束滑动）
        const interactiveBlankEl = e.target && e.target.closest
            ? e.target.closest('.written-cloze-blank, .seven-blank-reflected, .fill-blank-reflected, .sentence-insert-square, .trans-marker-badge, .passage-evidence-badge, .blank-quick-jump-pill, .blank-quick-next-btn')
            : null;
        if (interactiveBlankEl) {
            window._suppressNextLookupClickUntil = 0;
            hideContextualPopover();
            return;
        }
        if (window._suppressNextLookupClickUntil && Date.now() < window._suppressNextLookupClickUntil) {
            window._suppressNextLookupClickUntil = 0;
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        const wordEl = e.target && e.target.closest ? e.target.closest('.dict-word') : null;
        const canTriggerLookup = wordEl && (
            (window.isLookupMode && (!window.ToyPermissions || window.ToyPermissions.canUseLookupMode())) ||
            (!window.isLookupMode && isZeroConflictDirectClickWord(wordEl))
        );

        if (canTriggerLookup) {
            e.stopPropagation();
            e.preventDefault();
            const dictPopover = document.getElementById('dict-popover');
            if (activeHoverTarget === wordEl && dictPopover && dictPopover.classList.contains('active')) {
                activeHoverTarget = null;
                hideContextualPopover();
                return;
            }
            _lastDictClickPoint = { x: e.clientX, y: e.clientY };
            const rawWord = wordEl.dataset.word || wordEl.textContent;
            const entry = findWordEntry(rawWord);
            if (!entry && window.DICT_MAP) {
                activeHoverTarget = null;
                hideContextualPopover();
                if (wordEl.classList.contains('is-user-underlined')) {
                    const passageCard = wordEl.closest('#written-passage-card');
                    if (passageCard && typeof window.eraseContiguousUnderlineSpan === 'function') {
                        window.eraseContiguousUnderlineSpan(wordEl, passageCard);
                    }
                }
                return;
            }
            if (window.FeedbackEngine && typeof window.FeedbackEngine.triggerHaptic === 'function') {
                window.FeedbackEngine.triggerHaptic('selection');
            }
            activeHoverTarget = wordEl;
            showContextualPopover(rawWord, wordEl);
            return;
        }
        
        if (!e.target.closest('#dict-popover')) {
            hideContextualPopover();
        }
    }, true);
}
