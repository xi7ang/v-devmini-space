/* detail.js v2 — 详情页 + 转存面板（提取码自动携带） */
(() => {
  const { PLATFORM, phGradient, esc, transferUrl, copyText } = window.VU;
  const $ = s => document.querySelector(s);

  function navBar() {
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    $('#qyNav').innerHTML = items.map(([v, l]) =>
      `<a class="nav-link" href="index.html${v ? '?type=' + encodeURIComponent(v) : ''}">${l}</a>`).join('');
    $('#searchForm').onsubmit = e => { e.preventDefault(); location.href = 'index.html?q=' + encodeURIComponent($('#searchInput').value); };
  }

  function saveBtn(link) {
    const p = PLATFORM[link.platform] || PLATFORM.unknown;
    const url = transferUrl(link);
    const pwd = link.pwd || (String(link.url).match(/[?&](?:pwd|code)=([^&#]+)/) || [])[1] || '';
    return `<div class="save-btn">
      <span class="sb-left">
        <span class="sb-ico">${p.icon}</span>
        <span style="min-width:0">
          <span class="sb-name">${esc(p.name)}</span>
          <div class="sb-line">${pwd ? `提取码 <b>${esc(pwd)}</b> · 已自动填入链接` : '无需提取码 · 直接打开'}</div>
        </span>
      </span>
      <span class="sb-acts">
        <button class="sb-copy" data-copy="${esc(url)}">复制链接</button>
        <a class="sb-go" href="${esc(url)}" target="_blank" rel="noopener noreferrer">一键转存 →</a>
      </span>
    </div>`;
  }

  function relatedHTML(list) {
    return list.map(it => `<li class="qy-mod-li">
      <div class="qy-mod-img">
        <a class="card-link" href="detail.html?id=${esc(it.id)}" aria-label="${esc(it.title)}"></a>
        ${it.poster ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <span class="ph" style="background:${phGradient(it.title)}">${esc((it.title || '?').slice(0, 1))}</span>
        ${it.quality ? `<span class="badge-qual">${esc(it.quality)}</span>` : ''}
        <span class="badge-type">${esc(it.type)}</span>
      </div>
      <div class="title-wrap"><p class="main"><a href="detail.html?id=${esc(it.id)}">${esc(it.title)}</a></p></div>
    </li>`).join('');
  }

  async function init() {
    navBar();
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="qy-empty"><div class="big">🔍</div><p>未指定资源</p><p><a href="index.html" class="gold">返回首页</a></p></div>'; return; }
    try {
      const doc = await (await fetch('data/resources.json', { cache: 'no-cache' })).json();
      const it = (doc.items || []).find(x => x.id === id);
      if (!it) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="qy-empty"><div class="big">💤</div><p>资源不存在或已下架</p><p><a href="index.html" class="gold">返回首页</a></p></div>'; return; }
      document.title = `${it.title} - V影视`;
      $('#loading').hidden = true;
      const tags = (it.tags || []).slice(0, 8).map(t => `<span class="tag">#${esc(t)}</span>`).join('');
      const plats = Array.from(new Set((it.links || []).map(l => l.platform)));
      $('#detail').innerHTML = `
        <div class="detail-hero">
          ${it.poster ? `<div class="dh-bg" style="background-image:url('${esc(it.poster)}')"></div>` : ''}
          <div class="dh-veil"></div>
          <div class="dh-body">
            <div class="dh-poster">
              ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" onerror="this.remove()">` : ''}
              <span class="ph" style="background:${phGradient(it.title)}">${esc((it.title || '?').slice(0, 1))}</span>
            </div>
            <div>
              <a class="dh-back" href="index.html">‹ 返回</a>
              <h1 class="dh-title">${esc(it.title)}</h1>
              <div class="dh-meta">
                <span>${esc(it.type)}</span>
                ${it.year ? `<span>· ${esc(it.year)}</span>` : ''}
                ${it.quality ? `<span class="gold" style="font-weight:800">· ${esc(it.quality)}</span>` : ''}
                ${it.date ? `<span>· 更新 ${esc(it.date)}</span>` : ''}
                <span>· ${plats.length} 个网盘</span>
              </div>
              ${tags ? `<div class="dh-tags">${tags}</div>` : ''}
              ${it.desc ? `<p class="dh-syn">${esc(it.desc)}</p>` : ''}
              <div class="save-panel">
                <h3>📥 转存到我的网盘</h3>
                <p class="hint">点「一键转存」打开网盘分享页，链接已自动带上提取码，无需手动输入。</p>
                <div class="save-btns">${(it.links || []).map(saveBtn).join('')}</div>
                <ol class="save-steps">
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
      if (rel.length) { $('#relatedWrap').hidden = false; $('#relatedGrid').innerHTML = relatedHTML(rel); }
    } catch (e) {
      $('#loading').hidden = true;
      $('#detail').innerHTML = `<div class="qy-empty"><div class="big">⚠️</div><p>数据加载失败：${esc(e.message)}</p></div>`;
    }
  }
  init();
})();