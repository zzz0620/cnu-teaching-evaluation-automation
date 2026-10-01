# 配置指南

程序只读取 exe 或项目根目录旁边的 `evaluation.config.json`。首次运行 exe 时会自动生成该文件。

## 页面导航步骤

`workflow.navigationSteps` 按数组顺序执行。每个对象代表一页或一次点击：

| 字段 | 含义 |
| --- | --- |
| `name` | 日志中显示的步骤名称 |
| `pageKeywords` | 点击前当前页面应出现的任意文字 |
| `clickTexts` | 要点击的入口文字，按顺序尝试 |
| `nextPageKeywords` | 点击后目标页面应出现的任意文字 |
| `optional` | `true` 表示匹配不到时跳过；关键步骤建议 `false` |

例如登录后要经过“学生服务 -> 教学评价 -> 本学期评价”三页，就配置三个对象。关键字应选择页面中稳定、醒目且较少重复的文字，不要使用教师姓名、临时通知或日期。

## 教师/课程列表

`workflow.taskList` 用于自动寻找下一份任务：

- `pageKeywords`：列表页上稳定出现的文字。
- `entryTexts`：进入具体评价表的按钮或链接文字。
- `incompleteKeywords`：未完成行中的状态文字。
- `completedKeywords`：已完成行中的状态文字；程序会跳过这些行。
- `emptyKeywords`：全部完成或没有数据时的提示。
- `rowSelectors`：常见列表容器，通常无需修改。

程序会把入口按钮放回其所在表格行/列表项判断状态，因此同一页有多个教师或课程时不需要逐个配置姓名。

## 答案策略

`evaluation.preferredOptionTexts` 按优先级排列。程序会检查关联标签、相邻文字和表格列标题。例如表头是“不同意 / 同意 / 完全同意”，会优先选择“完全同意”。

`fallbackRadioChoice` 仅在无法识别偏好文字时使用。请根据学校表单的左右顺序选择 `first` 或 `last`；不确定时先使用 `submission.mode=off` 检查一次。

`checkboxMode`：

- `first`：每组选择第一项。
- `all`：选择全部。
- `none`：不处理多选题。

`textAnswers` 可写多条，按文本框顺序使用；文本框多于答案时重复第一条。

`selectMode` 控制下拉题：`first-non-empty` 优先匹配偏好文字，否则选择第一个非空项；`preferred-only` 只选择明确匹配偏好的项；`none` 不处理下拉题。

## 提交与循环

`submission.mode=manual` 时，程序填写后等待用户在 Edge 提交。提交成功并完成页面跳转后，回终端按回车，程序才检测下一份。

`runtime.keepRunning=true` 表示暂时找不到任务时继续轮询；`maxEvaluations=0` 表示不限制数量。按 `Ctrl+C` 可停止。

## 排错

1. 先将 `submission.mode` 改为 `off`，避免误提交。
2. 登录并停在异常页面。
3. 源码运行时执行 `npm run diagnose`；exe 用户可在命令行执行 `cnu-teaching-evaluation-automation.exe diagnose`。
4. 检查 `diagnostics/frames-text.txt` 中是否能看到配置关键字。

诊断数据可能含个人信息，分享前请脱敏。
