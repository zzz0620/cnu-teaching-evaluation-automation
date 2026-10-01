function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function settle(page, waitMs = 350) {
  await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
}

async function pageHasKeywords(page, keywords, mode = 'any') {
  const wanted = (keywords || []).map(normalizeText).filter(Boolean);
  if (wanted.length === 0) return true;
  const text = await getPageText(page);
  return mode === 'all' ? wanted.every(keyword => text.includes(keyword)) : wanted.some(keyword => text.includes(keyword));
}

async function getPageText(page) {
  const texts = [];
  for (const frame of page.frames()) {
    const text = await frame.locator('body').innerText({ timeout: 1500 }).catch(() => '');
    if (text) texts.push(normalizeText(text));
  }
  return texts.join('\n');
}

async function waitForKeywords(page, keywords, timeoutMs) {
  if (!keywords || keywords.length === 0) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pageHasKeywords(page, keywords)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function clickByTexts(page, texts, options = {}) {
  const wanted = (texts || []).map(normalizeText).filter(Boolean);
  for (const frame of page.frames()) {
    for (const searchText of wanted) {
      const clicked = await frame.evaluate(({ searchText, rowSelectors, completedKeywords, incompleteKeywords }) => {
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const visible = element => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        };
        const textOf = element => normalize([
          element.innerText,
          element.textContent,
          element.value,
          element.title,
          element.getAttribute?.('aria-label')
        ].filter(Boolean).join(' '));
        const clickableSelector = 'button, a, input[type="button"], input[type="submit"], [role="button"], [onclick], label';
        const clickable = element => element.closest(clickableSelector) || element.querySelector?.(clickableSelector) || null;
        const selectors = 'button, a, input[type="button"], input[type="submit"], [role="button"], [onclick], label, td, li, span, div';
        const candidates = Array.from(document.querySelectorAll(selectors))
          .filter(visible)
          .filter(element => {
            const text = textOf(element);
            return text === searchText || (text.includes(searchText) && text.length <= searchText.length + 80);
          })
          .sort((a, b) => {
            const aExact = textOf(a) === searchText ? 0 : 1;
            const bExact = textOf(b) === searchText ? 0 : 1;
            return aExact - bExact || textOf(a).length - textOf(b).length;
          });

        for (const candidate of candidates) {
          const target = clickable(candidate);
          if (!target || !visible(target)) continue;
          if (rowSelectors?.length) {
            const row = target.closest(rowSelectors.join(','));
            const rowText = textOf(row || target.parentElement || target);
            const completed = (completedKeywords || []).some(keyword => rowText.includes(keyword));
            const incomplete = (incompleteKeywords || []).some(keyword => rowText.includes(keyword));
            if (completed && !incomplete) continue;
          }
          target.scrollIntoView({ block: 'center', inline: 'center' });
          target.click();
          return true;
        }
        return false;
      }, {
        searchText,
        rowSelectors: options.rowSelectors || [],
        completedKeywords: options.completedKeywords || [],
        incompleteKeywords: options.incompleteKeywords || []
      }).catch(() => false);
      if (clicked) return { clicked: true, text: searchText, frameUrl: frame.url() };
    }
  }
  return { clicked: false };
}

async function runConfiguredNavigation(page, workflow, timeouts, log = console.log) {
  for (const step of workflow.navigationSteps || []) {
    if (step.pageKeywords?.length) {
      let matched = await pageHasKeywords(page, step.pageKeywords);
      if (!matched && step.nextPageKeywords?.length && await pageHasKeywords(page, step.nextPageKeywords)) {
        log(`导航步骤“${step.name}”已处于目标页面，跳过。`);
        continue;
      }
      if (!matched) matched = await waitForKeywords(page, step.pageKeywords, timeouts.pageReadyMs);
      if (!matched) {
        if (step.optional) {
          log(`未匹配可选步骤“${step.name}”的页面关键字，跳过。`);
          continue;
        }
        throw new Error(`导航步骤“${step.name}”未找到页面关键字：${step.pageKeywords.join(' / ')}`);
      }
    }

    const result = await clickByTexts(page, step.clickTexts);
    if (!result.clicked) {
      if (step.optional) {
        log(`未找到可选步骤“${step.name}”的入口，跳过。`);
        continue;
      }
      throw new Error(`导航步骤“${step.name}”未找到可点击文字：${step.clickTexts.join(' / ')}`);
    }
    log(`已执行导航步骤：${step.name}（${result.text}）`);
    await settle(page);

    if (step.nextPageKeywords?.length) {
      const reached = await waitForKeywords(page, step.nextPageKeywords, timeouts.pageReadyMs);
      if (!reached && !step.optional) {
        throw new Error(`导航步骤“${step.name}”点击后未进入预期页面：${step.nextPageKeywords.join(' / ')}`);
      }
    }
  }
}

async function clickNextEvaluationTask(page, taskList) {
  return clickByTexts(page, taskList.entryTexts, {
    rowSelectors: taskList.rowSelectors,
    completedKeywords: taskList.completedKeywords,
    incompleteKeywords: taskList.incompleteKeywords
  });
}

async function detectEvaluationForm(page) {
  let controls = 0;
  let questions = 0;
  for (const frame of page.frames()) {
    const result = await frame.evaluate(() => {
      const visible = element => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const fields = Array.from(document.querySelectorAll(
        'input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
      )).filter(visible);
      const radioNames = new Set(fields.filter(field => field.type === 'radio').map(field => field.name || field.id));
      return { controls: fields.length, questions: radioNames.size + fields.filter(field => field.type !== 'radio').length };
    }).catch(() => ({ controls: 0, questions: 0 }));
    controls += result.controls;
    questions += result.questions;
  }
  return { found: controls > 0, controls, questions };
}

async function waitForEvaluationForm(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await detectEvaluationForm(page);
    if (result.found) return result;
    await page.waitForTimeout(300);
  }
  return { found: false, controls: 0, questions: 0 };
}

async function fillEvaluationForm(page, evaluation) {
  const totals = { radioGroups: 0, checkboxes: 0, selects: 0, textFields: 0, questions: 0, hasForm: false };
  for (const frame of page.frames()) {
    const result = await frame.evaluate(config => {
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const dispatch = element => {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const descriptor = input => {
        const parts = [input.value, input.title, input.getAttribute('aria-label')];
        if (input.id) {
          const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (label) parts.push(label.innerText, label.textContent);
        }
        const label = input.closest('label');
        if (label) parts.push(label.innerText, label.textContent);
        const cell = input.closest('td, th');
        if (cell) {
          parts.push(cell.innerText, cell.textContent);
          const row = cell.parentElement;
          const index = Array.from(row?.children || []).indexOf(cell);
          const table = cell.closest('table');
          for (const headerRow of Array.from(table?.querySelectorAll('tr') || []).slice(0, 4)) {
            const header = headerRow.children[index];
            if (header && header !== cell) parts.push(header.innerText, header.textContent);
          }
        }
        const siblingText = [input.previousElementSibling, input.nextElementSibling]
          .filter(Boolean)
          .map(element => element.innerText || element.textContent);
        parts.push(...siblingText);
        return normalize(parts.filter(Boolean).join(' '));
      };
      const scoreOption = input => {
        const text = descriptor(input);
        let score = 0;
        config.preferredOptionTexts.forEach((keyword, index) => {
          const contains = keyword.length <= 1
            ? text.split(/[^A-Za-z0-9\u4e00-\u9fff]+/).includes(keyword)
            : text.includes(keyword);
          if (text === keyword) score = Math.max(score, 2000 - index * 10);
          else if (contains) score = Math.max(score, 1500 - index * 10);
        });
        config.rejectedOptionTexts.forEach(keyword => {
          if (text.includes(keyword)) score -= 1000;
        });
        if (config.fallbackRadioChoice === 'auto-best') {
          const numeric = text.match(/(?:^|\D)([1-9](?:\.\d+)?)(?:\D|$)/);
          if (numeric) score += Number(numeric[1]);
        }
        return score;
      };

      const radios = Array.from(document.querySelectorAll('input[type="radio"]:not([disabled])')).filter(visible);
      const groups = new Map();
      radios.forEach((radio, index) => {
        const key = radio.name || radio.getAttribute('data-question') || `unnamed-${index}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(radio);
      });

      let radioGroups = 0;
      for (const group of groups.values()) {
        if (group.some(radio => radio.checked)) continue;
        let chosen = [...group].sort((a, b) => scoreOption(b) - scoreOption(a))[0];
        if (!chosen || scoreOption(chosen) <= 0) {
          if (config.fallbackRadioChoice === 'first') chosen = group[0];
          else if (config.fallbackRadioChoice === 'auto-best') {
            chosen = [...group].sort((a, b) => Number(b.value) - Number(a.value))[0] || group[group.length - 1];
          } else chosen = group[group.length - 1];
        }
        chosen.scrollIntoView({ block: 'center', inline: 'center' });
        chosen.click();
        dispatch(chosen);
        radioGroups += 1;
      }

      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]:not([disabled])')).filter(visible);
      let checkboxCount = 0;
      if (config.checkboxMode !== 'none') {
        const groupsByName = new Map();
        checkboxes.forEach((checkbox, index) => {
          const key = checkbox.name || checkbox.getAttribute('data-question') || `checkbox-${index}`;
          if (!groupsByName.has(key)) groupsByName.set(key, []);
          groupsByName.get(key).push(checkbox);
        });
        for (const group of groupsByName.values()) {
          if (group.some(checkbox => checkbox.checked)) continue;
          const targets = config.checkboxMode === 'all' ? group : [group[0]];
          targets.filter(Boolean).forEach(checkbox => {
            checkbox.click();
            dispatch(checkbox);
            checkboxCount += 1;
          });
        }
      }

      const selects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(visible);
      let selectCount = 0;
      for (const select of config.selectMode === 'none' ? [] : selects) {
        if (select.value && select.selectedIndex > 0) continue;
        const options = Array.from(select.options).filter(option => !option.disabled && normalize(option.textContent));
        const preferred = options.find(option => config.preferredOptionTexts.some(keyword => normalize(option.textContent).includes(keyword)));
        const chosen = preferred || (config.selectMode === 'preferred-only' ? null : options.find(option => option.value && option.index > 0) || options[0]);
        if (!chosen) continue;
        select.value = chosen.value;
        dispatch(select);
        selectCount += 1;
      }

      const textareas = Array.from(document.querySelectorAll('textarea:not([disabled]), [contenteditable="true"]')).filter(visible);
      const blockedName = /(search|query|filter|course|teacher|student|number|code|id)/i;
      const textInputs = config.fillOptionalTextInputs
        ? Array.from(document.querySelectorAll('input[type="text"]:not([disabled])')).filter(visible).filter(input => !blockedName.test(`${input.name} ${input.id} ${input.placeholder}`))
        : [];
      let textFields = 0;
      [...textareas, ...textInputs].forEach((field, index) => {
        const current = normalize(field.value ?? field.textContent);
        if (current) return;
        const answer = config.textAnswers[index] || config.textAnswers[0];
        if (!answer) return;
        field.focus();
        if (field.isContentEditable) field.textContent = answer;
        else field.value = answer;
        dispatch(field);
        textFields += 1;
      });

      return {
        radioGroups,
        checkboxes: checkboxCount,
        selects: selectCount,
        textFields,
        questions: groups.size + checkboxes.length + selects.length + textareas.length,
        hasForm: radios.length + checkboxes.length + selects.length + textareas.length > 0
      };
    }, evaluation).catch(() => ({ radioGroups: 0, checkboxes: 0, selects: 0, textFields: 0, questions: 0, hasForm: false }));

    for (const key of ['radioGroups', 'checkboxes', 'selects', 'textFields', 'questions']) totals[key] += result[key];
    totals.hasForm ||= result.hasForm;
  }
  return totals;
}

async function getPageSignature(page) {
  const pieces = [];
  for (const frame of page.frames()) {
    const text = await frame.locator('body').innerText({ timeout: 1200 }).catch(() => '');
    if (text) pieces.push(`${frame.url()}\n${normalizeText(text).slice(0, 2500)}`);
  }
  return pieces.join('\n---\n');
}

async function waitForPageChange(page, previousSignature, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await settle(page, 150);
    const signature = await getPageSignature(page);
    if (signature && signature !== previousSignature) return { changed: true, signature };
    await page.waitForTimeout(250);
  }
  return { changed: false, signature: previousSignature };
}

async function handleConfirmations(page, texts, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let clicked = 0;
  while (Date.now() < deadline) {
    const result = await clickByTexts(page, texts);
    if (!result.clicked) {
      await page.waitForTimeout(250);
      continue;
    }
    clicked += 1;
    await page.waitForTimeout(500);
  }
  return clicked;
}

module.exports = {
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
  waitForKeywords,
  waitForPageChange
};
