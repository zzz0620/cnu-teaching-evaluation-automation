# CNU Teaching Evaluation Automation

[![Build](https://github.com/zzz0620/cnu-teaching-evaluation-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/zzz0620/cnu-teaching-evaluation-automation/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/zzz0620/cnu-teaching-evaluation-automation)](https://github.com/zzz0620/cnu-teaching-evaluation-automation/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

面向 Windows + Microsoft Edge 的大学教评自动填写工具。用户手动完成登录/验证码后，程序根据配置中的页面文字自动进入教学评价、选择下一位教师或课程，并自动适配常见单选、多选、下拉和文本题。

默认采用**手动提交**：程序填完后停在提交前，由用户检查并提交，回到终端按回车后再检测下一份。工具不保存账号密码，也不绕过验证码。

## 功能

- 使用页面可见文字配置导航，不要求用户编写 CSS/XPath。
- 支持任意数量的登录后导航步骤。
- 自动跳过“已评/已提交”任务，选择“未评/待评价”教师或课程。
- 自动处理普通页面和 iframe 中的单选、多选、下拉、文本域。
- 从标签、表头、选项值和配置偏好综合选择答案。
- 等待异步加载完成后再识别表单，避免切页过快导致漏填。
- 提供诊断输出、模拟教务系统测试和独立 Windows `.exe` 构建。

## 直接使用

1. 从 [Releases](https://github.com/zzz0620/cnu-teaching-evaluation-automation/releases) 下载 `cnu-teaching-evaluation-automation.exe`。
2. 把 exe 放到单独文件夹并双击。首次运行会在同目录生成 `evaluation.config.json`。
3. 按照学校页面修改导航关键字，详见 [配置指南](docs/CONFIGURATION.md)。
4. 再次运行 exe，在 Edge 中完成登录/验证码，然后回到终端按回车。
5. 程序自动进入评教并填写。检查无误后在 Edge 中手动提交，再回到终端按回车继续下一份。

运行要求：Windows 10/11、Microsoft Edge、可访问对应教务系统的网络。无需安装 Node.js、npm 或 Playwright。

## 配置示例

下面表示：登录后在首页点击“学生服务”，进入下一页后点击“教学评价”，最后从课程列表选择“未评”任务。

```json
{
  "workflow": {
    "navigationSteps": [
      {
        "name": "进入学生服务",
        "pageKeywords": ["首页"],
        "clickTexts": ["学生服务"],
        "nextPageKeywords": ["学生服务大厅"],
        "optional": false
      },
      {
        "name": "进入教学评价",
        "pageKeywords": ["学生服务大厅"],
        "clickTexts": ["教学评价", "学生评教"],
        "nextPageKeywords": ["课程", "教师", "评价"],
        "optional": false
      }
    ],
    "taskList": {
      "pageKeywords": ["课程", "教师", "评价"],
      "entryTexts": ["进入评价", "开始评价", "评价", "未评"],
      "incompleteKeywords": ["未评", "未提交", "待评价"],
      "completedKeywords": ["已评", "已提交", "已完成"]
    }
  }
}
```

每个数组都可以填写同义文字，程序按顺序尝试。学校页面改版时通常只需更新 JSON，不需要修改或重新打包代码。

## 表单适配

`evaluation.preferredOptionTexts` 定义优先答案，例如“非常满意、优秀、完全同意”。找不到文字时使用 `fallbackRadioChoice`：

- `last`：选择 DOM 中最后一个选项，适合优秀项在最右侧/末尾的表单。
- `first`：选择第一个选项。
- `auto-best`：优先选择数值较大的选项，再退回最后一个。

多选题由 `checkboxMode` 控制：`first`、`all` 或 `none`。评语在 `textAnswers` 中填写。程序不会自动填写搜索框、学号、课程号等普通文本输入框。

## 提交模式

默认配置：

```json
"submission": { "mode": "manual" }
```

- `manual`：用户检查并手动提交，推荐。
- `auto`：程序尝试点击提交与确认。使用前必须自行核对学校规则和页面结构。
- `off`：只填写一次并停在提交前。

## 从源码运行

需要 Node.js 22 和 Microsoft Edge：

```powershell
git clone https://github.com/zzz0620/cnu-teaching-evaluation-automation.git
cd cnu-teaching-evaluation-automation
npm ci
Copy-Item evaluation.config.example.json evaluation.config.json
npm test
npm start
```

诊断当前页面：

```powershell
npm run diagnose
```

诊断文件保存到本地 `diagnostics/`，其中可能包含课程名称、教师姓名或页面内容，请勿直接公开上传。

## 构建独立 EXE

在 Windows PowerShell 中：

```powershell
npm ci
npm test
npm run build:exe
```

输出：

```text
release/cnu-teaching-evaluation-automation.exe
release/evaluation.config.example.json
release/SHA256SUMS.txt
release/third-party-licenses.zip
```

exe 使用 Node.js Single Executable Application 构建并内置运行依赖，但不内置 Edge。当前发行文件没有商业代码签名证书，Windows SmartScreen 可能显示未知发布者；可使用 Release 中的 SHA-256 文件校验完整性。

## 安全与使用边界

- 不在配置、日志或仓库中填写账号、密码、Token、Cookie。
- 不绕过验证码、访问控制或学校安全措施。
- 默认不自动提交，用户应逐份检查答案。
- 用户应遵守学校规章、教务系统使用条款及适用法律，并对提交内容负责。
- 本项目与首都师范大学及其教务系统供应商无隶属、授权或背书关系。

漏洞报告和隐私注意事项见 [SECURITY.md](SECURITY.md)。

## 项目结构

```text
src/                            配置、导航和表单自动化引擎
tests/                          本地模拟教务系统测试
scripts/                        SEA 独立 exe 构建脚本
docs/CONFIGURATION.md           完整配置说明
.github/workflows/              CI 与 Release 自动构建
evaluation.config.example.json  公开配置模板
```

## 许可与所有权

项目由 **zzz** 发起并维护，原创代码与文档的权属边界见 [COPYRIGHT.md](COPYRIGHT.md)。源码按 [MIT License](LICENSE) 开源；Playwright、Chromium BiDi、esbuild、postject 和 Node.js 等第三方组件仍适用各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
