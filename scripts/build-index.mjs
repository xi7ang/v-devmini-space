#!/usr/bin/env node
/**
 * build-index.mjs — 扫描内容仓库（mswnlz/*）的 20*.md，并可选合并已有聚合种子，
 * 生成站点使用的 data/resources.json + data/search-index.json。
 *
 * 用法:
 *   node scripts/build-index.mjs --content-root ../../mswnlz \
 *        --seed ../../xi7ang.github.io/docs/public/data/resources.json
 *
 * 输出:
 *   data/resources.json   { updated, count, categories, items: [...] }
 *   data/search-index.json [ {i, t, g, y} ]  # i=item索引 t=标题 g=标签串 y=年份
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function arg(name, def = null) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return def
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : def
}
const CONTENT_ROOT = path.resolve(ROOT, arg('content-root', '../../mswnlz'))
const SEED = arg('seed', null)          // 默认不合并任何种子，避免非影视资源混入
const ONLY_CATEGORIES = (arg('categories', 'movies') || '').split(',').map(s => s.trim()).filter(Boolean)
const NO_MERGE = process.argv.includes('--no-merge')  // 默认保留已发布条目
const OUT_DIR = path.resolve(ROOT, 'data')

const CATEGORY_LABELS = {
  movies: '影视', games: '游戏', book: '书籍', tools: '软件工具',
  AIknowledge: 'AI 知识', curriculum: '课程', 'edu-knowlege': '教育',
  'self-media': '自媒体', healthy: '健康', auto: '汽车',
  'cross-border': '跨境电商', 'chinese-traditional': '传统文化',
}

const PLATFORM_LABELS = {
  quark: '夸克', uc: 'UC', xunlei: '迅雷', guangya: '光鸭',
  aliyun: '阿里云盘', baidu: '百度', '123pan': '123网盘', tianyi: '天翼', unknown: '其他',
}

function detectPlatform(url) {
  if (!url) return 'unknown'
  const u = url.toLowerCase()
  if (u.includes('pan.quark.cn') || u.includes('drive.uc.cn') === false && u.includes('quark.cn')) return 'quark'
  if (u.includes('drive.uc.cn') || u.includes('fast.uc.cn')) return 'uc'
  if (u.includes('pan.xunlei.com') || u.includes('xunlei.com')) return 'xunlei'
  if (u.includes('guangyapan.com')) return 'guangya'
  if (u.includes('alipan.com') || u.includes('aliyundrive.com')) return 'aliyun'
  if (u.includes('pan.baidu.com')) return 'baidu'
  if (u.includes('123pan.com') || u.includes('123684.com')) return '123pan'
  if (u.includes('cloud.189.cn')) return 'tianyi'
  return 'unknown'
}

function extractPwd(url) {
  if (!url) return null
  const m = url.match(/[?&]pwd=([^&\s)]+)/)
  return m ? m[1] : null
}

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex')
}
function itemId(platform, url, title) {
  return sha1(`${platform}|${url || title}`).slice(0, 12)
}

function normTitle(t) {
  return (t || '')
    .replace(/[（(]\s*20\d{2}\s*[)）]/g, '')
    .replace(/更至\d+集|更新至\d+集|每日更新|全集|完结/g, '')
    .replace(/[\[\]【】()（）·、,，。!！?？\-_|/\\~`'"：:]/g, ' ')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
}

const TYPE_RULES = [
  [/国漫|动画|动漫|番剧|剧场版|アニメ|anime/i, '动漫'],
  [/纪录片|纪实/i, '纪录片'],
  [/综艺|真人秀|脱口秀|晚会|访谈/i, '综艺'],
  [/电视剧|剧集|更至\d+集|更新至\d+集|第[一二三四五六七八九十\d]+季|国产剧|美剧|韩剧|日剧|泰剧|港剧/i, '电视剧'],
  [/电影|影片|影院|HD中字|蓝光|BD版/i, '电影'],
]
function detectType(title) {
  for (const [re, t] of TYPE_RULES) if (re.test(title)) return t
  return '资源'
}

function extractYear(title) {
  const m = (title || '').match(/(20\d{2})/)
  return m ? Number(m[1]) : null
}

function extractQuality(title) {
  const m = (title || '').match(/(4K|2160P|1080P|720P|HDR|H265|HEVC|蓝光|高清)/i)
  return m ? m[1].toUpperCase() : null
}

function cleanTitle(s) {
  return (s || '').replace(/^\s*[-·*]\s*/, '').replace(/\s*\|\s*$/, '').trim()
}

/** 从内容仓库 md 文件解析（卡片格式 + 管道格式） */
function parseMarkdown(text, category, month) {
  const items = []
  const lines = text.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    // 卡片格式: ### 标题 ... 之后跟 > **下载链接：**
    if (/^#{2,4}\s+/.test(line)) {
      const title = cleanTitle(line.replace(/^#{2,4}\s+/, ''))
      const block = []
      let j = i + 1
      while (j < lines.length && !/^#{2,4}\s+/.test(lines[j].trim()) && lines[j].trim() !== '---') {
        block.push(lines[j]); j++
      }
      const body = block.join('\n')
      const mdLink = body.match(/\]\((https?:\/\/[^\s)]+)\)/)
      const anyUrl = body.match(/https?:\/\/[^\s)\]<>"']+/)
      const url = mdLink ? mdLink[1] : (anyUrl ? anyUrl[0] : null)
      const descLine = block.find(l => /简介/.test(l))
      const desc = descLine ? descLine.replace(/^[\s>*-]*简介[：:]?\s*/, '').trim() : ''
      const tagLine = block.find(l => /标签/.test(l))
      let tags = []
      if (tagLine) {
        tags = tagLine.replace(/^[\s>*-]*标签[：:]?\s*/, '')
          .split(/[\s、,，]+/).map(t => t.replace(/[`🏷️【】\[\]]/g, '').trim())
          .filter(t => t && t.length < 24)
      }
      const dateLine = block.find(l => /推送日期/.test(l))
      const date = dateLine ? ((dateLine.match(/(20\d{2}-\d{2}-\d{2})/) || [])[1] || null) : null
      if (title.length >= 2) {
        items.push({
          title: title.split('/')[0].trim(),
          subtitle: title.includes('/') ? title.split('/').slice(1).join('/').trim() : '',
          tags, desc, url, date, month, category,
        })
      }
      i = j
      continue
    }

    // 管道格式: - 标题 | https://...
    const pipe = line.match(/^[-*]?\s*(.+?)\s*\|\s*(https?:\/\/\S+)/)
    if (pipe) {
      items.push({ title: cleanTitle(pipe[1]), subtitle: '', tags: [], desc: '', url: pipe[2], date: null, month, category })
      i++; continue
    }
    i++
  }
  return items
}

function scanContentRepos() {
  const out = []
  if (!fs.existsSync(CONTENT_ROOT)) return out
  for (const dir of fs.readdirSync(CONTENT_ROOT)) {
    const catDir = path.join(CONTENT_ROOT, dir)
    if (!fs.statSync(catDir).isDirectory() || dir.startsWith('.')) continue
    if (ONLY_CATEGORIES.length && !ONLY_CATEGORIES.includes(dir)) continue
    for (const f of fs.readdirSync(catDir)) {
      if (!/^20\d{4}\.md$/.test(f)) continue
      const month = f.replace('.md', '')
      const text = fs.readFileSync(path.join(catDir, f), 'utf8')
      out.push(...parseMarkdown(text, dir, month))
    }
  }
  return out
}

function fromSeed() {
  const out = []
  if (!SEED || !fs.existsSync(SEED)) return out
  const raw = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  if (!Array.isArray(raw)) return out
  for (const r of raw) {
    if (!r.url || !r.title) continue
    if (ONLY_CATEGORIES.length && !ONLY_CATEGORIES.includes(r.category)) continue
    out.push({
      title: r.title, subtitle: '', tags: [], desc: '', url: r.url,
      date: null, month: r.month || null, category: r.category || 'other',
    })
  }
  return out
}

function normalize(raw) {
  const platform = detectPlatform(raw.url)
  const tags = Array.from(new Set([...(raw.tags || [])].map(t => String(t).trim()).filter(t => t && t.length < 24)))
  // 仅 movies 类目录做影视类型推断；其他仓库（游戏/软件/书籍…）统一归为「资源」，
  // 避免“动漫商店模拟器”“电影模拟器.apk”这类标题被误判为影视。
  const isMedia = raw.category === 'movies'
  const item = {
    id: itemId(platform, raw.url, raw.title),
    title: raw.title,
    subtitle: raw.subtitle || '',
    type: isMedia ? detectType(raw.title + ' ' + (raw.subtitle || '') + ' ' + tags.join(' ')) : '资源',
    year: extractYear(raw.title + ' ' + (raw.subtitle || '')),
    quality: extractQuality(raw.title + ' ' + (raw.subtitle || '')),
    tags,
    desc: (raw.desc || '').slice(0, 600),
    poster: raw.poster || '',
    category: raw.category || 'other',
    categoryLabel: CATEGORY_LABELS[raw.category] || '其他',
    date: raw.date || null,
    month: raw.month || null,
    links: [{ platform, url: raw.url, pwd: extractPwd(raw.url) }],
  }
  return item
}

function mergeItems(items) {
  // 同标题 → 合并 links（不同网盘）
  const byKey = new Map()
  for (const it of items) {
    const key = normTitle(it.title) || it.id
    const cur = byKey.get(key)
    if (!cur) { byKey.set(key, it); continue }
    for (const l of it.links) {
      if (!cur.links.some(x => x.url === l.url)) cur.links.push(l)
    }
    if (!cur.desc && it.desc) cur.desc = it.desc
    if ((!cur.tags || !cur.tags.length) && it.tags?.length) cur.tags = it.tags
    if (!cur.poster && it.poster) cur.poster = it.poster
    if (!cur.year && it.year) cur.year = it.year || cur.year
  }
  return Array.from(byKey.values())
}

/** 合并现有 data/resources.json 中已发布的条目，避免 rebuild 抹掉直接发布的内容。 */
function mergeExisting(items) {
  const file = path.join(OUT_DIR, 'resources.json')
  if (NO_MERGE || !fs.existsSync(file)) return items
  let prev
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return items }
  const byKey = new Map(items.map(it => [normTitle(it.title) || it.id, it]))
  for (const old of (prev.items || [])) {
    if (!old || !old.title) continue
    const key = normTitle(old.title) || old.id
    const cur = byKey.get(key)
    if (!cur) { byKey.set(key, { ...old }); continue }
    for (const l of (old.links || [])) {
      if (!cur.links.some(x => x.url === l.url)) cur.links.push(l)
    }
    if (!cur.poster && old.poster) cur.poster = old.poster
    if (!cur.desc && old.desc) cur.desc = old.desc
    if (!cur.year && old.year) cur.year = old.year
    if ((!cur.tags || !cur.tags.length) && Array.isArray(old.tags) && old.tags.length) cur.tags = old.tags
  }
  return Array.from(byKey.values())
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const raw = [...scanContentRepos(), ...fromSeed()]
  const normalized = raw.map(normalize).filter(x => x.title && x.title.length >= 2)
  const items = mergeExisting(mergeItems(normalized))
  // 排序：有日期的在前（新→旧），其次有月份的
  items.sort((a, b) => String(b.date || b.month || '').localeCompare(String(a.date || a.month || '')))
  items.forEach((it, idx) => { it.i = idx })

  const categories = Array.from(new Set(items.map(x => x.category)))
  const payload = {
    updated: new Date().toISOString(),
    count: items.length,
    categories: categories.map(c => ({ key: c, label: CATEGORY_LABELS[c] || '其他' })),
    platformLabels: PLATFORM_LABELS,
    items,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'resources.json'), JSON.stringify(payload))

  const search = items.map(it => ({
    i: it.i, t: it.title, g: (it.tags || []).join(' '), y: it.year || '', p: it.type,
  }))
  fs.writeFileSync(path.join(OUT_DIR, 'search-index.json'), JSON.stringify(search))

  const byType = {}
  for (const it of items) byType[it.type] = (byType[it.type] || 0) + 1
  console.log(`[build-index] items=${items.length} categories=${categories.length}`)
  console.log(`[build-index] byType=${JSON.stringify(byType)}`)
  console.log(`[build-index] wrote ${path.join(OUT_DIR, 'resources.json')}`)
}

main()