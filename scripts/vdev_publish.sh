#!/bin/bash
# vdev_publish.sh — v.devmini.space 发布适配器（publisher skill 统一调用入口）
#
# 用法:
#   scripts/vdev_publish.sh --title "资源名" --link uc=https://drive.uc.cn/s/xxx \
#       [--link xunlei=...] [--link guangya=...] [--desc "..."] [--tags "a,b"] \
#       [--poster https://...] [--category movies] [--push] [--dry-run]
#
# 站点目录优先取 $VDEV_SITE_DIR，否则用脚本自身所在仓库。
set -euo pipefail
SITE_DIR="${VDEV_SITE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
exec node "$SITE_DIR/scripts/publish.mjs" "$@"