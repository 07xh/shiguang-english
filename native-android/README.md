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
  - MP3 现在需要通过 `ffprobe` 解出至少 5 秒的实际时长；若精听 JSON 提供可靠的句子结束时间，还会校验 MP3 是否覆盖已知的最后一句（容许 2 秒封装误差）。执行手动离线打包的环境必须有 `ffprobe`（FFmpeg）。
  - `content-index.json` 的 `audioCoverage` 为 `timeline_covered` 或 `duration_only`，并记录 `audioDurationMs`；后者仅证明音频可解析且时长合理，**不能据此宣称整卷原声完整**。即使已知末句得到覆盖，也仍需抽听、核对全题音频与时间轴。
- `UniversityRepository.kt`：从 APK assets 离线读取内容索引、试卷 JSON 和 MP3 路径
- `UniversityScreens.kt`：级别 / 年份 / 试卷目录、题号跳转、选择题、TFNG、填空、主观题输入和保存、逐句多空输入、原声音频播放器
- `.github/workflows/university-offline-apk.yml`：**严格完整性门禁**；只有 231 套 JSON 均验证且对应音频校验成功后才上传完整离线 APK

**两个 APK 构建不可混淆：** `native-android.yml` 的 Debug APK 只是工程编译预览包；`university-offline-apk.yml` 的产物才可称为完整大学题库离线包。缺失资源、源站限流、资源总量超限时，完整版工作流会失败，不能宣称内容已经内置。

题型解析是原生数据适配器，实际题型字段、整卷答案、听力精确句段时间轴仍须在完整数据成功下载后逐项核验。`MediaPlayer` 当前播放完整试卷 MP3，尚未逐句精准裁剪。**不可据此称已经 1:1 还原原站全部复杂交互。**

目标仍是手机和平板真机验收；CI 的 Android 编译与单元测试不能等同于两台实体设备上的操作验收。

### 手动触发离线包构建

在 GitHub → Actions → `University English Full Offline APK` 中运行 workflow。工作流会先抽检 4 套，再下载 231 套。完成且通过检查后，在该次运行的 Artifacts 下载 `shiguang-university-231-offline-debug-apk`；若失败，查看 `university-content-verification` 报告和日志。

## 原版 UI 原生复刻（2026-11-19 更新）

- `ReplicaHome.kt`：原版自然风景头图（已复制相同仓库图片资源）、白色上浮面板、周历/月历、三段训练切换、课程模块小卡片、真实数据统计、首页/统计悬浮玻璃胶囊导航。
- `UniversityScreens.kt`：模式/级别/年份筛选的网格考试大厅；原生 NO. 题目结构、分析卡、固定上一题/答题卡/下一题栏；平板阅读文本与题目双列；精听句内多空键盘。
- `ReplicaExerciseElements.kt`：选项、题号、分析、精听操作岛与底部操作栏的独立 Compose 组件。
- `ReplicaSentencePlayer.kt`：使用已打包 MP3，根据原版 JSON 中的 start/end 进行句段播放和结束控制；没有时间轴的只播放整段，不伪造逐句边界。
- `docs/native-ui-parity.md`：源代码中的可核对交互矩阵和未完成项。
- `.github/workflows/native-ui-emulators.yml`：手机/平板两种 Android **模拟器**的 Compose UI 烟雾测试及截图。模拟器不是实体设备验收。
- `.github/workflows/university-native-starter.yml`：从有授权的原站资源下载四种大学英语类别各一份真实试卷 JSON、3 份对应 MP3，校验后才生成可离线刷题的原生预览 APK。

提示：2026-11-19 首轮全量离线任务停在 105/231 份完整资源（总已下载 1.65 GB）；同时发现至少 10 份 MP3 候选路径未找到。不能据 231 个目录直接宣称已经打包全部资源。`University Native Starter APK` 是更小但确含真实资源的预览版，不是 231 套完整版。

UI 结构按原版设计标记复刻，但还缺复杂考题交互、查词、云端排行榜等。只要 UI 编译通过并不等于视觉逐像素一致；需要浏览模拟器截图后继续对齐。

## 双模式原生 UI（2026-11-19）

现在同一个 Kotlin/Compose 应用中有两套可切换的独立界面：

- **精听·笔试**：自然头图、三段训练、四级/六级/雅思/考研试卷大厅及原版题型结构，保留原版「首页 / 统计」浮动导航。
- **背单词**：参照原版 Vue Toy 交互独立重建「今日 / 词库 / 统计 / 我的」4 项悬浮导航。新增词书筛选、今日目标、学习卡、释义/发音、4 档记忆程度、复习到期词等原生页面。
- 模式切换入口在两个模式顶部；考试页面和背词页面分别使用保存状态容器，切换不会把页面重置回入口；模式、每日目标和词书选择通过 DataStore 保存。
- 背词记忆等级以 `SQLiteOpenHelper` 单独持久化；不覆盖笔试答题记录。现阶段 4 档对应简易离线复习间隔 0/1/3/7 天，是独立实现，**不能宣称算法与原作者完全一致**。
- `VocabRepository.kt` 在 APK 已有原版词库时读取真实词条；如果没有打包原版词库，则首次进入背词模式联网获取真实词库，下载失败显示重试，不显示虚假的完整词数。

### 原版大学词库离线打包

`native-android/tools/package_university_vocab.py` 使用原版独立的词表 JSON 和书单索引，限定 9 本大学及出国考试词书：CET-4、CET-6、专升本、考研英语一/二、雅思、托福、英语专业四/八级。不会加入小学、初中、高中词书。下载及索引校验失败时，CI 不会上传带「原版完整词库」标签的 APK。

`.github/workflows/native-dual-mode.yml` 会同时检验真实大学词库以及四级、六级、雅思、考研各一份原版试卷和对应音频。**仅当两类资源校验、单元测试、Android 编译都成功**，才上传 `shiguang-native-dual-mode-original-university` APK。

此版本仍不是 231 套全部真题的离线完整版；原版背词的精确间隔复习算法、全部插画音效、原作者在线账号、排行尚未等价迁移。模拟器与真机的视觉/点击验收需独立进行。

### 原版词库实际校验（2026-11-19）

双模式 CI 已真实下载并检查 9 本大学/考试词书，去重后含 **15,343** 条词条；原书词数分别为：四级 6,292、六级 8,007、专升本 3,307、考研一 5,680、考研二 5,680、雅思 6,810、托福 5,519、英语专四 8,702、英语专八 12,764。多本书共享词条，不能把各书数目相加当作独立词条数。

本轮原生视觉优化新增词书封面组件 `VocabBookCover`，构建时尝试从原版来源带入 9 张 WebP 封面。图像验证失败则自动使用原生图标，不会让整个词库不可用。

`native-ui-emulators.yml` 的模拟器测试修正为单个 Bash 脚本，避免 workflow 每行分开执行导致 Gradle 找不到子目录。只有 UI 用例真正完成后才能声称手机/平板模拟器测试通过；这仍不代表真实设备验收。

## 按需下载（2026-11-19）

**当前默认 APK：轻量按需下载版。** 保留原生 Kotlin/Compose 界面和大学四级/六级/雅思/考研的 231 套目录，不再把整套题目、音频或 15,343 条大学词条编进 APK。

- 用户打开某套试卷时，`UniversityRepository.ensureModule` 仅获取当前选择的 `written/listening/dictation` JSON，进度可见。获取失败可重试，不伪装成本地有题；成功后缓存到 Android 应用私有文件夹。
- 用户第一次按下播放键时，`ensureAudio` 查找该试卷相应的原版 MP3，验证有效后保存；下一次离线播放即可。**部分历史试卷源站缺 MP3，下载失败会明确提示**。
- 第一次进入背单词模式时，`VocabRepository.ensureCatalog` 获取原站共享的 `vocab_master.json` 与 `books_manifest.json`，构建已校验的大学词书缓存。九本词书共用同一总词表，仅需首次下载一次，后续切书不用重复请求；若原源不可达则提示重试，不用 16 词演示数据冒充真实词库。
- 所有资源放在 `filesDir/authorized_content_v1/`，不会因 App 重启而自动消失；下载先写入 `.part`，仅验证成功后原子改名，避免半截 MP3 或 JSON 被当作可用文件。删除 App 数据或卸载则会清除缓存。
- `native-android.yml` 现在提供 `shiguang-native-on-demand-debug`，CI 会确认 APK 不含全量音频和词库文件。以前的 4 套试卷包、9 本词书完整离线包、231 套全量包仍有工作流，但改为**手动触发**，避免每次小改动自动重新下载几十或上百 MB 资源。

**范围与限制：** 原版词库源站采用共享总词表格式，这一版是**首次进入背词模式时下载一次大学词书数据**，不是每本书单独下载；真正逐书下载需要服务端预先拆分并提供独立 JSON。应首先以 CI 编译及真实设备联网/断网测试验证。当前 `OnDemandStore` 已实现可校验的 HTTP Range 断点续传：对 206 返回范围和总长度做严格匹配，若服务器改为 200 则从头下载；下载中断的 `.part` 文件保留供下次重试，格式检查不通过则不会被当成完整资源。`ContentCachePanel` 已在考试与背词两个「我的」页面提供容量统计和分类清理；清理下载资源不会删除 SQLite/DataStore 练习记录。云同步、按词书拆分部署和原版缺失 MP3 修复仍未实现。实体手机/平板的联网与断网验收仍待进行。
