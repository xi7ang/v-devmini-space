// src/lib/appEnv.js
// 是否运行在「游戏源神」安卓 App 的 WebView 内 —— 命中才隐藏「安卓APP」下载入口。
//
// 只认壳自己打的标记：MainActivity 在 settings.userAgentString 末尾追加的 ` GameHubApp`。
//
// 为什么不认 Android WebView 默认 UA 里的 `; wv)`：QQ / 微信等一切 App 的内置浏览器都带这个标记，
// 用它会把那些环境一并误伤（2026-09 实际发生：QQ 内置浏览器里也看不到下载按钮了）。
// 精确识别只有一条路——壳主动自报家门；代价是旧版 APK 不带标记，用户升级后才自动生效。
const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''

export const IS_APP_WEBVIEW = /GameHubApp/i.test(ua)
