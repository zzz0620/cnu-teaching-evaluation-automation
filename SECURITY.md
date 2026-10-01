# Security Policy

## Supported Versions

仅最新 GitHub Release 接收安全修复。请先核对 Release 中的 SHA-256 校验值。

## Reporting a Vulnerability

请优先通过 GitHub Security Advisories 私下报告安全问题，不要在公开 Issue 中提供账号、密码、Cookie、Token、课程信息、教师姓名或完整诊断页面。

## Data and Credential Safety

- 程序不需要账号密码配置；登录和验证码由用户在 Edge 中完成。
- Edge 登录状态保存在 exe 同目录的 `.edge-profile/`，该目录可能包含敏感会话数据，不应分享或提交。
- `diagnostics/` 可能包含页面 HTML、课程、教师和学生信息，分享前必须脱敏。
- 不要把凭据写入 `evaluation.config.json`。
- 默认手动提交。启用自动提交前应先在 `off` 模式检查页面匹配结果。

## Binary Trust

发行 exe 未使用商业代码签名证书，Windows 可能显示未知发布者。只从官方 GitHub Releases 下载，并用 `SHA256SUMS.txt` 校验。源代码和可复现构建步骤公开在仓库中。
