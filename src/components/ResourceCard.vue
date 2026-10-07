<template>
  <!-- 影视资源卡：4:3 封面 + 底部仅片名（无其他信息）-->
  <a :href="detailHref(r.id)" class="rc">
    <div class="rc__cover" :style="coverStyle">
      <img v-if="r.cover" :src="r.cover" :alt="r.title" loading="lazy" />
      <template v-else>
        <span class="rc__cover-halo" :style="haloStyle"></span>
        <span class="rc__cover-emoji">{{ catMeta(r.category).emoji }}</span>
      </template>
      <span v-if="r.status === 'inactive'" class="rc__inactive">链接失效</span>
    </div>
    <div class="rc__name">{{ r.title }}</div>
  </a>
</template>

<script setup>
import { computed } from 'vue'
import { useData } from '../composables/useData.js'
import { detailHref } from '../lib/short.js'

const props = defineProps({ r: { type: Object, required: true } })
const { catMeta } = useData()

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const coverStyle = computed(() => {
  if (props.r.cover) return {}
  const meta = catMeta(props.r.category)
  const [a, b] = meta.gradient || ['#c99a5b', '#a87b3f']
  return { background: `linear-gradient(${hashStr(props.r.title + 'c') % 360}deg, ${a} 0%, ${b} 100%)` }
})
const haloStyle = computed(() => {
  if (props.r.cover) return {}
  const meta = catMeta(props.r.category)
  const [a] = meta.gradient || ['#c99a5b', '#a87b3f']
  return { background: `radial-gradient(circle at 50% 35%, ${a}55 0%, transparent 70%)` }
})
</script>

<style scoped>
.rc {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
  background:
    linear-gradient(var(--bg-1), var(--bg-1)) padding-box,
    linear-gradient(160deg, rgba(201, 154, 91, 0.65) 0%, rgba(201, 154, 91, 0.12) 35%, rgba(125, 156, 179, 0.3) 70%, rgba(201, 154, 91, 0.55) 100%) border-box;
  border: 1.5px solid transparent;
  transition: all 0.25s ease;
}
[data-theme="light"] .rc {
  background:
    linear-gradient(var(--bg-1), var(--bg-1)) padding-box,
    linear-gradient(160deg, rgba(168, 123, 63, 0.7) 0%, rgba(168, 123, 63, 0.15) 35%, rgba(93, 124, 147, 0.32) 70%, rgba(168, 123, 63, 0.6) 100%) border-box;
}
.rc::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  z-index: 3;
  opacity: 0.7;
  transition: opacity 0.25s;
  background: linear-gradient(90deg, transparent, rgba(201, 154, 91, 0.85), rgba(125, 156, 179, 0.5), transparent);
}
.rc:hover {
  transform: translateY(-4px);
  background:
    linear-gradient(var(--bg-1), var(--bg-1)) padding-box,
    linear-gradient(160deg, rgba(201, 154, 91, 0.95) 0%, rgba(201, 154, 91, 0.22) 35%, rgba(125, 156, 179, 0.45) 70%, rgba(201, 154, 91, 0.85) 100%) border-box;
  box-shadow: var(--shadow-glow);
}
.rc:hover::before { opacity: 1; box-shadow: 0 0 12px rgba(201, 154, 91, 0.4); }

/* 4:3 影视封面 */
.rc__cover {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rc__cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.45s; }
.rc:hover .rc__cover img { transform: scale(1.05); }
.rc__cover-halo { position: absolute; inset: -20%; z-index: 1; pointer-events: none; }
.rc__cover-emoji { position: relative; z-index: 2; font-size: 30px; filter: drop-shadow(0 2px 8px rgba(0,0,0,.4)); }
.rc__inactive {
  position: absolute; inset: 0; z-index: 4;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--bg-0-rgb), 0.75); color: #fb7185; font-weight: 700; font-size: 13px;
}
/* 底部片名（唯一信息） */
.rc__name {
  padding: 10px 12px 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-hi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.rc:hover .rc__name { color: var(--accent-gold); }
</style>