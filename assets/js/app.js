/* app.js — 首页（泥视频式板块布局）+ 频道/搜索列表 */
(() => {
  const DATA_URL = 'data/resources.json';
  const { PLATFORM, phGradient, esc } = window.VU;
  const PAGE = 60;
  const SECTIONS = ['电影', '电视剧', '动漫', '综艺', '纪录片'];
  const state = { items: [], type: '', platform: '', q: '', sort: 'new', view: 'home', shown: 0 };

  const $ = s => document.querySelector(s);
  const esc2 = esc;

  /* ---------- 卡片 ---------- */
  function platsOf(it) {
    return Array.from(new Set((it.links || []).map(l => l.platform)));
  }
  function cardHTML(it) {
    const plats = platsOf(it);
    const sub = it.subtitle || (it.year ? `${it.year}` : '');
    const badge = (it.subtitle || '').match(/更至\d+集|第\d+[集期季]|更新至\d+集/) || null;
    return `<li class="qy-mod-li">
      <div class="qy-mod-img">
        <a class="qy-mod-link" href="detail.html?id=${esc2(it.id)}" title="${esc2(it.title)}">
          ${it.poster ? `<img src="${esc2(it.poster)}" alt="${esc2(it.title)}" loading="lazy" onerror="this.remove()">` : ''}
          <span class="ph" style="background:${phGradient(it.title)}">${esc2((it.title || '?').slice(0, 1))}</span>
          <span class="icon-tr">${plats.slice(0, 3).map(p => `<span class="plat-dot ${esc2(p)}">${esc2((PLATFORM[p] || PLATFORM.unknown).short)}</span>`).join('')}</span>
          ${it.quality ? `<span class="label-score">${esc2(it.quality)}</span>` : ''}
          ${badge ? `<span class="icon-br"><span class="qy-mod-label">${esc2(badge[0])}</span></span>` : ''}
        </a>
      </div>
      <div class="title-wrap">
        <p class="main"><a href="detail.html?id=${esc2(it.id)}" title="${esc2(it.title)}">${esc2(it.title)}</a></p>
        <p class="sub">${esc2(sub)}</p>
      </div>
    </li>`;
  }

  /* ---------- 导航 ---------- */
  function buildNav() {
    const nav = $('#qyNav');
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    nav.innerHTML = '';
    items.forEach(([v, label]) => {
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.className = 'nav-link' + (state.view === 'list' && state.type === v ? ' active' : (state.view === 'home' && v === '' ? ' active' : ''));
      a.textContent = label;
      a.onclick = () => (v === '' ? showHome() : showList(v));
      nav.appendChild(a);
    });
  }

  /* ---------- 首页板块 ---------- */
  function renderSections() {
    const box = $('#sections');
    let html = '';
    const all = state.items;
    const newest = all.slice(0, 12);
    if (newest.length) html += sectionHTML('最新发布', '', newest);
    SECTIONS.forEach(t => {
      const list = all.filter(x => x.type === t);
      if (!list.length) return;
      html += sectionHTML(t, t, list.slice(0, 12));
    });
    box.innerHTML = html || `<div class="qy-empty"><div class="big">🍿</div><p>还没有影视资源</p><p style="color:var(--muted)">跑一次网盘发布就会出现在这里。</p></div>`;
    box.querySelectorAll('.qy-mod-ul').forEach(ul => {
      ul.innerHTML = ul.dataset.items ? JSON.parse(ul.dataset.items).map(cardHTML).join('') : '';
      ul.removeAttribute('data-items');
    });
    box.querySelectorAll('[data-goto]').forEach(el => {
      el.onclick = e => { e.preventDefault(); showList(el.dataset.goto); };
    });
  }
  function sectionHTML(title, type, list) {
    return `<section class="qy-mod-list">
      <div class="qy-mod-header">
        <h2 class="qy-mod-title">${esc2(title)}</h2>
        <a class="more" href="javascript:void(0)" data-goto="${esc2(type || '')}">更多 ›</a>
      </div>
      <ul class="qy-mod-ul" data-items='${JSON.stringify(list).replace(/'/g, '&#39;')}'></ul>
    </section>`;
  }

  /* ---------- 频道/搜索列表 ---------- */
  function buildChips() {
    const cats = [['', '全部']].concat(SECTIONS.map(t => [t, t]));
    $('#catChips').innerHTML = '';
    cats.forEach(([v, label]) => {
      const el = document.createElement('span');
      el.className = 'qy-chip' + (state.type === v ? ' active' : '');
      el.textContent = label;
      el.onclick = () => { state.type = v; showList(v, true); };
      $('#catChips').appendChild(el);
    });
    const plats = [['', '全部网盘'], ['uc', 'UC'], ['xunlei', '迅雷'], ['guangya', '光鸭'], ['quark', '夸克'], ['aliyun', '阿里云盘']];
    $('#platChips').innerHTML = '';
    plats.forEach(([v, label]) => {
      const el = document.createElement('span');
      el.className = 'qy-chip' + (state.platform === v ? ' active' : '');
      el.textContent = label;
      el.onclick = () => { state.platform = v; showList(state.type, true); };
      $('#platChips').appendChild(el);
    });
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = state.items.filter(it => {
      if (state.type && it.type !== state.type) return false;
      if (state.platform && !(it.links || []).some(l => l.platform === state.platform)) return false;
      if (q) {
        const hay = (it.title + ' ' + (it.subtitle || '') + ' ' + (it.tags || []).join(' ')).toLowerCase();
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
    const slice = list.slice(0, state.shown);
    $('#listGrid').innerHTML = slice.map(cardHTML).join('');
    $('#listEmpty').hidden = list.length !== 0;
    $('#loadMore').hidden = state.shown >= list.length;
    $('#stat').textContent = `共 ${list.length} 条`;
    $('#listTitle').textContent = state.q ? `搜索「${state.q}」` : (state.type ? state.type : '全部资源');
  }

  function showHome() {
    state.view = 'home'; state.type = ''; state.q = ''; $('#searchInput').value = '';
    $('#homeView').hidden = false; $('#listView').hidden = true;
    buildNav(); renderSections();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showList(type = '', keepQ = false) {
    state.view = 'list';
    if (typeof type === 'string') state.type = type;
    if (!keepQ) { state.q = ''; }
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

  /* ---------- 事件 ---------- */
  function wire() {
    $('#searchForm').onsubmit = e => { e.preventDefault(); showSearch($('#searchInput').value); };
    let t;
    $('#searchInput').oninput = () => { clearTimeout(t); t = setTimeout(() => { if ($('#searchInput').value.trim()) showSearch($('#searchInput').value); }, 350); };
    $('#sortSelect').onchange = e => { state.sort = e.target.value; renderList(true); };
    $('#loadMore').onclick = () => { state.shown += PAGE; renderList(false); };
    $('#searchType').onclick = () => window.VU.toast('搜索范围已设为「全部」');
  }

  async function init() {
    wire(); buildNav();
    try {
      const doc = await (await fetch(DATA_URL, { cache: 'no-cache' })).json();
      state.items = doc.items || [];
      const newest = state.items[0];
      if (newest) {
        $('#bannerTitle').textContent = newest.title.slice(0, 30);
        $('#bannerDesc').innerHTML = esc2((newest.desc || '影视资源，一键转存').slice(0, 80)) +
          ' —— 聚合 UC / 迅雷 / 光鸭 / 夸克 网盘链接，转存到自己的网盘后下载观看。本站<strong>不提供在线播放</strong>。';
      }
      $('#loading').hidden = true;
      const qs = new URLSearchParams(location.search);
      if (qs.get('q')) { $('#searchInput').value = qs.get('q'); showSearch(qs.get('q')); }
      else if (qs.get('type')) showList(qs.get('type'));
      else showHome();
    } catch (e) {
      $('#loading').hidden = true;
      $('#sections').innerHTML = `<div class="qy-empty"><div class="big">⚠️</div><p>数据加载失败：${esc2(e.message)}</p></div>`;
    }
  }
  init();
})();