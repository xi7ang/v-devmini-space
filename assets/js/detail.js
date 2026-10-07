/* detail.js — 详情页：根据 ?id= 渲染资源详情 + 网盘链接按钮 */
(() => {
  const $ = s => document.querySelector(s);
  const wrap = $('#detail');
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PLAT = {
    quark: { name: '夸克网盘', icon: '☁️' }, uc: { name: 'UC 网盘', icon: '🟢' },
    xunlei: { name: '迅雷网盘', icon: '🔷' }, guangya: { name: '光鸭网盘', icon: '🦆' },
    aliyun: { name: '阿里云盘', icon: '🟠' }, baidu: { name: '百度网盘', icon: '🔵' },
    '123pan': { name: '123 网盘', icon: '🟣' }, tianyi: { name: '天翼云盘', icon: '🌐' },
    unknown: { name: '外部链接', icon: '🔗' },
  };
  function phGradient(title) {
    let h = 0; for (const c of (title || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `linear-gradient(135deg,hsl(${h} 45% 22%),hsl(${(h + 40) % 360} 40% 13%))`;
  }
  const escAttr = s => esc(s).replace(/'/g, '%27');

  function linkRow(l) {
    const p = PLAT[l.platform] || PLAT.unknown;
    const pwd = l.pwd ? ` · 提取码 <b style="color:var(--accent)">${esc(l.pwd)}</b>` : '';
    return `<a class="link-btn" href="${escAttr(l.url)}" target="_blank" rel="noopener noreferrer">
      <span class="lb-left">
        <span class="lb-ico">${p.icon}</span>
        <span>
          <span class="lb-name">${p.name}${pwd}</span>
          <div class="lb-url">${esc(l.url)}</div>
        </span>
      </span>
      <span class="lb-go">转存 →</span>
    </a>`;
  }

  function relatedHTML(items) {
    return items.map(it => `<article class="card" data-id="${esc(it.id)}">
      <div class="poster" style="background:${phGradient(it.title)}">
        ${it.poster ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <div class="ph">${esc((it.title || '?').slice(0, 1))}</div>
        ${it.quality ? `<span class="badge-quality">${esc(it.quality)}</span>` : ''}
        <span class="badge-type">${esc(it.type)}</span>
      </div>
      <div class="card-body"><h3 class="card-title">${esc(it.title)}</h3></div>
    </article>`).join('');
  }

  async function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { wrap.innerHTML = '<div class="loading">未指定资源 ID。<a class="back-link" href="index.html">返回首页</a></div>'; return; }
    try {
      const doc = await (await fetch('data/resources.json', { cache: 'no-cache' })).json();
      const it = (doc.items || []).find(x => x.id === id);
      if (!it) { wrap.innerHTML = '<div class="loading">资源不存在或已下架。<a class="back-link" href="index.html">返回首页</a></div>'; return; }
      document.title = `${it.title} · V影视`;
      const tags = (it.tags || []).slice(0, 8).map(t => `<span class="meta-tag">#${esc(t)}</span>`).join('');
      wrap.innerHTML = `
        <a class="back-link" href="index.html">← 返回列表</a>
        <div class="detail-card">
          <div class="detail-poster" style="background:${phGradient(it.title)}">
            ${it.poster ? `<img src="${esc(it.poster)}" alt="${esc(it.title)}" onerror="this.remove()">` : ''}
            <div class="ph">${esc((it.title || '?').slice(0, 1))}</div>
          </div>
          <div class="detail-info">
            <h1 class="detail-title">${esc(it.title)}</h1>
            ${it.subtitle ? `<p class="detail-sub">${esc(it.subtitle)}</p>` : ''}
            <div class="meta-row">
              <span class="meta-tag">${esc(it.type)}</span>
              ${it.year ? `<span class="meta-tag">${esc(it.year)}</span>` : ''}
              ${it.quality ? `<span class="meta-tag">${esc(it.quality)}</span>` : ''}
              ${it.date ? `<span class="meta-tag">更新 ${esc(it.date)}</span>` : ''}
              ${tags}
            </div>
            ${it.desc ? `<p class="detail-desc">${esc(it.desc)}</p>` : ''}
            <p class="links-title">网盘资源（转存后下载观看，本站不提供在线播放）</p>
            <div class="link-btns">${it.links.map(linkRow).join('')}</div>
            <div class="tip-box">
              <b>如何观看？</b>
              <ol>
                <li>点击上方对应网盘按钮，打开分享页面</li>
                <li>登录你的网盘账号，点击「保存到我的网盘 / 转存」</li>
                <li>回到自己的网盘 App / 网页端，即可下载或播放已转存的文件</li>
              </ol>
            </div>
          </div>
        </div>`;

      // 相关推荐：同类型不同 ID，最多 6 个
      const rel = (doc.items || []).filter(x => x.type === it.type && x.id !== it.id).slice(0, 6);
      if (rel.length) {
        $('#relatedWrap').hidden = false;
        const rg = $('#relatedGrid');
        rg.innerHTML = relatedHTML(rel);
        rg.querySelectorAll('.card').forEach(c => { c.onclick = () => { location.href = `detail.html?id=${encodeURIComponent(c.dataset.id)}`; }; });
      }
    } catch (e) {
      wrap.innerHTML = '<div class="loading">数据加载失败：' + esc(e.message) + '</div>';
    }
  }
  init();
})();