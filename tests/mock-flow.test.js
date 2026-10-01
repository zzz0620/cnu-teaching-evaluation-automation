const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { mergeConfig } = require('../src/config');
const {
  clickNextEvaluationTask,
  detectEvaluationForm,
  fillEvaluationForm,
  runConfiguredNavigation,
  waitForEvaluationForm
} = require('../src/automation');

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const config = mergeConfig({
    workflow: {
      navigationSteps: [{
        name: '进入教学评价',
        pageKeywords: ['教务首页'],
        clickTexts: ['教学评价'],
        nextPageKeywords: ['课程评价列表'],
        optional: false
      }],
      taskList: {
        pageKeywords: ['课程评价列表'],
        entryTexts: ['进入评价', '评价'],
        incompleteKeywords: ['未评'],
        completedKeywords: ['已提交'],
        emptyKeywords: ['全部完成'],
        rowSelectors: ['tr']
      }
    },
    timeouts: { pageReadyMs: 3000, formReadyMs: 3000 }
  });

  await page.setContent(`
    <main id="app">
      <h1>教务首页</h1>
      <button onclick="showTasks()">教学评价</button>
    </main>
    <script>
      function showTasks() {
        document.querySelector('#app').innerHTML = \`
          <h1>课程评价列表</h1>
          <table>
            <tr><td>高等数学</td><td>已提交</td><td><button>评价</button></td></tr>
            <tr><td>大学物理</td><td>未评</td><td><button onclick="showForm()">进入评价</button></td></tr>
          </table>\`;
      }
      function showForm() {
        document.querySelector('#app').innerHTML = '<h1>正在加载评价表</h1>';
        setTimeout(() => {
          document.querySelector('#app').innerHTML = \`
            <h1>大学物理课程评价</h1>
            <fieldset>
              <legend>教学态度</legend>
              <label><input type="radio" name="q1" value="1">很差</label>
              <label><input type="radio" name="q1" value="5">非常满意</label>
            </fieldset>
            <table>
              <tr><th>课堂内容</th><th>不同意</th><th>完全同意</th></tr>
              <tr><td>内容清晰</td><td><input type="radio" name="q2" value="1"></td><td><input type="radio" name="q2" value="5"></td></tr>
            </table>
            <fieldset>
              <legend>课程特点</legend>
              <label><input type="checkbox" name="q3" value="clear">条理清楚</label>
              <label><input type="checkbox" name="q3" value="useful">内容实用</label>
            </fieldset>
            <label>总体等级<select name="q4"><option value="">请选择</option><option>一般</option><option>优秀</option></select></label>
            <textarea name="comment"></textarea>
            <button>提交</button>\`;
        }, 250);
      }
    </script>
  `);

  await runConfiguredNavigation(page, config.workflow, config.timeouts, () => {});
  assert.match(await page.locator('body').innerText(), /课程评价列表/);
  const task = await clickNextEvaluationTask(page, config.workflow.taskList);
  assert.equal(task.clicked, true);
  const ready = await waitForEvaluationForm(page, config.timeouts.formReadyMs);
  assert.equal(ready.found, true);

  const result = await fillEvaluationForm(page, config.evaluation);
  assert.equal(result.radioGroups, 2);
  assert.equal(result.checkboxes, 1);
  assert.equal(result.selects, 1);
  assert.equal(result.textFields, 1);
  assert.equal(await page.locator('input[name="q1"][value="5"]').isChecked(), true);
  assert.equal(await page.locator('input[name="q2"][value="5"]').isChecked(), true);
  assert.equal(await page.locator('select[name="q4"]').inputValue(), '优秀');
  assert.match(await page.locator('textarea').inputValue(), /认真负责/);
  assert.equal((await detectEvaluationForm(page)).found, true);

  await page.setContent('<iframe srcdoc="<label><input type=radio name=frame_q value=1>一般</label><label><input type=radio name=frame_q value=5>优秀</label><textarea></textarea>"></iframe>');
  await page.waitForTimeout(200);
  const frameResult = await fillEvaluationForm(page, config.evaluation);
  assert.equal(frameResult.radioGroups, 1);
  assert.equal(frameResult.textFields, 1);

  await browser.close();
  console.log('Mock workflow tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
