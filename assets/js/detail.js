/* detail.js v3 — GameHub 设计语言详情页 + 提取码自动携带 */
(() => {
  const { PLATFORM, phGradient, esc, transferUrl, copyText } = window.VU;
  const $ = s => document.querySelector(s);
  const CAT_EMOJI = { 电影: '🎬', 电视剧: '📺', 动漫: '🌀', 综艺: '🎤', 纪录片: '🌍', 资源: '📦' };
  const GRADS = [['#c99a5b', '#a87b3f'], ['#7d9cb3', '#4f6d8a'], ['#c46a4a', '#8a5a9a'], ['#7da37d', '#5d7c93'], ['#b08a5f', '#8a6844']];
  function gradOf(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return GRADS[h % GRADS.length] }

  function navBar() {
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    $('#siteNav').innerHTML = items.map(([v, l]) =>
      `<a class="nav-link" href="index.html${v ? '?type=' + encodeURIComponent(v) : ''}">${l}</a>`).join('');
    $('#searchForm').onsubmit = e => { e.preventDefault(); location.href = 'index.html?q=' + encodeURIComponent($('#searchInput').value); };
  }

  function platformBtn(link) {
    const p = PLATFORM[link.platform] || PLATFORM.unknown;
    const url = transferUrl(link);
    const pwd = link.pwd || (String(link.url).match(/[?&](?:pwd|code)=([^&#]+)/) || [])[1] || '';
    return `<div class="pbtn">
      <span class="l">
        <span class="ico">${p.icon}</span>
        <span style="min-width:0">
          <span class="nm">${esc(p.name)}</span>
          <div class="ln">${pwd ? `提取码 <b>${esc(pwd)}</b> · 已自动填入链接` : '无需提取码 · 直接打开'}</div>
        </span>
      </span>
      <span class="acts">
        <button class="cp" data-copy="${esc(url)}">复制链接</button>
        <a class="go" href="${esc(url)}" target="_blank" rel="noopener noreferrer">一键转存 →</a>
      </span>
    </div>`;
  }

  function wall(posters) {
    const track = $('#wallTrack');
    if (!track || !posters.length) return;
    const ROWS = 13, per = 16;
    let html = '';
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let i = 0; i < per; i++) row.push(posters[(r * 5 + i * 3) % posters.length]);
      const tiles = row.concat(row).map(p => `<span class="tile"><img src="${esc(p)}" alt="" loading="lazy"></span>`).join('');
      html += `<div class="bg-wall__row ${r % 2 === 0 ? 'l' : 'r'}" style="--row-speed:${560 + r * 40}s">${tiles}</div>`;
    }
    track.innerHTML = html;
  }

  function cardMini(it) {
    const ep = (it.subtitle || '').match(/更至\d+集|第\d+[集期季]|全\d+集/);
    return `<a class="rc" href="detail.html?id=${esc(it.id)}" title="${esc(it.title)}">
      <div class="rc__cover">
        ${it.poster ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.remove()">`
          : `<span class="rc__cover-halo" style="background:radial-gradient(circle at 50% 35%,${gradOf(it.title)[0]}55 0%,transparent 70%)"></span>
             <span class="rc__cover-emoji">${CAT_EMOJI[it.type] || '🎬'}</span>
             <span class="rc__cover-title">${esc(it.title)}</span>`}
        <span class="rc__veil"></span>
        ${it.quality ? `<span class="rc__tag"><span class="badge" style="background:linear-gradient(135deg,var(--accent-gold),var(--accent-gold-deep));color:#fff;border:0">${esc(it.quality)}</span></span>` : ''}
        <span class="rc__tagr"><span class="badge">${esc(it.type)}</span></span>
        ${ep ? `<span class="rc__ep">${esc(ep[0])}</span>` : ''}
      </div>
      <div class="rc__body"><h3 class="rc__title">${esc(it.title)}</h3>
        <div class="rc__meta"><span class="badge">${esc(it.type)}</span></div></div>
    </a>`;
  }

  async function init() {
    navBar();
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="empty"><div class="big">🔍</div><p>未指定资源</p><p><a href="index.html" style="color:var(--accent-gold)">返回首页</a></p></div>'; return; }
    try {
      const doc = await (await fetch('data/resources.json', { cache: 'no-cache' })).json();
      const it = (doc.items || []).find(x => x.id === id);
      wall((doc.items || []).filter(x => x.poster).map(x => x.poster));
      if (!it) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="empty"><div class="big">💤</div><p>资源不存在或已下架</p><p><a href="index.html" style="color:var(--accent-gold)">返回首页</a></p></div>'; return; }
      document.title = `${it.title} - V影视`;
      $('#loading').hidden = true;
      const tags = (it.tags || []).slice(0, 8).map(t => `<span class="badge">#${esc(t)}</span>`).join('');
      const plats = Array.from(new Set((it.links || []).map(l => l.platform)));
      $('#detail').innerHTML = `
        <div class="detail-hero">
          ${it.poster ? `<div class="dh-bg" style="background-image:url('${esc(it.poster)}')"></div>` : ''}
          <div class="dh-veil"></div>
          <div class="dh-body">
            <div class="dh-poster">
              ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" onerror="this.remove()">`
                : `<span class="rc__cover-title" style="position:absolute;inset:0;display:grid;place-items:center">${esc(it.title)}</span>`}
            </div>
            <div>
              <a class="dh-back" href="index.html">‹ 返回</a>
              <h1 class="dh-title">${esc(it.title)}</h1>
              <div class="dh-meta">
                <span class="badge">${esc(it.type)}</span>
                ${it.year ? `<span class="badge">${esc(it.year)}</span>` : ''}
                ${it.quality ? `<span class="badge" style="background:linear-gradient(135deg,var(--accent-gold),var(--accent-gold-deep));color:#fff;border:0">${esc(it.quality)}</span>` : ''}
                ${it.date ? `<span class="badge">更新 ${esc(it.date)}</span>` : ''}
                <span class="badge">${plats.length} 个网盘</span>
              </div>
              ${tags ? `<div class="dh-tags">${tags}</div>` : ''}
              ${it.desc ? `<p class="dh-syn">${esc(it.desc)}</p>` : ''}
              <div class="panel">
                <h3>📥 转存到我的网盘</h3>
                <p class="hint">点「一键转存」打开网盘分享页，链接已自动带上提取码，无需手动输入。</p>
                <div class="pbtns">${(it.links || []).map(platformBtn).join('')}</div>
                <ol class="steps">
                  <li>点「一键转存」→ 打开网盘分享页（<b>提取码已自动填好</b>）</li>
                  <li>登录网盘账号 → 点「<b>保存到我的网盘</b> / 转存」</li>
                  <li>回到自己的网盘 App / 网页端，即可下载或播放已转存的文件</li>
                </ol>
              </div>
            </div>
          </div>
        </div>`;
      $('#detail').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyText(b.dataset.copy));

      const rel = (doc.items || []).filter(x => x.id !== it.id && (x.type === it.type || (x.tags || []).some(t => (it.tags || []).includes(t)))).slice(0, 6);
      if (rel.length) { $('#relatedWrap').hidden = false; $('#relatedGrid').innerHTML = rel.map(cardMini).join(''); }
    } catch (e) {
      $('#loading').hidden = true;
      $('#detail').innerHTML = `<div class="empty"><div class="big">⚠️</div><p>数据加载失败：${esc(e.message)}</p></div>`;
    }
  }
  init();
})();