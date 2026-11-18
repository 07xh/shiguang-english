# 拾光英语 — 作者原生源码还原工程

通过信息收集 + 源站资源分析，从两个 B 站 toy 应用中还原出的原生源码工程。

## 两个应用

| 应用 | 源站 token | 技术栈 | 还原方式 | 源码质量 |
|---|---|---|---|---|
| 精听/笔试 | `qDif2poHemIk0VJH` | 原生 JS，无框架、无构建 | bundle 内含 41 个 `/* === js/xxx.js === */` 模块标记，1:1 切分回独立文件 | **未压缩、带完整注释与变量名 = 原生源码** |
| 背单词 | `CL2Plz4HgDfed3Il` | Vue 3 + Vite | ES module chunk，按模块边界还原 | 压缩产物（变量单字母），无 sourcemap |

## 信息收集过程与结论

1. **短链解析**：`b23.tv/cwjicWs` → 精听应用；`b23.tv/UTTjlrT` → 背单词应用。
2. **源站定位**：`https://www.bilibilitoy.com/toy/<token>/<version>/`，资源 CDN `https://bilibilitoyassets.top/`。
3. **gzip 修正**：源站 JS/CSS 返回 gzip 但未声明 Content-Encoding，需手动解压（已修复）。
4. **穿透探测**：
   - `bundle.js.map` / `*.js.map` / `*.css.map` → 全部 **404**（无 sourcemap）。
   - `.git/HEAD` / `.git/config` / `package.json` / `*.bak` / `src/` → 全部 **404**（`.git/config` 的 412 是 WAF 拦截页，非真实文件）。
   - CDN 目录列表 → **403**（禁止枚举）。
   - `robots.txt` / `sitemap.xml` → **404**。
5. **关键突破**：精听应用 `bundle.js`（1,575,855 B，Etag `d2ca79a56df5543c491afa62929b869d`，Last-Modified `2026-11-18 14:24 GMT`）**不是打包压缩产物**，而是作者按模块拼接的未压缩源码，保留了完整的源文件边界注释。据此 1:1 还原出原始工程结构。

## 目录结构

```
recovered-source/
├── README.md                 本说明
├── discovery.md              信息收集完整记录（URL、探测结果、API）
├── jingting/                 精听/笔试 — 原生源码（41 JS + 19 CSS 模块）
│   ├── README.md             工程结构与改造提示
│   ├── index.html            原始页面
│   ├── js/                   41 个原生源文件
│   └── css/                  19 个原生源文件
└── beici/                    背单词 — Vue/Vite 模块
    ├── index.html            原始页面
    └── src/                  5 个 ES module chunk
```

## 数据层 API（改原生 app 时对接或替换）

| 端点 | 用途 |
|---|---|
| `https://bilibilitoyassets.top/api/user_data` | 用户学习数据云同步（GET/POST） |
| `https://bilibilitoyassets.top/api/active_stats` | 今日活跃人数/排名统计 |
| `https://bilibilitoyassets.top/` | 音频、图片、字体资源根 |

## 给 GPT 改原生 app 的要点

- 精听应用源码是**浏览器端原生 JS**（无框架、无构建），依赖 `document` / `window` / `localStorage` / `Web Speech API` / `toy-sdk`。
- 改 React Native / Flutter / uni-app 时：
  - **可直接移植**：听写判分算法（`dictation_lexer.js`）、CRDT 数据序列化（`toy_crdt_serializer.js`）、学习计划与习惯养成（`habit_streak.js` / `home_calendar.js`）、词库解析（`dictionary.js`）、阅读判分（`written_proofread.js` / `written_subjective.js`）。
  - **需重写为平台组件**：所有 DOM 渲染层（各 `ui_*.js` / `*_renderer.js`）。
  - **可移除/替换**：`toy_sdk.js` / `toy_lifecycle.js` / `toy_permissions.js` / `orientation_manager.js`（B 站宿主桥接层）。
- 背单词应用源码为压缩 ES module，变量无语义；建议以精听工程为主重构，词库数据（`data-books` 模块）可提取复用。
