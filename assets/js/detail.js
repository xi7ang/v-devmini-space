/* detail.js — 详情页（泥视频式布局）+ 转存面板（提取码自动携带） */
(() => {
  const { PLATFORM, phGradient, esc, transferUrl, copyText, toast } = window.VU;
  const $ = s => document.querySelector(s);

  function navBar() {
    const nav = $('#qyNav');
    const items = [['', '首页'], ['电影', '电影'], ['电视剧', '电视剧'], ['综艺', '综艺'], ['动漫', '动漫'], ['纪录片', '纪录片']];
    nav.innerHTML = items.map(([v, l]) => `<a class="nav-link" href="index.html${v ? '?type=' + encodeURIComponent(v) : ''}">${l}</a>`).join('');
    $('#searchForm').onsubmit = e => { e.preventDefault(); location.href = 'index.html?q=' + encodeURIComponent($('#searchInput').value); };
  }

  /** 单个网盘转存按钮：链接已自动带上提取码 */
  function saveBtn(link) {
    const p = PLATFORM[link.platform] || PLATFORM.unknown;
    const url = transferUrl(link);
    const pwd = link.pwd || (String(link.url).match(/[?&](?:pwd|code)=([^&#]+)/) || [])[1] || '';
    const codeLabel = link.platform === 'guangya' ? '提取码' : '提取码';
    return `<div class="save-btn">
      <span class="sb-left">
        <span class="sb-ico">${p.icon}</span>
        <span style="min-width:0">
          <span class="sb-name">${esc(p.name)}</span>
          <div class="sb-line">
            ${pwd ? `${codeLabel} <span class="sb-code">${esc(pwd)}</span> · 已自动填入链接` : '无需提取码 · 直接打开'}
          </div>
        </span>
      </span>
      <span style="display:flex;gap:8px;flex:0 0 auto">
        <button class="sb-copy" data-copy="${esc(url)}">复制链接</button>
        <a class="sb-go" href="${esc(url)}" target="_blank" rel="noopener noreferrer">一键转存 →</a>
      </span>
    </div>`;
  }

  function relatedHTML(list) {
    return list.map(it => `<li class="qy-mod-li">
      <div class="qy-mod-img">
        <a class="qy-mod-link" href="detail.html?id=${esc(it.id)}" title="${esc(it.title)}">
          ${it.poster ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <span class="ph" style="background:${phGradient(it.title)}">${esc((it.title || '?').slice(0, 1))}</span>
          ${it.quality ? `<span class="label-score">${esc(it.quality)}</span>` : ''}
        </a>
      </div>
      <div class="title-wrap"><p class="main"><a href="detail.html?id=${esc(it.id)}">${esc(it.title)}</a></p></div>
    </li>`).join('');
  }

  async function init() {
    navBar();
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="qy-empty"><div class="big">🔍</div><p>未指定资源</p><p><a href="index.html" style="color:var(--gold)">返回首页</a></p></div>'; return; }
    try {
      const doc = await (await fetch('data/resources.json', { cache: 'no-cache' })).json();
      const it = (doc.items || []).find(x => x.id === id);
      if (!it) { $('#loading').hidden = true; $('#detail').innerHTML = '<div class="qy-empty"><div class="big">💤</div><p>资源不存在或已下架</p><p><a href="index.html" style="color:var(--gold)">返回首页</a></p></div>'; return; }
      document.title = `${it.title} - V影视`;
      $('#loading').hidden = true;
      const tags = (it.tags || []).slice(0, 8).map(t => `<span class="tag">#${esc(t)}</span>`).join('');
      $('#detail').innerHTML = `
        <div class="qy-detail">
          <div>
            <div class="detail-poster">
              ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" onerror="this.remove()">` : ''}
              <span class="ph" style="background:${phGradient(it.title)}">${esc((it.title || '?').slice(0, 1))}</span>
            </div>
          </div>
          <div class="detail-info">
            <a class="back" href="index.html">‹ 返回</a>
            <h1 class="detail-title">${esc(it.title)}</h1>
            ${it.subtitle ? `<p class="detail-sub">${esc(it.subtitle)}</p>` : ''}
            <div class="detail-meta">
              <span>${esc(it.type)}</span>
              ${it.year ? `<span>${esc(it.year)}</span>` : ''}
              ${it.quality ? `<span class="score">${esc(it.quality)}</span>` : ''}
              ${it.date ? `<span>更新 ${esc(it.date)}</span>` : ''}
              <span>${(it.links || []).length} 个网盘</span>
            </div>
            ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
            ${it.desc ? `<p class="detail-synopsis">${esc(it.desc)}</p>` : ''}
            <div class="save-panel">
              <h3>📥 转存到我的网盘</h3>
              <p class="hint">点击「一键转存」打开对应网盘分享页，链接已自动带上提取码，无需手动输入；登录后点「保存到我的网盘」即可下载观看。</p>
              <div class="save-btns">${(it.links || []).map(saveBtn).join('')}</div>
              <ol class="save-steps">
                <li>点「一键转存」→ 打开网盘分享页（<b>提取码已自动填好</b>）</li>
                <li>登录你的网盘账号 → 点「<b>保存到我的网盘</b> / 转存」</li>
                <li>回到自己的网盘 App / 网页端，即可下载或播放已转存的文件</li>
              </ol>
            </div>
          </div>
        </div>`;
      $('#detail').querySelectorAll('[data-copy]').forEach(b => {
        b.onclick = () => copyText(b.dataset.copy);
      });

      const rel = (doc.items || []).filter(x => x.id !== it.id && (x.type === it.type || (x.tags || []).some(t => (it.tags || []).includes(t)))).slice(0, 6);
      if (rel.length) { $('#relatedWrap').hidden = false; $('#relatedGrid').innerHTML = relatedHTML(rel); }
    } catch (e) {
      $('#loading').hidden = true;
      $('#detail').innerHTML = `<div class="qy-empty"><div class="big">⚠️</div><p>数据加载失败：${esc(e.message)}</p></div>`;
    }
  }
  init();
})();