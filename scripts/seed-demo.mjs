#!/usr/bin/env node
/**
 * seed-demo.mjs — 生成「示例资源卡片」用于展示站点整体效果。
 * 同时为每个示例生成一张自绘 SVG 海报（不依赖外链，Pages 上不会裂图）。
 *
 *   node scripts/seed-demo.mjs            # 写入示例数据（幂等）
 *   node scripts/seed-demo.mjs --remove   # 移除全部示例数据
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'data', 'resources.json')
const POSTER_DIR = path.join(ROOT, 'assets', 'posters')
const REMOVE = process.argv.includes('--remove')

const sha1 = s => crypto.createHash('sha1').update(s).digest('hex')

const DEMO = [
  ['电影', '星际回声', 2024, '4K', ['科幻', '太空', '冒险'], '一支深空探测队收到来自百年前的求救信号，返航的决定将改写人类历史。',
    [['uc', 'v8Kq2Lm1'], ['xunlei', 's7Hd93Ka']]],
  ['电影', '暗涌之城', 2023, '1080P', ['悬疑', '犯罪', '都市'], '一桩沉寂十年的旧案重新浮出水面，所有人都藏着不想被翻开的过去。',
    [['uc', 'p2Mx84Rb'], ['guangya', 'k7Zq1']]],
  ['电影', '雪山之巅', 2025, '4K HDR', ['剧情', '登山', '励志'], '在海拔七千米的绝壁上，两个陌生人被迫共用一根绳索。',
    [['xunlei', 'a4Nt66Yc']]],
  ['电影', '末日航线', 2024, '4K', ['灾难', '动作', '生存'], '最后一班撤离航班起飞前四十分钟，跑道被彻底封锁。',
    [['uc', 't9Lm30Vd'], ['xunlei', 'b6Qp71Ze']]],
  ['电影', '无声告白', 2022, '1080P', ['文艺', '家庭', '剧情'], '一位失聪母亲用十六年时间，学会了读懂女儿的每一个表情。',
    [['guangya', 'w3Rk5']]],
  ['电影', '午夜电台', 2025, '4K', ['惊悚', '悬疑'], '凌晨三点的电台热线，接进来的都是已经不在人世的人。',
    [['uc', 'm5Tz27Nf']]],

  ['电视剧', '长风渡口', 2026, '4K', ['古装', '权谋', '剧情'], '渡口小吏步步为营，在朝堂与江湖之间走出第三条路。|第12集',
    [['uc', 'c8Wb41Qh'], ['xunlei', 'd2Vr85Kj'], ['guangya', 'y6Nm7']]],
  ['电视剧', '暗夜迷局', 2025, '1080P', ['刑侦', '悬疑', '美剧'], '每个案件的凶手都在警局内部名单上。|第8集',
    [['xunlei', 'e5Xs63Pl'], ['uc', 'f1Yt09Zm']]],
  ['电视剧', '市井烟云', 2024, '1080P', ['年代', '家庭', '国产剧'], '一条老街，四十年，六户人家。|全36集',
    [['uc', 'g4Zu18An'], ['guangya', 'q9Bc3']]],
  ['电视剧', '归途', 2026, '4K', ['现代', '情感'], '离家十二年后，她带着一个不能说的秘密回来了。|第8集',
    [['uc', 'h7Av52Bo'], ['xunlei', 'j3Bw74Cp']]],

  ['动漫', '苍穹之翼', 2026, '4K', ['国漫', '热血', '奇幻'], '少年与机械巨龙缔结契约，踏上寻找天空尽头的旅程。|第24集',
    [['uc', 'k2Cx63Dq'], ['xunlei', 'l8Dy15Er'], ['guangya', 'z4Fg9']]],
  ['动漫', '山海拾遗', 2025, '1080P', ['国漫', '神话', '水墨'], '古籍里走失的异兽，一只只出现在现代都市的街角。|第16集',
    [['uc', 'm6Ez47Fs'], ['guangya', 'r2Hj5']]],
  ['动漫', '幻夜使者', 2026, '4K', ['日漫', '异世界', '战斗'], '被选中的人，每晚都要替这座城市守住八小时的黑暗。|第9集',
    [['xunlei', 'n1Fw86Gt'], ['uc', 'p5Gx29Hu']]],

  ['综艺', '周末环游记', 2026, '1080P', ['真人秀', '旅行'], '六个人，一辆车，没有剧本的周末。|第20261005期',
    [['uc', 'q9Hy71Iv'], ['guangya', 't8Kl2']]],
  ['综艺', '厨神争霸', 2025, '1080P', ['美食', '竞技'], '后厨如战场，这一季的对手是上一季的冠军。|第二季',
    [['xunlei', 'r4Jz03Kw']]],

  ['纪录片', '蓝色的星球', 2025, '4K', ['自然', '海洋', 'BBC'], '从海面到万米海沟，记录那些从未被拍到的生命。',
    [['uc', 's7Ka54Lx'], ['xunlei', 't2Lb96My']]],
  ['纪录片', '大地脉动', 2024, '4K', ['自然', '地理'], '四季更替之下，大陆深处仍在缓慢地呼吸。',
    [['guangya', 'u6Mc7'], ['uc', 'v3Nd28Oz']]],
]

const PLATFORM_LABEL = { uc: 'UC', xunlei: '迅雷', guangya: '光鸭', quark: '夸克', guangya2: '光鸭' }
const CODE_PARAM = { guangya: 'code' }
function baseUrl(platform, id) {
  if (platform === 'uc') return `https://drive.uc.cn/s/${id}`
  if (platform === 'xunlei') return `https://pan.xunlei.com/s/${id}`
  if (platform === 'guangya') return `https://www.guangyapan.com/s/${id}`
  if (platform === 'quark') return `https://pan.quark.cn/s/${id}`
  return `https://example.com/${id}`
}
function withCode(url, pwd, platform) {
  const key = CODE_PARAM[platform] || 'pwd'
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(pwd)}`
}
function hue(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** 生成一张自绘海报 SVG */
function posterSVG(title, year, quality, tags) {
  const h = hue(title)
  const h2 = (h + 42) % 360
  const chars = [...title]
  const lines = []
  const per = chars.length > 6 ? 4 : chars.length
  for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''))
  const lineH = 74
  const startY = 300 - (lines.length - 1) * lineH / 2
  const titleTspans = lines.map((l, i) =>
    `<text x="46" y="${startY + i * lineH}" font-size="62" font-weight="800" fill="#fff" letter-spacing="2">${esc(l)}</text>`
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h} 48% 26%)"/>
      <stop offset="0.55" stop-color="hsl(${h2} 40% 15%)"/>
      <stop offset="1" stop-color="#0e0f13"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.75" cy="0.2" r="0.8">
      <stop offset="0" stop-color="hsl(${h2} 85% 60%)" stop-opacity="0.45"/>
      <stop offset="1" stop-color="hsl(${h2} 85% 60%)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shade" x1="0" y1="0.35" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#bg)"/>
  <rect width="400" height="600" fill="url(#glow)"/>
  <g opacity="0.16" stroke="#fff" stroke-width="1">
    <circle cx="320" cy="150" r="86" fill="none"/>
    <circle cx="320" cy="150" r="130" fill="none" opacity="0.6"/>
    <circle cx="320" cy="150" r="180" fill="none" opacity="0.35"/>
  </g>
  <rect width="400" height="600" fill="url(#shade)"/>
  <text x="46" y="118" font-size="17" fill="hsl(${h2} 90% 72%)" letter-spacing="6" font-family="sans-serif">V · 影视</text>
  ${titleTspans}
  <text x="46" y="470" font-size="20" fill="rgba(255,255,255,.75)" font-family="sans-serif">${esc(year)} · ${esc(quality)}</text>
  <text x="46" y="510" font-size="16" fill="rgba(255,255,255,.5)" font-family="sans-serif">${esc((tags || []).join(' / '))}</text>
  <rect x="46" y="536" width="72" height="26" rx="13" fill="rgba(255,255,255,.14)"/>
  <text x="82" y="554" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif">示例</text>
</svg>`
}

function demoItems() {
  const items = []
  for (const [type, title, year, quality, tags, desc, links] of DEMO) {
    let [descText, badge] = String(desc).split('|')
    const id = sha1('demo|' + title).slice(0, 12)
    const ls = links.map(([p, pid, pwdIn]) => {
      const raw = baseUrl(p, pid)
      const pwd = pwdIn || null
      return { platform: p, url: pwd ? withCode(raw, pwd, p) : raw, pwd }
    })
    items.push({
      id, title, subtitle: badge ? `${year} · ${badge}` : `${year} · ${quality}`, type, year, quality,
      tags, desc: descText.trim(), poster: `assets/posters/${id}.svg`,
      category: 'movies', categoryLabel: '影视',
      date: null, month: null, links: ls, demo: true,
    })
  }
  return items
}

function main() {
  if (!fs.existsSync(DATA)) { console.error('先跑 scripts/build-index.mjs 生成 data/resources.json'); process.exit(1) }
  const doc = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  doc.items = (doc.items || []).filter(x => !x.demo)
  if (REMOVE) {
    doc.count = doc.items.length
    fs.writeFileSync(DATA, JSON.stringify(doc))
    console.log(`[seed-demo] 已移除示例数据，剩余 ${doc.count} 条`)
    return
  }
  // 生成海报
  fs.mkdirSync(POSTER_DIR, { recursive: true })
  for (const [type, title, year, quality, tags] of DEMO) {
    const id = sha1('demo|' + title).slice(0, 12)
    fs.writeFileSync(path.join(POSTER_DIR, `${id}.svg`), posterSVG(title, year, quality, tags))
  }
  const items = demoItems()
  items.sort((a, b) => (b.demo - a.demo))
  doc.items = [...items, ...doc.items]
  doc.items.forEach((it, i) => { it.i = i })
  doc.count = doc.items.length
  doc.updated = new Date().toISOString()
  fs.writeFileSync(DATA, JSON.stringify(doc))
  const search = doc.items.map(it => ({ i: it.i, t: it.title, g: (it.tags || []).join(' '), y: it.year || '', p: it.type }))
  fs.writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify(search))
  console.log(`[seed-demo] 写入 ${items.length} 条示例 + ${items.length} 张海报，总计 ${doc.count} 条`)
}

main()