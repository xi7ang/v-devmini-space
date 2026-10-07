/* app.js v2 — 首页（Hero 轮播 + 快筛 + 分类板块）+ 频道/搜索列表 */
(() => {
  const DATA_URL = 'data/resources.json';
  const { PLATFORM, phGradient, esc } = window.VU;
  const PAGE = 60;
  const SECTIONS = ['电影', '电视剧', '动漫', '综艺', '纪录片'];
  const state = { items: [], type: '', platform: '', q: '', sort: 'new', view: 'home', shown: 0, slide: 0 };
  const $ = s => document.querySelector(s);
  let heroTimer = null;

  function platsOf(it) { return Array.from(new Set((it.links || []).map(l => l.platform))) }
  const pShort = p => (PLATFORM[p] || PLATFORM.unknown).short;

  function cardHTML(it) {
    const plats = platsOf(it);
    const sub = it.subtitle || (it.year ? `${it.year}` : '');
    const badge = (it.subtitle || '').match(/更至\d+集|第\d+[集期季]|更新至\d+集|全\d+集|第[一二三四五六七八九十]+季/);
    return `<li class="qy-mod-li">
      <div class="qy-mod-img">
        <a class="card-link" href="detail.html?id=${esc(it.id)}" title="${esc(it.title)}" aria-label="${esc(it.title)}"></a>
        ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" loading="lazy" onerror="this.remove()">` : ''}
        <span class="ph" style="background:${phGradient(it.title)}">${esc((it.title || '?').slice(0, 1))}</span>
        ${it.quality ? `<span class="badge-qual">${esc(it.quality)}</span>` : ''}
        <span class="badge-type">${esc(it.type)}</span>
        ${badge ? `<span class="badge-ep">${esc(badge[0])}</span>` : ''}
        <span class="plats">${plats.slice(0, 3).map(p => `<span class="pdot ${esc(p)}">${esc(pShort(p))}</span>`).join('')}</span>
        <span class="hover-mask">
          <span class="hm-txt">${esc((it.desc || '暂无简介').slice(0, 68))}</span>
          <span class="hm-btn">查看转存 ›</span>
        </span>
      </div>
      <div class="title-wrap">
        <p class="main"><a href="detail.html?id=${esc(it.id)}" title="${esc(it.title)}">${esc(it.title)}</a></p>
        <p class="sub">${esc(sub)}</p>
      </div>
    </li>`;
  }

  function buildNav() {
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    $('#qyNav').innerHTML = items.map(([v, l]) =>
      `<a class="nav-link${(state.view === 'list' && state.type === v) || (state.view === 'home' && v === '') ? ' active' : ''}" href="javascript:void(0)" data-nav="${esc(v)}">${l}</a>`
    ).join('');
    $('#qyNav').querySelectorAll('[data-nav]').forEach(a => {
      a.onclick = () => (a.dataset.nav === '' ? showHome() : showList(a.dataset.nav));
    });
  }

  /* ---------- Hero 轮播 ---------- */
  function renderHero() {
    const picks = state.items.filter(x => x.poster).slice(0, 5);
    const list = picks.length ? picks : state.items.slice(0, 3);
    if (!list.length) { $('#hero').style.display = 'none'; return; }
    $('#hero').innerHTML = list.map((it, i) => `
      <div class="hero-slide${i === 0 ? ' on' : ''}" data-i="${i}">
        ${it.poster ? `<div class="hero-bg" style="background-image:url('${esc(it.poster)}')"></div>` : ''}
        <div class="hero-veil"></div>
        <div class="hero-inner">
          <p class="hero-kicker">精选推荐 · ${esc(it.type)}</p>
          <h1 class="hero-title">${esc(it.title)}</h1>
          <div class="hero-meta">
            ${it.year ? `<span>${esc(it.year)}</span>` : ''}
            ${it.quality ? `<span class="pill">${esc(it.quality)}</span>` : ''}
            ${platsOf(it).map(p => `<span class="pill">${esc(pShort(p))}</span>`).join('')}
          </div>
          <p class="hero-desc">${esc(it.desc || '网盘资源，转存到自己的网盘后下载观看。')}</p>
          <a class="btn btn-gold" href="detail.html?id=${esc(it.id)}">查看资源与转存 ›</a>
        </div>
      </div>`).join('') +
      `<div class="hero-dots">${list.map((_, i) => `<i class="${i === 0 ? 'on' : ''}" data-dot="${i}"></i>`).join('')}</div>`;
    const slides = $('#hero').querySelectorAll('.hero-slide');
    const dots = $('#hero').querySelectorAll('[data-dot]');
    const go = n => {
      state.slide = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('on', i === state.slide));
      dots.forEach((d, i) => d.classList.toggle('on', i === state.slide));
    };
    dots.forEach(d => { d.onclick = () => { go(+d.dataset.dot); restart(); }; });
    clearInterval(heroTimer);
    const restart = () => { clearInterval(heroTimer); heroTimer = setInterval(() => go(state.slide + 1), 5200); };
    restart();
  }

  /* ---------- 快筛 ---------- */
  function renderQuickbar() {
    const qb = $('#quickbar');
    if (!state.items.length) { qb.innerHTML = ''; return; }
    const quick = [['', '全部'], ['电影', '电影'], ['电视剧', '电视剧'], ['动漫', '动漫'], ['综艺', '综艺'], ['纪录片', '纪录片']];
    qb.innerHTML = `<span class="qb-label">快速筛选</span>` +
      quick.map(([v, l]) => `<span class="qy-chip" data-q="${esc(v)}">${l}</span>`).join('') +
      `<span class="divv"></span>` +
      [['uc', 'UC'], ['xunlei', '迅雷'], ['guangya', '光鸭'], ['quark', '夸克']]
        .map(([v, l]) => `<span class="qy-chip" data-p="${esc(v)}">${l}</span>`).join('');
    qb.querySelectorAll('[data-q]').forEach(el => el.onclick = () => (el.dataset.q ? showList(el.dataset.q) : showList('')));
    qb.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { state.platform = el.dataset.p; showList(''); });
  }

  /* ---------- 板块 ---------- */
  function sectionHTML(title, type, list) {
    return `<section class="qy-mod-list">
      <div class="qy-mod-header">
        <h2 class="qy-mod-title">${esc(title)}<span class="cnt">${list.length}</span></h2>
        <a class="more" href="javascript:void(0)" data-goto="${esc(type || '')}">更多 ›</a>
      </div>
      <ul class="qy-mod-ul" data-items='${JSON.stringify(list).replace(/'/g, '&#39;')}'></ul>
    </section>`;
  }
  function renderSections() {
    let html = '';
    if (state.items.length) html += sectionHTML('最新发布', '', state.items.slice(0, 12));
    SECTIONS.forEach(t => {
      const list = state.items.filter(x => x.type === t);
      if (list.length) html += sectionHTML(t, t, list.slice(0, 12));
    });
    const box = $('#sections');
    box.innerHTML = html || `<div class="qy-empty"><div class="big">🍿</div><p>还没有影视资源</p></div>`;
    box.querySelectorAll('.qy-mod-ul').forEach(ul => {
      ul.innerHTML = ul.dataset.items ? JSON.parse(ul.dataset.items).map(cardHTML).join('') : '';
      ul.removeAttribute('data-items');
    });
    box.querySelectorAll('[data-goto]').forEach(el => el.onclick = e => { e.preventDefault(); showList(el.dataset.goto); });
  }

  /* ---------- 列表 ---------- */
  function buildChips() {
    const cats = [['', '全部']].concat(SECTIONS.map(t => [t, t]));
    $('#catChips').innerHTML = cats.map(([v, l]) => `<span class="qy-chip${state.type === v ? ' active' : ''}" data-c="${esc(v)}">${l}</span>`).join('');
    $('#catChips').querySelectorAll('[data-c]').forEach(el => el.onclick = () => { state.type = el.dataset.c; showList(el.dataset.c, true); });
    const plats = [['', '全部网盘'], ['uc', 'UC'], ['xunlei', '迅雷'], ['guangya', '光鸭'], ['quark', '夸克'], ['aliyun', '阿里云盘']];
    $('#platChips').innerHTML = plats.map(([v, l]) => `<span class="qy-chip${state.platform === v ? ' active' : ''}" data-p="${esc(v)}">${l}</span>`).join('');
    $('#platChips').querySelectorAll('[data-p]').forEach(el => el.onclick = () => { state.platform = el.dataset.p; showList(state.type, true); });
  }
  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = state.items.filter(it => {
      if (state.type && it.type !== state.type) return false;
      if (state.platform && !(it.links || []).some(l => l.platform === state.platform)) return false;
      if (q) {
        const hay = (it.title + ' ' + (it.subtitle || '') + ' ' + (it.tags || []).join(' ') + ' ' + (it.desc || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (state.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    else if (state.sort === 'type') list.sort((a, b) => (a.type + a.title).localeCompare(b.type + b.title, 'zh'));
    return list;
  }
  function renderList(reset = true) {
    const list = filtered();
    if (reset) state.shown = PAGE;
    $('#listGrid').innerHTML = list.slice(0, state.shown).map(cardHTML).join('');
    $('#listEmpty').hidden = list.length !== 0;
    $('#loadMore').hidden = state.shown >= list.length;
    $('#stat').textContent = `共 ${list.length} 条`;
    $('#listTitle').textContent = state.q ? `搜索「${state.q}」` : (state.type || '全部资源');
    $('#listTitle').innerHTML = (state.q ? `搜索「${esc(state.q)}」` : esc(state.type || '全部资源')) + `<span class="cnt">${list.length}</span>`;
  }

  function showHome() {
    state.view = 'home'; state.type = ''; state.q = ''; $('#searchInput').value = '';
    $('#homeView').hidden = false; $('#listView').hidden = true;
    buildNav(); renderHero(); renderQuickbar(); renderSections();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showList(type = '', keepQ = false) {
    state.view = 'list';
    if (typeof type === 'string') state.type = type;
    if (!keepQ) state.q = '';
    $('#homeView').hidden = true; $('#listView').hidden = false;
    buildNav(); buildChips(); renderList(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showSearch(q) {
    state.q = q; state.type = ''; state.platform = '';
    state.view = 'list';
    $('#homeView').hidden = true; $('#listView').hidden = false;
    buildNav(); buildChips(); renderList(true);
  }

  function wire() {
    $('#searchForm').onsubmit = e => { e.preventDefault(); showSearch($('#searchInput').value); };
    let t;
    $('#searchInput').oninput = () => { clearTimeout(t); t = setTimeout(() => { if ($('#searchInput').value.trim()) showSearch($('#searchInput').value); }, 350); };
    $('#sortSelect').onchange = e => { state.sort = e.target.value; renderList(true); };
    $('#loadMore').onclick = () => { state.shown += PAGE; renderList(false); };
    $('#backHome').onclick = showHome;
    $('#searchType').onclick = () => window.VU.toast('搜索范围：全部');
  }

  async function init() {
    wire(); buildNav();
    try {
      const doc = await (await fetch(DATA_URL, { cache: 'no-cache' })).json();
      state.items = doc.items || [];
      $('#loading').hidden = true;
      const qs = new URLSearchParams(location.search);
      if (qs.get('q')) { $('#searchInput').value = qs.get('q'); showSearch(qs.get('q')); }
      else if (qs.get('type')) showList(qs.get('type'));
      else showHome();
    } catch (e) {
      $('#loading').hidden = true;
      $('#sections').innerHTML = `<div class="qy-empty"><div class="big">⚠️</div><p>数据加载失败：${esc(e.message)}</p></div>`;
    }
  }
  init();
})();