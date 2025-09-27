export type { ConfigType } from '@/config/types';
export type {
  LangnosticPlugin,
  TranslationFileMetadata,
  TranslationLocale as Locale,
  TranslationStringArg,
} from '@/core/types';
export {
  buildTranslatedContentMap,
  buildTranslationStrings,
} from '@/lib/plugins';
