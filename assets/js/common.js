/* common.js — 共享工具：提取码自动携带、复制、平台常量 */
(function (global) {
  // 各网盘「提取码」参数名（其余平台默认 pwd）
  const CODE_PARAM = { guangya: 'code' };

  const PLATFORM = {
    uc: { name: 'UC网盘', icon: '🟢', short: 'UC' },
    xunlei: { name: '迅雷网盘', icon: '🔷', short: '迅雷' },
    guangya: { name: '光鸭网盘', icon: '🦆', short: '光鸭' },
    quark: { name: '夸克网盘', icon: '☁️', short: '夸克' },
    aliyun: { name: '阿里云盘', icon: '🟠', short: '阿里' },
    baidu: { name: '百度网盘', icon: '🔵', short: '百度' },
    '123pan': { name: '123网盘', icon: '🟣', short: '123' },
    tianyi: { name: '天翼云盘', icon: '🌐', short: '天翼' },
    unknown: { name: '外部链接', icon: '🔗', short: '链接' },
  };

  /**
   * 把提取码自动拼到分享链接上，用户点开即自动填充，无需手输。
   * 光鸭用 ?code=，其余网盘用 ?pwd=。
   */
  function withCode(url, pwd, platform) {
    if (!url) return url;
    if (!pwd) return url;
    const key = CODE_PARAM[platform] || 'pwd';
    const code = String(pwd).trim();
    if (!code) return url;
    const re = new RegExp('([?&]' + key + '=)([^&#]*)');
    if (re.test(url)) return url.replace(re, '$1' + encodeURIComponent(code));
    // 保留 hash，参数补在 query
    const hashIdx = url.indexOf('#');
    let base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + key + '=' + encodeURIComponent(code) + hash;
  }

  /** 由 link 对象生成可直接转存的链接 */
  function transferUrl(link) {
    if (!link) return '';
    const pwd = link.pwd || (String(link.url).match(/[?&](?:pwd|code)=([^&#]+)/) || [])[1] || '';
    return withCode(link.url, pwd, link.platform);
  }

  function copyText(text) {
    const done = () => toast('已复制：' + text);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    } else {
      fallback(text, done);
    }
  }
  function fallback(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function hashHue(title) {
    let h = 0;
    for (const c of String(title || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }
  const phGradient = t => `linear-gradient(135deg,hsl(${hashHue(t)} 42% 22%),hsl(${(hashHue(t) + 40) % 360} 38% 13%))`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  global.VU = { CODE_PARAM, PLATFORM, withCode, transferUrl, copyText, toast, phGradient, esc };
})(window);