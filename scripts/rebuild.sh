#!/bin/bash
# rebuild.sh — 重建资源索引并推送，触发 GitHub Pages 更新。
# 供网盘 publisher skill 在发布完成后调用（等价于旧站的 trigger_site_rebuild.sh）。
set -euo pipefail
cd "$(dirname "$0")/.."

CONTENT_ROOT="${CONTENT_ROOT:-../../mswnlz}"
SEED="${SEED:-../../xi7ang.github.io/docs/public/data/resources.json}"

node scripts/build-index.mjs --content-root "$CONTENT_ROOT" ${SEED:+--seed "$SEED"}

git add data/resources.json data/search-index.json
if git diff --cached --quiet; then
  echo "[rebuild] 数据无变化，无需提交"
else
  git commit -m "chore: rebuild resource index ($(date +%Y-%m-%d\ %H:%M))"
  git push origin HEAD
  echo "[rebuild] 已推送，GitHub Pages 将自动重新发布"
fi