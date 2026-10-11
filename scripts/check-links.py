#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/check-links.py — v 站网盘分享链接巡检

对 public/data/resources.json 里 status != 'inactive' 的资源，逐条 links[] 用
**各网盘自己的分享校验接口**判断有效性。

⚠️ 为什么不用 HTTP HEAD 看状态码：失效的网盘分享页照样返回 200，探状态码只会
   得到一堆假「正常」。本脚本走平台接口，能真正区分「还在」和「已失效」。

  uc      UcPanTool sharepage/token    (pwd_id + passcode)
  quark   drive-pc.quark.cn sharepage/token (pwd_id + passcode)
  xunlei  `xunlei-pan check <url>`     (JSON success:true/false)
  guangya GuangyaClient.share_summary  (code==0 为有效)

用法：
  python3 scripts/check-links.py                 巡检 + 出报告，不改数据
  python3 scripts/check-links.py --apply         失效项从 links[] 摘除并留档 deadLinks；全失效 → status=inactive
  python3 scripts/check-links.py --apply --push  随后 npm run build + git commit + push

退出码：0 = 全部完好或已处理；2 = 检出失效（供外部/调度器判断）
"""
from __future__ import annotations
import ast
import json
import os
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # v-devmini-space
WS = ROOT.parent.parent                                 # /root/.openclaw/workspace
RES = ROOT / "public" / "data" / "resources.json"
REPORT = ROOT / "public" / "data" / "link-report.json"

UC_DIR = WS / "skills" / "uc-pan-publisher" / "UcPanTool"
UC_COOKIE = UC_DIR / "config" / "cookies.txt"
QUARK_COOKIE = WS / "QuarkPanTool" / "config" / "cookies.txt"
GX_SCRIPTS = WS / "skills" / "guangya-publisher" / "scripts"

TIMEOUT = 30
WORKERS = 6

QUARK_UA = ("Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/94.0.4606.71 Safari/537.36 Core/1.94.225.400 QQBrowser/12.2.5544.400")


# ── 平台识别 ──────────────────────────────────────────────────────────
def detect_platform(url: str) -> str:
    u = (url or "").lower()
    if "drive.uc.cn" in u or "fast.uc.cn" in u:
        return "uc"
    if "pan.quark.cn" in u or "quark.cn" in u:
        return "quark"
    if "xunlei.com" in u:
        return "xunlei"
    if "guangyapan.com" in u:
        return "guangya"
    return "unknown"


# ── uc ────────────────────────────────────────────────────────────────
def _uc_check(url: str) -> bool:
    """返回 True=有效。用 UcPanTool 的 sharepage/token 接口。"""
    if str(UC_DIR) not in sys.path:
        sys.path.insert(0, str(UC_DIR))
    import importlib, asyncio
    uc = importlib.import_module("uc")
    pwd_id = uc.UcPanFileManager.get_pwd_id(url)

    async def _run():
        # headless=True：cookie 失效时立即抛错，绝不启动浏览器（cron 无交互环境）
        mgr = uc.UcPanFileManager(headless=True)
        return await mgr.get_stoken(pwd_id)
    return bool(asyncio.run(_run()))


# ── quark ─────────────────────────────────────────────────────────────
def _quark_cookie() -> str:
    raw = QUARK_COOKIE.read_text(encoding="utf-8").strip()
    if raw.startswith("["):
        arr = ast.literal_eval(raw)
        return "; ".join(f"{c['name']}={c['value']}" for c in arr if c.get("name"))
    return raw


def _quark_check(url: str) -> bool:
    import httpx
    pwd_id = url.split("?")[0].split("/s/")[-1]
    m = re.search(r"[?&](?:pwd|code)=([^&#\s]+)", url)
    passcode = m.group(1) if m else ""
    params = {"pr": "ucpro", "fr": "pc", "uc_param_str": "",
              "__dt": random.randint(100, 9999), "__t": str(int(time.time() * 1000))}
    headers = {"user-agent": QUARK_UA, "origin": "https://pan.quark.cn",
               "referer": "https://pan.quark.cn/", "accept-language": "zh-CN,zh;q=0.9",
               "cookie": _quark_cookie()}
    r = httpx.post("https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token",
                   json={"pwd_id": pwd_id, "passcode": passcode},
                   params=params, headers=headers, timeout=TIMEOUT)
    j = r.json()
    return bool((j.get("data") or {}).get("stoken"))


# ── xunlei ────────────────────────────────────────────────────────────
def _xunlei_check(url: str) -> bool:
    """`xunlei-pan check` 输出前有一段 captcha 噪声，用正则取 success 字段。"""
    out = subprocess.run(["xunlei-pan", "check", url], capture_output=True, text=True,
                         timeout=TIMEOUT + 30)
    txt = out.stdout or ""
    m = re.search(r'"success"\s*:\s*(true|false)', txt)
    return bool(m and m.group(1) == "true")


# ── guangya ───────────────────────────────────────────────────────────
def _guangya_check(url: str) -> bool:
    sys.path.insert(0, str(GX_SCRIPTS))
    import guangya_common
    key = guangya_common.extract_share_key(url)
    if not key:
        return False
    c = guangya_common.make_client()
    try:
        r = c.share_summary(key)
        return isinstance(r, dict) and r.get("code") == 0
    except Exception:
        return False
    finally:
        try:
            c.close()
        except Exception:
            pass


CHECKERS = {"uc": _uc_check, "quark": _quark_check,
            "xunlei": _xunlei_check, "guangya": _guangya_check}


def check_link(link: dict) -> dict:
    url = link.get("url") or ""
    plat = link.get("platform") or detect_platform(url)
    fn = CHECKERS.get(plat)
    if not fn:
        return {"platform": plat, "url": url, "dead": False, "reason": "unsupported"}
    try:
        ok = fn(url)
        return {"platform": plat, "url": url, "dead": not ok,
                "reason": "ok" if ok else "invalid"}
    except Exception as e:
        # 校验本身失败（网络/cookie/token 问题）不算「失效」，避免误下架
        return {"platform": plat, "url": url, "dead": False,
                "reason": f"error: {type(e).__name__}: {str(e)[:120]}"}


def main() -> int:
    apply_mode = "--apply" in sys.argv
    push = "--push" in sys.argv

    data = json.loads(RES.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("❌ resources.json 不是数组，中止"); return 1

    # 收集待检任务
    targets = []
    for r in data:
        if r.get("status") == "inactive":
            continue
        links = r.get("links") or ([{"platform": r.get("platform"), "url": r.get("url"), "pwd": r.get("pwd")}]
                                    if r.get("url") else [])
        for l in links:
            if l and l.get("url"):
                targets.append((r["id"], l))

    print(f"🔍 待检资源 {sum(1 for r in data if r.get('status') != 'inactive')} 条 / 链接 {len(targets)} 个")
    if not targets:
        print("✅ 无可检链接"); return 0

    results = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(check_link, l): (rid, l) for rid, l in targets}
        for i, fut in enumerate(futs):
            rid, l = futs[fut]
            res = fut.result()
            results.setdefault(rid, []).append(res)
            flag = "🔴失效" if res["dead"] else ("⚠️ " + res["reason"] if res["reason"].startswith("error") else "🟢")
            print(f"  [{i+1}/{len(targets)}] {l.get('platform')} {flag} {res['url'][:70]}")

    dead_total = sum(1 for v in results.values() for x in v if x["dead"])
    err_total = sum(1 for v in results.values() for x in v if x["reason"].startswith("error"))

    # 报告
    report = {
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "resources": len([r for r in data if r.get("status") != "inactive"]),
        "links": len(targets),
        "dead": dead_total,
        "errors": err_total,
        "deadLinks": [{"id": rid, **x} for rid, v in results.items() for x in v if x["dead"]],
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    changed = 0
    if apply_mode and dead_total:
        for r in data:
            v = results.get(r.get("id"))
            if not v:
                continue
            dead_urls = {x["url"] for x in v if x["dead"]}
            if not dead_urls:
                continue
            keep, drop = [], []
            for l in (r.get("links") or []):
                (drop if l.get("url") in dead_urls else keep).append(l)
            if drop:
                r.setdefault("deadLinks", [])
                r["deadLinks"].extend(drop)
                r["links"] = keep
                if keep:
                    r["platform"], r["url"] = keep[0]["platform"], keep[0]["url"]
                    r["pwd"] = keep[0].get("pwd")
                else:
                    r["status"] = "inactive"
                r["updatedAt"] = time.strftime("%Y-%m-%d")
                changed += 1
        RES.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"🩹 已处理 {changed} 条资源（失效链接移入 deadLinks，全失效则置 inactive）")

    if push and changed:
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT), check=True)
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), check=True)
        subprocess.run(["git", "commit", "-m",
                        f"chore(links): 巡检下架失效网盘链接（{changed} 条资源）"],
                       cwd=str(ROOT), check=True)
        subprocess.run(["git", "push"], cwd=str(ROOT), check=True)
        print("🚀 已 build + commit + push")

    print(f"📄 汇总：链接 {len(targets)} | 失效 {dead_total} | 校验异常 {err_total}")
    return 2 if dead_total else 0


if __name__ == "__main__":
    sys.exit(main())
