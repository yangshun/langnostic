export type { ConfigType } from '@/config/types';
export type {
  LangnosticPlugin,
  TranslationFileItem,
  TranslationFileMetadata,
  TranslationLocale,
  TranslationStringArg,
} from '@/core/types';
export {
  ensureFileAndDirExists,
  fileExists,
  readFile,
  writeFile,
} from '@/lib/file-service';
export {
  buildTranslatedContentMap,
  buildTranslationStrings,
} from '@/lib/plugins';
