/* 拾光英语 App 状态层：全部数据落 localStorage，无账号、无付费 */
(function (global) {
  'use strict';
  var NS = 'sg_';
  function read(k, def) {
    try { var v = global.localStorage.getItem(NS + k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function write(k, v) {
    try { global.localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {}
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  var DEFAULT = {
    name: '浅蓝色的小慌', accent: 'us', bilingual: true, theme: 'light',
    streak: 2, points: 0, wordsDone: 0, minutes: 0, answers: 0, correct: 0,
    checkins: [], daily: {}, wordState: {}, examDone: {}, lastActive: ''
  };
  var state = Object.assign({}, DEFAULT, read('state', {}));

  var Store = {
    get: function (k) { return state[k]; },
    all: function () { return state; },
    set: function (k, v) { state[k] = v; this.save(); },
    save: function () { write('state', state); },
    today: today,
    isVip: function () { return true; },
    canUse: function () { return true; },
    quotaLeft: function () { return Infinity; },

    checkin: function () {
      var t = today();
      if (state.checkins.indexOf(t) >= 0) return { ok: false, msg: '今天已签到' };
      state.checkins.push(t);
      state.streak = (state.streak || 0) + 1;
      state.points = (state.points || 0) + 2;
      this.save();
      return { ok: true, msg: '签到成功 +2分', streak: state.streak };
    },
    addMinutes: function (m) { state.minutes = (state.minutes || 0) + m; this.log({ min: m }); this.save(); },
    answer: function (ok) {
      state.answers = (state.answers || 0) + 1;
      if (ok) state.correct = (state.correct || 0) + 1;
      this.log({ q: 1, correct: ok ? 1 : 0 }); this.save();
    },
    word: function (id, known) {
      state.wordState[id] = known ? 'known' : 'unknown';
      state.wordsDone = Object.keys(state.wordState).length;
      this.log({ w: 1 }); this.save();
    },
    exam: function (id) { state.examDone[id] = true; this.log({ e: 1 }); this.save(); },
    log: function (delta) {
      var t = today();
      var d = state.daily[t] || { q: 0, correct: 0, min: 0, w: 0, e: 0 };
      Object.keys(delta).forEach(function (k) { d[k] = (d[k] || 0) + delta[k]; });
      state.daily[t] = d;
    },
    week: function () {
      var out = [], now = new Date();
      var monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      var labels = ['一', '二', '三', '四', '五', '六', '日'];
      for (var i = 0; i < 7; i++) {
        var d = new Date(monday); d.setDate(monday.getDate() + i);
        var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        out.push({ label: labels[i], key: key, data: state.daily[key] || { q: 0, correct: 0, min: 0, w: 0, e: 0 } });
      }
      return out;
    },
    totalQ: function () {
      var n = 0; Object.keys(state.daily).forEach(function (k) { n += state.daily[k].q || 0; }); return n;
    },
    accuracy: function () { return state.answers ? Math.round(state.correct / state.answers * 100) : 0; },
    reset: function () { state = Object.assign({}, DEFAULT); this.save(); }
  };

  global.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
