# 拾光英语

面向手机和平板的大学英语练习 App。**当前开发主线是 Kotlin + Jetpack Compose 原生 Android 版**，不是早期的 Capacitor/WebView 安装包。

## 最新 Android 版：从构建记录获取

1. 打开 [Native Android (On-Demand Content) 构建记录](https://github.com/07xh/shiguang-english/actions/workflows/native-android.yml)。
2. 选择最新一次**成功**的 `main` 分支运行，在 Artifacts 下载 `shiguang-native-on-demand-debug`。
3. 解压 ZIP 后安装其中的 APK。调试包是开发预览，**不代表经过真机验收的正式发行版**。

> 仓库根目录旧版 `app-debug.apk` 和 `shiguang-original.apk` **不是最新 Compose 原生版**，请勿混用。若 Actions 尚未成功完成，不要将旧安装包标为“最新版”。

## 目前实现情况（以原生版为准）

| 模块 | 已实现 | 仍需验收 / 完善 |
| --- | --- | --- |
| 双模式 | 精听·笔试 / 背单词原生界面与切换 | 真机切换恢复、视觉细节 |
| 真题目录 | CET-4、CET-6、雅思、考研共 231 套**目录** | 不是 231 套完整试卷；少量历史资源缺失 |
| 笔试 | 基础题型、答题卡、解析、交卷确认、**本机自动保存草稿** | 原版复杂题型、完整计分与整卷回顾 |
| 听力 | 原始 MP3 按需下载、播放与调速 | 部分源文件缺失，完整时间轴与后台播放 |
| 逐句精听 | 多空输入、句子跳转、自制键盘、**本机自动保存草稿** | 键盘长按、精确分句与全部真题验收 |
| 背单词 | 9 本大学及考试词书、4 档复习、离线保存学习状态 | 原版复习算法、更多视觉和交互细节 |
| 下载缓存 | 题目/音频/词库按需下载，HTTP Range 续传、分类清理 | 真机弱网、断网和源站不可达验证 |
| 布局 | 手机/平板适配及 Compose UI 模拟器测试代码 | 仍需实体设备逐屏验收 |

原版大学考试目录有 231 套；词书校验得到 9 本书共 15,343 条去重词条。这两项是**资源清单/校验数据**，并不意味着当前轻量 APK 已内置全部试卷、词条或音频。首次使用对应资源时需要联网获取；下载完成并通过校验的资源才可离线使用。某些资源可能因来源缺失或网络问题而无法下载。

本地草稿按试卷和练习类型独立保存，不会上传到题库来源站；卸载或清除应用数据会删除草稿。跨设备同步、在线排行榜尚未实现。

## 仓库结构

- `native-android/` — **正式开发主线**：Kotlin / Jetpack Compose Android App，使用独立的资源仓库与本地缓存
- `docs/native-ui-parity.md` — 原生 UI、交互的已实现/待验收对照
- `docs/native-interaction-contract.md` — 练习行为与功能验收约束
- `shiguang-app/` — 旧 Capacitor / PWA 试验版本，仅保留供历史参考
- `shiguang-original/`、`recovered-source/` — 历史参考资料；不等于当前原生 App 的完整代码或资源

## 从源码构建

要求 JDK 17、Android SDK Platform 35 和 Gradle 8.9。用 Android Studio 打开 `native-android/`，或在配置好 Gradle 的环境中运行：

```bash
cd native-android
gradle --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

生成的开发 APK 路径是 `native-android/app/build/outputs/apk/debug/app-debug.apk`。

### 构建检查

- [原生 Android 编译 + 单测](https://github.com/07xh/shiguang-english/actions/workflows/native-android.yml)
- [手机/平板模拟器 UI 烟雾测试](https://github.com/07xh/shiguang-english/actions/workflows/native-ui-emulators.yml)
- [大学英语内容集成](native-android/README.md)

**CI 构建成功不等于所有功能、所有内容均可用。** 最终发布前必须在实体手机和平板上逐项验证。

## 使用范围

本项目供个人英语学习和工程练习。第三方题目、音频、图片、词表的使用和再分发必须符合对应授权；本仓库的代码许可不自动覆盖第三方素材。
