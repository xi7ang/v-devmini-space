#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/check-links.py — v 站网盘分享链接巡检

对 public/data/resources.json 里 status != 'inactive' 的资源，逐条 links[] 用
**各网盘自己的分享校验接口**判断有效性。

⚠️ 为什么不用 HTTP HEAD 看状态码：失效的网盘分享页照样返回 200，探状态码只会
   得到一堆假「正常」。本脚本走平台接口，能真正区分「还在」和「已失效」。

⚠️ 误杀防护（2026-10-11 加，因为踩过）：
   平台校验接口会**瞬时抖动**（迅雷有 captcha 握手、UC/夸克会限流）。一次 false
   就把链接判死＝误下架。所以现在的规则是：
     1) 只有「定论性无效」（接口明确回『分享不存在/链接错误/invalid』）才算失效；
     2) 且必须**连续 ATTEMPTS 次**全部定论性无效，才判定 dead；
     3) 校验抛异常 / 非定论性失败（captcha、限流、超时、网络）→ 一律按「不确定」处理，
        **绝不下架**，只记进报告的 errors。

  uc      UcPanTool 分享接口 sharepage/token (pwd_id + passcode)
  quark   drive-pc.quark.cn sharepage/token (pwd_id + passcode)
  xunlei  `xunlei-pan check <url>`          (JSON success:true/false)
  guangya GuangyaClient.share_summary       (code==0 有效)

用法：
  python3 scripts/check-links.py                 巡检 + 出报告，不改数据
  python3 scripts/check-links.py --apply         失效项从 links[] 摘除并留档 deadLinks；全失效 → status=inactive
  python3 scripts/check-links.py --apply --push  随后 npm run build + git commit + push

退出码：0 = 全部完好或已处理；2 = 检出失效
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
WORKERS = 4
ATTEMPTS = 3            # 连续多少次「定论性无效」才判死
RETRY_WAIT = 6          # 重试间隔（秒）

QUARK_UA = ("Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/94.0.4606.71 Safari/537.36 Core/1.94.225.400 QQBrowser/12.2.5544.400")

# 「定论性无效」的特征词——命中才算数，其它一律视为抖动
INVALID_RE = re.compile(r"分享不存在|分享链接错误|链接失效|已失效|无效|不存在|"
                        r"share_id can not be empty|invalid_argument|not found|已删除|被删除")


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


def _pwd_of(url: str) -> str:
    m = re.search(r"[?&](?:pwd|code)=([^&#\s]+)", url or "")
    return m.group(1) if m else ""


# ── uc ────────────────────────────────────────────────────────────────
def _uc_check(url: str) -> tuple[bool, bool, str]:
    if str(UC_DIR) not in sys.path:
        sys.path.insert(0, str(UC_DIR))
    import importlib, httpx
    uc = importlib.import_module("uc")
    pwd_id = uc.UcPanFileManager.get_pwd_id(url)
    cookie = UC_COOKIE.read_text(encoding="utf-8").strip()
    headers = {"user-agent": uc.UC_USER_AGENT, "origin": uc.UC_REFERER, "referer": uc.UC_REFERER,
               "accept": "application/json, text/plain, */*",
               "accept-language": "zh-CN,zh;q=0.9",
               "content-type": "application/json;charset=UTF-8", "cookie": cookie}
    params = {"pr": uc.UC_PR, "fr": "pc", "uc_param_str": "",
              "__dt": random.randint(100, 9999), "__t": str(int(time.time() * 1000))}
    # 1) token
    r = httpx.post(f"{uc.UC_API_BASE}/share/sharepage/token",
                   json={"pwd_id": pwd_id, "passcode": _pwd_of(url)},
                   params=params, headers=headers, timeout=TIMEOUT)
    j = r.json()
    stoken = (j.get("data") or {}).get("stoken")
    if not stoken:
        msg = str(j.get("message", ""))
        return False, bool(INVALID_RE.search(msg)), msg or "token-failed"
    # 2) detail —— 关键：token 成功≠分享有效！已失效的分享照样发 stoken，
    #    真正的信号在 detail（失效时返回「分享地址已失效」）。
    dp = dict(params)
    dp.update({"pwd_id": pwd_id, "stoken": stoken, "pdir_fid": "0", "force": "0",
               "_page": "1", "_size": "50", "_sort": "file_type:asc,updated_at:desc"})
    r2 = httpx.get(f"{uc.UC_API_BASE}/share/sharepage/detail",
                   params=dp, headers=headers, timeout=TIMEOUT)
    j2 = r2.json()
    if j2.get("status") == 200:
        return True, True, "ok"
    msg = str(j2.get("message", ""))
    return False, bool(INVALID_RE.search(msg)), msg or "detail-failed"


# ── quark ─────────────────────────────────────────────────────────────
def _quark_cookie() -> str:
    raw = QUARK_COOKIE.read_text(encoding="utf-8").strip()
    if raw.startswith("["):
        arr = ast.literal_eval(raw)
        return "; ".join(f"{c['name']}={c['value']}" for c in arr if c.get("name"))
    return raw


def _quark_check(url: str) -> tuple[bool, bool, str]:
    import httpx
    pwd_id = url.split("?")[0].split("/s/")[-1]
    params = {"pr": "ucpro", "fr": "pc", "uc_param_str": "",
              "__dt": random.randint(100, 9999), "__t": str(int(time.time() * 1000))}
    headers = {"user-agent": QUARK_UA, "origin": "https://pan.quark.cn",
               "referer": "https://pan.quark.cn/", "accept-language": "zh-CN,zh;q=0.9",
               "cookie": _quark_cookie()}
    # 1) token
    r = httpx.post("https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token",
                   json={"pwd_id": pwd_id, "passcode": _pwd_of(url)},
                   params=params, headers=headers, timeout=TIMEOUT)
    j = r.json()
    stoken = (j.get("data") or {}).get("stoken")
    if not stoken:
        msg = str(j.get("message", ""))
        return False, bool(INVALID_RE.search(msg)), msg or "token-failed"
    # 2) detail —— 同 UC：token 成功≠有效，必须看 detail
    dp = dict(params)
    dp.update({"pwd_id": pwd_id, "stoken": stoken, "pdir_fid": "0", "force": "0",
               "_page": "1", "_size": "50", "_sort": "file_type:asc,updated_at:desc"})
    r2 = httpx.get("https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail",
                   params=dp, headers=headers, timeout=TIMEOUT)
    try:
        j2 = r2.json()
    except Exception:
        return False, False, "detail-non-json"
    if j2.get("status") == 200:
        return True, True, "ok"
    msg = str(j2.get("message", ""))
    return False, bool(INVALID_RE.search(msg)), msg or "detail-failed"


# ── xunlei ────────────────────────────────────────────────────────────
def _xunlei_check(url: str) -> tuple[bool, bool, str]:
    out = subprocess.run(["xunlei-pan", "check", url], capture_output=True, text=True,
                         timeout=TIMEOUT + 30)
    txt = out.stdout or ""
    m = re.search(r'"success"\s*:\s*(true|false)', txt)
    if not m:
        return False, False, "no-json-response"
    if m.group(1) == "true":
        return True, True, "ok"
    # success:false —— 只有明确「分享无效」才定论；captcha/网络类抖动一律不算
    return False, bool(INVALID_RE.search(txt)), "xunlei-invalid" if INVALID_RE.search(txt) else "xunlei-inconclusive"


# ── guangya ───────────────────────────────────────────────────────────
def _guangya_check(url: str) -> tuple[bool, bool, str]:
    if str(GX_SCRIPTS) not in sys.path:
        sys.path.insert(0, str(GX_SCRIPTS))
    import guangya_common
    key = guangya_common.extract_share_key(url)
    if not key:
        return False, False, "no-share-key"
    c = guangya_common.make_client()
    try:
        r = c.share_summary(key)
        if isinstance(r, dict) and r.get("code") == 0:
            return True, True, "ok"
        msg = str((r or {}).get("msg", "")) if isinstance(r, dict) else str(r)
        return False, bool(INVALID_RE.search(msg)), msg or "unknown"
    finally:
        try:
            c.close()
        except Exception:
            pass


CHECKERS = {"uc": _uc_check, "quark": _quark_check,
            "xunlei": _xunlei_check, "guangya": _guangya_check}


def check_link(link: dict) -> dict:
    """判定单个链接。dead=True 只有一种可能：连续 ATTEMPTS 次「定论性无效」。"""
    url = link.get("url") or ""
    plat = link.get("platform") or detect_platform(url)
    fn = CHECKERS.get(plat)
    if not fn:
        return {"platform": plat, "url": url, "dead": False, "reason": "unsupported"}

    last = ""
    for attempt in range(ATTEMPTS):
        try:
            ok, conclusive, detail = fn(url)
        except Exception as e:
            # 校验自身故障（cookie 失效 / 网络 / 超时）→ 不确定，绝不下架
            return {"platform": plat, "url": url, "dead": False,
                    "reason": f"error: {type(e).__name__}: {str(e)[:100]}"}
        if ok:
            return {"platform": plat, "url": url, "dead": False, "reason": "ok"}
        last = detail
        if not conclusive:
            # 非定论性失败（captcha/限流/抖动）→ 立即判「不确定」
            return {"platform": plat, "url": url, "dead": False,
                    "reason": f"inconclusive: {detail}"}
        if attempt < ATTEMPTS - 1:
            time.sleep(RETRY_WAIT * (attempt + 1))
    # 连续 ATTEMPTS 次定论性无效 → 判死
    return {"platform": plat, "url": url, "dead": True, "reason": last}


def main() -> int:
    apply_mode = "--apply" in sys.argv
    push = "--push" in sys.argv

    data = json.loads(RES.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("❌ resources.json 不是数组，中止"); return 1

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
            if res["dead"]:
                flag = "🔴失效"
            elif res["reason"].startswith(("error", "inconclusive")):
                flag = f"⚠️ {res['reason'][:40]}"
            else:
                flag = "🟢"
            print(f"  [{i+1}/{len(targets)}] {l.get('platform')} {flag} {res['url'][:70]}")

    dead_total = sum(1 for v in results.values() for x in v if x["dead"])
    unc_total = sum(1 for v in results.values() for x in v
                    if x["reason"].startswith(("error", "inconclusive")))

    report = {
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "resources": sum(1 for r in data if r.get("status") != "inactive"),
        "links": len(targets),
        "dead": dead_total,
        "uncertain": unc_total,
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

    # 数据变动后顺带刷新详情页「资源列表」（UC 文件列表）；失败不阻断发布
    fl_changed = False
    if apply_mode:
        fl = ROOT / "public" / "data" / "filelist.json"
        before = fl.read_bytes() if fl.exists() else b""
        try:
            subprocess.run([sys.executable, str(ROOT / "scripts" / "gen-filelist.py")],
                           cwd=str(ROOT), check=True)
        except Exception as e:  # noqa: BLE001
            print(f"⚠️ gen-filelist 刷新失败（不阻断发布）: {e}")
        after = fl.read_bytes() if fl.exists() else b""
        fl_changed = before != after
        print(f"🗂 资源列表刷新：{'已更新' if fl_changed else '无变化'}")

    if push and (changed or fl_changed):
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT), check=True)
        subprocess.run(["git", "add", "-A"], cwd=str(ROOT), check=True)
        msg = (f"chore(links): 巡检下架失效网盘链接（{changed} 条资源）" if changed
               else "chore(filelist): 刷新详情页「资源列表」数据")
        subprocess.run(["git", "commit", "-m", msg], cwd=str(ROOT), check=True)
        subprocess.run(["git", "push"], cwd=str(ROOT), check=True)
        print("🚀 已 build + commit + push")

    print(f"📄 汇总：链接 {len(targets)} | 失效 {dead_total} | 不确定 {unc_total}")
    return 2 if dead_total else 0


if __name__ == "__main__":
    sys.exit(main())
