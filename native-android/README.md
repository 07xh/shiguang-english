# 拾光英语 Android 原生版（原生开发工程）

本目录是 **Kotlin + Jetpack Compose** 独立 Android 项目，非 Capacitor / WebView 套壳。与仓库既有 `www/`、`android/`、`shiguang-original/` 并存，未删除或改动原版参考资料。

## 当前实际完成

- 手机底部导航、宽屏/平板侧边导航、统一配色和卡片样式
- 首页、统计、听力入口、单词词书、我的
- **5 道自行编写的样本题**：选项选择、反馈、解析、题号抽屉、已答状态、返回并继续、结算；重访已答题目不重复累加统计
- **16 个自行编写的样本词条**：按词书过滤、发音、翻义、认识/不认识、上一词/跳过
- **3 句自行编写的精听样本**：Android TTS 朗读、倍速、英美口音、提示、填空、答案、前后切句、句子跳转、自制 26 键 / 系统键盘切换、句间输入保留
- DataStore 存储本地词语标记与答题记录，可清空

## 尚未完成（不能宣称可用）

- 真实 CET/考研/雅思题目、原始音频、全文解析及完整词书
- 原版复杂题型与分组抽屉、自制键盘长按退格与多空换空、查词模式、离线音频及媒体会话
- 原版排名、打卡、补签、跨设备同步及第三方 Toy 平台功能
- 真机交互等价回归和正式 APK 发行

原版静态 `bundle.js` / `bundle.css` 是第三方构建产物，并非可直接再分发的授权原工程。本原生代码未移植第三方 bundle。

## 构建

安装 Android Studio（JDK 17、Android SDK Platform 35），打开本目录并同步 Gradle。
要求 Android Gradle Plugin 8.7.3 + Gradle 8.9 + Kotlin 2.0.21。

仓库 CI 使用 `gradle :app:testDebugUnitTest :app:assembleDebug`，不依赖作者本机 Gradle 绝对路径。当前未提交 Gradle Wrapper JAR，使用 IDE 配置的 Gradle 或 CI 安装的 Gradle。

**首次提交仅代表代码已上传，不代表构建已通过或 APK 已发布。** 构建结果请以 GitHub Actions 最新运行结果为准。

## 交互迁移规则

参见 [原版交互契约](../docs/native-interaction-contract.md)。原版可合法实现的行为逐项迁移；样本内容只供验证交互，不充作正式真题/词库。

## CI 失败处理

2026-11-19 首轮 CI 失败于废弃 SDK `tools` 包安装，第二轮失败于 Maven Central HTTP 429（非 Kotlin 编译错误）。工作流现降低并发并有限次退避重试，最终状态以新 CI 为准。

## 大学英语原版内容集成（新增）

范围来自现有 `shiguang-original/.../exams_manifest.js`：四级 74、六级 51、雅思 72、考研 34，共 **231 套目录**；不收录高考。用户已确认拥有将原版题库及音频用于当前项目 APK 的许可。

- `app/src/main/assets/university/catalog.json`：真实 231 个原版目录元数据，**不等于题目内容**
- `tools/package_university_assets.py`：在 CI 从原站获取相应 JSON 切片、MP3；按考试 ID 打包，不放伪造题目；逐套记录校验结果
- `UniversityRepository.kt`：从 APK assets 离线读取内容索引、试卷 JSON 和 MP3 路径
- `UniversityScreens.kt`：级别 / 年份 / 试卷目录、题号跳转、选择题、TFNG、填空、主观题输入和保存、逐句多空输入、原声音频播放器
- `.github/workflows/university-offline-apk.yml`：**严格完整性门禁**；只有 231 套 JSON 均验证且对应音频校验成功后才上传完整离线 APK

**两个 APK 构建不可混淆：** `native-android.yml` 的 Debug APK 只是工程编译预览包；`university-offline-apk.yml` 的产物才可称为完整大学题库离线包。缺失资源、源站限流、资源总量超限时，完整版工作流会失败，不能宣称内容已经内置。

题型解析是原生数据适配器，实际题型字段、整卷答案、听力精确句段时间轴仍须在完整数据成功下载后逐项核验。`MediaPlayer` 当前播放完整试卷 MP3，尚未逐句精准裁剪。**不可据此称已经 1:1 还原原站全部复杂交互。**

目标仍是手机和平板真机验收；CI 的 Android 编译与单元测试不能等同于两台实体设备上的操作验收。

### 手动触发离线包构建

在 GitHub → Actions → `University English Full Offline APK` 中运行 workflow。工作流会先抽检 4 套，再下载 231 套。完成且通过检查后，在该次运行的 Artifacts 下载 `shiguang-university-231-offline-debug-apk`；若失败，查看 `university-content-verification` 报告和日志。
