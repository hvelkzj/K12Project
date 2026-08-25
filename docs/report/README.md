# A 实验报告生成说明

报告内容来自最终仓库、测试结果、PR 记录和 `docs/screenshots` 中的实际页面证据。

生成命令：

```text
python docs/report/build_a_report.py
```

为保证依赖和字体一致，最终交付使用 Codex 工作区自带的 Python 运行时生成，再通过 LibreOffice 渲染为逐页图片检查。报告采用 `standard_business_brief` 版式参数和 `editorial_cover` 首页结构。

构建结果写入 `artifacts/report/`。该目录是本地交付产物目录，不作为运行时源码依赖。
