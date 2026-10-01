# 工作流

1. 阅读项目规则、README、配置指南、总结和对齐记录。
2. 修改页面逻辑时保持“配置关键字导航 -> 任务列表选择 -> 通用表单适配 -> 提交边界”的分层。
3. 使用 `evaluation.config.example.json` 表达公开配置，不提交本地实际配置和浏览器状态。
4. 执行 `npm run check` 和 `npm test`。
5. 执行 `npm run build:exe`，在空目录仅复制 exe，验证 `--version` 和 `check`。
6. 更新文档、SHA-256 和项目总结后再提交 Git。
7. 发布 Release 时上传 exe、配置示例和 `SHA256SUMS.txt`。
