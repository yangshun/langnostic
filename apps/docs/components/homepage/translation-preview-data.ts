export const previewFiles = [
  {
    locale: 'en-US',
    language: 'English',
    cta: 'Get started',
    welcome: 'Hello, world.',
    learnMore: 'Learn more',
  },
  {
    locale: 'zh-CN',
    language: 'Simplified Chinese',
    cta: '开始使用',
    welcome: '你好，世界。',
    learnMore: '了解更多',
  },
] as const;

export const previewSteps = [
  { label: 'Translate', title: 'Run the translation command', duration: 1800 },
  { label: 'Translated', title: 'View zh-CN.json', duration: 1200 },
  { label: 'Edit', title: 'Add a message to en-US.json', duration: 1800 },
  { label: 'Re-run', title: 'Run the command again', duration: 1800 },
  { label: 'Update', title: 'Update zh-CN.json', duration: 1400 },
] as const;

export const previewCommand = 'npx langnostic translate';
