/* app.js — 首页：加载索引、分类/网盘筛选、搜索、排序、分页渲染 */
(() => {
  const DATA_URL = 'data/resources.json';
  const PAGE = 60;
  const state = { items: [], filtered: [], shown: 0, type: '全部', platform: '全部', q: '', sort: 'new' };

  const $ = s => document.querySelector(s);
  const grid = $('#grid');
  const emptyEl = $('#empty');
  const loadMore = $('#loadMore');
  const statEl = $('#stat');

  const TYPE_TABS = ['全部', '电影', '电视剧', '动漫', '综艺', '纪录片', '资源'];
  const PLAT_TABS = ['全部', '夸克', 'UC', '迅雷', '光鸭', '阿里云盘'];

  function phGradient(title) {
    let h = 0;
    for (const c of (title || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `linear-gradient(135deg,hsl(${h} 45% 22%),hsl(${(h + 40) % 360} 40% 13%))`;
  }
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function buildNav(types) {
    const nav = $('#mainNav');
    nav.innerHTML = '';
    [['全部', '全部'], ['电影', '电影'], ['电视剧', '剧集'], ['动漫', '动漫'], ['综艺', '综艺'], ['纪录片', '纪录']].forEach(([v, label]) => {
      const a = document.createElement('a');
      a.href = '#list';
      a.textContent = label;
      a.className = state.type === v ? 'active' : '';
      a.onclick = e => { e.preventDefault(); setType(v); };
      nav.appendChild(a);
    });
  }

  function buildChips() {
    const cRow = $('#categoryRow');
    cRow.innerHTML = '';
    TYPE_TABS.forEach(t => {
      const el = document.createElement('span');
      el.className = 'chip' + (state.type === t ? ' active' : '');
      el.textContent = t;
      el.onclick = () => setType(t);
      cRow.appendChild(el);
    });
    const pRow = $('#platformRow');
    pRow.innerHTML = '';
    PLAT_TABS.forEach(p => {
      const el = document.createElement('span');
      el.className = 'chip plat' + (state.platform === p ? ' active' : '');
      el.textContent = p;
      el.onclick = () => { state.platform = p; buildChips(); apply(); };
      pRow.appendChild(el);
    });
  }

  function setType(t) {
    state.type = t;
    buildNav();
    buildChips();
    apply();
    $('#list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function platformLabels(item) {
    return item.links.map(l => l.platform);
  }
  const PLAT_NAME = { quark: '夸克', uc: 'UC', xunlei: '迅雷', guangya: '光鸭', aliyun: '阿里云盘', baidu: '百度', '123pan': '123', tianyi: '天翼', unknown: '其他' };

  function cardHTML(it) {
    const sub = it.subtitle || (it.year ? `${it.year}` : '');
    const plats = Array.from(new Set(platformLabels(it)));
    const poster = it.poster
      ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" loading="lazy" onerror="this.remove()">`
      : '';
    return `<article class="card" data-id="${esc(it.id)}">
      <div class="poster" style="background:${phGradient(it.title)}">
        ${poster}
        <div class="ph">${esc((it.title || '?').slice(0, 1))}</div>
        ${it.quality ? `<span class="badge-quality">${esc(it.quality)}</span>` : ''}
        <span class="badge-type">${esc(it.type)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(it.title)}</h3>
        ${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}
        <div class="card-links">${plats.map(p => `<span class="plat-badge ${esc(p)}">${esc(PLAT_NAME[p] || p)}</span>`).join('')}</div>
      </div>
    </article>`;
  }

  function render() {
    const slice = state.filtered.slice(0, state.shown);
    grid.innerHTML = slice.map(cardHTML).join('');
    grid.querySelectorAll('.card').forEach(c => {
      c.onclick = () => { location.href = `detail.html?id=${encodeURIComponent(c.dataset.id)}`; };
    });
    emptyEl.hidden = state.filtered.length !== 0;
    loadMore.hidden = state.shown >= state.filtered.length;
    statEl.textContent = `共 ${state.filtered.length} 条资源 · 显示 ${Math.min(state.shown, state.filtered.length)}`;
  }

  function apply() {
    const q = state.q.trim().toLowerCase();
    let list = state.items.filter(it => {
      if (state.type !== '全部' && it.type !== state.type) return false;
      if (state.platform !== '全部') {
        const want = Object.keys(PLAT_NAME).find(k => PLAT_NAME[k] === state.platform);
        if (!it.links.some(l => l.platform === want)) return false;
      }
      if (q) {
        const hay = (it.title + ' ' + (it.subtitle || '') + ' ' + (it.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (state.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    else if (state.sort === 'type') list.sort((a, b) => (a.type + a.title).localeCompare(b.type + b.title, 'zh'));
    state.filtered = list;
    state.shown = PAGE;
    render();
  }

  function wireSearch() {
    const form = $('#searchForm');
    const input = $('#searchInput');
    form.onsubmit = e => { e.preventDefault(); state.q = input.value; apply(); };
    let t;
    input.oninput = () => { clearTimeout(t); t = setTimeout(() => { state.q = input.value; apply(); }, 200); };
    const qs = new URLSearchParams(location.search).get('q');
    if (qs) { input.value = qs; state.q = qs; }
    $('#sortSelect').onchange = e => { state.sort = e.target.value; apply(); };
    loadMore.onclick = () => { state.shown += PAGE; render(); };
    $('#heroCta').onclick = e => { e.preventDefault(); input.focus(); $('#list').scrollIntoView({ behavior: 'smooth' }); };
  }

  async function init() {
    wireSearch();
    buildNav();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      const doc = await res.json();
      state.items = doc.items || [];
      const newest = state.items[0];
      if (newest) {
        $('#heroTitle').textContent = newest.title.slice(0, 26);
        $('#heroDesc').innerHTML = (newest.desc || '影视资源，一键转存').slice(0, 90) +
          ' —— 聚合 UC / 迅雷 / 光鸭 / 夸克 网盘链接，转存到自己的网盘后下载观看。本站<strong>不提供在线播放</strong>。';
      }
      buildChips();
      apply();
    } catch (e) {
      grid.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.querySelector('p').textContent = '数据加载失败：' + e.message;
      statEl.textContent = '加载失败';
    }
  }
  init();
})();