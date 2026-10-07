# v.devmini.space · V影视

影视资源网盘分享链接聚合站（静态站点，GitHub Pages 部署）。

- 仿 泥视频（nivod.cc）前端风格，深色影院 UI
- 聚合 **UC 网盘 / 迅雷网盘 / 光鸭网盘 / 夸克网盘** 等分享链接
- 用户搜索 → 详情页 → 转存到自己的网盘 → 下载观看
- **不提供在线播放**，不存储任何影视文件

## 目录结构

```
├── index.html              首页（列表 + 搜索 + 筛选）
├── detail.html             详情页（?id=）
├── support.html            使用说明
├── CNAME                   自定义域名 v.devmini.space
├── assets/
│   ├── css/style.css
│   ├── js/app.js           首页逻辑
│   └── js/detail.js        详情页逻辑
├── data/
│   ├── resources.json      资源索引（构建产物，勿手改）
│   └── search-index.json   精简搜索索引
└── scripts/
    ├── build-index.mjs     从内容仓库构建索引
    └── publish.mjs         一键发布单个资源
```

## 构建索引

扫描 `mswnlz/*/20*.md` 内容仓库，可选合并已有聚合种子：

```bash
node scripts/build-index.mjs \
  --content-root ../../mswnlz \
  --seed ../../xi7ang.github.io/docs/public/data/resources.json
```

## 一键发布（供网盘 publisher skill 调用）

```bash
# 结构化 JSON
node scripts/publish.mjs --json /tmp/resource.json

# 命令行
node scripts/publish.mjs --title "示例电影 (2026)" \
  --link "uc=https://drive.uc.cn/s/xxxx" \
  --link "xunlei=https://pan.xunlei.com/s/yyyy" \
  --tags "4K,悬疑" --desc "简介" --poster "https://..." --push
```

幂等：同标题（规范化后）合并，同 URL 去重；重复发布不会产生重复条目。

## 接口约定（publisher → 站点）

| 平台 | platform 值 | 示例链接 |
|------|-------------|----------|
| UC 网盘 | `uc` | `https://drive.uc.cn/s/xxxx` |
| 迅雷网盘 | `xunlei` | `https://pan.xunlei.com/s/xxxx` |
| 光鸭网盘 | `guangya` | `https://www.guanggapan.com/s/xxxx` |
| 夸克网盘 | `quark` | `https://pan.quark.cn/s/xxxx?pwd=yyy` |

## 部署

GitHub Pages，`main` 分支根目录发布，自定义域名 `v.devmini.space`（`CNAME` 文件）。
DNS 需添加：`CNAME  v  →  xi7ang.github.io`。

## 免责声明

本站仅收集、整理公开网盘分享链接，不存储、不提供任何影视资源与在线播放服务；版权归原作者所有。