#!/usr/bin/env node
/**
 * publish.mjs — 一键发布单个资源到站点数据（供 UC / 迅雷 / 光鸭 publisher skill 调用）。
 *
 * 用法 A（结构化 JSON，publisher 推荐）:
 *   node scripts/publish.mjs --json /tmp/resource.json [--push] [--dry-run]
 *   payload: { "title":"...", "desc":"...", "tags":["a","b"], "poster":"https://...",
 *              "links":[{"platform":"uc","url":"https://drive.uc.cn/s/xxx","pwd":null}],
 *              "type":"电影", "year":2026 }
 *
 * 用法 B（命令行参数）:
 *   node scripts/publish.mjs --title "示例" --link "uc=https://drive.uc.cn/s/xxx" \
 *        --tags "4K,悬疑" --desc "简介" --poster "https://..." [--push]
 *
 * 幂等：同标题（规范化后）合并；同一 URL 不重复添加。
 * 退出码：0 成功；1 参数错误；2 数据缺失。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'data', 'resources.json')

const PLATFORM_LABELS = {
  quark: '夸克', uc: 'UC', xunlei: '迅雷', guangya: '光鸭',
  aliyun: '阿里云盘', baidu: '百度', '123pan': '123网盘', tianyi: '天翼', unknown: '其他',
}
const CATEGORY_LABELS = { movies: '影视', games: '游戏', book: '书籍', tools: '软件工具' }

function parseArgs(argv) {
  const out = { links: [], tags: [], codes: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--push') { out.push = true; continue }
    if (a === '--dry-run') { out.dryRun = true; continue }
    const key = a.replace(/^--/, '')
    const val = argv[i + 1]
    if (key === 'link') { out.links.push(val); i++; continue }
    if (key === 'tags') { out.tags.push(val); i++; continue }
    if (key === 'code') { out.codes.push(val); i++; continue }
    out[key] = val; i++
  }
  return out
}

const sha1 = s => crypto.createHash('sha1').update(s).digest('hex')
const itemId = (platform, url, title) => sha1(`${platform}|${url || title}`).slice(0, 12)
const normTitle = t => (t || '')
  .replace(/[（(]\s*20\d{2}\s*[)）]/g, '')
  .replace(/更至\d+集|更新至\d+集|每日更新|全集|完结/g, '')
  .replace(/[\[\]【】()（）·、,，。!！?？\-_|/\\~`'"：:]/g, ' ')
  .replace(/\s+/g, '').trim().toLowerCase()

function detectPlatform(url) {
  const u = String(url || '').toLowerCase()
  if (u.includes('pan.quark.cn') || u.includes('quark.cn')) return 'quark'
  if (u.includes('drive.uc.cn') || u.includes('fast.uc.cn')) return 'uc'
  if (u.includes('xunlei.com')) return 'xunlei'
  if (u.includes('guangyapan.com')) return 'guangya'
  if (u.includes('alipan.com') || u.includes('aliyundrive.com')) return 'aliyun'
  if (u.includes('pan.baidu.com')) return 'baidu'
  if (u.includes('123pan.com')) return '123pan'
  return 'unknown'
}
const extractPwd = url => (String(url || '').match(/[?&]pwd=([^&\s)]+)/) || [])[1] || null

// 提取码参数名：光鸭用 code，其余用 pwd
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

function detectType(title, tags) {
  const s = `${title} ${tags.join(' ')}`
  if (/国漫|动画|动漫|番剧|剧场版/i.test(s)) return '动漫'
  if (/纪录片|纪实/i.test(s)) return '纪录片'
  if (/综艺|真人秀|脱口秀/i.test(s)) return '综艺'
  if (/电视剧|剧集|更至\d+集|第[一二三四五六七八九十\d]+季|国产剧|美剧|韩剧|日剧/i.test(s)) return '电视剧'
  if (/电影|影片|蓝光|HD中字/i.test(s)) return '电影'
  return '影视'
}

function buildPayload(args) {
  let p = {}
  if (args.json) {
    p = JSON.parse(fs.readFileSync(args.json, 'utf8'))
  }
  if (args.title) p.title = args.title
  if (args.desc) p.desc = args.desc
  if (args.poster) p.poster = args.poster
  if (args.type) p.type = args.type
  if (args.year) p.year = Number(args.year)
  if (args['category']) p.category = args['category']
  if (args.tags.length) p.tags = args.tags.flatMap(t => String(t).split(/[\s,、，]+/)).filter(Boolean)
  const links = []
  for (const l of args.links) {
    // 形式: platform=url  或  url
    const m = String(l).match(/^([a-z0-9]+)=(.*)$/i)
    if (m) links.push({ platform: m[1].toLowerCase(), url: m[2] })
    else links.push({ platform: detectPlatform(l), url: l })
  }
  if (links.length) p.links = links
  // --code platform=VALUE  → 各平台提取码（UC/光鸭返回 code，迅雷返回 pwd）
  const codes = {}
  for (const c of (args.codes || [])) {
    const m = String(c).match(/^([a-z0-9]+)=(.*)$/i)
    if (m) codes[m[1].toLowerCase()] = m[2]
  }
  p._codes = codes
  return p
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const p = buildPayload(args)
  if (!p.title || !p.links || !p.links.length) {
    console.error('[publish] 需要 --title 和至少一个 --link（或 --json）')
    process.exit(1)
  }
  if (!fs.existsSync(DATA)) {
    console.error(`[publish] 数据文件不存在: ${DATA}（先跑 scripts/build-index.mjs）`)
    process.exit(2)
  }
  const doc = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  const tags = Array.from(new Set((p.tags || []).map(t => String(t).trim()).filter(Boolean)))
  const type = p.type || detectType(p.title, tags)
  const year = p.year || (Number((p.title.match(/20\d{2}/) || [])[0]) || null)
  const date = p.date || new Date().toISOString().slice(0, 10)

  const key = normTitle(p.title)
  let item = doc.items.find(x => normTitle(x.title) === key)
  if (!item) {
    item = {
      id: itemId(p.links[0].platform, p.links[0].url, p.title),
      title: p.title, subtitle: p.subtitle || '', type, year,
      quality: (p.title.match(/(4K|2160P|1080P|HDR|H265)/i) || [])[0] || null,
      tags, desc: p.desc || '', poster: p.poster || '',
      category: p.category || 'movies',
      categoryLabel: CATEGORY_LABELS[p.category || 'movies'] || '影视',
      date, month: date.slice(0, 7).replace('-', ''),
      links: [],
    }
    doc.items.unshift(item)
  } else {
    if (p.desc) item.desc = p.desc
    if (p.poster) item.poster = p.poster
    if (tags.length) item.tags = Array.from(new Set([...(item.tags || []), ...tags]))
    item.date = date
  }
  const codeMap = Object.assign({}, p._codes || {})
  for (const l of p.links) {
    const platform = l.platform || detectPlatform(l.url)
    if (!/^https?:\/\//.test(l.url)) { console.error(`[publish] 跳过非法链接: ${l.url}`); continue }
    const pwd = l.pwd ?? codeMap[platform] ?? extractPwd(l.url)
    const url = withCode(l.url, pwd, platform)   // 提取码自动写进链接，用户无需手输
    if (!item.links.some(x => x.url === url)) {
      item.links.push({ platform, url, pwd: pwd || null })
    }
  }

  doc.updated = new Date().toISOString()
  doc.count = doc.items.length
  doc.items.forEach((it, idx) => { it.i = idx })

  if (args.dryRun) {
    console.log(`[publish][dry-run] title="${p.title}" type=${type} links=${item.links.length} new=${!doc.items.includes(item) ? '?' : 'merged'}`)
    console.log(JSON.stringify(item, null, 2))
    return
  }
  fs.writeFileSync(DATA, JSON.stringify(doc))
  // 同步 search-index
  const search = doc.items.map(it => ({ i: it.i, t: it.title, g: (it.tags || []).join(' '), y: it.year || '', p: it.type }))
  fs.writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify(search))
  console.log(`[publish] OK title="${item.title}" type=${item.type} links=${item.links.map(l => PLATFORM_LABELS[l.platform] || l.platform).join('+')} total=${doc.items.length}`)

  if (args.push) {
    const run = (cmd, a) => execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit' })
    run('git', ['add', 'data/resources.json', 'data/search-index.json'])
    run('git', ['commit', '-m', `publish: ${item.title}`])
    run('git', ['push', 'origin', 'HEAD'])
    console.log('[publish] pushed')
  }
}

main()