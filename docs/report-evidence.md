# 实验报告材料

开发时保存以下内容即可：

| 报告部分 | 需要保存 |
|---|---|
| 功能介绍 | 功能清单和页面截图 |
| AI 交互 | 提示词、AI 回复、自己的判断和修改 |
| 系统设计 | 数据库图、权限表、三个业务流程图 |
| 测试调试 | 测试过程、错误、修复方法和结果 |
| 使用示例 | 截图及对应的操作说明 |
| 团队合作 | 分工、接口联调、PR 和 Git 提交截图 |
| 系统兼容 | macOS、Windows 各一次启动和测试结果 |
| 多端运行 | Android APP 和微信小程序登录、课件、作业、批改、考勤截图 |
| 压力测试 | 500 请求、并发 50 的吞吐量、平均、P50、P95、最大耗时和失败数 |
| 完整过程 | AGENTS.md、相关规则和完整 AI 记录 |

每位成员至少保留三个不同时间的提交，分别体现功能、Bug 修复和测试或文档。

## 2026-08-25 可用数据

- 公开 GitHub 仓库：`https://github.com/hvelkzj/K12Project`。
- `npm run check`：332 项有效测试通过、0 失败；2 项受限进程的回环端口测试跳过。
- Windows 最终版本：全量命令通过；`npm run check` 为 347 项测试通过、0 失败、0 跳过，真实 HTTP 用例在 Windows 正常执行。
- Windows 移动端与运行验证：`npm run test:load`、`npm run build:app`、`npm run build:mp-weixin` 和 `npm run dev` 全部通过。
- `npm run test:load` 最终复验：500 次、并发 50、失败 0；吞吐量 6449.64 请求/秒，平均 7.46 ms，P50 3.65 ms，P95 42.39 ms，最大 72.71 ms。
- `npm run build:app`：通过，生成 APP 运行资源。
- `npm run build:mp-weixin`：通过，生成可导入微信开发者工具的构建目录。
- 公共学生概览同时供网页端、APP 和小程序使用；教师课件与考勤写入后由统一仓库回读。
- 微信开发者工具真实导入通过；学生完成登录、课件读取、作业提交、状态回写和退出，截图见 `docs/screenshots/wechat-mini-program-*.png`。
- HBuilderX 5.24 已识别移动工程并安装真机运行插件；`0.1.2` 测试 APK 已完成免费云打包、压缩结构、签名、版本和 Camera 模块验证。SHA-256 为 `482f70027dbcc7d4f7bc3b9f053064a9b973109caa40fc434496f3c43c010099`。
