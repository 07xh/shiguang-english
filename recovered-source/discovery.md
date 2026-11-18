# 信息收集 / 渗透探测记录

## 目标

获取两个 B 站 toy 应用（精听笔试、背单词）的作者原生源码，供改原生 app 使用。

## 一、短链解析

| 短链 | 落地页 |
|---|---|
| `https://b23.tv/cwjicWs` | `https://www.bilibili.com/toy/qDif2poHemIk0VJH/24227927458816-v53236/index.html` |
| `https://b23.tv/UTTjlrT` | `https://www.bilibili.com/toy/CL2Plz4HgDfed3Il/47033545129984-v53301/index.html` |

镜像源站：`https://www.bilibilitoy.com/toy/<token>/<version>/`

## 二、源站静态资源

### 精听应用（qDif2poHemIk0VJH）

| 资源 | URL | 大小 | Etag |
|---|---|---|---|
| 页面 | `/index.html` | 116,943 B | — |
| JS | `/js/bundle.js` | 1,575,855 B | `d2ca79a56df5543c491afa62929b869d` |
| CSS | `/css/bundle.css` | 1,164,634 B | — |
| 题库清单 | `/exams_manifest.js` | 70,012 B | — |
| SDK | `https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js` | 139,344 B | — |

`Last-Modified: Wed, 18 Nov 2026 14:24:42 GMT`

### 背单词应用（CL2Plz4HgDfed3Il）

| 资源 | 大小 |
|---|---|
| `assets/index-9yEgmxqS.js` | 598,989 B |
| `assets/index-BuaBEaJy.css` | 410,761 B |
| `assets/data-books-B15OUI3K.js` | 68,290 B |
| `assets/vendor-vue-BatMTeph.js` | 77,736 B |
| `assets/vendor-libs-BcgWARxX.js` | 25,653 B |

## 三、源码泄露探测结果

探测脚本：`research/probe_source.sh`

### Sourcemap（全部 404）

```
js/bundle.js.map       404
js/bundle.map          404
bundle.js.map          404
js/bundle.js.map.gz    404
js/app.js.map          404
js/main.js.map         404
js/index.js.map        404
static/js/bundle.js.map 404
assets/bundle.js.map   404
index-9yEgmxqS.js.map  404 (背单词)
index-BuaBEaJy.css.map  404 (背单词)
```

### 源码/备份/配置（全部 404）

```
bundle.js.bak / bundle.js.orig / bundle.js.old / bundle.js.txt
js/bundle.js.bak / js/app.js / js/main.js / js/index.js
src/ / source/ / app.js / main.js / index.js
webpack.config.js / package.json / README.md
index.html.bak / index.html.orig / index.html.txt
```

### Git / 隐藏文件

```
.git/HEAD          404
.git/config        412  ← B 站 WAF 拦截页（返回 HTML 错误页，非真实文件）
.git/index         412  ← 同上
.DS_Store          404
.env               404
config.js          404
deploy.sh          404
```

### 目录/元信息

```
bilibilitoyassets.top/          200 (3 B，空)
bilibilitoyassets.top/word_toy/ 403 (禁止列目录)
bilibilitoyassets.top/toy/      404
bilibilitoy.com/robots.txt      404
bilibilitoy.com/sitemap.xml     404
```

## 四、关键发现：bundle 即原生源码

精听应用 `bundle.js` 开头片段：

```javascript
/* === Bulletproof iOS WKWebView Cross-Origin Iframe Storage Engine === */
(function() {
    if (window.__toyLS && window.__toySS) return;
    function createSafeStorage(nativeName) {
        ...
```

内部按源文件边界标注：

```javascript
/* === js/daily_manifest.js === */
...
/* === js/audio_cache_db.js === */
...
/* === js/exam_loader.js === */
...
```

共 **41 个 JS 模块标记**。CSS 同样带 19 个模块标记：

```css
/* === css/base.css === */
/* === css/layout.css === */
/* === css/lobby_cards.css === */
...
```

这是作者按模块手写、拼接成单文件的原生源码，未经过 webpack/terser 混淆，变量名与注释完整保留。

## 五、还原方法

脚本：`research/restore_source.py`

- 用正则 `/\*\s*=+\s*((?:js|css)/[\w./-]+)\s*=+\s*\*/` 定位所有模块标记。
- 按标记位置将 bundle 切分为独立文件，标记之前的内容归为 `js/00_storage_engine.js`。
- 验证：还原后 JS 合计 1,575,677 B / 原始 1,575,855 B（差 178 B = 41 个标记注释长度）；CSS 合计 1,164,522 B / 原始 1,164,634 B（差 112 B = 19 个标记注释长度）。**无内容丢失**。

## 六、发现的 API 端点

从 bundle 源码中提取：

```javascript
https://bilibilitoyassets.top/api/user_data       // 用户数据同步
https://bilibilitoyassets.top/api/active_stats    // 活跃统计
https://bilibilitoyassets.top                     // 资源根
https://b23.tv/vmXUfYs                            // 充电入口（源于作者页面，独立 app 应移除）
```

## 七、跳转 B 站的真正根因（附带发现）

在 `index.html` 中发现顶层脚本：

```html
<script>
if(window.self===window.top){
  window.location.replace("https://www.bilibili.com/toy/qDif2poHemIk0VJH/24227927458816-v53236/index.html");
}
</script>
```

这是"点开 APK 就跳 B 站"的真正元凶：独立 app 中 `window.self === window.top` 成立，触发 `location.replace` 跳出。之前的 patch 只处理了 `bundle.js` 中 `openWordToyApp()` 的 `window.open` fallback，未处理这段内联脚本，所以验证仍显示 1 次 navigation。

修复方式：从 `index.html` 中删除该 `<script>` 块（或改为判断外部协议白名单后再放行）。
