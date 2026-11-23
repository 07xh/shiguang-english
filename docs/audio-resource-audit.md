# 拾光英语：历史缺失原声专项核验

## 证据范围

2026-11-18 的 [University English Full Offline APK 构建 #44359632422](https://github.com/07xh/shiguang-english/actions/runs/44359632422) 在尝试打包 231 套大学英语真题时，日志报告 **10 套** CET 试卷未找到符合当时校验条件的候选 MP3。构建在约 1.65 GB 的资产容量限制附近停止，未覆盖全部 231 套；因此这 10 套 **不是全部缺失资源的完整统计**。

历史失败的试卷 ID：

| 等级 | ID |
| --- | --- |
| 四级 | `2023_06_cet4_set1` |
| 四级 | `2023_06_cet4_set2` |
| 四级 | `2022_06_cet4_set1` |
| 四级 | `2019_12_cet4_set1` |
| 四级 | `2019_12_cet4_set2` |
| 六级 | `2023_06_cet6_set2` |
| 六级 | `2023_06_cet6_set1` |
| 六级 | `2022_06_cet6_set1` |
| 六级 | `2019_12_cet6_set2` |
| 六级 | `2019_12_cet6_set1` |

## 如何重新核验

执行 [Audit Historical Missing CET Audio (read-only)](../.github/workflows/audit-missing-cet-audio.yml) 工作流，也可从 `native-android` 目录运行：

```bash
python3 -m unittest discover -s tools/tests -p test_missing_audio_audit.py -v
python3 -m tools.audit_missing_audio --dry-run --output missing-audio-candidates.json
python3 -m tools.audit_missing_audio --timeout 8 --workers 2 --output missing-audio-audit.json
```

核验仅针对代码中的固定 ID、固定授权域名，以及现有打包器本来就会尝试的文件名候选。每条 URL 使用一次最多读取 1024 字节的 Range GET，不保存音频正文；两个工作线程降低源站负担。报告作为工作流 `missing-cet-audio-availability-audit` Artifact 上传。

## 如何解读结果

- `mp3_header_reachable`：候选路径响应了 MP3 文件头。
- `mp4_header_reachable`：候选路径虽使用 `.mp3` 扩展名，实际返回了含 `ftyp` 标识的 MP4/ISO BMFF 容器；这可能解释旧脚本把音频误判为缺失。
- `candidate_header_found`：本轮找到上述任一容器文件头。**不等于确认文件包含音轨、可完整解码或覆盖整套听力**。
- `not_found`：这次对某个候选文件名的请求返回 HTTP 404；不能证明其他文件名或其他授权资源不存在。
- `access_denied`、`rate_limited`：服务器拒绝请求/限流，不应与永久缺失混为一谈。
- `not_mp3_header`：HTTP 响应成功，但开头并非识别到的 MP3 头（例如 HTML 页面）。
- `network_error`：本次网络、DNS 或超时错误；无法证明文件是否存在。

专项报告只反映 **运行时** 的目标域名响应。真正解决某一卷原声问题，还需要拿到符合授权的真实文件，核对实际时长、可解码性以及已知最后一句时间轴，必要时逐题抽听。不要用 TTS 伪装官方原声，也不要将目录 231 项等同于完整资源 231 套。

## 与当前 App 的关系

原生 Android 按需下载仍由 `UniversityRepository.ensureAudio` 负责。这个审计工具**不会更改 App 的源站地址、缓存、播放逻辑或学习记录**；核验有结果后再讨论精确的文件名映射或独立的已授权资源来源。

### 2026-11-23 发现：十个候选均显示 MP4 容器开头

在历史十个 ID 的每一项中，至少一个源站 `.mp3` URL 返回 HTTP 206、`Content-Type: audio/mpeg`，但实际开头为 `00 00 00 18 66 74 79 70` 或 `00 00 00 20 66 74 79 70`；`66 74 79 70` 即 ASCII `ftyp`。这说明此前仅认 MP3 文件头的校验器有误判风险。下一步必须通过真正的媒体探测确认音轨、时长和内容覆盖，再决定是否能在 Android 端接入；不能仅凭 `ftyp` 就宣称录音已修复。
