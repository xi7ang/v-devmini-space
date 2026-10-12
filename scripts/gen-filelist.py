#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/gen-filelist.py — 生成详情页「资源列表」数据（仅 UC）

对 public/data/resources.json 每条资源，取**UC 分享链接**，调用 UC 分享的文件列表接口，
递归列出分享内的文件，**只保留视频文件**（按文件扩展名判定），文件名**按名称排序**，
结果写到 public/data/filelist.json（按资源 id 索引）。

用户口径（2026-10-12）：
  - 只使用 UC 网盘的文件列表能力，**不使用迅雷**（迅雷 check 只给顶层，列不全）；
  - 列表里**过滤掉非视频文件**（.exe/.pdf/.torrent 之类一律不出现在前端）。

为什么离线生成、不在浏览器里实时拉：
  UC 分享接口没有给第三方的 CORS 头，站点又是纯静态（GitHub Pages），
  浏览器直接 fetch 必被拦；cookie 也不该下发到前端。所以只能构建期生成、随站点一起发布。

用法：
  python3 scripts/gen-filelist.py                 # 全量生成
  python3 scripts/gen-filelist.py --only <id>     # 只跑一条（调试）
  python3 scripts/gen-filelist.py --push          # 生成后 npm run build + commit + push
数据新鲜度：file list 会随后续集数更新变化，发布/巡检流程里定期重跑本脚本即可。
"""
from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # v-devmini-space
WS = ROOT.parent.parent                                 # /root/.openclaw/workspace
RES = ROOT / "public" / "data" / "resources.json"
OUT = ROOT / "public" / "data" / "filelist.json"
UC_DIR = WS / "skills" / "uc-pan-publisher" / "UcPanTool"
UC_COOKIE = UC_DIR / "config" / "cookies.txt"

TIMEOUT = 30
MAX_DEPTH = 3          # 递归层数上限，防病态目录树

# 视频扩展名（其余一律过滤掉，不进入列表）
VIDEO_EXT = {
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "ts", "m4v", "rmvb", "rm",
    "webm", "mpg", "mpeg", "m2ts", "mts", "3gp", "m3u8", "vob", "f4v",
    "asf", "ogv", "divx", "rmhd", "mp4v", "mkv3d",
}


def ext_of(name: str) -> str:
    m = re.search(r"\.([A-Za-z0-9]{1,6})$", name or "")
    return m.group(1).lower() if m else ""


def detect_platform(url: str) -> str:
    u = (url or "").lower()
    if "drive.uc.cn" in u or "fast.uc.cn" in u:
        return "uc"
    if "xunlei.com" in u:
        return "xunlei"
    if "quark.cn" in u:
        return "quark"
    if "guangyapan.com" in u:
        return "guangya"
    return "unknown"


def natkey(name: str):
    """自然序：第2集排在第10集前面。"""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name or "")]


def _uc_files(url: str) -> tuple[list[dict], str]:
    """递归列出 UC 分享内所有文件。返回 (files, err)。"""
    import httpx, importlib
    if str(UC_DIR) not in sys.path:
        sys.path.insert(0, str(UC_DIR))
    uc = importlib.import_module("uc")
    pwd_id = uc.UcPanFileManager.get_pwd_id(url)
    m = re.search(r"[?&](?:pwd|code)=([^&#\s]+)", url or "")
    passcode = m.group(1) if m else ""
    cookie = UC_COOKIE.read_text(encoding="utf-8").strip()
    headers = {"user-agent": uc.UC_USER_AGENT, "origin": uc.UC_REFERER,
               "referer": uc.UC_REFERER, "accept": "application/json, text/plain, */*",
               "accept-language": "zh-CN,zh;q=0.9",
               "content-type": "application/json;charset=UTF-8", "cookie": cookie}
    params = {"pr": uc.UC_PR, "fr": "pc", "uc_param_str": "",
              "__dt": random.randint(100, 9999), "__t": str(int(time.time() * 1000))}
    c = httpx.Client(timeout=TIMEOUT, headers=headers)
    j = c.post(f"{uc.UC_API_BASE}/share/sharepage/token",
               json={"pwd_id": pwd_id, "passcode": passcode}, params=params).json()
    stoken = (j.get("data") or {}).get("stoken")
    if not stoken:
        return [], f"token 失败: {j.get('message') or j.get('status')}"

    files: list[dict] = []
    detail_err = ""

    def walk(pdir_fid: str, prefix: str, depth: int):
        nonlocal detail_err
        if depth > MAX_DEPTH:
            return
        dp = dict(params)
        dp.update({"pwd_id": pwd_id, "stoken": stoken, "pdir_fid": pdir_fid,
                   "force": "0", "_page": "1", "_size": "200",
                   "_sort": "file_type:asc,updated_at:desc"})
        r = c.get(f"{uc.UC_API_BASE}/share/sharepage/detail", params=dp).json()
        if r.get("status") != 200:
            detail_err = str(r.get("message") or r.get("status"))
            return
        for it in (r.get("data") or {}).get("list") or []:
            name = it.get("file_name") or ""
            if it.get("dir"):
                walk(it.get("fid", ""), (prefix + name + "/") if prefix else "", depth + 1)
            else:
                files.append({
                    "name": name,
                    "path": prefix + name,
                    "size": int(it.get("size") or 0),
                    "video": ext_of(name) in VIDEO_EXT,
                })

    walk("0", "", 1)
    return files, detail_err


def build_entry(item: dict) -> dict:
    """只用 UC；只留视频；按名称排序。"""
    links = item.get("links") or []
    if not links and item.get("url"):
        links = [{"platform": item.get("platform"), "url": item.get("url"), "pwd": item.get("pwd")}]
    uc_url = ""
    for l in links:
        if l and l.get("url") and (l.get("platform") == "uc" or detect_platform(l["url"]) == "uc"):
            uc_url = l["url"]
            break
    if not uc_url:
        return {"platform": None, "total": 0, "files": [], "error": "无 UC 链接"}

    try:
        all_files, err = _uc_files(uc_url)
    except Exception as e:  # noqa: BLE001
        return {"platform": "uc", "total": 0, "files": [],
                "error": f"{type(e).__name__}: {e}"}
    if err and not all_files:
        return {"platform": "uc", "total": 0, "files": [], "error": err}
    if not all_files:
        return {"platform": "uc", "total": 0, "files": [], "error": "分享内无文件或已失效"}

    videos = [f for f in all_files if f["video"]]
    videos.sort(key=lambda f: natkey(f["name"]))
    for f in videos:
        f.pop("video", None)  # 前端只显示视频，无需再带标记
    return {"platform": "uc", "total": len(videos), "files": videos}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="只处理指定资源 id")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    data = json.loads(RES.read_text(encoding="utf-8"))
    out: dict = {}
    if OUT.exists():
        try:
            out = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            out = {}
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")

    targets = [x for x in data if (not args.only or x.get("id") == args.only)]
    for i, item in enumerate(targets, 1):
        rid = item.get("id")
        if not rid:
            continue
        print(f"({i}/{len(targets)}) {rid} {item.get('title','')[:30]}")
        ent = build_entry(item)
        ent["generatedAt"] = now
        out[rid] = ent
        print(f"    -> {ent.get('platform')} total={ent['total']} err={ent.get('error') or '-'}")

    out["_generatedAt"] = now
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[DONE] wrote {OUT} ({OUT.stat().st_size} bytes, {len(targets)} resources)")

    if args.push:
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT), check=True)
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), check=True)
        subprocess.run(["git", "commit", "-m", "feat(详情页): 新增「资源列表」栏目（UC 文件列表，仅视频，按名称排序）"],
                       cwd=str(ROOT), check=True)
        subprocess.run(["git", "push"], cwd=str(ROOT), check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
