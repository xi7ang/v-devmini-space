/* app.js v3 — GameHub 设计语言：背景图墙 + Hero + 卡牌网格 */
(() => {
  const DATA_URL = 'data/resources.json';
  const { PLATFORM, phGradient, esc } = window.VU;
  const PAGE = 60;
  const SECTIONS = ['电影', '电视剧', '动漫', '综艺', '纪录片'];
  const state = { items: [], type: '', platform: '', q: '', sort: 'new', view: 'home', shown: 0, slide: 0 };
  const $ = s => document.querySelector(s);
  let heroTimer = null;

  /* ── 主题由 common.js 统一处理 ── */

  const platsOf = it => Array.from(new Set((it.links || []).map(l => l.platform)));
  const pShort = p => (PLATFORM[p] || PLATFORM.unknown).short;
  const CAT_EMOJI = { 电影: '🎬', 电视剧: '📺', 动漫: '🌀', 综艺: '🎤', 纪录片: '🌍', 资源: '📦' };

  /* ── 卡牌（GameHub ResourceCard 结构）── */
  function cardHTML(it) {
    const plats = platsOf(it);
    const sub = it.subtitle || (it.year ? `${it.year}` : '');
    const ep = (it.subtitle || '').match(/更至\d+集|第\d+[集期季]|更新至\d+集|全\d+集|第[一二三四五六七八九十]+季/);
    const noCover = !it.poster;
    return `<a class="rc" href="detail.html?id=${esc(it.id)}" title="${esc(it.title)}">
      <div class="rc__cover">
        ${noCover ? `<span class="rc__cover-halo" style="background:radial-gradient(circle at 50% 35%,${gradOf(it.title)[0]}55 0%,transparent 70%)"></span>
          <span class="rc__cover-emoji">${CAT_EMOJI[it.type] || '🎬'}</span>
          <span class="rc__cover-title">${esc(it.title)}</span>` : ''}
        ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" loading="lazy" onerror="this.remove()">` : ''}
        <span class="rc__veil"></span>
        ${it.quality ? `<span class="rc__tag"><span class="badge" style="background:linear-gradient(135deg,var(--accent-gold),var(--accent-gold-deep));color:#fff;border:0">${esc(it.quality)}</span></span>` : ''}
        <span class="rc__tagr"><span class="badge">${esc(it.type)}</span></span>
        ${ep ? `<span class="rc__ep">${esc(ep[0])}</span>` : ''}
        <span class="rc__plats">${plats.slice(0, 3).map(p => `<span class="pdot">${esc(pShort(p))}</span>`).join('')}</span>
        <span class="rc__hover"><span class="hm-txt">${esc((it.desc || '暂无简介').slice(0, 60))}</span><span class="hm-btn">查看转存 ›</span></span>
      </div>
      <div class="rc__body">
        <h3 class="rc__title">${esc(it.title)}</h3>
        <div class="rc__meta">
          <span class="badge">${esc(it.type)}</span>
          ${sub ? `<span class="rc__date">${esc(sub)}</span>` : ''}
        </div>
      </div>
    </a>`;
  }
  const GRADS = [['#c99a5b', '#a87b3f'], ['#7d9cb3', '#4f6d8a'], ['#c46a4a', '#8a5a9a'], ['#7da37d', '#5d7c93'], ['#b08a5f', '#8a6844']];
  function gradOf(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return GRADS[h % GRADS.length] }

  /* ── 背景图墙 ── */
  function buildWall() {
    const posters = state.items.filter(x => x.poster).map(x => x.poster);
    const track = $('#wallTrack');
    if (!track) return;
    const covers = posters.length ? posters : [];
    if (!covers.length) { track.innerHTML = ''; return; }
    const ROWS = 13;
    const per = 16;
    let html = '';
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let i = 0; i < per; i++) row.push(covers[(r * 5 + i * 3) % covers.length]);
      const tiles = row.concat(row).map(p => `<span class="tile"><img src="${esc(p)}" alt="" loading="lazy" decoding="async"></span>`).join('');
      html += `<div class="bg-wall__row ${r % 2 === 0 ? 'l' : 'r'}" style="--row-speed:${560 + r * 40}s">${tiles}</div>`;
    }
    track.innerHTML = html;
  }

  /* ── 导航 ── */
  function buildNav() {
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    $('#siteNav').innerHTML = items.map(([v, l]) =>
      `<a class="nav-link${(state.view === 'list' && state.type === v) || (state.view === 'home' && v === '') ? ' active' : ''}" href="javascript:void(0)" data-nav="${esc(v)}">${l}</a>`).join('');
    $('#siteNav').querySelectorAll('[data-nav]').forEach(a => {
      a.onclick = () => (a.dataset.nav === '' ? showHome() : showList(a.dataset.nav));
    });
  }

  /* ── Hero ── */
  function renderHero() {
    const picks = state.items.filter(x => x.poster).slice(0, 5);
    const list = picks.length ? picks : state.items.slice(0, 3);
    const hero = $('#hero');
    if (!list.length) { hero.style.display = 'none'; return; }
    hero.innerHTML = list.map((it, i) => `
      <div class="hero-slide${i === 0 ? ' on' : ''}">
        ${it.poster ? `<div class="hero-bg" style="background-image:url('${esc(it.poster)}')"></div>` : ''}
        <div class="hero-veil"></div>
        <div class="hero-inner">
          ${it.poster ? `<div class="hero-poster"><img src="${esc(it.poster)}" alt=""></div>` : ''}
          <div class="hero-copy">
            <div class="hero-kicker">精选 · ${esc(it.type)}</div>
            <h1 class="hero-title">${esc(it.title)}</h1>
            <div class="hero-meta">
              ${it.year ? `<span class="badge">${esc(it.year)}</span>` : ''}
              ${it.quality ? `<span class="badge">${esc(it.quality)}</span>` : ''}
              ${platsOf(it).map(p => `<span class="badge">${esc(pShort(p))}</span>`).join('')}
            </div>
            <p class="hero-desc">${esc(it.desc || '网盘资源，转存到自己的网盘后下载观看。')}</p>
            <a class="btn btn-primary" href="detail.html?id=${esc(it.id)}">查看资源与转存 ›</a>
          </div>
        </div>
      </div>`).join('') +
      `<div class="hero-dots">${list.map((_, i) => `<i class="${i === 0 ? 'on' : ''}" data-dot="${i}"></i>`).join('')}</div>`;
    const slides = hero.querySelectorAll('.hero-slide');
    const dots = hero.querySelectorAll('[data-dot]');
    const go = n => {
      state.slide = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('on', i === state.slide));
      dots.forEach((d, i) => d.classList.toggle('on', i === state.slide));
    };
    dots.forEach(d => d.onclick = () => { go(+d.dataset.dot); restart(); });
    function restart() { clearInterval(heroTimer); heroTimer = setInterval(() => go(state.slide + 1), 5500); }
    restart();
  }

  /* ── 快筛 ── */
  function renderQuickbar() {
    const qb = $('#quickbar');
    if (!state.items.length) { qb.innerHTML = ''; return; }
    qb.innerHTML = `<span style="color:var(--text-low);font-size:13px">快速筛选</span>` +
      [['', '全部'], ['电影', '电影'], ['电视剧', '电视剧'], ['动漫', '动漫'], ['综艺', '综艺'], ['纪录片', '纪录片']]
        .map(([v, l]) => `<span class="chip" data-q="${esc(v)}">${l}</span>`).join('') +
      `<span class="divv"></span>` +
      [['uc', 'UC'], ['xunlei', '迅雷'], ['guangya', '光鸭'], ['quark', '夸克']]
        .map(([v, l]) => `<span class="chip" data-p="${esc(v)}">${l}</span>`).join('');
    qb.querySelectorAll('[data-q]').forEach(el => el.onclick = () => showList(el.dataset.q));
    qb.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { state.platform = el.dataset.p; showList(''); });
  }

  /* ── 板块 ── */
  function sectionHTML(title, type, list) {
    return `<section class="section" style="padding-top:0">
      <div class="section-title">${esc(title)}<span class="cnt">${list.length}</span>
        <a href="javascript:void(0)" data-goto="${esc(type || '')}" style="font-family:var(--font-body);font-size:13px;font-weight:400;color:var(--text-mid)">更多 ›</a>
      </div>
      <div class="grid-cards" data-items='${JSON.stringify(list).replace(/'/g, '&#39;')}'></div>
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
    box.innerHTML = html || `<div class="empty"><div class="big">🍿</div><p>还没有影视资源</p></div>`;
    box.querySelectorAll('.grid-cards').forEach(g => {
      g.innerHTML = g.dataset.items ? JSON.parse(g.dataset.items).map(cardHTML).join('') : '';
      g.removeAttribute('data-items');
    });
    box.querySelectorAll('[data-goto]').forEach(el => el.onclick = e => { e.preventDefault(); showList(el.dataset.goto); });
  }

  /* ── 列表 ── */
  function buildChips() {
    const cats = [['', '全部']].concat(SECTIONS.map(t => [t, t]));
    $('#catChips').innerHTML = cats.map(([v, l]) => `<span class="chip${state.type === v ? ' active' : ''}" data-c="${esc(v)}">${l}</span>`).join('');
    $('#catChips').querySelectorAll('[data-c]').forEach(el => el.onclick = () => { state.type = el.dataset.c; showList(el.dataset.c, true); });
    const plats = [['', '全部网盘'], ['uc', 'UC'], ['xunlei', '迅雷'], ['guangya', '光鸭'], ['quark', '夸克'], ['aliyun', '阿里云盘']];
    $('#platChips').innerHTML = plats.map(([v, l]) => `<span class="chip${state.platform === v ? ' active' : ''}" data-p="${esc(v)}">${l}</span>`).join('');
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
    state.q = q; state.type = ''; state.platform = ''; state.view = 'list';
    $('#homeView').hidden = true; $('#listView').hidden = false;
    buildNav(); buildChips(); renderList(true);
  }

  function wire() {
    $('#searchForm').onsubmit = e => { e.preventDefault(); showSearch($('#searchInput').value); };
    let t;
    $('#searchInput').oninput = () => { clearTimeout(t); t = setTimeout(() => { if ($('#searchInput').value.trim()) showSearch($('#searchInput').value); }, 350); };
    $('#sortSelect').onchange = e => { state.sort = e.target.value; renderList(true); };
    $('#loadMore').onclick = () => { state.shown += PAGE; renderList(false); };
  }

  async function init() {
    wire(); buildNav();
    try {
      const doc = await (await fetch(DATA_URL, { cache: 'no-cache' })).json();
      state.items = doc.items || [];
      $('#loading').hidden = true;
      buildWall();
      const qs = new URLSearchParams(location.search);
      if (qs.get('q')) { $('#searchInput').value = qs.get('q'); showSearch(qs.get('q')); }
      else if (qs.get('type')) showList(qs.get('type'));
      else showHome();
    } catch (e) {
      $('#loading').hidden = true;
      $('#sections').innerHTML = `<div class="empty"><div class="big">⚠️</div><p>数据加载失败：${esc(e.message)}</p></div>`;
    }
  }
  init();
})();