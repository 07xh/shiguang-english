# 拾光英语 · 原生 UI / 交互对照（2026-11-19）

对照仓库 `recovered-source/jingting/index.html` 及 `css/{base,home_hero_dashboard,home_calendar,home_modules,home_tabbar,lobby_cards,quiz,dictation,written}.css`。

## 已重建的原生 Compose 部分

| 原版结构 | Android 原生实现 | 验收状态 |
|---|---|---|
| `home-hero-cover` 自然风景 | 复用同一张已确认授权的 JPG，原生裁剪和渐变 | 代码完成，待视觉实测 |
| `home-bottom-sheet` | 上浮白色圆角面板与拉手 | 代码完成 |
| `home-calendar-section` | 周历、月历、日期选择、前后月 | 代码完成；未接入每日学习事件 |
| `training-mode-switcher` | 笔试/听力/逐句精听三段切换 | 代码完成 |
| `capsule-module-card` | 大学英语分类小卡，四级、六级、雅思、考研 | 代码完成，已排除高考 |
| `home-tabbar` | 首页/统计双按钮悬浮导航；练习页隐藏 | 代码完成，模糊视觉尚非逐像素复刻 |
| `lobby-level-pills-bar` + `exam-grid` | 模式、级别、年份、试卷网格 | 代码完成；缺失资源不可开始 |
| `quiz-card-top-bar` | NO. 序号、Section、题目索引抽屉 | 代码完成 |
| `quiz-stage-card` | 题干、选项、练习/考试模式、解析 | 基础题型完成，复杂类型待逐类验证 |
| `written-split-container` | 手机纵排、宽屏原文与题目双列 | 代码完成，未真机验证 |
| `bottom-nav-bar` | 固定上一题/答题卡/下一题、上一句/选句/下一句 | 代码完成 |
| `dict-hero-sentence` | 句内流式文本、多空输入，不再拆成独立卡片 | 代码完成 |
| `dict-virtual-keyboard` | 26 键、系统输入法切换、上下空、退格 | 基础完成；长按待迁移 |
| `dict-floating-island` | 重听/播放/倍速/提示/答案 | 基础完成；原声时间轴待验证 |

## 尚未等价

真实排行榜、打卡、云端同步、查词、复杂滑动动效、键盘长按退格、匹配题与改错题的原站特殊判定、媒体全屏时间轴。完整 231 套资源上一轮下载到 105 套时超过 1550 MiB 上限，而且部分原站 MP3 无法验证，完整版未构建成功。手机/平板真机视觉及交互尚未测试。

## 安装包

- `Native Android (Compose)`：仅原生工程和少量示例题，不含完整原版资源。
- `University Native Starter APK`：抽检并打包四级、六级、雅思、考研各一套原版 JSON/相应 MP3，校验失败则不会发布。
- `University English Full Offline APK`：仅在 231 套资源全部核验后上传，不能因下载超限取消质量门禁。

注意：所有界面由 Kotlin/Compose 构建，不嵌入原版 WebView；原版 JS/CSS 作为授权范围内的交互参考。
