/* === js/toy_crdt_serializer.js === */
/**
 * ==========================================================================
 * CRDT Exam Merger, Cloud 1024-Byte Compact Serializer & Settings Signer (js/toy_crdt_serializer.js)
 * ==========================================================================
 */

/**
 * Exact UTF-8 byte counter (TextEncoder with pure-JS surrogate-aware fallback for VM/legacy environments)
 */
const _sharedUtf8Encoder = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;
function utf8ByteLength(str) {
    if (typeof str !== 'string') str = String(str == null ? '' : str);
    if (_sharedUtf8Encoder) {
        return _sharedUtf8Encoder.encode(str).length;
    }
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7f) {
            bytes += 1;
        } else if (code <= 0x7ff) {
            bytes += 2;
        } else if (code >= 0xd800 && code <= 0xdbff) {
            bytes += 4;
            i++;
        } else {
            bytes += 3;
        }
    }
    return bytes;
}
window.utf8ByteLength = utf8ByteLength;

/**
 * Deep CRDT-style Exam Record Merger
 * Prevents cross-module overwrites between Listening (answers), Written (writtenAnswers / underlines / eliminatedOptions),
 * and Dictation (dictationCompleted) within the same exam title, while honoring _deleted tombstones and redo resetAt timestamps.
 */
function mergeExamRecord(localExam, remoteExam) {
    if (!localExam && !remoteExam) return {};
    if (!localExam || typeof localExam !== 'object') return JSON.parse(JSON.stringify(remoteExam));
    if (!remoteExam || typeof remoteExam !== 'object') return JSON.parse(JSON.stringify(localExam));

    const localTime = typeof localExam.timestamp === 'number' ? localExam.timestamp : 0;
    const remoteTime = typeof remoteExam.timestamp === 'number' ? remoteExam.timestamp : 0;
    const merged = Object.assign({}, localExam, remoteExam);
    merged.timestamp = Math.max(localTime, remoteTime, Date.now() === 0 ? 0 : (localTime || remoteTime));

    const maxAnsReset = Math.max(
        typeof localExam.answersResetAt === 'number' ? localExam.answersResetAt : 0,
        typeof remoteExam.answersResetAt === 'number' ? remoteExam.answersResetAt : 0
    );
    const maxWriReset = Math.max(
        typeof localExam.writtenResetAt === 'number' ? localExam.writtenResetAt : 0,
        typeof remoteExam.writtenResetAt === 'number' ? remoteExam.writtenResetAt : 0
    );
    const maxDictReset = Math.max(
        typeof localExam.dictResetAt === 'number' ? localExam.dictResetAt : 0,
        typeof remoteExam.dictResetAt === 'number' ? remoteExam.dictResetAt : 0
    );
    if (maxAnsReset > 0) merged.answersResetAt = maxAnsReset;
    if (maxWriReset > 0) merged.writtenResetAt = maxWriReset;
    if (maxDictReset > 0) merged.dictResetAt = maxDictReset;

    // 1. Listening Score & Written Score (preserve valid scores, prefer newer submission, drop scores older than resetAt)
    const lScoreTs = localExam.scoreTimestamp || localTime;
    const rScoreTs = remoteExam.scoreTimestamp || remoteTime;
    const lScore = (typeof localExam.score === 'number' && !isNaN(localExam.score) && !(maxAnsReset > 0 && lScoreTs <= maxAnsReset)) ? localExam.score : undefined;
    const rScore = (typeof remoteExam.score === 'number' && !isNaN(remoteExam.score) && !(maxAnsReset > 0 && rScoreTs <= maxAnsReset)) ? remoteExam.score : undefined;
    if (lScore !== undefined && rScore !== undefined) {
        merged.score = (rScoreTs > lScoreTs) ? rScore : ((lScoreTs > rScoreTs) ? lScore : Math.max(lScore, rScore));
        merged.scoreTimestamp = Math.max(lScoreTs, rScoreTs);
    } else if (lScore !== undefined) {
        merged.score = lScore;
        if (localExam.scoreTimestamp) merged.scoreTimestamp = localExam.scoreTimestamp;
    } else if (rScore !== undefined) {
        merged.score = rScore;
        if (remoteExam.scoreTimestamp) merged.scoreTimestamp = remoteExam.scoreTimestamp;
    } else {
        delete merged.score;
        delete merged.scoreTimestamp;
    }

    const lwScoreTs = localExam.writtenScoreTimestamp || localTime;
    const rwScoreTs = remoteExam.writtenScoreTimestamp || remoteTime;
    const lwScore = (typeof localExam.writtenScore === 'number' && !isNaN(localExam.writtenScore) && !(maxWriReset > 0 && lwScoreTs <= maxWriReset)) ? localExam.writtenScore : undefined;
    const rwScore = (typeof remoteExam.writtenScore === 'number' && !isNaN(remoteExam.writtenScore) && !(maxWriReset > 0 && rwScoreTs <= maxWriReset)) ? remoteExam.writtenScore : undefined;
    if (lwScore !== undefined && rwScore !== undefined) {
        merged.writtenScore = (rwScoreTs > lwScoreTs) ? rwScore : ((lwScoreTs > rwScoreTs) ? lwScore : Math.max(lwScore, rwScore));
        merged.writtenScoreTimestamp = Math.max(lwScoreTs, rwScoreTs);
    } else if (lwScore !== undefined) {
        merged.writtenScore = lwScore;
        if (localExam.writtenScoreTimestamp) merged.writtenScoreTimestamp = localExam.writtenScoreTimestamp;
    } else if (rwScore !== undefined) {
        merged.writtenScore = rwScore;
        if (remoteExam.writtenScoreTimestamp) merged.writtenScoreTimestamp = remoteExam.writtenScoreTimestamp;
    } else {
        delete merged.writtenScore;
        delete merged.writtenScoreTimestamp;
    }

    // 2. Deep merge Listening answers per question index (filtering entries older than answersResetAt)
    if (localExam.answers || remoteExam.answers || maxAnsReset > 0) {
        const rawLAns = (localExam.answers && typeof localExam.answers === 'object') ? localExam.answers : {};
        const rawRAns = (remoteExam.answers && typeof remoteExam.answers === 'object') ? remoteExam.answers : {};
        const mergedAns = {};
        const allQKeys = new Set([...Object.keys(rawLAns), ...Object.keys(rawRAns)]);
        const cloneAnsObj = (v, fallbackTs) => (typeof v === 'string')
            ? { selected: v, isCorrect: true, ts: fallbackTs }
            : Object.assign({}, v);
        allQKeys.forEach(k => {
            const laRaw = rawLAns[k];
            const raRaw = rawRAns[k];
            const lTs = (laRaw && typeof laRaw === 'object' && typeof laRaw.ts === 'number') ? laRaw.ts : localTime;
            const rTs = (raRaw && typeof raRaw === 'object' && typeof raRaw.ts === 'number') ? raRaw.ts : remoteTime;
            const la = (laRaw && !(maxAnsReset > 0 && lTs <= maxAnsReset)) ? laRaw : null;
            const ra = (raRaw && !(maxAnsReset > 0 && rTs <= maxAnsReset)) ? raRaw : null;
            if (la && !ra) {
                mergedAns[k] = cloneAnsObj(la, lTs);
            } else if (!la && ra) {
                mergedAns[k] = cloneAnsObj(ra, rTs);
            } else if (la && ra) {
                mergedAns[k] = (rTs > lTs) ? cloneAnsObj(ra, rTs) : cloneAnsObj(la, lTs);
            }
        });
        merged.answers = mergedAns;
    }

    // 3. Deep merge Written & Proofread answers per question ID / editKey (with _deleted tombstone & writtenResetAt support)
    if (localExam.writtenAnswers || remoteExam.writtenAnswers || maxWriReset > 0) {
        const rawLWA = (localExam.writtenAnswers && typeof localExam.writtenAnswers === 'object') ? localExam.writtenAnswers : {};
        const rawRWA = (remoteExam.writtenAnswers && typeof remoteExam.writtenAnswers === 'object') ? remoteExam.writtenAnswers : {};
        const mergedWA = {};
        const allWKeys = new Set([...Object.keys(rawLWA), ...Object.keys(rawRWA)]);
        allWKeys.forEach(k => {
            const lwRaw = rawLWA[k];
            const rwRaw = rawRWA[k];
            const lTs = (lwRaw && typeof lwRaw.ts === 'number') ? lwRaw.ts : localTime;
            const rTs = (rwRaw && typeof rwRaw.ts === 'number') ? rwRaw.ts : remoteTime;
            const lw = (lwRaw && !(maxWriReset > 0 && lTs <= maxWriReset)) ? lwRaw : null;
            const rw = (rwRaw && !(maxWriReset > 0 && rTs <= maxWriReset)) ? rwRaw : null;
            if (lw && !rw) {
                mergedWA[k] = Object.assign({}, lw);
            } else if (!lw && rw) {
                mergedWA[k] = Object.assign({}, rw);
            } else if (lw && rw) {
                if (rTs > lTs) {
                    mergedWA[k] = Object.assign({}, rw);
                } else if (lTs > rTs) {
                    mergedWA[k] = Object.assign({}, lw);
                } else {
                    if (lw._deleted || rw._deleted) {
                        mergedWA[k] = Object.assign({}, lw._deleted ? lw : rw);
                    } else {
                        const lKeys = Object.keys(lw).length;
                        const rKeys = Object.keys(rw).length;
                        mergedWA[k] = Object.assign({}, (rKeys > lKeys) ? rw : lw);
                    }
                }
            }
        });
        merged.writtenAnswers = mergedWA;
    }

    // 4. Deep merge Dictation / Daily Listening completed sentences (honoring dictResetAt)
    if (localExam.dictationCompleted || remoteExam.dictationCompleted || maxDictReset > 0) {
        const lDictTs = typeof localExam.dictUpdatedAt === 'number' ? localExam.dictUpdatedAt : localTime;
        const rDictTs = typeof remoteExam.dictUpdatedAt === 'number' ? remoteExam.dictUpdatedAt : remoteTime;
        const lDC = (localExam.dictationCompleted && typeof localExam.dictationCompleted === 'object' && !(maxDictReset > 0 && lDictTs <= maxDictReset))
            ? localExam.dictationCompleted
            : {};
        const rDC = (remoteExam.dictationCompleted && typeof remoteExam.dictationCompleted === 'object' && !(maxDictReset > 0 && rDictTs <= maxDictReset))
            ? remoteExam.dictationCompleted
            : {};
        merged.dictationCompleted = Object.assign({}, lDC, rDC);
        const maxDictUpd = Math.max(
            typeof localExam.dictUpdatedAt === 'number' ? localExam.dictUpdatedAt : 0,
            typeof remoteExam.dictUpdatedAt === 'number' ? remoteExam.dictUpdatedAt : 0
        );
        if (maxDictUpd > 0) merged.dictUpdatedAt = maxDictUpd;
    }

    // 5. Merge Passage Underlines (respect newer underlinesUpdatedAt so erasures are preserved)
    if (Array.isArray(localExam.underlines) || Array.isArray(remoteExam.underlines)) {
        const lUlTs = typeof localExam.underlinesUpdatedAt === 'number' ? localExam.underlinesUpdatedAt : 0;
        const rUlTs = typeof remoteExam.underlinesUpdatedAt === 'number' ? remoteExam.underlinesUpdatedAt : 0;
        if (rUlTs > lUlTs && Array.isArray(remoteExam.underlines)) {
            merged.underlines = Array.from(new Set(remoteExam.underlines.map(String)));
            merged.underlinesUpdatedAt = rUlTs;
        } else if (lUlTs > rUlTs && Array.isArray(localExam.underlines)) {
            merged.underlines = Array.from(new Set(localExam.underlines.map(String)));
            merged.underlinesUpdatedAt = lUlTs;
        } else {
            const combined = [
                ...(Array.isArray(localExam.underlines) ? localExam.underlines : []),
                ...(Array.isArray(remoteExam.underlines) ? remoteExam.underlines : [])
            ].map(String);
            merged.underlines = Array.from(new Set(combined));
            merged.underlinesUpdatedAt = Math.max(lUlTs, rUlTs);
        }
    }

    // 6. Merge Eliminated Options per question key (respect newer eliminatedUpdatedAt)
    if (localExam.eliminatedOptions || remoteExam.eliminatedOptions) {
        const lElim = (localExam.eliminatedOptions && typeof localExam.eliminatedOptions === 'object') ? localExam.eliminatedOptions : {};
        const rElim = (remoteExam.eliminatedOptions && typeof remoteExam.eliminatedOptions === 'object') ? remoteExam.eliminatedOptions : {};
        const lElimTs = typeof localExam.eliminatedUpdatedAt === 'number' ? localExam.eliminatedUpdatedAt : 0;
        const rElimTs = typeof remoteExam.eliminatedUpdatedAt === 'number' ? remoteExam.eliminatedUpdatedAt : 0;
        const mergedElim = {};
        const allEKeys = new Set([...Object.keys(lElim), ...Object.keys(rElim)]);
        allEKeys.forEach(k => {
            const le = lElim[k];
            const re = rElim[k];
            if (Array.isArray(le) && !Array.isArray(re)) {
                mergedElim[k] = Array.from(new Set(le));
            } else if (!Array.isArray(le) && Array.isArray(re)) {
                mergedElim[k] = Array.from(new Set(re));
            } else if (Array.isArray(le) && Array.isArray(re)) {
                mergedElim[k] = Array.from(new Set((rElimTs > lElimTs) ? re : ((lElimTs > rElimTs) ? le : [...le, ...re])));
            }
        });
        merged.eliminatedOptions = mergedElim;
        merged.eliminatedUpdatedAt = Math.max(lElimTs, rElimTs);
    }

    return merged;
}
window.mergeExamRecord = mergeExamRecord;


/**
 * Get deterministic full list of all exam titles across all levels (CET-4, CET-6, Gaokao)
 */
function getAllGlobalExamTitles() {
    if (window.EXAMS_MANIFEST && typeof window.EXAMS_MANIFEST === 'object') {
        const titles = [];
        ['cet4', 'cet6', 'gaokao', 'ielts', 'kaoyan'].forEach(lvl => {
            if (Array.isArray(window.EXAMS_MANIFEST[lvl])) {
                window.EXAMS_MANIFEST[lvl].forEach(m => {
                    if (m && m.title && !titles.includes(m.title)) {
                        titles.push(m.title);
                    }
                });
            }
        });
        if (titles.length > 0) return titles;
    }
    return (window.EXAMS_MAP && Object.keys(window.EXAMS_MAP).length > 0)
        ? Object.keys(window.EXAMS_MAP)
        : (window.WRITTEN_EXAMS_MAP ? Object.keys(window.WRITTEN_EXAMS_MAP) : []);
}

/**
 * Get deterministic index for an exam title across all levels
 */
function getExamIndex(title) {
    if (!title) return -1;
    const allTitles = getAllGlobalExamTitles();
    const idx = allTitles.indexOf(title);
    if (idx >= 0) return idx;
    if (window.EXAMS_MAP && window.EXAMS_MAP[title]) {
        return Object.keys(window.EXAMS_MAP).indexOf(title);
    }
    if (window.WRITTEN_EXAMS_MAP && window.WRITTEN_EXAMS_MAP[title]) {
        return Object.keys(window.WRITTEN_EXAMS_MAP).indexOf(title);
    }
    return -1;
}

/**
 * Serialize user settings / preferences for cross-device cloud sync
 */
function getSerializedUserSettings() {
    const tp = window.ToyPermissions;
    const s = {
        pv: 2,
        dictMode: (typeof dictDifficultyMode !== 'undefined') ? dictDifficultyMode : (window.__toyLS.getItem('toy_dict_difficulty_mode') || 'basic'),
        hideQ: !!window.hideListeningQuestion,
        bilingual: !!window.showBilingual,
        dictBilingual: !!window.showDictBilingual,
        writtenBilingual: !!window.showWrittenBilingual,
        lookup: !!window.isLookupMode,
        hasShared: !!(tp && tp.hasShared),
        c4: !!(tp && tp.hasCoinCet4),
        c6: !!(tp && tp.hasCoinCet6),
        cg: !!(tp && tp.hasCoinGaokao),
        cd: !!(tp && tp.hasCoinDaily),
        ci: !!(tp && tp.hasCoinIelts),
        ck: !!(tp && tp.hasCoinKaoyan),
        fl: !!(tp && tp.isFollowing)
    };
    if (window.ToySecurity && typeof window.ToySecurity.signSettings === 'function') {
        s._sg = window.ToySecurity.signSettings(getCurrentUserKey(), s);
    }
    return s;
}

function applySerializedUserSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    if (settings.dictMode === 'basic' || settings.dictMode === 'advanced') {
        if (typeof setDictDifficultyMode === 'function') {
            setDictDifficultyMode(settings.dictMode);
        }
    }
    if (typeof settings.hideQ === 'boolean') {
        window.hideListeningQuestion = settings.hideQ;
        try { window.__toyLS.setItem('cet4_hide_listening_question', String(settings.hideQ)); } catch(e) {}
    }

    if (window.ToyPermissions && !(window.ENABLE_TEST_IDENTITY_SWITCHER && window.ToyPermissions.isTestOverridden)) {
        const isSigValid = (window.ToySecurity && typeof window.ToySecurity.verifySettings === 'function')
            ? window.ToySecurity.verifySettings(getCurrentUserKey(), settings)
            : (Number(settings.pv) >= 2);

        if (isSigValid && Number(settings.pv) >= 2) {
            let permUpdated = false;
            if (settings.hasShared === true) {
                window.ToyPermissions.hasShared = true;
                permUpdated = true;
            }
            if (settings.c4 === true || settings.hasCoinCet4 === true) { window.ToyPermissions.hasCoinCet4 = true; permUpdated = true; }
            if (settings.c6 === true || settings.hasCoinCet6 === true) { window.ToyPermissions.hasCoinCet6 = true; permUpdated = true; }
            if (settings.cg === true || settings.hasCoinGaokao === true) { window.ToyPermissions.hasCoinGaokao = true; permUpdated = true; }
            if (settings.cd === true || settings.hasCoinDaily === true) { window.ToyPermissions.hasCoinDaily = true; permUpdated = true; }
            if (settings.ci === true || settings.hasCoinIelts === true) { window.ToyPermissions.hasCoinIelts = true; permUpdated = true; }
            if (settings.ck === true || settings.hasCoinKaoyan === true) { window.ToyPermissions.hasCoinKaoyan = true; permUpdated = true; }
            if (settings.fl === true || settings.isFollowing === true) { window.ToyPermissions.isFollowing = true; permUpdated = true; }
            if (permUpdated) {
                window.ToyPermissions._saveCachedPermissions();
                window.ToyPermissions.updateUI({ forceLobbyRerender: true });
            }
        }
    }

    const canBilingual = (window.ToyPermissions && typeof window.ToyPermissions.canUseBilingualMode === 'function')
        ? window.ToyPermissions.canUseBilingualMode()
        : false;
    const canLookup = (window.ToyPermissions && typeof window.ToyPermissions.canUseLookupMode === 'function')
        ? window.ToyPermissions.canUseLookupMode()
        : false;

    if (typeof settings.bilingual === 'boolean') {
        window.showBilingual = canBilingual ? settings.bilingual : false;
        try { window.__toyLS.setItem('cet4_bilingual_enabled', String(window.showBilingual)); } catch(e) {}
    }
    if (typeof settings.dictBilingual === 'boolean') {
        window.showDictBilingual = canBilingual ? settings.dictBilingual : false;
    }
    if (typeof settings.writtenBilingual === 'boolean') {
        window.showWrittenBilingual = canBilingual ? settings.writtenBilingual : false;
    }
    if (typeof settings.lookup === 'boolean') {
        window.isLookupMode = canLookup ? settings.lookup : false;
    }
}

/**
 * Compact serialize a single exam for Cloud Storage (Guaranteed <= 950 UTF-8 bytes << 1024 bytes)
 */
function serializeExamForCloud(title) {
    const data = window.completedExams && window.completedExams[title];
    if (!data) return null;
    const compact = {
        s: (typeof data.score === 'number') ? data.score : undefined,
        ws: (typeof data.writtenScore === 'number') ? data.writtenScore : undefined,
        t: data.timestamp || Date.now(),
        ra: (typeof data.answersResetAt === 'number' && data.answersResetAt > 0) ? data.answersResetAt : undefined,
        rw: (typeof data.writtenResetAt === 'number' && data.writtenResetAt > 0) ? data.writtenResetAt : undefined,
        rd: (typeof data.dictResetAt === 'number' && data.dictResetAt > 0) ? data.dictResetAt : undefined,
        du: (typeof data.dictUpdatedAt === 'number' && data.dictUpdatedAt > 0) ? data.dictUpdatedAt : undefined,
        a: {},
        wa: {},
        dc: []
    };
    const aErr = [];
    if (data.answers && typeof data.answers === 'object') {
        Object.entries(data.answers).forEach(([qid, ans]) => {
            if (ans && ans._deleted) return;
            const val = (typeof ans === 'string') ? ans : (ans && (ans.selected || ans.userChoice || ans.choice || ''));
            if (val) {
                compact.a[qid] = val;
                if (ans && typeof ans === 'object' && ans.isCorrect === false) {
                    aErr.push(Number(qid));
                }
            }
        });
    }
    if (Object.keys(compact.a).length === 0) delete compact.a;
    if (aErr.length > 0) compact.ae = aErr;

    const waErr = [];
    const waDel = [];
    if (data.writtenAnswers && typeof data.writtenAnswers === 'object') {
        Object.entries(data.writtenAnswers).forEach(([qid, ans]) => {
            if (ans && ans._deleted) {
                waDel.push(String(qid));
                return;
            }
            const val = (typeof ans === 'string') ? ans : (ans && (ans.selected || ans.userChoice || ans.choice || ''));
            if (val !== undefined && val !== null && (val !== '' || (ans && ans.userType === 'delete'))) {
                compact.wa[qid] = (ans && ans.userType === 'delete') ? '__DEL__' : val;
                if (ans && typeof ans === 'object' && ans.isCorrect === false) {
                    waErr.push(/^\d+$/.test(String(qid)) ? Number(qid) : String(qid));
                }
            }
        });
    }
    if (Object.keys(compact.wa).length === 0) delete compact.wa;
    if (waErr.length > 0) compact.we = waErr;
    if (waDel.length > 0) compact.wd = waDel;

    if (data.dictationCompleted && typeof data.dictationCompleted === 'object') {
        const dcList = Object.keys(data.dictationCompleted).filter(k => data.dictationCompleted[k]).map(Number);
        if (dcList.length > 0) {
            compact.dc = dcList;
        } else {
            delete compact.dc;
        }
    } else {
        delete compact.dc;
    }

    let baseStr = JSON.stringify(compact);
    if (utf8ByteLength(baseStr) > 950 && compact.wa) {
        const waKeysBySize = Object.keys(compact.wa).sort((a, b) => utf8ByteLength(String(compact.wa[b])) - utf8ByteLength(String(compact.wa[a])));
        for (const k of waKeysBySize) {
            if (utf8ByteLength(baseStr) <= 950) break;
            delete compact.wa[k];
            baseStr = JSON.stringify(compact);
        }
    }
    if (utf8ByteLength(baseStr) > 950 && Array.isArray(compact.wd)) {
        while (compact.wd.length > 0 && utf8ByteLength(baseStr) > 950) {
            compact.wd.shift();
            baseStr = JSON.stringify(compact);
        }
    }
    if (Array.isArray(data.underlines) && data.underlines.length > 0 && utf8ByteLength(baseStr) < 780) {
        const candidate = Object.assign({}, compact, {
            ul: data.underlines.slice(0, 60),
            ult: data.underlinesUpdatedAt || data.timestamp || Date.now()
        });
        const candStr = JSON.stringify(candidate);
        if (utf8ByteLength(candStr) <= 950) {
            baseStr = candStr;
        }
    }
    return baseStr;
}

/**
 * Hydrate a compact cloud exam record (ce_<idx>) back into a mergeable exam object
 */
function hydrateExamFromCloud(title, compact, existingExam = {}) {
    if (!compact || typeof compact !== 'object') return null;
    const cloudTime = compact.t || 0;
    const cloudExam = { timestamp: cloudTime };
    if (typeof compact.s === 'number') cloudExam.score = compact.s;
    if (typeof compact.ws === 'number') cloudExam.writtenScore = compact.ws;
    if (typeof compact.ra === 'number' && compact.ra > 0) cloudExam.answersResetAt = compact.ra;
    if (typeof compact.rw === 'number' && compact.rw > 0) cloudExam.writtenResetAt = compact.rw;
    if (typeof compact.rd === 'number' && compact.rd > 0) cloudExam.dictResetAt = compact.rd;
    if (typeof compact.du === 'number' && compact.du > 0) cloudExam.dictUpdatedAt = compact.du;

    if (compact.a && typeof compact.a === 'object') {
        cloudExam.answers = {};
        const exam = window.EXAMS_MAP && window.EXAMS_MAP[title];
        const aErrSet = Array.isArray(compact.ae) ? new Set(compact.ae.map(Number)) : null;
        Object.entries(compact.a).forEach(([qid, choice]) => {
            const qIndex = parseInt(qid, 10);
            const existingAns = existingExam.answers && existingExam.answers[qIndex];
            const question = exam && (exam.questions ? exam.questions[qIndex] : exam[qIndex]);
            let isCorrect = true;
            if (question && question.answer) {
                isCorrect = (choice === question.answer);
            } else if (aErrSet) {
                isCorrect = !aErrSet.has(qIndex);
            } else if (existingAns && existingAns.selected === choice && typeof existingAns.isCorrect === 'boolean') {
                isCorrect = existingAns.isCorrect;
            }
            cloudExam.answers[qIndex] = { selected: choice, isCorrect, ts: cloudTime };
        });
    }

    if ((compact.wa && typeof compact.wa === 'object') || Array.isArray(compact.wd)) {
        cloudExam.writtenAnswers = {};
        const wExam = window.WRITTEN_EXAMS_MAP && window.WRITTEN_EXAMS_MAP[title];
        const wQuestionsList = wExam
            ? ((typeof buildWrittenQuestionsList === 'function')
                ? buildWrittenQuestionsList(wExam)
                : (Array.isArray(wExam.questions) ? wExam.questions : []))
            : [];
        const wErrSet = Array.isArray(compact.we) ? new Set(compact.we.filter(x => x !== null && x !== undefined).map(String)) : null;
        if (compact.wa && typeof compact.wa === 'object') {
            Object.entries(compact.wa).forEach(([qid, choice]) => {
                const qKey = /^\d+$/.test(String(qid)) ? parseInt(qid, 10) : String(qid);
                if (typeof qKey === 'number' && isNaN(qKey)) return;
                const existingWA = existingExam.writtenAnswers && (existingExam.writtenAnswers[qKey] || existingExam.writtenAnswers[qid]);
                const isDelOp = (choice === '__DEL__');
                const actualChoice = isDelOp ? '' : choice;
                let isCorrect = true;
                if (wErrSet) {
                    isCorrect = !wErrSet.has(String(qKey)) && !wErrSet.has(String(qid));
                } else if (existingWA && existingWA.selected === actualChoice && typeof existingWA.isCorrect === 'boolean') {
                    isCorrect = existingWA.isCorrect;
                } else if (wQuestionsList.length > 0) {
                    const matchedQ = wQuestionsList.find(q => String(q.id) === String(qKey));
                    const expectedAns = matchedQ ? (matchedQ.answer || matchedQ.target || matchedQ.word) : null;
                    if (expectedAns) {
                        isCorrect = (typeof checkIsCorrect === 'function')
                            ? checkIsCorrect(actualChoice, expectedAns)
                            : (String(actualChoice).trim().toLowerCase() === String(expectedAns).trim().toLowerCase());
                    }
                }
                cloudExam.writtenAnswers[qKey] = Object.assign(
                    {},
                    (existingWA && !existingWA._deleted) ? existingWA : {},
                    { selected: actualChoice, isCorrect, ts: cloudTime },
                    isDelOp ? { userType: 'delete' } : {}
                );
            });
        }
        if (Array.isArray(compact.wd)) {
            compact.wd.forEach(delKey => {
                cloudExam.writtenAnswers[delKey] = { _deleted: true, ts: cloudTime };
            });
        }
    }

    if (Array.isArray(compact.dc)) {
        cloudExam.dictationCompleted = {};
        compact.dc.forEach(sentIdx => {
            cloudExam.dictationCompleted[sentIdx] = true;
        });
    }

    if (Array.isArray(compact.ul)) {
        cloudExam.underlines = compact.ul.map(String);
        cloudExam.underlinesUpdatedAt = compact.ult || cloudTime;
    }

    return cloudExam;
}


function mergeHabitStreakData(remoteHS) {
    if (!remoteHS || typeof remoteHS !== 'object') return;
    try {
        const curStorageKey = (typeof getUserStorageKey === 'function') 
            ? getUserStorageKey('habit_streak_v5') 
            : 'word_toy_habit_streak_v5';
        
        let localData = null;
        try {
            const raw = window.__toyLS.getItem(curStorageKey);
            if (raw) localData = JSON.parse(raw);
        } catch(e) {}

        const currentMonth = (function() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();

        const base = (window.HabitStreak && window.HabitStreak.state) 
            ? window.HabitStreak.state 
            : (localData || {
                monthKey: currentMonth,
                streakCount: 0,
                makeupCardsCount: 0,
                monthlyRewardedCardsCount: 0,
                monthlyUsedMakeupCount: 0,
                punchedDays: [],
                makeupPunchedDays: [],
                makeupPunchedDates: []
            });

        if (remoteHS.monthKey === currentMonth || !base.monthKey) {
            base.monthKey = currentMonth;
            const localPunched = new Set(base.punchedDays || []);
            (remoteHS.punchedDays || []).forEach(d => localPunched.add(d));
            const localMakeup = new Set(base.makeupPunchedDays || []);
            (remoteHS.makeupPunchedDays || []).forEach(d => localMakeup.add(d));

            // 始终保留今日登录自动打卡记录
            const todayNum = new Date().getDate();
            if (!localMakeup.has(todayNum)) {
                localPunched.add(todayNum);
            }

            base.punchedDays = Array.from(localPunched).sort((a,b)=>a-b);
            base.makeupPunchedDays = Array.from(localMakeup).sort((a,b)=>a-b);

            base.makeupCardsCount = Math.max(base.makeupCardsCount || 0, remoteHS.makeupCardsCount || 0);
            base.monthlyRewardedCardsCount = Math.max(base.monthlyRewardedCardsCount || 0, remoteHS.monthlyRewardedCardsCount || 0);
            base.monthlyUsedMakeupCount = Math.max(base.monthlyUsedMakeupCount || 0, remoteHS.monthlyUsedMakeupCount || 0);
        }

        const localHistMakeup = new Set(base.makeupPunchedDates || []);
        (remoteHS.makeupPunchedDates || []).forEach(d => localHistMakeup.add(d));
        base.makeupPunchedDates = Array.from(localHistMakeup).sort();

        // Sync in-memory HabitStreak state if loaded
        if (window.HabitStreak && window.HabitStreak.state && window.HabitStreak.state !== base) {
            Object.assign(window.HabitStreak.state, base);
        }
        if (window.HabitStreak && window.HabitStreak.state && typeof window.HabitStreak.calculateConsecutiveStreak === 'function') {
            base.streakCount = Math.max(1, window.HabitStreak.calculateConsecutiveStreak());
            window.HabitStreak.state.streakCount = base.streakCount;
        } else if (typeof remoteHS.streakCount === 'number') {
            base.streakCount = Math.max(1, base.streakCount || 0, remoteHS.streakCount);
        }

        // Save to localStorage
        try {
            if (typeof safeLocalStorageSet === 'function') {
                safeLocalStorageSet(curStorageKey, JSON.stringify(base));
            } else {
                window.__toyLS.setItem(curStorageKey, JSON.stringify(base));
            }
        } catch(e) {}
    } catch(e) {
        console.warn('[ToySDK] mergeHabitStreakData error:', e);
    }
}

function mergeCalendarPunchesData(remoteCP) {
    if (!remoteCP || typeof remoteCP !== 'object') return;
    try {
        const calKey = getUserStorageKey('calendar_custom_punches');
        let localCP = {};
        try {
            localCP = JSON.parse(window.__toyLS.getItem(calKey) || '{}');
        } catch(e) {}
        const merged = Object.assign({}, localCP, remoteCP);
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        merged[todayDateStr] = true;
        if (typeof safeLocalStorageSet === 'function') {
            safeLocalStorageSet(calKey, JSON.stringify(merged));
        } else {
            window.__toyLS.setItem(calKey, JSON.stringify(merged));
        }
    } catch(e) {
        console.warn('[ToySDK] mergeCalendarPunchesData error:', e);
    }
}


/**
 * Safely serialize Today Practice Log for Cloud Storage (Guaranteed <= 900 UTF-8 bytes << 1024 bytes)
 * Compacts Chinese exam title prefixes to deterministic #<examIdx>#<qId> keys to save ~50 UTF-8 bytes per entry.
 */
function serializeTodayLogForCloud(log) {
    if (!log || !log.questions || typeof log.questions !== 'object') {
        return JSON.stringify({ date: (typeof getTodayDateStr === 'function' ? getTodayDateStr() : ''), questions: {} });
    }
    const currentToday = typeof getTodayDateStr === 'function' ? getTodayDateStr() : log.date;
    const entries = Object.entries(log.questions);
    entries.sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0));

    const compactQuestions = {};
    for (const [rawKey, val] of entries) {
        let compactKey = rawKey;
        if (typeof rawKey === 'string' && !rawKey.startsWith('#')) {
            const hashPos = rawKey.lastIndexOf('#');
            if (hashPos > 0) {
                const examTitle = rawKey.slice(0, hashPos);
                const qPart = rawKey.slice(hashPos + 1);
                const idx = getExamIndex(examTitle);
                if (idx >= 0) {
                    compactKey = `#${idx}#${qPart}`;
                }
            }
        }
        compactQuestions[compactKey] = {
            c: val && val.isCorrect ? 1 : 0,
            t: (val && typeof val.timestamp === 'number') ? val.timestamp : 0
        };
        const candidateStr = JSON.stringify({ date: currentToday, questions: compactQuestions });
        if (utf8ByteLength(candidateStr) > 900) {
            delete compactQuestions[compactKey];
            break;
        }
    }
    return JSON.stringify({ date: currentToday, questions: compactQuestions });
}

function hydrateTodayLogFromCloud(cloudTodayLog) {
    if (!cloudTodayLog || typeof cloudTodayLog !== 'object' || typeof cloudTodayLog.questions !== 'object') {
        return {};
    }
    const allTitles = getAllGlobalExamTitles();
    const expanded = {};
    Object.entries(cloudTodayLog.questions).forEach(([k, v]) => {
        let fullKey = k;
        const m = (typeof k === 'string') ? k.match(/^#(\d+)#(.+)$/) : null;
        if (m) {
            const idx = parseInt(m[1], 10);
            const title = allTitles[idx];
            if (title) {
                fullKey = `${title}#${m[2]}`;
            }
        }
        if (v && typeof v === 'object') {
            expanded[fullKey] = {
                isCorrect: ('isCorrect' in v) ? !!v.isCorrect : !!v.c,
                timestamp: (typeof v.timestamp === 'number') ? v.timestamp : (v.t || 0)
            };
        }
    });
    return expanded;
}


window.getAllGlobalExamTitles = getAllGlobalExamTitles;
window.getExamIndex = getExamIndex;
window.getSerializedUserSettings = getSerializedUserSettings;
window.applySerializedUserSettings = applySerializedUserSettings;
window.serializeExamForCloud = serializeExamForCloud;
window.hydrateExamFromCloud = hydrateExamFromCloud;
window.serializeTodayLogForCloud = serializeTodayLogForCloud;
window.hydrateTodayLogFromCloud = hydrateTodayLogFromCloud;
window.mergeHabitStreakData = mergeHabitStreakData;
window.mergeCalendarPunchesData = mergeCalendarPunchesData;
