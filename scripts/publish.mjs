#!/usr/bin/env node
/**
 * publish.mjs — v.devmini.space（影视站）一键发布适配器
 * 供 UC / 迅雷 / 光鸭 publisher skill 调用。
 *
 * 数据落点：public/data/resources.json（Vue 站的唯一数据源，数组）
 * 写完自动重生成 home.json / search-index.json，可选 git push。
 *
 * 用法 A（结构化 JSON，publisher 推荐）:
 *   node scripts/publish.mjs --json /tmp/resource.json [--push] [--dry-run]
 *   payload: {
 *     "title":"...", "desc":"...", "tags":["悬疑","4K"], "cover":"/covers/x.webp",
 *     "category":"movie", "year":2026, "quality":"4K",
 *     "links":[{"platform":"uc","url":"https://drive.uc.cn/s/xxx","pwd":"k9x2"}]
 *   }
 *
 * 用法 B（命令行）:
 *   node scripts/publish.mjs --title "示例电影 (2026)" \
 *     --link "uc=https://drive.uc.cn/s/xxx" --code "uc=k9x2" \
 *     --link "xunlei=https://pan.xunlei.com/s/yyy" --code "xunlei=aa11" \
 *     --desc "简介" --tags "4K,悬疑" --category 电影 [--push]
 *
 * 幂等：同标题（规范化后）合并 links；同 URL 去重；重跑不产生重复条目。
 * 退出码：0 成功 / 1 参数错误 / 2 数据文件缺失
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'public', 'data', 'resources.json')

/* ── 平台 ───────────────────────────────────────────── */
const PLATFORMS = ['quark', 'uc', 'xunlei', 'guangya', 'aliyun', 'baidu', 'unknown']
const PLATFORM_LABELS = { quark: '夸克', uc: 'UC', xunlei: '迅雷', guangya: '光鸭', aliyun: '阿里云盘', baidu: '百度', unknown: '其他' }
const CODE_PARAM = { guangya: 'code' }   // 提取码参数名：光鸭 code，其余 pwd

/* ── 分类：中文名 ↔ key ─────────────────────────────── */
const CAT_ALIAS = {
  movie: 'movie', 电影: 'movie',
  tv: 'tv', 电视剧: 'tv', 剧集: 'tv',
  anime: 'anime', 动漫: 'anime', 动画: 'anime',
  variety: 'variety', 综艺: 'variety',
  documentary: 'documentary', 纪录片: 'documentary',
  other: 'other', 其他: 'other',
}
function normCategory(v) {
  if (!v) return 'movie'
  return CAT_ALIAS[String(v).trim()] || CAT_ALIAS[String(v).trim().toLowerCase()] || 'movie'
}

/* ── 工具 ───────────────────────────────────────────── */
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex')
const normTitle = (t) => String(t || '')
  .replace(/[（(]\s*20\d{2}\s*[)）]/g, '')
  .replace(/更至\d+集|更新至\d+集|每日更新|全集|完结|第\d+[集期季]/g, '')
  .replace(/[\[\]【】()（）·、,，。!！?？\-_|/\\~`'"：:]/g, ' ')
  .replace(/\s+/g, '').trim().toLowerCase()

function detectPlatform(url) {
  const u = String(url || '').toLowerCase()
  if (u.includes('drive.uc.cn') || u.includes('fast.uc.cn')) return 'uc'
  if (u.includes('pan.quark.cn') || u.includes('quark.cn')) return 'quark'
  if (u.includes('xunlei.com')) return 'xunlei'
  if (u.includes('guangyapan.com')) return 'guangya'
  if (u.includes('alipan.com') || u.includes('aliyundrive.com')) return 'aliyun'
  if (u.includes('pan.baidu.com')) return 'baidu'
  return 'unknown'
}
const extractPwd = (url) => (String(url || '').match(/[?&](?:pwd|code)=([^&#\s)]+)/) || [])[1] || null

/** 提取码自动拼进链接：光鸭 code，其余 pwd */
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

function detectType(title, category) {
  if (category && category !== 'movie') return category
  const s = String(title || '')
  if (/国漫|动画|动漫|番剧|剧场版/.test(s)) return 'anime'
  if (/纪录片|纪实/.test(s)) return 'documentary'
  if (/综艺|真人秀|脱口秀/.test(s)) return 'variety'
  if (/电视剧|剧集|更至\d+集|第[一二三四五六七八九十\d]+季|国产剧|美剧|韩剧|日剧/.test(s)) return 'tv'
  return 'movie'
}

function parseArgs(argv) {
  const out = { links: [], tags: [], codes: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--push') { out.push = true; continue }
    if (a === '--dry-run') { out.dryRun = true; continue }
    if (a === '--no-gen') { out.noGen = true; continue }
    const key = a.replace(/^--/, '')
    const val = argv[i + 1]
    if (key === 'link') { out.links.push(val); i++; continue }
    if (key === 'tags') { out.tags.push(val); i++; continue }
    if (key === 'code') { out.codes.push(val); i++; continue }
    out[key] = val; i++
  }
  return out
}

function buildPayload(args) {
  let p = {}
  if (args.json) p = JSON.parse(fs.readFileSync(args.json, 'utf8'))
  if (args.title) p.title = args.title
  if (args.desc) p.desc = args.desc
  if (args.cover || args.poster) p.cover = args.cover || args.poster
  if (args.category) p.category = args.category
  if (args.year) p.year = Number(args.year)
  if (args.quality) p.quality = args.quality
  if (args.date) p.date = args.date
  if (args.tags.length) p.tags = args.tags.flatMap((t) => String(t).split(/[\s,、，]+/)).filter(Boolean)
  const links = []
  for (const l of args.links) {
    const m = String(l).match(/^([a-z0-9]+)=(.*)$/i)
    if (m) links.push({ platform: m[1].toLowerCase(), url: m[2] })
    else links.push({ platform: detectPlatform(l), url: l })
  }
  if (links.length) p.links = links
  const codes = {}
  for (const c of args.codes || []) {
    const m = String(c).match(/^([a-z0-9]+)=(.*)$/i)
    if (m) codes[m[1].toLowerCase()] = m[2]
  }
  p._codes = codes
  return p
}

function genId(list, category, month) {
  const prefix = `${category}-${month}-`
  let max = 0
  for (const it of list) {
    if (typeof it.id === 'string' && it.id.startsWith(prefix)) {
      const n = parseInt(it.id.slice(prefix.length), 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00')

function main() {
  const args = parseArgs(process.argv.slice(2))
  const p = buildPayload(args)
  if (!p.title || !p.links || !p.links.length) {
    console.error('[publish] 需要 --title 和至少一个 --link（或 --json）')
    process.exit(1)
  }
  if (!fs.existsSync(DATA)) {
    console.error(`[publish] 数据文件不存在: ${DATA}`)
    process.exit(2)
  }

  const list = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  const tags = Array.from(new Set((p.tags || []).map((t) => String(t).trim()).filter(Boolean))).slice(0, 8)
  const category = normCategory(p.category || detectType(p.title, null))
  const year = p.year || (Number((String(p.title).match(/20\d{2}/) || [])[0]) || null)
  const quality = p.quality || ((String(p.title).match(/(4K|2160P|1080P|720P|HDR|H265)/i) || [])[0] || '')
  const now = isoNow()
  const month = String(p.date || now).slice(0, 7).replace('-', '')

  // 幂等：按规范化标题找已有条目
  const key = normTitle(p.title)
  let item = list.find((x) => normTitle(x.title) === key)
  let created = false
  if (!item) {
    item = {
      id: genId(list, category, month),
      title: String(p.title).trim(),
      enTitle: '',
      category,
      tags,
      platform: '',
      url: '',
      pwd: null,
      links: [],
      size: '',
      sizeBytes: null,
      quality,
      year,
      cover: p.cover || '',
      desc: p.desc || '',
      status: 'active',
      featured: false,
      addedAt: now,
      updatedAt: now,
      month,
      steamAppID: null,
    }
    list.unshift(item)
    created = true
  } else {
    if (p.desc) item.desc = p.desc
    if (p.cover) item.cover = p.cover
    if (year) item.year = year
    if (quality) item.quality = quality
    if (tags.length) item.tags = Array.from(new Set([...(item.tags || []), ...tags])).slice(0, 8)
    item.updatedAt = now
  }

  // 合并网盘链接（按「去 query 的基地址」去重，避免同条分享带码/不带码算两条）
  if (!Array.isArray(item.links)) item.links = []
  const codeMap = p._codes || {}
  const baseKey = (platform, url) => platform + '|' + String(url).replace(/[?#].*$/, '').replace(/\/+$/, '')
  let added = 0
  for (const l of p.links) {
    if (!l.url || !/^https?:\/\//.test(l.url)) { console.error(`[publish] 跳过非法链接: ${l.url}`); continue }
    const platform = PLATFORMS.includes(l.platform) ? l.platform : detectPlatform(l.url)
    const pwd = l.pwd ?? codeMap[platform] ?? extractPwd(l.url)
    const url = withCode(l.url, pwd, platform)   // 提取码写进链接，用户无需手输
    const k = baseKey(platform, l.url)
    const exist = item.links.find((x) => baseKey(x.platform, x.url) === k)
    if (exist) {
      // 同一条分享：补/更新提取码，不新增条目
      if (!exist.pwd && pwd) { exist.pwd = pwd; exist.url = url }
    } else {
      item.links.push({ platform, url, pwd: pwd || null })
      added++
    }
  }
  // links 按固定顺序排；主平台取第一个
  item.links.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform))
  if (item.links.length) {
    item.platform = item.links[0].platform
    item.url = item.links[0].url
    item.pwd = item.links[0].pwd
  }

  if (args.dryRun) {
    console.log(`[publish][dry-run] ${created ? '新增' : '合并'} title="${item.title}" category=${item.category} links=${item.links.map((l) => PLATFORM_LABELS[l.platform] || l.platform).join('+')}（本次新增 ${added} 条链接）`)
    console.log(JSON.stringify(item, null, 2))
    return
  }

  fs.writeFileSync(DATA, JSON.stringify(list, null, 1))

  if (!args.noGen) {
    for (const s of ['gen-search-index.js', 'gen-home.js']) {
      try {
        execFileSync('node', [path.join('scripts', s)], { cwd: ROOT, stdio: 'pipe' })
      } catch (e) {
        console.error(`[publish] ${s} 执行失败（不阻断）: ${String(e.message).slice(0, 160)}`)
      }
    }
  }

  console.log(`[publish] ${created ? '新增' : '合并'} OK → "${item.title}" | ${item.category} | ${item.links.map((l) => PLATFORM_LABELS[l.platform] || l.platform).join('+')} | 总计 ${list.length} 条`)

  if (args.push) {
    const run = (cmd, a) => execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit' })
    run('git', ['add', 'public/data'])
    run('git', ['commit', '-m', `publish: ${item.title}`])
    run('git', ['push', 'origin', 'HEAD'])
    console.log('[publish] pushed（GitHub Actions 会自动重建站点）')
  }
}

main()