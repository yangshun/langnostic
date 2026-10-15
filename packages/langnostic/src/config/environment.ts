import type { ConfigValue } from './types';

export function resolveEnvironment(
  value: ConfigValue,
  field: string,
): ConfigValue {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      resolveEnvironment(item, `${field}.${index}`),
    );
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Object.keys(value).length === 1 && 'env' in value) {
    if (typeof value.env !== 'string' || value.env.trim() === '') {
      throw new Error(
        `${field}: Expected a non-empty environment variable name`,
      );
    }
    const resolved = process.env[value.env];
    if (resolved === undefined) {
      throw new Error(`${field}: Environment variable ${value.env} is not set`);
    }
    return resolved;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveEnvironment(item, `${field}.${key}`),
    ]),
  );
}
