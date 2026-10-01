const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { DEFAULT_CONFIG, mergeConfig, validateConfig } = require('./config');
const {
  clickByTexts,
  clickNextEvaluationTask,
  detectEvaluationForm,
  fillEvaluationForm,
  getPageSignature,
  getPageText,
  handleConfirmations,
  pageHasKeywords,
  runConfiguredNavigation,
  settle,
  waitForEvaluationForm,
  waitForPageChange
} = require('./automation');

const APP_NAME = 'cnu-teaching-evaluation-automation';
const APP_VERSION = '1.0.0';
const executableName = path.basename(process.execPath).toLowerCase();
const isSingleExecutable = executableName !== 'node.exe' && executableName !== 'node';
const rootDir = process.pkg || isSingleExecutable ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'evaluation.config.json');
const exampleConfigPath = path.join(rootDir, 'evaluation.config.example.json');

async function main() {
  const mode = process.argv[2] || 'run';
  if (mode === '--version' || mode === 'version') {
    console.log(`${APP_NAME} ${APP_VERSION}`);
    return;
  }

  const config = await loadConfig();
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`配置校验失败：\n- ${errors.join('\n- ')}`);

  if (mode === 'check') {
    console.log(`配置读取正常：${configPath}`);
    console.log(`导航步骤：${config.workflow.navigationSteps.length}`);
    console.log(`提交模式：${config.submission.mode}`);
    return;
  }
  if (mode === 'self-test') {
    await runEmbeddedSelfTest(config);
    return;
  }

  const rl = readline.createInterface({ input, output });
  let stopRequested = false;
  process.once('SIGINT', () => {
    stopRequested = true;
    console.log('\n收到退出指令，将在当前操作完成后退出。');
  });

  const context = await chromium.launchPersistentContext(path.resolve(rootDir, config.edgeProfileDir), {
    channel: 'msedge',
    headless: false,
    slowMo: config.slowMoMs,
    viewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    if (config.submission.mode === 'auto') {
      page.on('dialog', dialog => dialog.accept().catch(() => {}));
    }

    await page.goto(config.startUrl, { waitUntil: 'domcontentloaded' });
    if (config.manualLogin) {
      await rl.question('\n请在 Edge 中完成登录或验证码。登录完成后回到这里按回车，程序将自动导航...');
    }

    if (mode === 'diagnose') {
      await saveDiagnostics(page, config);
      console.log(`诊断文件已保存到：${path.resolve(rootDir, config.runtime.diagnosticsDir)}`);
      return;
    }

    await runConfiguredNavigation(page, config.workflow, config.timeouts, console.log);
    console.log(`\n自动流程已启动，提交模式：${config.submission.mode}。按 Ctrl+C 退出。`);
    await runEvaluationLoop(page, config, rl, () => stopRequested);
  } finally {
    await rl.close();
    if (config.closeBrowserOnExit) await context.close();
    else console.log('\n程序已停止，Edge 窗口保持打开。');
  }
}

async function runEvaluationLoop(page, config, rl, shouldStop) {
  let completed = 0;
  let lastSubmittedSignature = '';
  const max = config.runtime.maxEvaluations;

  while (!shouldStop() && (max <= 0 || completed < max)) {
    const form = await ensureEvaluationForm(page, config);
    if (!form.found) {
      const pageText = await getPageText(page);
      const complete = config.workflow.taskList.emptyKeywords.some(keyword => pageText.includes(keyword));
      console.log(complete ? '当前列表显示全部评价已完成。' : '暂未找到未评价任务或评价表单。');
      if (!config.runtime.keepRunning) break;
      console.log(`${Math.round(config.timeouts.idleRetryMs / 1000)} 秒后重新检查；按 Ctrl+C 可退出。`);
      await delay(config.timeouts.idleRetryMs);
      continue;
    }

    const signature = await getPageSignature(page);
    if (signature && signature === lastSubmittedSignature) {
      console.log('页面仍是刚才提交的表单，等待页面跳转后再继续。');
      const transition = await waitForPageChange(page, signature, config.timeouts.formReadyMs);
      if (!transition.changed) await delay(config.timeouts.idleRetryMs);
      continue;
    }

    const result = await fillEvaluationForm(page, config.evaluation);
    console.log(
      `已适配当前表单：单选 ${result.radioGroups} 组，多选 ${result.checkboxes} 项，` +
      `下拉 ${result.selects} 项，文本 ${result.textFields} 项。`
    );

    if (config.submission.mode === 'off') {
      console.log('submission.mode=off，已停在提交前。');
      break;
    }

    if (config.submission.mode === 'manual') {
      await rl.question('请在 Edge 中检查并手动提交、确认。提交完成后回到这里按回车检测下一份...');
      const transition = await waitForPageChange(page, signature, config.timeouts.formReadyMs);
      if (!transition.changed && (await detectEvaluationForm(page)).found) {
        console.log('仍检测到同一份表单，本次不计为完成。请确认网页已经提交成功。');
        continue;
      }
    } else {
      const submit = await clickByTexts(page, config.submission.submitButtonTexts);
      if (!submit.clicked) {
        console.log('未找到提交按钮，为防止误操作已停在当前页面。');
        break;
      }
      await handleConfirmations(page, config.submission.confirmButtonTexts, config.timeouts.confirmationMs);
      await waitForPageChange(page, signature, config.timeouts.formReadyMs);
    }

    lastSubmittedSignature = signature;
    completed += 1;
    console.log(`已完成 ${completed} 份评价，正在寻找下一位教师/课程...`);

    if ((await detectEvaluationForm(page)).found) continue;
    const next = await clickNextEvaluationTask(page, config.workflow.taskList);
    if (next.clicked) await waitForEvaluationForm(page, config.timeouts.formReadyMs);
  }

  console.log(`本次运行共确认完成 ${completed} 份评价。`);
}

async function ensureEvaluationForm(page, config) {
  const current = await detectEvaluationForm(page);
  if (current.found) return current;

  if (!await pageHasKeywords(page, config.workflow.taskList.pageKeywords, 'all')) {
    await runConfiguredNavigation(page, config.workflow, config.timeouts, console.log).catch(error => {
      console.log(`重新导航未完成：${error.message}`);
    });
  }

  const task = await clickNextEvaluationTask(page, config.workflow.taskList);
  if (!task.clicked) return { found: false, controls: 0, questions: 0 };
  console.log(`已选择下一份评价任务（${task.text}）。`);
  await settle(page);
  return waitForEvaluationForm(page, config.timeouts.formReadyMs);
}

async function loadConfig() {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`无法读取配置 ${configPath}：${error.message}`);
    try {
      await fs.copyFile(exampleConfigPath, configPath);
      raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
    } catch {
      raw = DEFAULT_CONFIG;
      await fs.writeFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    }
    console.log(`已创建配置文件：${configPath}`);
  }
  return mergeConfig(raw);
}

async function saveDiagnostics(page, config) {
  const dir = path.resolve(rootDir, config.runtime.diagnosticsDir);
  await fs.mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, 'page.png'), fullPage: true }).catch(() => {});
  const summaries = [];
  for (let index = 0; index < page.frames().length; index += 1) {
    const frame = page.frames()[index];
    const html = await frame.content().catch(() => '');
    const text = await frame.locator('body').innerText({ timeout: 1500 }).catch(() => '');
    await fs.writeFile(path.join(dir, `frame-${String(index).padStart(2, '0')}.html`), html, 'utf8');
    summaries.push(`FRAME ${index}\nURL: ${frame.url()}\n\n${text.slice(0, 12000)}`);
  }
  await fs.writeFile(path.join(dir, 'frames-text.txt'), summaries.join('\n\n---\n\n'), 'utf8');
}

async function runEmbeddedSelfTest(config) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <h1>Sandbox evaluation</h1>
      <label><input type="radio" name="quality" value="1">很差</label>
      <label><input type="radio" name="quality" value="5">非常满意</label>
      <select><option value="">请选择</option><option>一般</option><option>优秀</option></select>
      <textarea></textarea>
    `);
    const result = await fillEvaluationForm(page, config.evaluation);
    const radio = await page.locator('input[value="5"]').isChecked();
    const select = await page.locator('select').inputValue();
    const comment = await page.locator('textarea').inputValue();
    if (!radio || select !== '优秀' || !comment || result.radioGroups !== 1) {
      throw new Error('内置表单填写结果不符合预期');
    }
    console.log('内置沙盒测试通过：Edge 启动、表单识别和自动填写均正常。');
  } finally {
    await browser.close();
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  main().catch(error => {
    console.error(`\n运行失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { ensureEvaluationForm, loadConfig, runEvaluationLoop };
