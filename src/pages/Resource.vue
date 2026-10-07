<template>
  <div class="resource-page">
    <SiteHeader />
    <BgWall />

    <div class="container">
      <div v-if="state.loading" class="detail-loading">
        <div class="skeleton" style="height: 320px; border-radius: var(--radius-lg)"></div>
      </div>

      <template v-else-if="r">
        <a href="javascript:history.back()" class="back-link text-low">← 返回</a>

                <div class="mv glass fade-up">
          <div class="mv__backdrop" :style="r.cover ? { backgroundImage: 'url(' + r.cover + ')' } : {}"></div>
          <div class="mv__veil"></div>
          <div class="mv__body">
            <div class="mv__poster" :style="coverStyle">
              <img v-if="r.cover" :src="r.cover" :alt="r.title" />
              <template v-else>
                <span class="detail__cover-halo" :style="haloStyle"></span>
                <span class="detail__cover-emoji">{{ cat?.emoji }}</span>
              </template>
            </div>

            <div class="mv__info">
              <div class="flex gap-sm wrap mb-md">
                <span class="badge" :style="catBadgeStyle">{{ cat?.emoji }} {{ cat?.name }}</span>
                <span v-if="r.year" class="badge">{{ r.year }}</span>
                <span v-if="r.quality" class="badge badge--gold">{{ r.quality }}</span>
                <span v-for="t in r.tags" :key="t" class="badge">#{{ t }}</span>
              </div>

              <h1 class="mv__title">{{ r.title }}</h1>
              <p v-if="r.desc" class="mv__desc">{{ r.desc }}</p>

              <div class="mv__get">
                <div class="mv__get-head">
                  <span class="mv__get-title">获取资源</span>
                  <span class="mv__get-sub">已自动带上提取码，点开即转存</span>
                </div>
                <div class="mv__cards">
                  <a
                    v-for="l in links"
                    :key="l.platform"
                    class="mv-card"
                    :href="transferUrl(l)"
                    target="_blank"
                    rel="noreferrer"
                    @click="onGet($event, l)"
                  >
                    <span class="mv-card__ico" :style="iconStyle(l)">
                      <img
                        v-if="platformMeta(l).iconImg"
                        :src="platformMeta(l).iconImg"
                        :alt="platformMeta(l).label"
                        class="mv-card__logo"
                      />
                      <template v-else>{{ platformMeta(l).icon }}</template>
                    </span>
                    <span class="mv-card__mid">
                      <span class="mv-card__name">{{ platformMeta(l).label }}</span>
                      <span class="mv-card__line">
                        <template v-if="l.pwd">提取码 <b>{{ l.pwd }}</b> · 已自动填入</template>
                        <template v-else>无需提取码 · 直接打开</template>
                      </span>
                    </span>
                    <span class="mv-card__go">一键转存 →</span>
                  </a>
                </div>
                <p v-if="!links.length" class="text-low" style="font-size: 13px">暂无可用网盘链接。</p>
              </div>

              <div class="mv__meta text-low">
                <span v-if="r.size">大小：{{ r.size }}</span>
                <span>更新：{{ fmtFull(r.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 同分类推荐 -->
        <section v-if="related.length" class="section">
          <h2 class="section-title">🎯 同类推荐</h2>
          <div class="rc-grid">
            <ResourceCard v-for="rel in related" :key="rel.id" :r="rel" />
          </div>
        </section>
      </template>

      <div v-else class="empty glass">
        <div style="font-size: 40px; margin-bottom: 10px">🕹️</div>
        <p>资源不存在或已被移除</p>
        <a href="/" class="btn btn-primary mt-md">返回首页</a>
      </div>
    </div>

    <!-- 二维码弹窗（PC 端「一键获取」触发）——码与提取码都跟你点的那张卡走 -->
    <div v-if="showQr" class="modal-mask" @click.self="closeQr">
      <div class="modal glass game-modal">
        <button class="game-modal__close" @click="closeQr" title="关闭">✕</button>
        <h3 class="game-modal__title">扫码转存{{ activePlatformLabel ? ' · ' + activePlatformLabel : '' }}</h3>
        <p class="game-modal__hint">手机扫一扫，打开 {{ activePlatformLabel || '网盘' }} 分享页（提取码已自动带入）</p>
        <div class="game-modal__qr-wrap">
          <canvas ref="qrRef" class="game-modal__qr"></canvas>
        </div>
        <div v-if="activeLink?.pwd" class="game-modal__pwd">
          <span class="text-low">提取码：</span>
          <code class="pwd-code">{{ activeLink.pwd }}</code>
        </div>
        <p v-else class="game-modal__tip" style="opacity: 0.7">该网盘无需提取码</p>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import QRCode from 'qrcode'
import SiteHeader from '../components/SiteHeader.vue'
import BgWall from '../components/BgWall.vue'
import ResourceCard from '../components/ResourceCard.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useData } from '../composables/useData.js'
import { useFavorites } from '../composables/useFavorites.js'
import { shortId } from '../lib/short.js'
import { BUILD_ID } from '../lib/version.js'

const BASE = import.meta.env.BASE_URL

const { state, load, catMeta } = useData()
const params = new URLSearchParams(location.search)

// <title>：资源名前 10 字 + 页面静态标题（后半句的品牌名由 useData.applyBrandToDoc 统一换成运行中品牌）。
// 详情页由 ?id= 定位，构建期不知道是哪条资源，只能加载后运行时改。
const TITLE_NAME_LEN = 10
let titleApplied = false
function applyDocTitle() {
  const item = r.value
  if (!item?.title || titleApplied) return
  // 第 10 个字符可能正好是空格（如「战D6 战D风云6 赠单板补丁」），不 trim 会拼出双空格
  const prefix = String(item.title).slice(0, TITLE_NAME_LEN).trim()
  document.title = `${prefix} ${document.title}`
  titleApplied = true
}
const rawId = params.get('id')
const legacyCat = params.get('c')
const showQr = ref(false)
const qrRef = ref(null)

// Umami 自建统计（script 由 postbuild 的 inject-build.js 注入全站，见那里第 7 条）。
// 事件名带资源 id：view:<id> / get:<id>，聚合侧 join 出「每资源点击率 = get / view」。
// 脚本被拦截或未加载时不能影响页面，所以判存在 + try 包住。
function track(name) {
  try {
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(name)
  } catch (e) {
    /* 统计失败不能影响页面 */
  }
}

// 详情查找：支持短码（6 位 base36）与旧语义 id；短码用 FNV-1a hash 动态匹配（资源量小，直接遍历）
const r = computed(() => {
  if (!rawId) return null
  let hit = state.resources.find((x) => x.id === rawId)
  if (!hit && /^[0-9a-z]{6}$/i.test(rawId)) {
    hit = state.resources.find((x) => shortId(x.id) === rawId.toLowerCase()) || null
  }
  return hit
})

// 旧站链接兼容：/resource?c=games&id=1329 → 查 legacy-map → 302 到新短链
async function resolveLegacy() {
  if (r.value || !legacyCat || !rawId || !/^\d+$/.test(rawId)) return
  try {
    const map = await fetch(`${BASE}data/legacy-map.json?v=${BUILD_ID || Date.now()}`).then((res) => res.json())
    const newId = map[`${legacyCat}:${rawId}`]
    if (newId) {
      location.replace(`/resource.html?id=${shortId(newId)}`)
    }
  } catch (e) {
    console.error('legacy 映射加载失败:', e)
  }
}

onMounted(async () => {
  await load()
  applyDocTitle() // 必须在 load() 之后：那时 applyBrandToDoc 已把静态标题里的品牌名换好
  if (r.value?.id) track('view:' + r.value.id)
  await resolveLegacy()
})

const cat = computed(() => (r.value ? catMeta(r.value.category) : null))

// 收藏 / 已收藏（纯本地 localStorage）
const { isFav, toggleFav } = useFavorites()
const favored = computed(() => isFav(r.value?.id))
function onToggleFav() {
  if (!r.value?.id) return
  toggleFav(r.value)
}
const platform = computed(() => {
  if (!r.value) return null
  const p = state.site?.platforms?.[r.value.platform]
  return p || { label: '网盘链接', icon: '🔗' }
})

// ── 自适应网盘卡片：只显示该资源实际存在的网盘 ──
const PLATFORM_ORDER = ['quark', 'uc', 'xunlei', 'guangya', 'aliyun', 'baidu', 'unknown']
const links = computed(() => {
  const item = r.value
  if (!item) return []
  const raw = Array.isArray(item.links) && item.links.length
    ? item.links
    : [{ platform: item.platform, url: item.url, pwd: item.pwd }]
  const seen = new Set()
  return raw
    .filter((l) => l && l.url && !seen.has(l.platform) && seen.add(l.platform))
    .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform))
})
function platformMeta(l) {
  return state.site?.platforms?.[l.platform] || { label: '网盘链接', icon: '🔗', color: '#8a8880' }
}
function iconStyle(l) {
  const p = platformMeta(l)
  // 带品牌 logo 的网盘用白底：logo 多为透明底/浅色，压在暗色卡上看不清
  if (p.iconImg) return { background: '#fff', borderColor: 'rgba(255,255,255,.18)' }
  const c = p.color || '#8a8880'
  return { background: c + '1a', borderColor: c + '55' }
}
// 提取码自动拼进链接：光鸭用 code，其余用 pwd
const CODE_PARAM = { guangya: 'code' }
function withCode(url, pwd, platform) {
  if (!url || !pwd) return url
  const key = CODE_PARAM[platform] || 'pwd'
  const code = String(pwd).trim()
  if (!code) return url
  const re = new RegExp('([?&]' + key + '=)([^&#]*)')
  if (re.test(url)) return url.replace(re, '$1' + encodeURIComponent(code))
  const i = url.indexOf('#')
  const base = i >= 0 ? url.slice(0, i) : url
  const hash = i >= 0 ? url.slice(i) : ''
  return base + (base.includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(code) + hash
}
function transferUrl(l) { return withCode(l.url, l.pwd, l.platform) }
const related = computed(() =>
  r.value ? state.resources.filter((x) => x.category === r.value.category && x.id !== r.value.id).slice(0, 4) : []
)

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const coverStyle = computed(() => {
  if (!r.value || r.value.cover) return {}
  const [a, b] = cat.value?.gradient || ['#c99a5b', '#a87b3f']
  const deg = hashStr(r.value.title + 'c') % 360
  return { background: `linear-gradient(${deg}deg, ${a} 0%, ${b} 100%)` }
})
const haloStyle = computed(() => {
  if (!r.value || r.value.cover) return {}
  const [a] = cat.value?.gradient || ['#c99a5b', '#a87b3f']
  return { background: `radial-gradient(circle at 50% 38%, ${a}55 0%, transparent 70%)` }
})
const catBadgeStyle = computed(() => {
  if (!cat.value) return {}
  return {
    color: cat.value.gradient[0],
    borderColor: cat.value.gradient[0] + '55',
    background: cat.value.gradient[0] + '14',
  }
})
const platformIconStyle = computed(() => {
  // 带位图 logo 的网盘（如夸克）用白底：源图是透明底浅色 logo，压在暗色卡上几乎看不见
  if (platform.value?.iconImg) return { background: '#fff' }
  const c = platform.value?.color || '#888'
  return { background: c + '1a' }
})

// 「获取方式」下面的决策理由：只用站上真实存在的字段，不编「已获取 1234 次」这种假社会证明
const getHints = computed(() => {
  const item = r.value
  if (!item) return []
  const out = []
  if (item.status !== 'inactive') out.push('✅ 免费分享')
  if (item.size) out.push(`📦 ${item.size}`)
  const d = daysAgo(item.updatedAt)
  if (d !== null) out.push(d <= 0 ? '🕒 今日更新' : `🕒 ${d} 天前更新`)
  return out
})
function daysAgo(iso) {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}
// 移动端点了之后按钮换兜底文案：目标页被拦截/加载慢时用户能再点一次，这是真实的流失点
const gotIt = ref(false)

function fmtFull(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
async function copyPwd() {
  try {
    await navigator.clipboard.writeText(r.value.pwd)
    alert('提取码已复制: ' + r.value.pwd)
  } catch {
    alert('提取码: ' + r.value.pwd)
  }
}
// 「一键获取」设备分流：PC 弹二维码，移动端直接跳转网盘。
// link = 你点的那张网盘卡；二维码与提取码都取它，而不是条目的主平台。
const activeLink = ref(null)
const activePlatformLabel = computed(() => activeLink.value
  ? (state.site?.platforms?.[activeLink.value.platform]?.label || '')
  : '')
function closeQr() { showQr.value = false }
function onGet(e, link) {
  // 先埋点再分流：两条路径（弹码 / 直接跳）都算一次「获取」
  if (r.value?.id) track('get:' + r.value.id)
  activeLink.value = link
    || links.value[0]
    || (r.value ? { platform: r.value.platform, url: r.value.url, pwd: r.value.pwd } : null)
  if (window.matchMedia('(min-width: 768px)').matches) {
    e.preventDefault()
    showQr.value = true
    return
  }
  // 移动端直接跳网盘；这里不动 preventDefault，让默认导航照常发生
  gotIt.value = true
}

// 渐变游戏风二维码：深色模块替换为紫→蓝→青渐变
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const QR_GRAD = ['#7c3aed', '#4f46e5', '#0891b2'] // 紫→靛蓝→深青
async function drawGradientQr(canvas, text) {
  const size = 240
  const tmp = document.createElement('canvas')
  tmp.width = tmp.height = size
  // 1. 生成基础二维码：深色模块不透明，浅色区域透明
  // 注意：qrcode 库颜色只支持 hex（含 #RRGGBBAA），不支持 rgba() 字符串
  await QRCode.toCanvas(tmp, text, {
    width: size,
    margin: 2,
    color: { dark: '#000000ff', light: '#ffffff00' },
  })
  // 2. 目标画布：白底 + 渐变填充
  const ctx = canvas.getContext('2d')
  canvas.width = canvas.height = size
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  const stops = QR_GRAD.map(hexToRgb)
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1)
    const seg = t * (stops.length - 1)
    const i = Math.min(Math.floor(seg), stops.length - 2)
    const f = seg - i
    const [r1, g1, b1] = stops[i]
    const [r2, g2, b2] = stops[i + 1]
    const r = lerp(r1, r2, f)
    const g = lerp(g1, g2, f)
    const b = lerp(b1, b2, f)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, y, size, 1)
  }
  // 3. 用二维码深色模块作遮罩，只保留渐变
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(tmp, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

watch([showQr, activeLink], async ([v]) => {
  if (!v || !r.value) return
  await nextTick() // 先等 v-if 弹窗挂载完成，再拿 canvas
  if (!qrRef.value) return
  try {
    // 码必须跟着当前点击的那张网盘卡走（含该平台的提取码参数）
    const link = activeLink.value
    await drawGradientQr(qrRef.value, link ? transferUrl(link) : r.value.url)
  } catch (e) {
    console.error('二维码生成失败:', e)
  }
})

</script>

<style scoped>
.resource-page { min-height: 100vh; }
.back-link { display: inline-block; margin: 26px 0 14px; font-size: 14px; transition: color 0.2s; position: relative; z-index: 1; }
.back-link:hover { color: var(--neon-cyan); }

.detail {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
}
.detail__cover {
  position: relative;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  overflow: hidden;
}
.detail__cover-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(20px) brightness(0.62) saturate(1.2);
  transform: scale(1.12);
  pointer-events: none;
}
.detail__cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  box-sizing: border-box;
  padding: 6px;
}
.detail__cover-halo {
  position: absolute;
  inset: -20%;
  z-index: 1;
  pointer-events: none;
}
.detail__cover-emoji {
  position: relative;
  z-index: 2;
  font-size: 38px;
  filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45));
}
.detail__cover-title {
  position: relative;
  z-index: 2;
  font-family: var(--font-display);
  font-size: clamp(18px, 2.2vw, 26px);
  font-weight: 700;
  color: #fff;
  text-align: center;
  text-shadow: 0 3px 16px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 255, 255, 0.3);
  line-height: 1.3;
  max-width: 90%;
}
.detail__inactive {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 14, 0.8);
  color: #fb7185;
  font-weight: 700;
  font-size: 18px;
}
.detail__info { padding: 28px 30px; display: flex; flex-direction: column; }
.detail__title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
.detail__entitle { font-size: 15px; margin-bottom: 12px; }

/* 收藏按钮（本地功能，视觉语言与全站 CTA 区分：已收藏用暖金实底） */
.detail__actions { display: flex; gap: 10px; margin-bottom: 4px; }
.fav-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: 100px;
  border: 1px solid var(--glass-border);
  background: rgba(var(--accent-rgb), 0.06);
  color: var(--text-mid);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.fav-btn:hover { color: var(--text-hi); border-color: var(--accent-gold); box-shadow: var(--shadow-glow); }
.fav-btn__star { font-size: 16px; line-height: 1; }
.fav-btn--on {
  color: #3b1e00;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-gold), var(--accent-gold-deep));
  box-shadow: 0 4px 18px rgba(var(--accent-rgb), 0.35);
}
.fav-btn--on:hover { color: #3b1e00; }

/* 获取卡片：平台 + 提取码 + 一键获取 整合高亮 */
.get-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 16px 0 20px;
  padding: 18px;
  border-radius: 16px;
  /* 无边框：柔和渐变底替代框线 */
  background: linear-gradient(160deg, rgba(var(--accent-rgb), 0.09), rgba(var(--accent-rgb), 0.02) 55%, transparent);
}

/* 图标卡 = 可点引导区：整块跟按钮同 href，视线第一站就是可操作的 */
.platform-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px;
  margin: -4px;
  border-radius: 12px;
  transition: background 0.25s ease;
}
.platform-card:hover { background: rgba(var(--accent-rgb), 0.07); }
.platform-card:active { background: rgba(var(--accent-rgb), 0.12); }
.platform-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 24px;
}
.platform-card__icon-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}
.platform-card__body { flex: 1; min-width: 0; }
.platform-card__name { font-weight: 700; font-size: 15px; }
.platform-card__desc { font-size: 13px; margin-top: 2px; }
/* 决策理由：真实字段拼的，不编社会证明 */
.get-hints { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-top: 4px; }
.get-hint { font-size: 12px; color: var(--text-low); white-space: nowrap; }

/* 「获取方式」：暖色渐变字 + 上升火星粒子 */
.hot-label { position: relative; display: inline-block; }
.hot-label__text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.5px;
  background: linear-gradient(180deg, #ffedb0 0%, #ffb347 46%, #ff5a15 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 6px rgba(255, 122, 26, 0.35));
}
.hot-label__embers { position: absolute; inset: 0; pointer-events: none; }
.hot-label__embers i {
  position: absolute;
  bottom: 1px;
  left: calc(4% + var(--i) * 15%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff6c2 0%, #ffab2e 45%, #ff4d00 78%, transparent 100%);
  opacity: 0;
  /* 只跑一次：进页时的入场火星，不常驻循环（循环动画看三遍就是噪音） */
  animation: ember-rise 2.4s ease-out 0.2s 1 both;
  animation-delay: calc(0.2s + var(--i) * 0.4s);
}
@keyframes ember-rise {
  0% { translate: 0 0; scale: 0.5; opacity: 0; }
  25% { opacity: 1; }
  70% { opacity: 0.65; }
  100% { translate: 0 -22px; scale: 0.2; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hot-label__embers { display: none; }
}

.pwd-row { display: flex; align-items: center; gap: 10px; }
.pwd-code {
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.12);
  border: 1px dashed rgba(var(--accent-rgb), 0.4);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--neon-cyan);
}
.detail__btn {
  position: relative;
  overflow: hidden;
  font-size: 17px;
  font-weight: 800;
  padding: 15px 28px;
  border-radius: 16px;
  justify-content: center;
  width: 100%;
  /* 全站唯一用橙色的地方：跟粒子同一语义（火 = 值得拿），从金色 CTA 里跳出来 */
  color: #3b1e00;
  background: linear-gradient(165deg, #ffd45c 0%, #ff9f22 52%, #ff6a00 100%);
  box-shadow: 0 6px 26px rgba(255, 122, 26, 0.38);
  animation: cta-in 0.55s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.detail__btn:hover { box-shadow: 0 8px 34px rgba(255, 122, 26, 0.55); transform: translateY(-1px); }
.detail__btn:active { transform: scale(0.97); }
/* 进页一次的扫光：跑完停住，不循环；动 transform 的伪元素跟 :hover/:active 的 transform 不撞车 */
.detail__btn::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 45%;
  background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  transform: translateX(-160%);
  animation: cta-sweep 1.2s ease-out 0.35s 1 both;
  pointer-events: none;
}
/* 入场缩放动的是 scale 而不是 transform：transform 会永久盖住 :hover/:active 的位移与缩放 */
@keyframes cta-in {
  from { scale: 0.92; opacity: 0.5; }
  to { scale: 1; opacity: 1; }
}
@keyframes cta-sweep {
  from { transform: translateX(-160%); }
  to { transform: translateX(320%); }
}
.detail__btn-label { position: relative; z-index: 1; }

/* 「一键免费获取」：按钮内上升的 SVG 四角星粒子 */
.btn-sparks { position: absolute; inset: 0; pointer-events: none; }
.btn-spark {
  position: absolute;
  bottom: 3px;
  left: calc(4% + (var(--i) - 1) * 18%);
  color: #ffffff;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.7));
  opacity: 0;
  animation: spark-rise 2.6s ease-out infinite;
  animation-delay: calc(var(--i) * 0.42s);
}
@keyframes spark-rise {
  0% { translate: 0 6px; scale: 0.4; opacity: 0; }
  18% { opacity: 1; }
  60% { opacity: 0.8; }
  100% { translate: 0 -30px; scale: 0.15; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hot-label__embers,
  .btn-sparks { display: none; }
  .detail__btn,
  .detail__btn::after { animation: none; }
}
.detail__desc { font-size: 15px; color: var(--text-mid); margin-bottom: 20px; }
.detail__meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; margin-top: auto; border-top: 1px solid var(--glass-border); padding-top: 16px; }

.rc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.empty { padding: 60px 20px; text-align: center; margin: 40px 0; }

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(3, 3, 10, 0.82);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal { padding: 30px; text-align: center; max-width: 340px; width: 90%; }
.modal__title { margin-bottom: 10px; }
.modal__hint { font-size: 13px; margin-bottom: 16px; }
.modal__iframe {
  width: 100%;
  height: 380px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.modal__iframe iframe { width: 100%; height: 100%; border: 0; display: block; }
.modal__pwd { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }

/* 游戏风弹窗：霓虹渐变边框 + 渐变二维码 */
.game-modal {
  position: relative;
  max-width: 400px;
  width: 92%;
  padding: 32px 28px 26px;
  border-radius: 20px;
  border: 1.5px solid transparent;
  background:
    linear-gradient(rgba(10, 10, 24, 0.97), rgba(10, 10, 24, 0.97)) padding-box,
    linear-gradient(135deg, rgba(168, 85, 247, 0.7), rgba(34, 211, 238, 0.7), rgba(244, 114, 182, 0.6)) border-box;
  box-shadow: 0 0 50px rgba(124, 58, 237, 0.25), 0 0 80px rgba(34, 211, 238, 0.12);
  animation: gameModalIn 0.28s ease-out;
}
@keyframes gameModalIn {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.game-modal__close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-mid);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 5;
}
.game-modal__close:hover { color: var(--neon-cyan); border-color: var(--neon-cyan); box-shadow: 0 0 12px rgba(34, 211, 238, 0.4); }
.game-modal__title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
  background: linear-gradient(135deg, #a78bfa, #22d3ee, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 16px rgba(168, 85, 247, 0.35));
}
.game-modal__hint { font-size: 13px; color: var(--text-mid); margin-bottom: 16px; }
.game-modal__qr-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}
.game-modal__qr {
  width: 240px;
  height: 240px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 0 24px rgba(34, 211, 238, 0.25), 0 4px 20px rgba(0, 0, 0, 0.4);
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.game-modal__pwd { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
.game-modal__tip {
  font-size: 13px;
  color: var(--text-mid);
  letter-spacing: 0.05em;
  animation: tipPulse 2s ease-in-out infinite;
}
@keyframes tipPulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; text-shadow: 0 0 14px rgba(34, 211, 238, 0.6); }
}

@media (max-width: 768px) {
  .detail { grid-template-columns: 1fr; }
  /* 移动端封面：显式宽度 70vw（grid item 收缩到内容宽度是之前封面变小的根因） */
  .detail__cover {
    width: min(70vw, 100%);
    min-height: 0;
    aspect-ratio: 16 / 9;
    justify-self: center;
    margin-top: 20px;
    border-radius: 12px;
  }
  .detail__cover-emoji { font-size: 26px; }
  .detail__cover-title { font-size: 14px; }
  .detail__info { padding: 20px 18px 26px; }
  .detail__title { font-size: 22px; }
  .get-card { padding: 14px; }
  .detail__btn { width: 100%; }
  .rc-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) { .rc-grid { grid-template-columns: repeat(2, 1fr); } }

/* ── 影视站详情卡（重新设计）── */
.mv { position: relative; overflow: hidden; border-radius: var(--radius-lg); margin-bottom: var(--space-lg); }
.mv__backdrop { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(30px) saturate(1.2); transform: scale(1.25); opacity: 0.35; }
.mv__veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(var(--bg-0-rgb), 0.72), rgba(var(--bg-0-rgb), 0.96)); }
.mv__body { position: relative; display: grid; grid-template-columns: 300px 1fr; gap: 28px; padding: 26px 28px; }
.mv__poster { position: relative; aspect-ratio: 3 / 4; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-card); background: var(--bg-2); display: flex; align-items: center; justify-content: center; }
.mv__poster img { width: 100%; height: 100%; object-fit: cover; }
.mv__title { font-family: var(--font-display); font-size: 30px; font-weight: 700; line-height: 1.25; margin-bottom: 10px; }
.mv__desc { color: var(--text-mid); font-size: 14.5px; line-height: 1.85; margin-bottom: 20px; white-space: pre-wrap; }
.badge--gold { background: linear-gradient(135deg, var(--accent-gold), var(--accent-gold-deep)); color: #fff; border-color: transparent; }
.mv__get { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius); padding: 16px 18px; backdrop-filter: blur(14px); }
.mv__get-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.mv__get-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
.mv__get-sub { font-size: 12.5px; color: var(--text-low); }
.mv__cards { display: grid; gap: 10px; }
.mv-card { display: flex; align-items: center; gap: 14px; background: var(--bg-1); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px 14px; transition: all 0.2s; }
.mv-card:hover { border-color: var(--accent-gold); box-shadow: var(--shadow-glow); transform: translateY(-1px); }
.mv-card__ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 11px; border: 1px solid var(--glass-border); font-size: 19px; flex: 0 0 auto; overflow: hidden; }
.mv-card__logo { width: 28px; height: 28px; object-fit: contain; display: block; }
.mv-card__mid { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.mv-card__name { font-size: 15px; font-weight: 700; }
.mv-card__line { font-size: 12px; color: var(--text-mid); }
.mv-card__line b { color: var(--accent-gold); }
.mv-card__go { flex: 0 0 auto; background: linear-gradient(135deg, var(--accent-gold), var(--accent-gold-deep)); color: #fff; font-weight: 700; font-size: 13.5px; padding: 9px 16px; border-radius: 100px; white-space: nowrap; }
.mv__meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.5px; margin-top: 14px; }
@media (max-width: 840px) { .mv__body { grid-template-columns: 1fr; padding: 18px; } .mv__poster { aspect-ratio: 3 / 4; max-width: 220px; } .mv__title { font-size: 22px; } }
</style>
