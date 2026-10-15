export type { ConfigType } from '@/config/types';
export type {
  LangnosticPlugin,
  TranslationFileItem,
  TranslationFileMetadata,
  TranslationLocale,
  TranslationStringArg,
} from '@/core/types';
export {
  buildTranslatedContentMap,
  buildTranslationStrings,
} from '@/lib/plugins';
export { writeFileAtomic, writeJsonAtomic } from '@/lib/files';
