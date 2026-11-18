/* 拾光英语 App 主逻辑：页面渲染与交互 */
(function (global) {
  'use strict';
  var S = global.Store;
  var doc = global.document;
  var app, tabbar;
  var curPage = 'home';
  var examLevel = 'cet4', examYear = 'all';
  var bookId = 'cet4', wordIdx = 0, wordShow = false;
  var mockQ = [], mockIdx = 0, mockAns = [];
  var listenItem = null, playing = false, playTimer = null;
  var reviewRange = 'week', chartMetric = 'q';

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 1800);
  }
  function speak(text) {
    try {
      if (!global.speechSynthesis) return;
      global.speechSynthesis.cancel();
      var u = new global.SpeechSynthesisUtterance(text);
      u.lang = S.get('accent') === 'uk' ? 'en-GB' : 'en-US';
      u.rate = 0.9;
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- 首页（云背景 + 日期条 + 排名/打卡 + 精听卡片） ---------- */
  function dates() {
    var names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var now = new Date();
    var monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    var todayKey = S.today();
    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday); d.setDate(monday.getDate() + i);
      var key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      var on = key === todayKey;
      var dot = S.get('checkins').indexOf(key) >= 0 ? '<i class="dot"></i>' : '';
      html += '<div class="date' + (on ? ' on' : '') + '"><span class="d">' + names[i] + '</span>' + d.getDate() + dot + '</div>';
    }
    return html;
  }

  function homeHTML() {
    var st = S.all();
    var dicts = [
      { cls: '', code: 'CET-4<br>DICTATION', name: '四级精听', level: 'cet4' },
      { cls: 'c2', code: 'CET-6<br>DICTATION', name: '六级精听', level: 'cet6' },
      { cls: 'c3', code: '高考<br>DICTATION', name: '高考精听', level: 'gaokao' },
      { cls: 'c4', code: '雅思<br>DICTATION', name: '雅思精听', level: 'ielts' },
      { cls: 'c5', code: '第五期<br>DICTATION', name: '每日英语听力', level: 'daily' }
    ];
    var cards = dicts.map(function (x) {
      return '<div class="dict-card ' + x.cls + '" data-level="' + x.level + '">' +
        '<div class="dict-ring"></div><div class="dict-tag">' + x.code + '</div><div class="dict-name">' + x.name + '</div></div>';
    }).join('');
    var min = st.minutes || 0;
    return '' +
      '<div class="hero">' +
        '<div class="cloud c2"></div><div class="cloud c3"></div><div class="cloud c1"></div>' +
        '<div class="hero-hi">Welcome back 👋</div>' +
        '<div class="hero-name">' + esc(st.name) + '</div>' +
        '<div class="hero-side">' +
          '<div class="hbtn" data-go="moments"><span class="ic">◎</span>生活圈</div>' +
          '<div class="avatar" data-go="profile"></div>' +
        '</div>' +
      '</div>' +
      '<div class="sheet"><div class="grabber"></div>' +
        '<div class="dates">' + dates() + '</div>' +
        '<div class="topcards">' +
          '<div class="rankcard">' +
            '<div class="rank-avatars">👥 +65人</div>' +
            '<div class="rank-num">第 11 名</div>' +
            '<div class="rank-sub">今日排名</div>' +
          '</div>' +
          '<div class="sidecards">' +
            '<div class="scard"><div><b>连续打卡 ' + (st.streak || 0) + '</b>天</div><span class="emo">💧</span></div>' +
            '<div class="scard"><div><b>今日学习 ' + min + '分</b>' + (st.seconds || 5) + '秒</div><span class="emo">📖</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="seg" id="dict-seg">' +
          '<button data-tab="written">📝 笔试特训</button>' +
          '<button data-tab="listening">🎧 听力特训</button>' +
          '<button data-tab="dictation" class="on">🎤 逐句精听<span class="bar"></span></button>' +
        '</div>' +
        '<div class="dict-grid">' + cards + '</div>' +
      '</div>';
  }

  /* ---------- 复盘页（参考图：周/月/全部 + 刷题统计 + 柱状图 + 练习构成） ---------- */
  function reviewHTML() {
    var week = S.week();
    var total = S.totalQ();
    var acc = S.accuracy();
    var mins = S.get('minutes') || 0;
    var streak = S.get('streak') || 0;
    var max = Math.max(1, Math.max.apply(null, week.map(function (d) { return d.data[chartMetric] || 0; })));
    var bars = week.map(function (d) {
      var v = d.data[chartMetric] || 0;
      var h = v ? Math.max(8, Math.round(v / max * 92)) : 4;
      return '<div class="col"><div class="bar' + (v ? ' has' : '') + '" style="height:' + h + 'px"></div><div class="lb">' + d.label + '</div></div>';
    }).join('');
    var rangeLabel = reviewRange === 'week' ? '这周' : (reviewRange === 'month' ? '这个月' : '累计');
    return '' +
      '<div class="sheet" style="margin-top:0;border-radius:0;padding-top:24px">' +
        '<div class="review-title">学习复盘</div>' +
        '<div class="review-seg">' +
          '<button data-range="week" class="' + (reviewRange === 'week' ? 'on' : '') + '">周</button>' +
          '<button data-range="month" class="' + (reviewRange === 'month' ? 'on' : '') + '">月</button>' +
          '<button data-range="all" class="' + (reviewRange === 'all' ? 'on' : '') + '">全部</button>' +
          '<div class="share">↗</div>' +
        '</div>' +
        '<div class="big-stat">' + rangeLabel + '你刷了</div>' +
        '<div class="big-num">' + total + '<small>题</small></div>' +
        '<div class="streak">连续第 ' + streak + ' 天，习惯正在形成</div>' +
        '<div class="three-stats">' +
          '<div><b>' + (S.get('checkins') || []).length + '天</b><span>学习天数</span></div>' +
          '<div><b>' + acc + '%</b><span>正确率</span></div>' +
          '<div><b>' + mins + '分钟</b><span>学习时长</span></div>' +
        '</div>' +
        '<div class="chart-head"><b>每日刷题</b>' +
          '<div class="mini-seg">' +
            '<button data-metric="q" class="' + (chartMetric === 'q' ? 'on' : '') + '">刷题</button>' +
            '<button data-metric="min" class="' + (chartMetric === 'min' ? 'on' : '') + '">时长</button>' +
            '<button data-metric="correct" class="' + (chartMetric === 'correct' ? 'on' : '') + '">正确率</button>' +
          '</div>' +
        '</div>' +
        '<div class="chart">' + bars + '</div>' +
        '<div class="compose">' +
          '<div class="ch">练习构成 <span>' + (total ? '' : '暂无记录') + '</span></div>' +
          '<div class="items">' +
            '<div class="item"><span><i style="background:#1f7a4d"></i>听力真题</span><b>' + countType('e') + '题</b></div>' +
            '<div class="item"><span><i style="background:#3b82f6"></i>笔试阅读</span><b>' + countType('q') + '题</b></div>' +
            '<div class="item"><span><i style="background:#f7b733"></i>生词积累</span><b>' + (S.get('wordsDone') || 0) + '词</b></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function countType(k) {
    var n = 0; var d = S.get('daily') || {};
    Object.keys(d).forEach(function (day) { n += d[day][k] || 0; });
    return n;
  }

  /* ---------- 听力大厅 ---------- */
  function listeningHTML() {
    var data = global.EXAM_DATA || {};
    var keys = ['cet4', 'cet6', 'kaoyan', 'ielts'];
    var labels = { cet4: '四级', cet6: '六级', kaoyan: '考研', ielts: '雅思' };
    var seg = keys.map(function (k) { return '<button data-level="' + k + '" class="' + (examLevel === k ? 'on' : '') + '">' + labels[k] + '</button>'; }).join('');
    var list = data[examLevel] ? data[examLevel].list : [];
    var years = ['all'];
    list.forEach(function (x) { if (x.year && years.indexOf(String(x.year)) < 0) years.push(String(x.year)); });
    years.sort().reverse();
    var chips = years.map(function (y) { return '<div class="chip' + (examYear === y ? ' on' : '') + '" data-year="' + y + '">' + (y === 'all' ? '全部年份' : y) + '</div>'; }).join('');
    var shown = list.filter(function (x) { return examYear === 'all' || String(x.year) === examYear; }).slice(0, 60);
    var items = shown.map(function (x, i) {
      var done = S.get('examDone')[x.examId];
      return '<div class="exam-item" data-exam="' + esc(x.examId) + '" data-i="' + i + '">' +
        '<div class="exam-badge">' + esc(String(x.year || '').slice(-2)) + '<br>真题</div>' +
        '<div class="exam-main"><div class="t">' + esc(x.title || (x.year + '年 ' + labels[examLevel])) + '</div>' +
        '<div class="s">听力 ' + (x.listeningCount || 0) + ' 题 · 听写 ' + (x.dictationCount || 0) + ' 空' + (x.isWrittenOnly ? ' · 仅笔试' : '') + '</div></div>' +
        '<div style="font-size:12px;color:' + (done ? '#1f7a4d' : '#f2703a') + ';font-weight:700">' + (done ? '已完成' : '开始 ›') + '</div></div>';
    }).join('');
    if (!shown.length) items = '<div class="card muted" style="text-align:center">暂无该年份真题</div>';
    return '<div class="page"><div class="ptitle">听力真题</div>' +
      '<div class="seg" id="exam-seg">' + seg + '</div>' +
      '<div class="chips">' + chips + '</div>' + items + '</div>';
  }

  /* ---------- 精听舞台 ---------- */
  function stageHTML() {
    if (!listenItem) return '<div class="page"><div class="card">请从听力大厅选择一套真题</div></div>';
    var lines = [
      { en: 'Welcome to today\'s English listening practice.', zh: '欢迎来到今天的英语听力练习。' },
      { en: 'Please listen carefully and fill in the blanks.', zh: '请仔细听并填空。' },
      { en: 'The weather was beautiful yesterday.', zh: '昨天天气很好。' }
    ];
    var text = lines.map(function (l) { return l.en; }).join(' ');
    var blanks = 'Please ____ carefully and fill in the ____.';
    return '<div class="page"><div class="ptitle">逐句精听</div>' +
      '<div class="listening-stage">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(listenItem.title || listenItem.year + ' 真题') + '</b><span style="font-size:12px;color:#9aa5b4">' + (S.get('accent') === 'uk' ? '英音' : '美音') + '</span></div>' +
        '<div class="play-btn" id="play-btn">' + (playing ? '❚❚' : '▶') + '</div>' +
        '<div class="subtitle" id="sub-en">' + esc(blanks) + '</div>' +
        (S.get('bilingual') ? '<div class="subtitle-zh">' + esc(lines[1].zh) + '</div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
          '<button class="chip" id="reveal">显示原文</button>' +
          '<button class="chip" id="speed">倍速 1.0x</button>' +
          '<button class="chip" id="accent">切换口音</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#9aa5b4;margin-top:10px">点击播放或朗读，Web Speech 驱动</div>' +
      '</div></div>';
  }

  /* ---------- 背单词 ---------- */
  function booksHTML() {
    var books = global.BOOK_DATA || [];
    var colors = ['#ff8a5b', '#7c5cff', '#22b07d', '#f7b733', '#e5484d', '#3b82f6'];
    var cards = books.map(function (b, i) {
      var done = 0;
      return '<div class="dict-card" style="background:' + colors[i % colors.length] + ';color:#fff;min-height:110px" data-book="' + esc(b.id) + '">' +
        '<div style="font-size:11px;opacity:.9">' + esc(b.tag || '') + '</div>' +
        '<div style="font-weight:800;font-size:14px;margin:6px 0">' + esc(b.title) + '</div>' +
        '<div style="font-size:11px;opacity:.9">' + b.totalWords + ' 词</div></div>';
    }).join('');
    return '<div class="page"><div class="ptitle">选择词书</div><div class="dict-grid">' + cards + '</div></div>';
  }

  function wordsHTML() {
    var words = global.WORD_DATA || [];
    if (!words.length) return '<div class="page"><div class="card">词库为空</div></div>';
    if (wordIdx >= words.length) wordIdx = 0;
    var w = words[wordIdx];
    return '<div class="page"><div class="ptitle">背单词 <span style="font-size:12px;color:#9aa5b4;font-weight:400">' + (wordIdx + 1) + '/' + words.length + '</span></div>' +
      '<div class="word-card">' +
        '<div class="dict-tag">' + esc(w.pos || '') + ' · ' + esc((w.level || '').toUpperCase()) + '</div>' +
        '<div class="wc-word">' + esc(w.word) + '</div>' +
        '<div class="wc-ph">' + esc(w.phonetic || '') + '</div>' +
        '<button class="chip" id="speak-word" style="margin-top:12px">🔊 朗读</button>' +
        '<div class="wc-mean' + (wordShow ? '' : ' hide') + '" id="wc-mean">' + esc(w.meaning) + '</div>' +
        '<div style="font-size:12px;color:#9aa5b4;margin-top:10px;line-height:1.6">' + esc(w.example || '') + '<br>' + esc(w.exampleZh || '') + '</div>' +
      '</div>' +
      '<div class="word-actions"><button class="btn-no" id="word-no">不认识</button><button class="btn-yes" id="word-yes">认识</button></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:#9aa5b4">' +
        '<button id="word-prev">← 上一个</button><button id="word-next">下一个 →</button></div>' +
      '</div>';
  }

  /* ---------- 模考 ---------- */
  function buildMock() {
    var words = global.WORD_DATA || [];
    var pool = words.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 10);
    mockQ = pool.map(function (w) {
      var wrong = words.filter(function (x) { return x.word !== w.word; }).sort(function () { return Math.random() - 0.5; }).slice(0, 3);
      var opts = wrong.map(function (x) { return x.meaning; }).concat([w.meaning]).sort(function () { return Math.random() - 0.5; });
      return { word: w.word, answer: w.meaning, options: opts };
    });
    mockIdx = 0; mockAns = [];
  }
  function mockHTML() {
    if (!mockQ.length) buildMock();
    if (mockIdx >= mockQ.length) {
      var correct = mockAns.filter(Boolean).length;
      return '<div class="page"><div class="ptitle">模考完成</div><div class="word-card">' +
        '<div style="font-size:14px;color:#6b7688">本次成绩</div>' +
        '<div style="font-size:46px;font-weight:800;color:#1f7a4d">' + correct + ' / ' + mockQ.length + '</div>' +
        '<div style="font-size:13px;color:#9aa5b4">正确率 ' + Math.round(correct / mockQ.length * 100) + '%</div>' +
        '</div><button class="btn" id="mock-retry">再来一套</button></div>';
    }
    var q = mockQ[mockIdx];
    var opts = q.options.map(function (o, i) {
      return '<div class="q-opt" data-opt="' + i + '"><span style="display:inline-flex;width:24px;height:24px;border-radius:50%;background:#f1f2f5;align-items:center;justify-content:center;font-weight:700;font-size:12px">' + String.fromCharCode(65 + i) + '</span>' + esc(o) + '</div>';
    }).join('');
    return '<div class="page"><div class="ptitle">全真模考 <span style="font-size:12px;color:#9aa5b4;font-weight:400">' + (mockIdx + 1) + '/' + mockQ.length + '</span></div>' +
      '<div class="listening-stage"><div style="font-size:13px;color:#6b7688">请选择「' + esc(q.word) + '」的正确释义</div>' +
      '<div style="font-size:26px;font-weight:800;margin:14px 0" id="mock-word">' + esc(q.word) + '</div>' +
      '<div class="q-options">' + opts + '</div><div id="mock-explain"></div></div></div>';
  }

  /* ---------- 我的 ---------- */
  function profileHTML() {
    var st = S.all();
    return '<div class="page"><div class="ptitle">我的</div>' +
      '<div class="card"><div style="display:flex;align-items:center;gap:14px">' +
        '<div class="hero-side" style="position:static"><div class="avatar" style="width:56px;height:56px;font-size:22px;background:#ff8a5b;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%">' + esc(st.name.slice(0, 1)) + '</div></div>' +
        '<div><b style="font-size:18px">' + esc(st.name) + '</b><div style="font-size:12px;color:#9aa5b4">已坚持 ' + (st.streak || 0) + ' 天 · ' + (st.points || 0) + ' 分</div></div>' +
      '</div></div>' +
      '<div class="card">' +
        '<div class="set-row"><span>昵称</span><span class="v" id="set-name">' + esc(st.name) + '</span></div>' +
        '<div class="set-row"><span>发音口音</span><span class="v" id="set-accent">' + (st.accent === 'uk' ? '英式英语' : '美式英语') + '</span></div>' +
        '<div class="set-row"><span>双语对照</span><span class="v" id="set-bilingual">' + (st.bilingual ? '开启' : '关闭') + '</span></div>' +
        '<div class="set-row"><span>会员权益</span><span class="v">全部免费开放</span></div>' +
      '</div>' +
      '<button class="btn" id="checkin-btn">' + (S.get('checkins').indexOf(S.today()) >= 0 ? '今日已签到' : '签到 +2分') + '</button>' +
      '<button class="btn" style="background:#fff;color:#6b7688;border:1px solid #eceef2" id="reset-btn">清空学习数据</button>' +
      '</div>';
  }

  var RENDER = {
    home: homeHTML, review: reviewHTML, listening: listeningHTML, stage: stageHTML,
    words: wordsHTML, mock: mockHTML, profile: profileHTML
  };

  function render() {
    app.innerHTML = (RENDER[curPage] || homeHTML)();
    // 底部 tab 高亮
    $$('.tabbar button').forEach(function (b) {
      var p = b.getAttribute('data-page');
      var on = p === curPage || (curPage === 'stage' && p === 'home') || (curPage === 'books' && p === 'words');
      b.classList.toggle('on', on);
    });
    bind();
  }
  function go(page) { curPage = page; render(); window.scrollTo(0, 0); }

  function bind() {
    // 底部导航
    $$('.tabbar button').forEach(function (b) {
      b.onclick = function () { go(b.getAttribute('data-page')); };
    });
    // 首页分段
    $$('#dict-seg button').forEach(function (b) {
      b.onclick = function () {
        var tab = b.getAttribute('data-tab');
        if (tab === 'dictation') { toast('当前：逐句精听'); return; }
        go(tab === 'written' ? 'mock' : 'listening');
      };
    });
    // 首页精听卡片
    $$('.dict-card[data-level]').forEach(function (c) {
      c.onclick = function () {
        var lv = c.getAttribute('data-level');
        if (global.EXAM_DATA && global.EXAM_DATA[lv]) examLevel = lv;
        examYear = 'all';
        go('listening');
      };
    });
    $('.hbtn[data-go="moments"]') && ($('.hbtn[data-go="moments"]').onclick = function () { toast('生活圈即将开放'); });
    $('.avatar[data-go="profile"]') && ($('.avatar[data-go="profile"]').onclick = function () { go('profile'); });

    // 复盘
    $$('.review-seg button[data-range]').forEach(function (b) {
      b.onclick = function () { reviewRange = b.getAttribute('data-range'); render(); };
    });
    $$('.mini-seg button').forEach(function (b) {
      b.onclick = function () { chartMetric = b.getAttribute('data-metric'); render(); };
    });

    // 听力大厅
    $$('#exam-seg button').forEach(function (b) {
      b.onclick = function () { examLevel = b.getAttribute('data-level'); examYear = 'all'; render(); };
    });
    $$('.chip[data-year]').forEach(function (b) {
      b.onclick = function () { examYear = b.getAttribute('data-year'); render(); };
    });
    $$('.exam-item').forEach(function (it) {
      it.onclick = function () {
        listenItem = { title: $('.t', it).textContent, year: $('.exam-badge', it).textContent.trim() };
        S.exam(it.getAttribute('data-exam'));
        go('stage');
      };
    });

    // 精听舞台
    $('#play-btn') && ($('#play-btn').onclick = function () {
      playing = !playing;
      $('#play-btn').textContent = playing ? '❚❚' : '▶';
      if (playing) {
        var line = 'Please listen carefully and fill in the blanks.';
        speak(line);
        playTimer = setInterval(function () { S.addMinutes(1); }, 60000);
      } else { clearInterval(playTimer); try { global.speechSynthesis.cancel(); } catch (e) {} }
    });
    $('#reveal') && ($('#reveal').onclick = function () {
      $('#sub-en').textContent = 'Welcome to today\'s English listening practice. Please listen carefully and fill in the blanks.';
    });
    $('#speed') && ($('#speed').onclick = function () {
      var btn = $('#speed'); var cur = btn.textContent.match(/[\d.]+/)[0];
      var arr = ['0.75', '1.0', '1.25', '1.5', '2.0'];
      var next = arr[(arr.indexOf(cur) + 1) % arr.length];
      btn.textContent = '倍速 ' + next + 'x';
    });
    $('#accent') && ($('#accent').onclick = function () {
      S.set('accent', S.get('accent') === 'uk' ? 'us' : 'uk'); render();
    });

    // 词书 / 单词
    $$('.dict-card[data-book]').forEach(function (c) {
      c.onclick = function () { bookId = c.getAttribute('data-book'); wordIdx = 0; go('words'); };
    });
    $('#speak-word') && ($('#speak-word').onclick = function () {
      var w = (global.WORD_DATA || [])[wordIdx]; if (w) speak(w.word);
    });
    $('#wc-mean') && ($('#wc-mean').onclick = function () { wordShow = true; $('#wc-mean').classList.remove('hide'); });
    function nextWord(known) {
      var w = (global.WORD_DATA || [])[wordIdx]; if (w) S.word(w.id, known);
      wordIdx++; wordShow = false; render();
    }
    $('#word-yes') && ($('#word-yes').onclick = function () { nextWord(true); });
    $('#word-no') && ($('#word-no').onclick = function () { nextWord(false); });
    $('#word-next') && ($('#word-next').onclick = function () { wordIdx++; wordShow = false; render(); });
    $('#word-prev') && ($('#word-prev').onclick = function () { wordIdx = Math.max(0, wordIdx - 1); wordShow = false; render(); });

    // 模考
    $$('.q-opt').forEach(function (o) {
      o.onclick = function () {
        if ($('#mock-explain').innerHTML) return;
        var q = mockQ[mockIdx];
        var val = o.textContent.trim();
        var ok = val === q.answer;
        $$('.q-opt').forEach(function (x) {
          if (x.textContent.trim() === q.answer) x.classList.add('right');
        });
        if (!ok) o.classList.add('wrong');
        $('#mock-explain').innerHTML = '<div class="explain">正确答案：' + esc(q.answer) + '</div><button class="btn" id="mock-next">下一题 →</button>';
        $('#mock-next').onclick = function () { mockAns.push(ok); mockIdx++; S.answer(ok); render(); };
      };
    });
    $('#mock-retry') && ($('#mock-retry').onclick = function () { buildMock(); render(); });

    // 我的
    $('#set-name') && ($('#set-name').onclick = function () {
      var v = global.prompt('输入昵称', S.get('name')); if (v) { S.set('name', v); render(); }
    });
    $('#set-accent') && ($('#set-accent').onclick = function () {
      S.set('accent', S.get('accent') === 'uk' ? 'us' : 'uk'); render();
    });
    $('#set-bilingual') && ($('#set-bilingual').onclick = function () {
      S.set('bilingual', !S.get('bilingual')); render();
    });
    $('#checkin-btn') && ($('#checkin-btn').onclick = function () { var r = S.checkin(); toast(r.msg); render(); });
    $('#reset-btn') && ($('#reset-btn').onclick = function () {
      if (global.confirm('清空全部学习数据？')) { S.reset(); render(); }
    });
  }

  function init() {
    app = $('#app'); tabbar = $('#tabbar');
    if (!app) return;
    S.set('lastActive', S.today());
    render();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  global.App = { go: go, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
