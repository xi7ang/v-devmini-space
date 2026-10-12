#!/usr/bin/env node
/**
 * scripts/gen-hot-keywords.js — 生成首页「热门搜索」关键词库
 *
 * 用户口径（2026-10-12）：热词库**只能包含 v 站已有的资源关键词**，站上搜不到的词不许出现；
 * 且要随资源更新**动态刷新**。本脚本从 public/data/resources.json 派生候选词：
 *   1) 资源名（剥年份 / 更至N集 / 画质标签）；
 *   2) 标题方括号里的标签词、以及 tags 字段；
 * 过滤掉画质/规格类（4K、1080P、HDR…）和过短/纯数字的词。
 *
 * 保留人工策展：已有的 hotKeywords.json 里**仍然能被站上资源命中**的词，原序保留在前；
 * 已被删掉的资源对应的旧词自动剔除。新派生的词按“资源新旧”追加在后。
 *
 * 兜底校验：每个写入的词都必须至少命中 1 条资源（否则丢弃）——与 scripts/validate.js 同口径。
 *
 * 用法：
 *   node scripts/gen-hot-keywords.js            # 生成
 *   node scripts/gen-hot-keywords.js --check    # 只校验，不写文件
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RES = path.join(ROOT, 'public', 'data', 'resources.json')
const HOT = path.join(ROOT, 'public', 'data', 'hotKeywords.json')
const MAX = 120

// 画质/规格类，不进热词（用户不会拿它当搜索词）
const GENERIC = new Set([
  '4k', '1080p', '720p', '2160p', 'hdr', 'h265', 'hevc', 'hd', '蓝光', 'bd',
  '国语', '中字', '中英双字', '字幕', '双字', '原声', '完整版', '高清',
])

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_·、,，。!！?？|/\\~`'"：:（）()\[\]【】]/g, '')

/** 从一条资源派生候选词（保持出现顺序） */
function candidatesOf(item) {
  const out = []
  const title = String(item.title || '')
  const brackets = [...title.matchAll(/[\[【]([^\]】]+)[\]】]/g)].map((m) => m[1])
  let name = title
    .replace(/[\[【][^\]】]*[\]】]/g, ' ')
    .replace(/[（(]\s*20\d{2}\s*[)）]/g, ' ')
    .replace(/更至\s*\d+\s*[集期]|更新至?\s*\d+\s*[集期]|全\s*\d+\s*集|超前完结|完结|第\s*[0-9一二三四五六七八九十]+\s*季/g, ' ')
    .replace(/[·、,，。!！?？|/\\~`'"：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (name) out.push(name)
  for (const b of brackets) for (const t of b.split(/[\/·、,，\s]+/)) out.push(t)
  for (const t of item.tags || []) out.push(String(t))
  return out.map((s) => s.trim()).filter(Boolean)
}

function keep(kw) {
  const k = kw.trim()
  if (k.length < 2) return false
  if (/^[\d\s.]+$/.test(k)) return false
  if (GENERIC.has(k.toLowerCase())) return false
  if (/^20\d{2}$/.test(k)) return false
  return true
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const items = JSON.parse(fs.readFileSync(RES, 'utf8'))

  // 每条资源的可命中文本（标题 + 标签，全部归一化）
  const hay = items.map((it) => norm([it.title, ...(it.tags || [])].join(' ')))
  const hit = (kw) => {
    const k = norm(kw)
    return k.length >= 2 && hay.some((h) => h.includes(k))
  }

  // 1) 人工策展里仍有效的词，原序保留
  let curated = []
  try {
    const old = JSON.parse(fs.readFileSync(HOT, 'utf8'))
    curated = (Array.isArray(old?.keywords) ? old.keywords : []).filter((k) => typeof k === 'string' && keep(k))
  } catch { /* 没有旧文件 */ }
  const dropped = curated.filter((k) => !hit(k))
  const kept = curated.filter((k) => hit(k))

  // 2) 从现有资源派生
  const seen = new Set(kept.map(norm))
  const derived = []
  const byNewest = [...items].sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')))
  for (const it of byNewest) {
    for (const c of candidatesOf(it)) {
      if (!keep(c) || !hit(c)) continue
      const n = norm(c)
      if (seen.has(n)) continue
      seen.add(n)
      derived.push(c)
    }
  }

  const keywords = [...kept, ...derived].slice(0, MAX)

  if (dropped.length) console.log(`[hot] 剔除失效词 ${dropped.length} 个（站上已无对应资源）: ${dropped.slice(0, 12).join(', ')}${dropped.length > 12 ? ' …' : ''}`)
  console.log(`[hot] 保留策展词 ${kept.length} | 新增派生词 ${derived.length} | 合计 ${keywords.length}`)

  if (checkOnly) return
  fs.writeFileSync(HOT, JSON.stringify({ keywords }, null, 2) + '\n')
  console.log(`[hot] wrote ${HOT}`)
}

main()
