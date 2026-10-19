/* =========================================================
   AI Promise 화면 4개
   1. 기업 고르기      #/
   2. 약속 목록        #/c/<기업id>
   3. 약속 자세히 보기  #/c/<기업id>/p/<약속id>
   4. 면접 카드        #/c/<기업id>/card

   데이터: data/results.json 이 있으면 그걸 쓰고,
           없으면 data/sample-data.js 의 예시 데이터를 써요.
   두 파일 모두 안내서 4장의 sample_data.json 형식이에요. (엔진 결과 파일과 같은 형식)

   1019 Final v2: 시간축(약속 보고서 → 근거 보고서), 확인 4단계, 검증 현황, 면접 카드 세 묶음(확인된 사실, 면접에서 쓸 포인트, 회사에 물어볼 질문).
   누가 했는지는 meta로 정해요: data_mode가 human_reviewed_demo면 '사람이 원문 대조',
   data_mode 없이 is_sample이면 '예시 데이터', 그 밖(엔진 결과)은 'AI 엔진'.
   사용자 테스트 숫자는 data/validation.json에서만 읽어요.
   링크는 http(s) 주소만 만들어요. '확인된 사실'에는 원문 인용 검사를 통과한 근거 문장만 넣어요.

   1012 수정 (데이터 연결, 김성태): 안내서 형식을 그대로 읽게 바꾸고, 안내서 2장 규칙 9개에 맞췄어요.
   - 안내 문구 2개를 모든 화면에, 예시 데이터 안내를 맨 위에 (meta.is_sample)
   - 화면 문구는 데이터의 labels에서 읽기
   - 개수 요약은 구체적 약속만, 규칙 3의 형태로. 비율 막대는 뺌
   - 방향성 약속 묶음, "원문 확인됨" 표시, 면접 카드 안내 문구와 링크
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 판정 4가지: 데이터 값 → 색 이름(css) ---------- */
  var VERDICT_ORDER = ['evidence_found', 'partial', 'not_verifiable', 'company_reported_not_pursued'];
  var CSS_NAME = {
    evidence_found: 'confirmed',
    partial: 'partial',
    not_verifiable: 'not_found',
    company_reported_not_pursued: 'not_pursued'
  };
  // labels가 없을 때만 쓰는 기본 문구 (안내서 2장과 같음)
  var DEFAULT_LABELS = {
    service_name: 'AI Promise',
    service_subtitle: '기업 AI 약속 검증',
    tagline: '면접 전 5분 기업 AI 체크',
    disclaimers: ['공시 범위 안에서 확인한 결과입니다.', 'AI가 생성한 분석입니다.'],
    verdicts: {
      evidence_found: { label: '근거 확인', short_label: '근거 확인' },
      partial: { label: '일부 확인', short_label: '일부 확인' },
      not_verifiable: { label: '공시에서 확인 불가', short_label: '확인 불가' },
      company_reported_not_pursued: { label: '회사가 미추진으로 공시', short_label: '미추진 공시' }
    },
    promise_types: {
      specific: { label: '구체적 약속', note: '' },
      directional: { label: '방향성 약속', note: '방향이 넓어 판정하지 않고 관련 활동만 보여줍니다. 개수에는 넣지 않습니다.' }
    },
    not_verifiable_message: '읽은 공시 범위에서 관련 내용을 찾지 못했습니다.',
    no_related_activity_message: '읽은 공시 범위에서 관련 활동을 찾지 못했습니다.',
    citation_verified_label: '원문 확인됨',
    interview_card_notice: '완성된 답변이 아니라 근거가 붙은 소재입니다. 자신의 말로 바꿔 쓰세요.'
  };

  var THEME_KEY = 'ai-promise-theme';
  var appEl = document.getElementById('app');
  var DATA = null;
  var VALID = null;   // data/validation.json (사용자 테스트 숫자). 없으면 '진행 중'
  var L = DEFAULT_LABELS;

  /* ---------- 아이콘 ---------- */
  var ICON = {
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    chevron: '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    dash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>',
    external: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>'
  };

  /* ---------- 도구 ---------- */
  // 데이터 문장을 화면에 넣을 때 항상 거쳐요 (HTML로 해석되지 않게)
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function verdictInfo(code) { return (L.verdicts && L.verdicts[code]) || DEFAULT_LABELS.verdicts[code] || null; }
  function verdictLabel(code) { var v = verdictInfo(code); return v ? v.label : ''; }
  function verdictShort(code) { var v = verdictInfo(code); return v ? (v.short_label || v.label) : ''; }
  function vClass(code) { return code && CSS_NAME[code] ? 'verdict-' + CSS_NAME[code] : 'verdict-none'; }
  function isSpecific(p) { return p.type !== 'directional'; }
  function specifics(company) { return (company.promises || []).filter(isSpecific); }
  function directionals(company) { return (company.promises || []).filter(function (p) { return !isSpecific(p); }); }
  function findCompany(id) {
    return (DATA.companies || []).filter(function (c) { return c.id === id; })[0] || null;
  }
  function findPromise(company, pid) {
    return (company.promises || []).filter(function (p) { return p.id === pid; })[0] || null;
  }
  function countVerdicts(promises) {
    var counts = {};
    VERDICT_ORDER.forEach(function (k) { counts[k] = 0; });
    (promises || []).forEach(function (p) { if (counts[p.verdict] != null) counts[p.verdict] += 1; });
    return counts;
  }
  // 규칙 3의 형태: "근거 확인 3, 일부 확인 1, 확인 불가 1, 미추진 공시 1"
  function countLine(promises) {
    var counts = countVerdicts(promises);
    return VERDICT_ORDER.map(function (k) { return verdictShort(k) + ' ' + counts[k]; }).join(', ');
  }
  function reportTitles(list) { return (list || []).map(function (r) { return r.title; }).join(', '); }
  function sourceLabel(src) {
    // 예: "2024 사업보고서 · II. 사업의 내용 · p.12" (쪽 번호가 있을 때만)
    var parts = [src.report];
    if (src.section) parts.push(src.section);
    if (src.page) parts.push('p.' + src.page);
    return parts.join(' · ');
  }
  function promiseHref(company, pid) {
    return '#/c/' + encodeURIComponent(company.id) + '/p/' + encodeURIComponent(pid);
  }

  /* ---------- 테마 ---------- */
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    var btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = themeIcon();
  }
  function themeIcon() { return currentTheme() === 'dark' ? ICON.sun : ICON.moon; }
  function themeButton() {
    return '<button type="button" class="icon-btn" id="theme-btn" aria-label="다크 모드와 라이트 모드 전환">' + themeIcon() + '</button>';
  }

  /* ---------- 공통 틀 ---------- */
  // 규칙 9: 예시 데이터일 때 화면 맨 위 안내
  function sampleBanner() {
    var meta = DATA.meta || {};
    if (!meta.is_sample) return '';
    return '<div class="sample-banner" role="note">' + esc(meta.notice || '예시 데이터입니다. 실제 기업이나 실제 공시 내용이 아닙니다.') + '</div>';
  }
  // 규칙 1: 안내 문구 2개를 모든 화면에
  function disclaimers() {
    return '<p class="disclaimer">' + (L.disclaimers || []).map(esc).join('<span aria-hidden="true"> · </span>') + '</p>';
  }
  function topbar(left) {
    return sampleBanner() + '<header class="topbar">' + left + themeButton() + '</header>';
  }
  function backLink(href, text) {
    return '<a class="back" href="' + href + '">' + ICON.back + esc(text) + '</a>';
  }
  // http(s) 주소만 링크로 만들어요 (javascript: 같은 주소는 링크로 쓰지 않음)
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function docLink(src, label) {
    var url = safeUrl(src && src.url);
    if (url) {
      return '<a class="btn btn-secondary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + ICON.external + '</a>';
    }
    return '<span class="btn btn-secondary btn-sm" aria-disabled="true" title="원문 링크가 아직 없어요">' + esc(label) + ICON.external + '</span>';
  }

  /* ---------- Final v2 (10/19): 시간축, 확인 단계, 검증 현황에 쓰는 도구 ---------- */
  // 데이터 방식 3가지: 사람이 원문 대조한 검증용 데이터(human), 가상 예시(sample), 엔진 결과(engine)
  function dataMode() {
    var m = DATA.meta || {};
    if (m.data_mode === 'human_reviewed_demo') return 'human';
    if (m.is_sample && !m.data_mode) return 'sample';
    return 'engine';
  }
  function isHumanData() { return dataMode() === 'human'; }
  // 보고서 칸: 첫 칸은 약속 보고서, 다음 칸은 근거 보고서.
  // 근거 문장의 보고서 이름이 칸에 없으면 뒤에 칸을 더해서, 점과 근거 문장이 서로 어긋나지 않게 해요.
  function reportCols(company, forDirectional) {
    var r = company.reports || {};
    var role = forDirectional ? '관련 활동' : '근거';
    var cols = (r.promise || []).slice(0, 1).map(function (x) { return { title: x.title, url: safeUrl(x.url), role: '약속' }; });
    (r.evidence || []).forEach(function (x) { cols.push({ title: x.title, url: safeUrl(x.url), role: role }); });
    var known = cols.map(function (c) { return c.title; });
    (company.promises || []).forEach(function (p) {
      (p.evidence || []).forEach(function (e) {
        var t = (e.source || {}).report;
        if (t && known.indexOf(t) < 0) { known.push(t); cols.push({ title: t, url: '', role: role }); }
      });
    });
    return cols;
  }
  function evidenceIn(p, title) {
    return (p.evidence || []).filter(function (e) { return (e.source || {}).report === title; });
  }
  function trackLabel(company, p) {
    var noun = isSpecific(p) ? '근거' : '관련 활동';
    return reportCols(company, !isSpecific(p)).map(function (c, i) {
      var has = evidenceIn(p, c.title).length > 0;
      if (i === 0) return c.title + ' 약속' + (has ? ', ' + noun + ' 있음' : '');
      return c.title + ' ' + noun + (has ? ' 있음' : ' 없음');
    }).join(', ');
  }
  // 시간축: 첫 칸은 약속한 보고서, 다음 칸은 근거를 찾은 보고서. 근거가 있으면 채운 점, 없으면 빈 점
  function track(company, p) {
    var cols = reportCols(company, !isSpecific(p));
    var nodes = cols.map(function (c, i) {
      var on = evidenceIn(p, c.title).length > 0;
      if (i === 0) return '<span class="track-node is-promise' + (on ? ' is-on' : '') + '" aria-hidden="true"></span>';
      return '<span class="track-node ' + (on ? 'is-on' : 'is-off') + '" aria-hidden="true"></span>';
    }).join('');
    return '<span class="track" role="img" aria-label="' + esc(trackLabel(company, p)) + '" style="grid-template-columns:repeat(' + cols.length + ',minmax(0,1fr));--n:' + cols.length + '">' + nodes + '</span>';
  }
  function trackHead(company, withLinks, forDirectional) {
    var cols = reportCols(company, forDirectional);
    var linked = withLinks && cols.some(function (c) { return c.url; });
    var cells = cols.map(function (c) {
      var name = linked && c.url
        ? '<a class="tl-col-name" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.title) + '</a>'
        : '<span class="tl-col-name">' + esc(c.title) + '</span>';
      return '<span class="tl-col">' + name + '<span class="tl-col-role">' + esc(c.role) + '</span></span>';
    }).join('');
    // 링크가 없으면 화면 낭독기는 시간축 설명(aria-label)만 읽게 해요 (보고서 이름을 두 번 읽지 않게)
    return '<div class="tl-head"' + (linked ? '' : ' aria-hidden="true"') + ' style="grid-template-columns:repeat(' + cols.length + ',minmax(0,1fr))">' + cells + '</div>';
  }
  function hasReportLinks(company) { return reportCols(company).some(function (c) { return c.url; }); }
  function citationCount(promises) {
    var total = 0, ok = 0;
    (promises || []).forEach(function (p) {
      (p.evidence || []).forEach(function (e) { total += 1; if (e.citation_verified === true) ok += 1; });
    });
    return { total: total, ok: ok };
  }
  // 검증 현황: 데이터에서 계산한 값과 validation.json(사용자 테스트)만 보여줘요
  function factsPanel(companies, scopeName, showNote) {
    var spec = [];
    companies.forEach(function (c) { spec = spec.concat(specifics(c)); });
    var cc = citationCount(spec);
    var mode = dataMode();
    var counts = companies.map(function (c) { return reportCols(c).length; });
    var lo = counts.length ? Math.min.apply(null, counts) : 0;
    var hi = counts.length ? Math.max.apply(null, counts) : 0;
    var reportText = (mode === 'sample' ? '가상 예시' : 'DART 정기공시') + ', ' +
      (companies.length > 1 ? '기업마다 보고서 ' : '보고서 ') + (lo === hi ? lo : lo + '~' + hi) + '개';
    var judgeText = mode === 'human' ? '사람이 원문과 대조해 판정 (판정기준 v2, 검증용 시연 데이터)'
      : mode === 'sample' ? '화면 형식을 보여 주는 가상 예시 (판정기준 v2 형식)'
      : 'AI 엔진이 판정기준 v2로 판정';
    var ut = (VALID && VALID.user_test) || null;
    var utText;
    if (ut && ut.responses > 0) {
      utText = '응답 ' + ut.responses + '명 (공식 최소 ' + (ut.target || 5) + '명)';
      var av = ut.averages || {};
      var parts = [];
      if (av.understanding != null) parts.push('이해도 ' + av.understanding);
      if (av.trust != null) parts.push('신뢰도 ' + av.trust);
      if (av.intent != null) parts.push('활용 의향 ' + av.intent);
      if (parts.length) utText += ', 5점 만점 평균 ' + parts.join(', ');
    } else {
      utText = '진행 중이에요. 응답이 모이면 실제 숫자를 적어요';
    }
    var rows = [
      ['자료', reportText],
      ['판정', judgeText],
      ['원문 일치', cc.total ? '근거 문장 ' + cc.total + '개 중 ' + cc.ok + '개 ' + L.citation_verified_label : '확인할 근거 문장이 아직 없어요'],
      ['사용자 테스트', utText]
    ];
    if (showNote && companies.length === 1 && companies[0].check_note) rows.splice(1, 0, ['기업 안내', companies[0].check_note]);
    return '<section class="card facts" aria-label="' + esc(scopeName) + ' 검증 현황">' +
      '<h2 class="card-title">' + esc(scopeName) + ' 검증 현황</h2>' +
      '<dl class="fact-list">' + rows.map(function (r) {
        return '<div class="fact-row"><dt class="fact-key">' + esc(r[0]) + '</dt><dd class="fact-val">' + esc(r[1]) + '</dd></div>';
      }).join('') + '</dl></section>';
  }
  // 첫 화면의 실제 예: 데이터 순서상 첫 기업에서 근거 확인(없으면 일부 확인) 약속 하나
  function heroExample() {
    var c = (DATA.companies || []).filter(function (x) { return specifics(x).length; })[0];
    if (!c) return '';
    var spec = specifics(c);
    var p = spec.filter(function (x) { return x.verdict === 'evidence_found'; })[0] ||
            spec.filter(function (x) { return x.verdict === 'partial'; })[0] || spec[0];
    var first = reportCols(c)[0];
    return '<a class="hero-example ' + vClass(p.verdict) + '" href="' + promiseHref(c, p.id) + '">' +
        '<span class="hero-example-cap">' + esc(c.name + '의 ' + (first ? first.title + ' ' : '') + '약속 하나') + '</span>' +
        '<span class="hero-example-title">' + esc(p.title) + '</span>' +
        trackHead(c, false) + track(c, p) +
        '<span class="hero-example-foot"><span class="verdict-text">' + esc(verdictLabel(p.verdict)) + '</span>' + ICON.chevron + '</span>' +
      '</a>';
  }
  function stripVerdictTail(text) {
    var t = String(text || '');
    VERDICT_ORDER.forEach(function (k) {
      [verdictShort(k), verdictLabel(k)].forEach(function (lab) {
        var tail = ' (' + lab + ')';
        if (lab && t.slice(-tail.length) === tail) t = t.slice(0, -tail.length);
      });
    });
    return t;
  }
  function srcLine(src) {
    if (!src || !src.report) return '';
    var url = safeUrl(src.url);
    var link = url ? '<a class="ev-link" href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기' + ICON.external + '</a>' : '';
    return '<div class="src-line"><span class="src-text">출처: ' + esc(sourceLabel(src)) + '</span>' + link + '</div>';
  }

  /* ---------- 화면 1: 기업 고르기 ---------- */
  function viewHome() {
    var companies = (DATA.companies || []).map(function (c) {
      var spec = specifics(c);
      var ready = (c.promises || []).length > 0;
      var reports = c.reports || {};
      var meta = ready
        ? '구체적 약속 ' + spec.length + '개 중 ' + countLine(spec)
        : '결과 준비 중';
      var inner =
        '<div class="company-logo" aria-hidden="true">' + esc(c.name.charAt(0)) + '</div>' +
        '<div class="company-info"><div class="company-name">' + esc(c.name) + '</div>' +
        '<div class="company-reports">' + esc('약속: ' + reportTitles(reports.promise) + ' · 근거: ' + reportTitles(reports.evidence)) + '</div>' +
        (c.check_note ? '<div class="company-reports check-note">' + esc(c.check_note) + '</div>' : '') +
        '<div class="company-meta">' + esc(meta) + '</div></div>' + ICON.chevron;
      return ready
        ? '<a class="company" href="#/c/' + encodeURIComponent(c.id) + '">' + inner + '</a>'
        : '<div class="company" aria-disabled="true">' + inner + '</div>';
    }).join('');

    var allReports = [];
    (DATA.companies || []).forEach(function (c) {
      var r = c.reports || {};
      (r.promise || []).concat(r.evidence || []).forEach(function (x) {
        if (allReports.indexOf(x.title) < 0) allReports.push(x.title);
      });
    });
    var ready = (DATA.companies || []).filter(function (c) { return (c.promises || []).length; });
    var firstCo = ready[0] || (DATA.companies || [])[0];
    var promiseReport = firstCo ? ((firstCo.reports || {}).promise || [])[0] : null;
    var human = isHumanData();

    var pipeline = [
      ['약속 찾기', (promiseReport ? promiseReport.title : '사업보고서') + '의 정한 장에서 AI 약속 문장을 원문 그대로 골라요.'],
      ['근거 찾기', '다음 보고서에서 키워드 검색과 의미 검색(RAG)으로 근거 후보를 찾아요. 판정이 "확인 불가"면 검색어를 바꿔 다시 찾아요 (처음 포함 최대 3번).'],
      ['판정', '찾은 문장만 근거로 판정기준 v2에 따라 4가지 중 하나로 정해요.'],
      ['원문 인용 검사', '근거 문장이 원문에 글자 그대로 있는지 코드로 다시 확인해요.']
    ];
    var pipeHtml = '<ol class="pipeline">' + pipeline.map(function (s, i) {
      return '<li class="pipe-step"><span class="pipe-num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="pipe-body"><span class="pipe-title">' + esc(s[0]) + '</span><span class="pipe-desc">' + esc(s[1]) + '</span></span></li>';
    }).join('') + '</ol>';

    return topbar('<div class="brand">' + ICON.shield + esc(L.service_name) + '</div>') +
      '<main class="content">' + disclaimers() +
        '<div class="cols cols-home">' +
        '<section class="hero col-main">' +
          '<p class="eyebrow">' + esc(L.service_subtitle) + ' · ' + esc(L.tagline) + '</p>' +
          '<h1 class="headline">면접 볼 회사의 AI 약속을<br>다음 해 공시와 맞춰 봐요</h1>' +
          '<p class="lead">사업보고서의 "하겠다"를 찾고, 다음 보고서에서 "했다"는 근거를 찾아 원문과 함께 보여드려요.</p>' +
          '<p class="hero-flow">' + (human ? '엔진 처리 순서: ' : '처리 순서: ') + 'DART 정기공시 → 약속 찾기 → 근거 찾기(RAG 검색) → 판정 → 원문 인용 검사</p>' +
          heroExample() +
        '</section>' +
        '<section class="col-side pick">' +
          '<h2 class="section-label">기업 고르기</h2>' +
          '<div class="company-list">' + companies + '</div>' +
        '</section>' +
        '</div>' +
        '<div class="cols cols-pair">' +
        '<section class="card">' +
          '<h2 class="card-title">AI가 확인하는 4단계</h2>' + pipeHtml +
          (human ? '<p class="note">지금 화면의 판정은 사람이 공시 원문을 직접 읽고 대조한 검증용 데이터예요. 위 4단계는 엔진이 같은 형식의 결과를 만드는 순서예요.</p>' : '') +
        '</section>' +
        (ready.length ? factsPanel(ready, '전체') : '') +
        '</div>' +
      '</main>' +
      '<footer class="bottombar"><p class="note">자료: 금융감독원 전자공시(DART)' + (allReports.length ? ' · ' + esc(allReports.join(', ')) : '') + '</p></footer>';
  }

  /* ---------- 화면 2: 약속 목록 (시간축) ---------- */
  function tlRow(company, p) {
    var tag = isSpecific(p)
      ? '<span class="verdict-text">' + esc(verdictLabel(p.verdict)) + '</span>'
      : '<span class="verdict-text">' + esc(L.promise_types.directional.label) + '</span>';
    return '<li><a class="tl-row ' + vClass(p.verdict) + '" href="' + promiseHref(company, p.id) + '">' +
      '<span class="tl-row-top"><span class="tl-title">' + esc(p.title) + '</span>' + ICON.chevron + '</span>' +
      tag + track(company, p) +
    '</a></li>';
  }

  function viewList(company) {
    var spec = specifics(company);
    var dirs = directionals(company);
    var counts = countVerdicts(spec);

    var grid = VERDICT_ORDER.map(function (k) {
      return '<div class="' + vClass(k) + '"><div class="summary-num">' + counts[k] + '</div>' +
        '<div class="summary-label">' + esc(verdictShort(k)) + '</div></div>';
    }).join('');
    var rows = spec.map(function (p) { return tlRow(company, p); }).join('');
    var dirBlock = dirs.length
      ? '<details class="directional">' +
          '<summary>' + esc(L.promise_types.directional.label) + ' ' + dirs.length + '개 (개수에 넣지 않음)</summary>' +
          '<p class="note">' + esc(L.promise_types.directional.note) + '</p>' +
          trackHead(company, false, true) +
          '<ul class="tl-rows">' + dirs.map(function (p) { return tlRow(company, p); }).join('') + '</ul>' +
        '</details>'
      : '';
    var nv = verdictInfo('not_verifiable') || {};

    return topbar(backLink('#/', '기업 선택')) +
      '<main class="content">' + disclaimers() +
        '<section style="display:flex;flex-direction:column;gap:6px">' +
          '<p class="eyebrow">' + esc(company.name) + '</p>' +
          '<h1 class="headline">구체적 약속 ' + spec.length + '개 중</h1>' +
          '<p class="count-line">' + esc(countLine(spec)) + '</p>' +
        '</section>' +
        '<section class="card" aria-label="판정별 개수">' +
          '<div class="summary-grid">' + grid + '</div>' +
        '</section>' +
        '<div class="cols cols-list"><div class="col-main">' +
        '<section class="timeline" aria-label="보고서별 약속과 근거">' +
          trackHead(company, true) +
          '<ul class="tl-rows">' + rows + '</ul>' +
          '<p class="note">첫 점은 약속한 보고서예요. 색이 찬 점은 그 보고서에서 근거 문장을 찾았다는 뜻이에요.' + (hasReportLinks(company) ? ' 보고서 이름을 누르면 DART 원문이 열려요.' : '') + '</p>' +
        '</section>' +
        dirBlock +
        '<p class="note">' + esc(nv.label || '') + ': ' + esc(nv.meaning || '') + '</p>' +
        '</div><div class="col-side">' + factsPanel([company], company.name, true) + '</div></div>' +
      '</main>' +
      '<footer class="bottombar"><a class="btn btn-primary" href="#/c/' + encodeURIComponent(company.id) + '/card">면접 카드 보기</a></footer>';
  }

  /* ---------- 화면 3: 약속 자세히 보기 (확인 4단계) ---------- */
  function evidenceQuote(e, kindLabel) {
    var verified = e.citation_verified === true
      ? '<span class="verified">' + ICON.check + esc(L.citation_verified_label) + '</span>'
      : '';
    var url = safeUrl(e.source && e.source.url);
    var link = url
      ? '<a class="ev-link" href="' + esc(url) + '" target="_blank" rel="noopener">원문 보기' + ICON.external + '</a>'
      : '';
    return '<div class="quote-block step-quote">' +
        '<div class="quote-meta is-evidence"><span>' + esc(kindLabel) + '</span><span>' + esc(sourceLabel(e.source || {})) + '</span></div>' +
        '<p class="quote-text">"' + esc(e.sentence) + '"</p>' +
        '<div class="ev-foot">' + verified + link + '</div>' +
      '</div>';
  }
  function step(num, title, who, body) {
    return '<li class="step"><span class="step-num" aria-hidden="true">' + num + '</span>' +
      '<div class="step-main"><div class="step-head"><h2 class="step-title">' + esc(title) + '</h2>' +
      (who ? '<span class="step-who">' + esc(who) + '</span>' : '') + '</div>' +
      '<div class="step-body">' + body + '</div></div></li>';
  }

  function viewDetail(company, p) {
    var listHref = '#/c/' + encodeURIComponent(company.id);
    var evidence = p.evidence || [];
    var specific = isSpecific(p);
    var mode = dataMode();
    // 단계마다 누가 했는지: 사람 대조 데이터 / 가상 예시 / 엔진 결과
    function who(human, sample, engine) { return mode === 'human' ? human : (mode === 'sample' ? sample : engine); }
    var kindLabel = !specific ? '관련 활동' : (p.verdict === 'company_reported_not_pursued' ? '회사가 적은 문장' : '실행 근거');
    var emptyMsg = specific ? L.not_verifiable_message : L.no_related_activity_message;
    var cols = reportCols(company, !specific);

    // 1. 약속 찾기
    var promiseUrl = safeUrl(p.source && p.source.url);
    var promiseLink = promiseUrl
      ? '<div class="ev-foot"><a class="ev-link" href="' + esc(promiseUrl) + '" target="_blank" rel="noopener">원문 보기' + ICON.external + '</a></div>'
      : '';
    var s1 = step(1, '약속 찾기', who('사람이 원문에서 고름', '예시 데이터', 'AI가 원문 문장을 고름'),
      '<div class="quote-block step-quote">' +
        '<div class="quote-meta"><span>약속</span><span>' + esc(sourceLabel(p.source || {})) + '</span></div>' +
        '<p class="quote-text">"' + esc(p.sentence) + '"</p>' + promiseLink +
      '</div>');

    // 2. 근거 찾기: 보고서마다 근거가 있었는지 + 근거 문장 (약속 보고서는 근거가 있을 때만 보여줘요)
    var noun = specific ? '근거' : '관련 활동';
    var checks = cols.map(function (c, i) {
      var n = evidenceIn(p, c.title).length;
      if (i === 0 && !n) return '';
      return '<li class="report-check ' + (n ? 'is-on' : 'is-off') + '">' +
        '<span class="check-icon ' + (n ? 'ok' : 'no') + '">' + (n ? ICON.check : ICON.dash) + '</span>' +
        '<span>' + esc(c.title) + (n ? ' ' + noun + ' ' + n + '개' : ' ' + noun + ' 없음') + '</span></li>';
    }).join('');
    var who2 = who('사람이 원문 대조', '예시 데이터', specific && p.search_attempts ? '검색 ' + p.search_attempts + '번' : 'AI 검색');
    var evHtml = evidence.length
      ? evidence.map(function (e) { return evidenceQuote(e, kindLabel); }).join('')
      : '<p class="quote-empty">' + esc(emptyMsg) + '</p>';
    var s2 = step(2, specific ? '근거 찾기' : '관련 활동 찾기', who2, '<ul class="report-checks">' + checks + '</ul>' + evHtml);

    // 3. 판정
    var vi = verdictInfo(p.verdict) || {};
    var s3 = specific
      ? step(3, '판정', who('판정기준 v2, 사람', '판정기준 v2, 예시', '판정기준 v2, AI'),
          '<span class="verdict-pill">' + esc(verdictLabel(p.verdict)) + '</span>' +
          (vi.meaning ? '<p class="note">' + esc(vi.meaning) + '</p>' : '') +
          (p.reason ? '<p class="reason">' + esc(p.reason) + '</p>' : ''))
      : step(3, '판정', '', '<p class="note">' + esc(L.promise_types.directional.note) + '</p>');

    // 4. 원문 인용 검사
    var cc = citationCount([p]);
    var s4 = step(4, '원문 인용 검사', who('사람이 원문과 대조', '예시 데이터', '코드가 원문과 대조'),
      cc.total
        ? '<p class="step-result"><span class="check-icon ' + (cc.ok === cc.total ? 'ok' : 'no') + '">' + (cc.ok === cc.total ? ICON.check : ICON.dash) + '</span>' +
            esc((specific ? '근거 문장 ' : '찾은 문장 ') + cc.total + '개 중 ' + cc.ok + '개 ' + L.citation_verified_label) + '</p>'
        : '<p class="note">확인할 문장이 없어요.</p>');

    var pill = specific
      ? '<span class="verdict-pill">' + esc(verdictLabel(p.verdict)) + '</span>'
      : '<span class="verdict-pill">' + esc(L.promise_types.directional.label) + '</span>';
    var evReports = cols.filter(function (c) { return evidenceIn(p, c.title).length; }).map(function (c) { return c.title; });
    var secondLink = evidence.length && evidence[0].source
      ? docLink(evidence[0].source, evidence[0].source.report + ' 원문')
      : '<a class="btn btn-secondary btn-sm" href="' + listHref + '">목록으로</a>';

    return topbar(backLink(listHref, '약속 목록')) +
      '<main class="content ' + vClass(p.verdict) + '">' + disclaimers() +
        '<section style="display:flex;flex-direction:column;gap:10px">' +
          pill +
          '<h1 class="detail-title">' + esc(p.title) + '</h1>' +
        '</section>' +
        '<div class="cols cols-detail">' +
          '<div class="detail-side"><div class="detail-track">' + trackHead(company, false, !specific) + track(company, p) +
            '<dl class="side-sum">' +
              '<div class="fact-row"><dt class="fact-key">판정</dt><dd class="fact-val">' + esc(specific ? verdictLabel(p.verdict) : L.promise_types.directional.label) + '</dd></div>' +
              '<div class="fact-row"><dt class="fact-key">' + esc(specific ? '근거' : '관련 활동') + '</dt><dd class="fact-val">' + esc(evReports.length ? evReports.join(', ') : '찾지 못함') + '</dd></div>' +
              '<div class="fact-row"><dt class="fact-key">원문 일치</dt><dd class="fact-val">' + esc(cc.total ? cc.ok + '/' + cc.total : '해당 없음') + '</dd></div>' +
              '<div class="fact-row"><dt class="fact-key">확인</dt><dd class="fact-val">' + esc(who('사람이 원문 대조', '가상 예시', 'AI 엔진, 판정기준 v2')) + '</dd></div>' +
            '</dl>' +
          '</div></div>' +
          '<ol class="stepper" aria-label="확인 4단계">' + s1 + s2 + s3 + s4 + '</ol>' +
        '</div>' +
      '</main>' +
      '<footer class="bottombar two">' + docLink(p.source, ((p.source || {}).report || '약속') + ' 원문') + secondLink + '</footer>';
  }

  /* ---------- 화면 4: 면접 카드 (확인된 사실, 면접에서 쓸 포인트, 회사에 물어볼 질문) ---------- */
  function confirmedFacts(company) {
    var card = company.interview_card || {};
    var issueText = {};
    (card.issues || []).forEach(function (it) { if (it.promise_id && !issueText[it.promise_id]) issueText[it.promise_id] = stripVerdictTail(it.text); });
    // 원문 인용 검사를 통과한(citation_verified가 true인) 근거 문장만 씁니다
    var rows = specifics(company).map(function (p) {
      return { p: p, ev: (p.evidence || []).filter(function (e) { return e.citation_verified === true; })[0] };
    }).filter(function (x) { return x.ev; });
    var ordered = rows.filter(function (x) { return x.p.verdict === 'evidence_found'; })
      .concat(rows.filter(function (x) { return x.p.verdict === 'partial'; }));
    return ordered.slice(0, 3).map(function (x) {
      return { p: x.p, text: issueText[x.p.id] || x.p.title, ev: x.ev };
    });
  }
  function viewCard(company) {
    var card = company.interview_card || {};
    var listHref = '#/c/' + encodeURIComponent(company.id);
    var facts = confirmedFacts(company);
    var tpData = card.talking_points || [], qData = card.questions || [];
    if (!facts.length && !tpData.length && !qData.length) {
      return topbar(backLink(listHref, '약속 목록')) +
        '<main class="content">' + disclaimers() + '<p class="empty">면접 카드를 준비하고 있어요.</p></main>';
    }
    function promiseOf(pid) { return findPromise(company, pid); }

    var factHtml = facts.length ? facts.map(function (f) {
      return '<div class="fact-item ' + vClass(f.p.verdict) + '">' +
        '<a class="fact-head" href="' + promiseHref(company, f.p.id) + '"><span class="verdict-text">' + esc(verdictLabel(f.p.verdict)) + '</span>' +
          '<span class="fact-text">' + esc(f.text) + '</span></a>' +
        '<p class="fact-quote">"' + esc(f.ev.sentence) + '"</p>' + srcLine(f.ev.source) +
      '</div>';
    }).join('') : '<p class="note">원문 일치를 확인한 근거 문장이 아직 없어요. 아래 질문으로 추진 방향을 물어보세요.</p>';
    var factNote = facts.length
      ? '<p class="note">' + (dataMode() === 'sample' ? '따옴표 안 문장은 가상 예시 문장이에요.' : '따옴표 안 문장은 공시 원문 그대로예요.') + '</p>'
      : '';

    var answers = tpData.map(function (a) {
      var p = promiseOf(a.promise_id);
      // 근거 링크와 같은 근거 문장만 출처로 써요 (복사 문구와 같은 링크가 되게)
      var ev = p && a.evidence_url ? (p.evidence || []).filter(function (e) { return (e.source || {}).url === a.evidence_url; })[0] : null;
      var src = ev ? ev.source : (a.evidence_url ? { report: '근거 원문', url: a.evidence_url } : null);
      return '<div class="answer">' +
        (p ? '<a class="answer-tag" href="' + promiseHref(company, p.id) + '">' + esc(p.title) + '</a>' : '') +
        '<div class="answer-text">' + esc(a.text) + '</div>' + srcLine(src) + '</div>';
    }).join('');

    var questions = qData.map(function (q) {
      var text = typeof q === 'string' ? q : q.text;
      var p = q && q.promise_id ? promiseOf(q.promise_id) : null;
      return '<div class="question-item">' +
        '<div class="question">' + ICON.chat + '<div>' + esc(text) + '</div></div>' +
        (p ? '<a class="q-link" href="' + promiseHref(company, p.id) + '">관련 약속: ' + esc(p.title) + ' (' + esc(verdictShort(p.verdict) || L.promise_types.directional.label) + ')</a>' + srcLine(p.source) : '') +
      '</div>';
    }).join('');

    return topbar(backLink(listHref, '약속 목록')) +
      '<main class="content">' + disclaimers() +
        '<section style="display:flex;flex-direction:column;gap:6px">' +
          '<p class="eyebrow">' + esc(company.name) + ' 면접 카드</p>' +
          '<h1 class="headline">면접 5분 전,<br>이것만 보고 들어가세요</h1>' +
          '<p class="note">' + esc(L.interview_card_notice) + '</p>' +
        '</section>' +
        '<div class="cols cols-card">' +
        '<section class="card"><h2 class="card-title">확인된 사실 ' + facts.length + '</h2>' +
          factNote + factHtml + '</section>' +
        '<section class="card"><h2 class="card-title">면접에서 쓸 포인트 ' + tpData.length + '</h2>' + answers + '</section>' +
        '<section class="card"><h2 class="card-title">회사에 물어볼 질문 ' + qData.length + '</h2>' + questions + '</section>' +
        '</div>' +
      '</main>' +
      '<footer class="bottombar two">' +
        '<button type="button" class="btn btn-secondary" id="copy-btn">카드 복사하기</button>' +
        '<a class="btn btn-primary" href="#/">다른 기업 보기</a>' +
      '</footer>';
  }

  function cardAsText(company) {
    var card = company.interview_card || {};
    function srcText(src) { var u = safeUrl(src && src.url); return src && src.report ? ' (출처: ' + sourceLabel(src) + (u ? ', ' + u : '') + ')' : ''; }
    var lines = ['[' + company.name + ' 면접 카드]', L.interview_card_notice, '', '확인된 사실'];
    var facts = confirmedFacts(company);
    facts.forEach(function (f, i) {
      lines.push((i + 1) + '. ' + f.text + ' [' + verdictLabel(f.p.verdict) + ']');
      lines.push('   "' + f.ev.sentence + '"' + srcText(f.ev.source));
    });
    if (!facts.length) lines.push('- 원문 일치를 확인한 근거 문장이 아직 없어요');
    lines.push('', '면접에서 쓸 포인트');
    (card.talking_points || []).forEach(function (a) {
      var u = safeUrl(a.evidence_url);
      lines.push('- ' + a.text + (u ? ' (근거: ' + u + ')' : ''));
    });
    lines.push('', '회사에 물어볼 질문');
    (card.questions || []).forEach(function (q) { lines.push('- ' + (typeof q === 'string' ? q : q.text)); });
    lines.push('', (L.disclaimers || []).join(' '));
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function toast(message) {
    var el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1800);
  }

  /* ---------- 주소(#)에 맞는 화면 그리기 ---------- */
  function notFound() {
    return topbar(backLink('#/', '처음으로')) + '<main class="content">' + disclaimers() + '<p class="empty">찾는 화면이 없어요.</p></main>';
  }

  // 그리는 중 오류가 나면 빈 화면 대신 안내를 보여주고, 오류는 그대로 던져서 검사(ui_check)에 잡히게 해요
  function render() {
    try { draw(); } catch (e) {
      appEl.innerHTML = '<main class="content"><p class="empty">화면을 그리지 못했어요. 새로고침해 주세요.</p></main>';
      throw e;
    }
  }

  function draw() {
    var parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
    var html, title = L.service_name;
    var company = parts[0] === 'c' ? findCompany(parts[1]) : null;

    if (parts.length === 0) {
      html = viewHome();
    } else if (company && parts.length === 2) {
      html = viewList(company); title = company.name + ' 약속 목록';
    } else if (company && parts[2] === 'p' && findPromise(company, parts[3])) {
      var p = findPromise(company, parts[3]);
      html = viewDetail(company, p); title = p.title;
    } else if (company && parts[2] === 'card') {
      html = viewCard(company); title = company.name + ' 면접 카드';
    } else {
      html = notFound();
    }

    appEl.innerHTML = html;
    document.title = title === L.service_name ? L.service_name + ' | ' + L.service_subtitle : title + ' | ' + L.service_name;
    window.scrollTo(0, 0);

    var themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn && company) {
      copyBtn.addEventListener('click', function () {
        copyText(cardAsText(company))
          .then(function () { toast('면접 카드를 복사했어요'); })
          .catch(function () { toast('복사하지 못했어요. 직접 선택해 주세요'); });
      });
    }
  }

  /* ---------- 시작: 결과 파일 → 없으면 예시 데이터 ---------- */
  function start(data) {
    DATA = data || { companies: [] };
    var labels = DATA.labels || {};
    L = {};
    Object.keys(DEFAULT_LABELS).forEach(function (k) { L[k] = labels[k] != null ? labels[k] : DEFAULT_LABELS[k]; });
    if (!L.promise_types.directional) L.promise_types = DEFAULT_LABELS.promise_types;
    window.addEventListener('hashchange', render);
    render();
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) { if (!res.ok) throw new Error(url); return res.json(); });
  }
  // results.json을 못 읽을 때만 예시 데이터로 바꿔요. 그리는 중 오류는 예시 데이터로 덮지 않고 그대로 드러나게 해요
  getJson('data/validation.json').catch(function () { return null; }).then(function (v) {
    VALID = v;
    return getJson('data/results.json');
  })
    .then(function (data) { start(data); }, function () { start(window.AI_PROMISE_SAMPLE); });
})();
