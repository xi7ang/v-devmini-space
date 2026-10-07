// src/lib/version.js
// 部署后免强刷：轮询 version.json（构建期生成），构建号变了就带 ?v=<新构建号> 重新进入页面。
//
// 为什么不用 location.reload()：Pages / Cloudflare 对 html 是 max-age=600 的强缓存，
// reload 仍可能命中旧 HTML（于是又跑到旧的 hashed assets）。换一个 URL（加 query）
// 才会绕开缓存键拿到新 HTML，再由新 HTML 引用新的 assets。
//
// 构建号来源：scripts/inject-build.js 注入 window.__BUILD_ID__（HTML head，module script 之前执行），
// 与 dist/version.json 同一次构建写出，必然一致。
export const BUILD_ID = (typeof window !== 'undefined' && window.__BUILD_ID__) || ''

const CHECK_INTERVAL = 3 * 60 * 1000
let checking = false

// 用户正在输入时不打断（输入框失焦后由下一次轮询/可见性变化接手）
function isBusy() {
  const ae = document.activeElement
  return !!ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)
}

async function checkVersion() {
  if (!BUILD_ID || checking || document.visibilityState !== 'visible') return
  checking = true
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { version } = await res.json()
    if (!version || version === BUILD_ID || isBusy()) return
    const url = new URL(location.href)
    url.searchParams.set('v', version)
    location.replace(url.toString())
  } catch (e) {
    // 静默：版本检查失败不该影响正常使用，下次再试
  } finally {
    checking = false
  }
}

export function startVersionWatch() {
  if (!BUILD_ID) return
  // Admin 有未保存的表单，自动跳转会丢数据 —— 那一页保持手动刷新
  if (location.pathname.endsWith('/admin.html')) return

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkVersion() // 从 bfcache 恢复 = 可能是很久以前的页面
  })
  window.addEventListener('focus', checkVersion)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion()
  })
  setInterval(checkVersion, CHECK_INTERVAL)
  if (document.readyState === 'complete') checkVersion()
  else window.addEventListener('load', checkVersion)
}
