# 项目总结

更新时间：2026-10-01

## 当前成果

- 项目已迁移到统一 Codex 工作区，目录为 `project_017_cnu_teaching_evaluation`。
- 配置升级为 schema v2，支持任意数量的页面关键字导航步骤。
- 任务列表按行识别未评/已评状态，自动选择下一位教师或课程。
- 通用表单引擎支持单选、多选、下拉、文本域、contenteditable 和 iframe。
- 默认保留人工登录/验证码与人工最终提交，避免保存凭据和未经检查的提交。
- 提供 Node.js SEA 单文件构建、SHA-256 输出和 GitHub Release 工作流。
- 补齐 README、配置指南、MIT 许可、权属、第三方声明、安全和贡献文档。
- 源码已公开至 `https://github.com/zzz0620/cnu-teaching-evaluation-automation`。
- Windows 独立程序已发布至 `https://github.com/zzz0620/cnu-teaching-evaluation-automation/releases/tag/v1.0.0`。

## 验证状态

- JavaScript 语法检查：通过。
- 配置校验：通过。
- 本地模拟教务系统测试：通过；覆盖异步加载、已提交任务跳过、未评任务选择、常见题型和 iframe。
- 独立 exe 构建：通过；输出 92,880,384 字节的 Windows x64 单文件程序。
- 独立 exe 空目录测试：通过；自动生成配置、启动无界面 Edge 并完成内置表单填写。
- Release SHA-256 校验：通过；v1.0.0 本地候选文件为 `9f6aaf527a884ada68a4750cabdbf1bc2039153fa4567de0db1d12f57cb853a5`。
- 第三方许可证归档：通过；Release 包含 11 个许可证/说明文件。
- 首都师范大学真实账号端到端测试：未执行；需要用户登录且涉及真实教评数据。

## 风险

- 教务系统改版、Shadow DOM、画布控件或非标准自绘控件可能需要扩展通用引擎。
- 配置关键字过短或重复可能点击错误入口，首次使用建议 `submission.mode=off` 检查。
- 未签名 exe 可能触发 Windows SmartScreen；应从官方 Release 下载并核对 SHA-256。
