# Project Working Rules

- 修改前阅读 `README.md`、`docs/PROJECT_SUMMARY.md`、`docs/ALIGNMENT.md` 和 `docs/CONFIGURATION.md`。
- 项目默认安全边界是人工登录/验证码和人工最终提交；不得默认保存凭据或绕过验证码。
- 页面适配优先使用可配置文字和通用表单语义，不为单个账号、教师或课程硬编码选择器。
- `evaluation.config.json`、`.edge-profile/` 和 `diagnostics/` 不得提交公开仓库。
- 新增运行时依赖前说明必要性；构建依赖和第三方许可同步更新。
- 修改后至少运行 `npm run check`、`npm test` 和独立 exe 空目录检查。
- 完成任务后更新 `docs/PROJECT_SUMMARY.md`；用户偏好纠正更新 `docs/ALIGNMENT.md`。
