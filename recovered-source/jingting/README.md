# 拾光英语（精听/笔试）— 作者原生源码还原工程
## 来源
- 源站：`https://www.bilibilitoy.com/toy/qDif2poHemIk0VJH/24227927458816-v53236/`
- 还原依据：源站 `js/bundle.js` 为**未压缩源码**，内部保留 `/* === js/xxx.js === */` 模块边界标记，本工程按标记 1:1 切分还原，未改写任何逻辑。
- `Last-Modified`: Wed, 18 Nov 2026 14:24:42 GMT · Etag: `d2ca79a56df5543c491afa62929b869d`

## 工程结构
```
recovered-source/jingting/
├── js/    (41 个原生模块)
│   └── 00_storage_engine.js
│   └── daily_manifest.js
│   └── audio_cache_db.js
│   └── exam_loader.js
│   └── toy_user_identity.js
│   └── toy_practice_stats.js
│   └── toy_crdt_serializer.js
│   └── toy_sdk.js
│   └── toy_rank_view.js
│   └── toy_permissions.js
│   └── toy_lifecycle.js
│   └── orientation_manager.js
│   └── dictionary.js
│   └── feedback_engine.js
│   └── ux_physics_engines.js
│   └── listening_quiz.js
│   └── dict_audio_engine.js
│   └── dict_virtual_keyboard.js
│   └── dictation_lexer.js
│   └── dictation_lobby.js
│   └── dictation_quiz.js
│   └── dictation_controls.js
│   └── written_lobby.js
│   └── written_proofread.js
│   └── written_subjective.js
│   └── written_annotations.js
│   └── written_passage_renderer.js
│   └── written_question_objective.js
│   └── written_question_subjective.js
│   └── written_exam.js
│   └── ui_controller.js
│   └── ui_home_portal.js
│   └── ui_arena_controls.js
│   └── habit_streak.js
│   └── home_calendar.js
│   └── dashboard_carousel.js
│   └── share_card.js
│   └── rank_modal.js
│   └── home_tabbar.js
│   └── tab_stats.js
│   └── app.js
└── css/   (19 个原生模块)
    └── base.css
    └── layout.css
    └── lobby_cards.css
    └── home_hero_dashboard.css
    └── home_calendar.css
    └── home_modules.css
    └── home_schemes.css
    └── home_modals.css
    └── home_tabbar.css
    └── quiz.css
    └── written.css
    └── written_proofread_fillin.css
    └── written_subjective.css
    └── written_split_sheet.css
    └── dictation.css
    └── comp_dictionary.css
    └── comp_rank_skins.css
    └── components.css
    └── landscape.css
```

## 数据层 API（改原生 app 时对接/替换）
- `https://bilibilitoyassets.top/api/user_data` — 用户学习数据云同步
- `https://bilibilitoyassets.top/api/active_stats` — 今日活跃/排名统计
- 音频与图片资源根：`https://bilibilitoyassets.top/`

## 原生 app 改造提示（交给 GPT）
- 这些文件是浏览器端原生 JS（无框架、无构建），大量依赖 `document`/`window`/`localStorage`/`Web Speech API`/`toy-sdk`。
- 改 React Native / Flutter / uni-app 时：业务算法（听写判分、CRDT 序列化、学习计划、词库解析）可直接移植；DOM 渲染层需重写为对应平台组件。
- `js/toy_sdk.js`、`js/toy_lifecycle.js`、`js/toy_permissions.js` 是 B 站宿主桥接层，独立 app 可移除或替换。
