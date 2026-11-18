# 拾光英语 · 大学英语学习平台

手机 / 平板 / 网页三端可用的英语学习 App。参考 B 站「英语精听与历年真题」「背什么背」两个 Toy 应用的页面风格复刻，**全站功能免费，无付费墙**。

## 两个版本的区别

| 版本 | 目录 | APK | 说明 |
|---|---|---|---|
| **原版（100% 源码复刻）** | `shiguang-original/` | [shiguang-original.apk](https://github.com/07xh/shiguang-english/raw/main/shiguang-original.apk) | 原封不动使用源应用导出的 bundle.js（1.57MB）、bundle.css（1.16MB）、toy-sdk.js、真题清单与全部图片，**未重写一行源码**。功能 / 页面 / 交互与视频中的原应用一致（日历签到、学习复盘、练习构成、每日刷题、笔试/听力/逐句精听、听力真题列表等）。部分在线数据接口（用户数据、活跃统计）仍指向源站，离线时走本地兜底。 |
| **重写版（参考截图实现）** | `shiguang-app/` | [app-debug.apk](https://github.com/07xh/shiguang-english/raw/main/app-debug.apk) | 参照两张截图独立重写的近似版，代码自主可控、全站免费、无外部 API 依赖。页面结构与原应用相似但非逐行复刻。 |

## 直接下载安装（无需编译）

- **Android APK（v1.0）**：[点此下载 app-debug.apk](https://github.com/07xh/shiguang-english/raw/main/app-debug.apk)
  - 手机 / 平板下载后直接安装（需允许「安装未知来源应用」）
  - 最小支持 Android 5.1（API 22），目标 Android 14（API 34）

## 功能

| 模块 | 内容 |
|---|---|
| 首页 | 云层头图、欢迎语、一周日期条、今日排名 / 连续打卡 / 学习时长、笔试特训 / 听力特训 / 逐句精听分段、精听卡片 |
| 学习复盘 | 周 / 月 / 全部切换、刷题总数、连续天数、学习天数 / 正确率 / 时长、每日刷题柱状图、练习构成 |
| 听力真题 | CET-4 / CET-6 / 考研 / 雅思，共 231 套目录，按年份筛选 |
| 逐句精听 | 播放 / 暂停、倍速、英美音切换、挖空显示原文、双语对照，Web Speech 朗读 |
| 背单词 | 9 类词书、卡片翻释义、认识 / 不认识分组、朗读 |
| 全真模考 | 10 题抽题、逐题解析、即时计分 |
| 我的 | 昵称、口音、双语开关、签到、数据清空 |

数据全部存本机 `localStorage`，无需账号、无后端、无网络依赖。

## 目录结构

```
shiguang-app/
├── www/                     # Web 应用（同时用于 Capacitor 与 PWA）
│   ├── index.html
│   ├── manifest.webmanifest # PWA 安装配置
│   ├── sw.js                # Service Worker（离线缓存）
│   ├── css/style.css
│   ├── js/{app,store,data-exams,data-books,data-words}.js
│   └── icons/               # 各尺寸图标
├── android/                 # Capacitor 生成的 Android 工程
├── capacitor.config.json
├── package.json
└── README.md
```

## 构建 Android APK

环境要求：JDK 17、Android SDK（platform 33+、build-tools）。

```powershell
cd shiguang-app
npm install
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

装到手机 / 平板：

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## 作为 PWA 安装（无需 APK）

把 `www/` 部署到任意静态服务器（或 GitHub Pages），手机 / 平板浏览器打开后：

- Android Chrome：菜单 → 安装应用 / 添加到主屏幕
- iOS Safari：分享 → 添加到主屏幕

`manifest.webmanifest` + `sw.js` 已配好，安装后全屏运行、离线可用。

## 本地开发

直接双击 `www/index.html` 即可在桌面浏览器运行（数据存 localStorage）。
如要调试 Android WebView，运行 `npx cap open android` 用 Android Studio 打开。

## 数据来源

真题目录与词书元数据来自两个公开 Toy 应用的清单结构，已归一为静态 JSON 放在 `www/js/data-*.js`。真题原文与完整词表未随公开清单提供，精听文本为内置示例。

## 许可

MIT
