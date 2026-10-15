import type { AIProvider, ConfigValue } from './types';

const protectedFields: Record<AIProvider, ReadonlyArray<string>> = {
  openai: ['input', 'instructions', 'tools', 'tool_choice', 'text.format'],
  anthropic: [
    'messages',
    'system',
    'tools',
    'tool_choice',
    'output_format',
    'output_config.format',
  ],
  google: [
    'contents',
    'systemInstruction',
    'tools',
    'toolConfig',
    'generationConfig.responseMimeType',
    'generationConfig.responseSchema',
    'generationConfig.responseJsonSchema',
    'generationConfig.responseFormat',
  ],
  'openai-compatible': [
    'messages',
    'tools',
    'tool_choice',
    'response_format',
    'n',
  ],
};

function isObject(
  value: ConfigValue | undefined,
): value is Record<string, ConfigValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeParameters(
  body: Record<string, ConfigValue>,
  parameters: Record<string, ConfigValue>,
  protectedPaths: ReadonlySet<string>,
  prefix = '',
): Record<string, ConfigValue> {
  const merged = { ...body };
  for (const [key, value] of Object.entries(parameters)) {
    const field = `${prefix}${key}`;
    if (protectedPaths.has(field)) continue;
    // An ancestor replacement must not remove a nested output schema.
    if (
      !isObject(value) &&
      [...protectedPaths].some((path) => path.startsWith(`${field}.`))
    )
      continue;
    const original = Object.prototype.hasOwnProperty.call(body, key)
      ? body[key]
      : undefined;
    // defineProperty also keeps JSON keys such as __proto__ ordinary data.
    Object.defineProperty(merged, key, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: isObject(value)
        ? mergeParameters(
            isObject(original) ? original : {},
            value,
            protectedPaths,
            `${field}.`,
          )
        : value,
    });
  }
  return merged;
}

export function createProviderFetch(
  provider: AIProvider,
  parameters: Record<string, ConfigValue> | undefined,
): typeof globalThis.fetch | undefined {
  if (parameters === undefined) return undefined;
  const protectedPaths = new Set([
    'model',
    'stream',
    ...protectedFields[provider],
  ]);
  return (url, init) => {
    // These adapters send generation requests as JSON strings.
    const body = JSON.parse(init!.body as string) as Record<
      string,
      ConfigValue
    >;
    return globalThis.fetch(url, {
      ...init,
      body: JSON.stringify(mergeParameters(body, parameters, protectedPaths)),
    });
  };
}
