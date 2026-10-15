import type {
  TranslationGroupBatchId,
  TranslationGroupBatchStatus,
  TranslationStringArg,
  TranslationStringResult,
} from '@/core/types';

export class TranslationGroupBatch {
  #batchId: TranslationGroupBatchId;
  #status: TranslationGroupBatchStatus;
  #errors: Array<Error>;
  #time: {
    end: number | null;
    start: number | null;
  };
  #translations: Array<TranslationStringResult>;
  #strings: ReadonlyArray<TranslationStringArg>;

  constructor(
    batchId: TranslationGroupBatchId,
    strings: ReadonlyArray<TranslationStringArg>,
  ) {
    this.#batchId = batchId;
    this.#status = 'queued';
    this.#errors = [];
    this.#time = { end: null, start: null };
    this.#translations = [];
    this.#strings = strings;
  }

  get batchId() {
    return this.#batchId;
  }

  get status() {
    return this.#status;
  }

  get strings() {
    return this.#strings;
  }

  get translations() {
    return this.#translations;
  }

  get errors(): ReadonlyArray<Error> {
    return this.#errors;
  }

  get readyToWrite() {
    return (
      this.#status === 'translating' &&
      this.#translations.length === this.#strings.length
    );
  }

  startTranslating() {
    if (this.#status !== 'queued') {
      return;
    }

    this.#status = 'translating';
    this.#time.start = Date.now();
  }

  addTranslations(results: ReadonlyArray<TranslationStringResult>) {
    if (this.#status !== 'translating') {
      throw Error(
        'Cannot add translations to a batch that is not translating.',
      );
    }

    this.#translations.push(...results);
  }

  markSuccess() {
    if (!this.readyToWrite) {
      throw Error('Cannot complete a batch before all translations are ready.');
    }

    this.#status = 'success';
    this.#time.end = Date.now();
  }

  addError(error: unknown) {
    this.#errors.push(
      error instanceof Error ? error : new Error(String(error)),
    );
    if (this.#status === 'error') {
      return;
    }

    this.#status = 'error';
    this.#time.end = Date.now();
  }

  get duration(): number | null {
    return this.#time.start
      ? (this.#time.end ?? Date.now()) - this.#time.start
      : null;
  }
}
