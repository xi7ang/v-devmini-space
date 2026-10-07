<template>
  <!-- 全页背景：影视剧封面墙（16:9，来自百度图片采集→webp） -->
  <div class="bg-wall" aria-hidden="true">
    <div class="game-wall">
      <div class="game-wall__track">
        <template v-for="(row, ri) in gameRows" :key="ri">
          <div
            class="game-wall__row"
            :class="ri % 2 === 0 ? 'scroll-left' : 'scroll-right'"
            :style="{ '--row-speed': rowSpeed + 's', marginLeft: rowMargin(ri) }"
          >
            <div
              v-for="(m, gi) in [...row, ...row]"
              :key="'t' + ri + '_' + gi"
              class="game-tile"
            >
              <img v-if="m.img" :src="m.img" :alt="m.name" class="game-tile__img" loading="lazy" decoding="async" draggable="false" />
              <span v-else class="game-tile__name">{{ m.short }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="bg-wall__fade"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { BUILD_ID } from '../lib/version.js'

const BASE = import.meta.env.BASE_URL

// 兜底列表（bgwall.json 缺失时用）
const DEFAULT_COVERS = Array.from({ length: 16 }, (_, i) => ({
  slug: `m${String(i + 1).padStart(3, '0')}`,
  name: `m${i + 1}`,
  short: `m${i + 1}`,
  img: `${BASE}movie-covers/m${String(i + 1).padStart(3, '0')}.webp`,
}))

const covers = ref([...DEFAULT_COVERS])
const rowCount = ref(12)
const rowSpeed = 600

onMounted(async () => {
  try {
    const res = await fetch(`${BASE}data/bgwall.json?v=${BUILD_ID || Date.now()}`)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data.images) && data.images.length) {
      covers.value = data.images.map((g) => ({
        ...g,
        short: g.short || g.slug || g.name,
        img: g.img.startsWith('http') ? g.img : `${BASE}${String(g.img).replace(/^\/+/, '')}`,
      }))
    }
    if (Number.isFinite(data.rows) && data.rows > 0) rowCount.value = Math.min(40, Math.floor(data.rows))
  } catch { /* 用兜底列表 */ }
})

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const gameRows = computed(() => {
  const rows = []
  for (let i = 0; i < rowCount.value; i++) rows.push(shuffle(covers.value))
  return rows
})
function rowMargin(ri) { return ri % 2 === 0 ? '-35px' : '35px' }
</script>

<style scoped>
.bg-wall { position: fixed; inset: 0; z-index: -2; overflow: hidden; user-select: none; -webkit-user-select: none; background: var(--wall-bg); }
.game-wall { position: absolute; inset: -12% -5%; display: flex; justify-content: center; align-items: flex-start; padding-top: 10px; transform: rotate(-3deg) scale(1.12); }
.game-wall__track { display: flex; flex-direction: column; gap: 8px; will-change: transform; width: 100%; overflow: hidden; }
.game-wall__row { display: flex; gap: 8px; width: max-content; will-change: transform; }
.game-wall__row.scroll-left { animation: scroll-left var(--row-speed, 600s) linear infinite; }
.game-wall__row.scroll-right { animation: scroll-right var(--row-speed, 600s) linear infinite; }
@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes scroll-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
/* 16:9 影视封面砖 */
.game-tile { width: 168px; height: 94px; border-radius: 5px; display: flex; align-items: center; justify-content: center; opacity: 0.26; flex-shrink: 0; overflow: hidden; background: #253244; }
[data-theme="light"] .game-tile { opacity: 0.32; }
.game-tile__img { width: 100%; height: 100%; object-fit: cover; display: block; -webkit-user-drag: none; user-drag: none; pointer-events: none; }
.game-tile__name { font-size: 11px; font-weight: 700; color: #fff; text-align: center; white-space: nowrap; }
.bg-wall__fade {
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(to bottom,
    rgba(var(--bg-0-rgb), 0.92) 0%, rgba(var(--bg-0-rgb), 0.3) 25%,
    rgba(var(--bg-0-rgb), 0.3) 75%, rgba(var(--bg-0-rgb), 0.92) 100%);
}
@media (prefers-reduced-motion: reduce) { .game-wall__row { animation: none; } }
</style>