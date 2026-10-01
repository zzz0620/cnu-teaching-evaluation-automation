const DEFAULT_CONFIG = {
  schemaVersion: 2,
  startUrl: 'https://urp.cnu.edu.cn/eams/homeExt.action#',
  edgeProfileDir: '.edge-profile',
  manualLogin: true,
  closeBrowserOnExit: false,
  slowMoMs: 100,
  timeouts: {
    pageReadyMs: 20000,
    formReadyMs: 15000,
    idleRetryMs: 5000,
    confirmationMs: 4000
  },
  workflow: {
    navigationSteps: [
      {
        name: '从首页进入教学评价',
        pageKeywords: ['首页'],
        clickTexts: ['教学评价', '学生评教', '教学质量评价'],
        nextPageKeywords: ['评价', '评教'],
        optional: false
      }
    ],
    taskList: {
      pageKeywords: ['课程', '教师', '评价'],
      entryTexts: ['进入评价', '开始评价', '评价', '评教', '未评'],
      incompleteKeywords: ['未评', '未提交', '待评价', '进行中'],
      completedKeywords: ['已评', '已提交', '已完成', '完成评价'],
      emptyKeywords: ['暂无数据', '没有未评', '全部完成'],
      rowSelectors: ['tr', 'li', '[role="row"]', '.item', '.list-group-item']
    }
  },
  evaluation: {
    preferredOptionTexts: ['非常满意', '优秀', '完全同意', '非常同意', 'A', '5'],
    rejectedOptionTexts: ['不满意', '很差', '完全不同意'],
    fallbackRadioChoice: 'last',
    checkboxMode: 'first',
    selectMode: 'first-non-empty',
    textAnswers: ['老师授课认真负责，课程内容清晰，课堂组织有序，学习收获较大。'],
    fillOptionalTextInputs: false
  },
  submission: {
    mode: 'manual',
    submitButtonTexts: ['提交', '保存并提交', '完成评价'],
    confirmButtonTexts: ['确定', '确认', '是', 'OK']
  },
  runtime: {
    keepRunning: true,
    maxEvaluations: 0,
    diagnosticsDir: 'diagnostics'
  }
};

function mergeConfig(userConfig = {}) {
  return deepMerge(DEFAULT_CONFIG, migrateLegacyConfig(userConfig));
}

function deepMerge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== 'object') return override === undefined ? base : override;

  const result = { ...base };
  if (!override || typeof override !== 'object') return result;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return result;
}

function migrateLegacyConfig(config) {
  if (config.schemaVersion === 2) return config;

  const migrated = { ...config, schemaVersion: 2 };
  migrated.timeouts = {
    pageReadyMs: config.formReadyTimeoutMs,
    formReadyMs: config.formReadyTimeoutMs,
    idleRetryMs: config.idleRetryMs,
    confirmationMs: config.confirmWaitMs
  };
  migrated.evaluation = {
    preferredOptionTexts: config.preferredOptionTexts,
    fallbackRadioChoice: config.fallbackRadioChoice,
    textAnswers: config.textareaAnswers,
    fillOptionalTextInputs: config.fillTextInputs
  };
  migrated.submission = {
    mode: config.submitMode || (config.submit ? 'auto' : 'manual'),
    submitButtonTexts: config.submitButtonTexts,
    confirmButtonTexts: config.confirmButtonTexts
  };
  migrated.runtime = {
    keepRunning: config.keepRunning,
    maxEvaluations: config.maxForms,
    diagnosticsDir: config.diagnosticsDir
  };
  return migrated;
}

function validateConfig(config) {
  const errors = [];
  if (!/^https?:\/\//i.test(config.startUrl)) errors.push('startUrl 必须是 http 或 https 地址');
  if (!Array.isArray(config.workflow.navigationSteps)) errors.push('workflow.navigationSteps 必须是数组');
  for (const [index, step] of config.workflow.navigationSteps.entries()) {
    if (!step.name) errors.push(`navigationSteps[${index}] 缺少 name`);
    if (!Array.isArray(step.clickTexts) || step.clickTexts.length === 0) {
      errors.push(`navigationSteps[${index}] 至少需要一个 clickTexts 关键字`);
    }
  }
  if (!['manual', 'auto', 'off'].includes(config.submission.mode)) {
    errors.push('submission.mode 只能是 manual、auto 或 off');
  }
  if (!['first', 'last', 'auto-best'].includes(config.evaluation.fallbackRadioChoice)) {
    errors.push('evaluation.fallbackRadioChoice 只能是 first、last 或 auto-best');
  }
  if (!['first-non-empty', 'preferred-only', 'none'].includes(config.evaluation.selectMode)) {
    errors.push('evaluation.selectMode 只能是 first-non-empty、preferred-only 或 none');
  }
  return errors;
}

module.exports = { DEFAULT_CONFIG, mergeConfig, validateConfig };
