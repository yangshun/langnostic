import type { LangnosticPlugin, TranslationAI } from '@/core/types';

export type ConfigType = {
  ai: TranslationAI;
  concurrencyLimit?: number;
  groups: Array<ConfigGroup>;
  localeConfig: LocaleConfig;
};

export type LocaleConfig = {
  source: string; // Source locale
  target: Array<string>; // Target locales
};

export type ConfigGroupPathItem = {
  source: string; // Source paths for source locale file
  target: string; // Target paths for translated locale file
};

export type ConfigGroup = {
  localeConfig?: LocaleConfig; // Optional, group-specific locale config
  name: string; // Unique identifier for a group
  paths: Array<ConfigGroupPathItem>;
  plugin: LangnosticPlugin; // Plugin to use for the group
  stringsPerRequest?: number; // Optional, maximum number of strings per request
};

export type ConfigValue =
  | null
  | boolean
  | number
  | string
  | Array<ConfigValue>
  | { [key: string]: ConfigValue };

export type ModuleReference = {
  module: string;
  export?: string;
  options?: Record<string, ConfigValue>;
};

export type DeclarativeConfigType = Omit<ConfigType, 'ai' | 'groups'> & {
  version: 1;
  ai: {
    model: string;
    provider?: ModuleReference;
    providerOptions?: Record<string, Record<string, ConfigValue>>;
    temperature?: number;
    topP?: number;
  };
  groups: Array<
    Omit<ConfigGroup, 'plugin'> & { plugin: string | ModuleReference }
  >;
};
