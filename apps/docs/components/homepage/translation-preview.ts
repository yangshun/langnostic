import {
  previewCommand,
  previewFiles,
  previewSteps,
} from './translation-preview-data';

const stepStarts = previewSteps.map((_, index) =>
  previewSteps.slice(0, index).reduce((sum, step) => sum + step.duration, 0),
);
const totalDuration = previewSteps.reduce(
  (sum, step) => sum + step.duration,
  0,
);
const targetCount = previewFiles.length - 1;
const targetLabel = `${targetCount} ${targetCount === 1 ? 'locale' : 'locales'}`;

export function mountTranslationPreview(root: HTMLElement) {
  function element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const match = root.querySelector<T>(selector);
    if (!match)
      throw new Error(`Missing translation preview element: ${selector}`);
    return match;
  }

  const events = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const playButton = element<HTMLButtonElement>('[data-preview-play]');
  const replayButton = element<HTMLButtonElement>('[data-preview-replay]');
  const pauseIcon = element('[data-preview-pause-icon]');
  const playIcon = element('[data-preview-play-icon]');
  const announcement = element('[data-preview-announcement]');
  const fileRows = previewFiles.map((file) =>
    element(`[data-preview-file="${file.locale}"]`),
  );
  const fileBadges = fileRows.map((row) =>
    row.querySelector<HTMLElement>('[data-preview-file-badge]'),
  );
  const stepButtons = previewSteps.map((_, index) =>
    element<HTMLButtonElement>(`[data-preview-step="${index}"]`),
  );
  const editorStrip = element('[data-preview-editors]');
  const editors = previewFiles.map((file) => {
    const selector = `[data-preview-editor="${file.locale}"]`;
    return {
      pane: element(selector),
      code: element(`${selector} [data-preview-code]`),
      status: element(`${selector} [data-preview-editor-status]`),
      lastCode: '',
    };
  });
  const command = element('[data-preview-command]');
  const cursor = element('[data-preview-cursor]');
  const terminalState = element('[data-preview-terminal-state]');
  const progress = element('[data-preview-progress]');
  const results = previewFiles
    .slice(1)
    .map((file) => element(`[data-preview-result="${file.locale}"]`));
  const rerun = element('[data-preview-rerun]');
  const secondCommand = element('[data-preview-second-command]');
  const secondCursor = element('[data-preview-second-cursor]');
  const secondProgress = element('[data-preview-second-progress]');
  const complete = element('[data-preview-complete]');

  let elapsed = 0;
  let paused = reducedMotion.matches;
  let inView = false;
  let frame = 0;
  let lastTick = 0;
  let lastPaint = 0;
  let lastFocusedFile = -1;

  function setText(target: HTMLElement, text: string) {
    if (target.textContent !== text) target.textContent = text;
  }

  function renderCode(
    fileIndex: number,
    added: boolean,
    typedCharacters: number,
  ) {
    const editor = editors[fileIndex];
    const signature = `${added}:${typedCharacters}`;
    if (signature === editor.lastCode) return;
    editor.lastCode = signature;
    const file = previewFiles[fileIndex];
    const messages: Array<[string, string]> = [['cta', file.cta]];
    if (added) messages.push(['learnMore', file.learnMore]);
    messages.push(['welcome', file.welcome]);

    const content = document.createElement('code');
    function line(number: number, addedLine = false) {
      const row = document.createElement('span');
      row.className = 'preview-code-line';
      if (addedLine) row.dataset.added = '';
      const lineNumber = document.createElement('span');
      lineNumber.className = 'preview-line-number';
      lineNumber.setAttribute('aria-hidden', 'true');
      lineNumber.textContent = String(number);
      row.append(lineNumber);
      content.append(row);
      return row;
    }

    line(1).append(document.createTextNode('{'));
    messages.forEach(([key, value], index) => {
      const addedLine = key === 'learnMore';
      const row = line(index + 2, addedLine);
      const text = document.createElement('span');
      const keySpan = document.createElement('span');
      keySpan.className = 'preview-code-key';
      keySpan.textContent = JSON.stringify(key);
      const valueSpan = document.createElement('span');
      valueSpan.className = 'preview-code-value';
      const typing = addedLine && typedCharacters < value.length;
      valueSpan.textContent = typing
        ? `"${value.slice(0, typedCharacters)}`
        : JSON.stringify(value);
      text.append('  ', keySpan, ': ', valueSpan);
      if (typing) {
        const caret = document.createElement('span');
        caret.className = 'preview-typing-cursor';
        caret.setAttribute('aria-hidden', 'true');
        text.append(caret);
      } else if (index < messages.length - 1) {
        text.append(',');
      }
      row.append(text);
    });
    line(messages.length + 2).append(document.createTextNode('}'));
    editor.code.replaceChildren(content);
    setText(editor.status, added ? '3 messages · 1 new' : '2 messages');
  }

  function render() {
    const stage = previewSteps.findIndex(
      (step, index) => elapsed < stepStarts[index] + step.duration,
    );
    const stageTime = elapsed - stepStarts[stage];
    const stageProgress = stageTime / previewSteps[stage].duration;
    const typingProgress = Math.min(1, stageTime / 1200);
    const createdCount =
      stage > 1
        ? targetCount
        : stage === 1
          ? Math.min(targetCount, 1 + Math.floor(stageTime / 750))
          : 0;
    const updatedCount =
      stage === 4 ? Math.min(targetCount, 1 + Math.floor(stageTime / 750)) : 0;
    const updateComplete = updatedCount === targetCount;
    const sourceEdited = stage >= 2;
    // Bring the target into view during the re-run, before its contents change.
    const fileIndex =
      stage === 4
        ? updatedCount
        : stage === 3 && editorStrip.scrollWidth > editorStrip.clientWidth + 1
          ? targetCount
          : stage === 1
            ? createdCount
            : 0;
    const typedCharacters =
      stage === 2
        ? Math.ceil(previewFiles[0].learnMore.length * typingProgress)
        : Infinity;

    root.dataset.stage = String(stage);
    root.style.setProperty('--preview-progress', String(stageProgress));
    stepButtons.forEach((button, index) => {
      if (index === stage) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.toggleAttribute('data-complete', index < stage);
    });
    fileRows.forEach((row, index) => {
      row.hidden = index > createdCount;
      if (index === fileIndex) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
      const status =
        (index === 0 && sourceEdited) || (index > 0 && index <= updatedCount)
          ? 'updated'
          : index > 0 && index <= createdCount
            ? 'created'
            : '';
      if (row.dataset.status !== status) row.dataset.status = status;
      const badge = fileBadges[index];
      if (badge)
        setText(
          badge,
          status === 'updated' ? '+1' : status === 'created' ? 'NEW' : '',
        );
    });
    editors.forEach((editor, index) => {
      editor.pane.hidden = index > createdCount;
      editor.pane.dataset.selected = String(index === fileIndex);
      renderCode(
        index,
        index === 0 ? sourceEdited : index <= updatedCount,
        index === 0 ? typedCharacters : Infinity,
      );
    });
    if (lastFocusedFile !== fileIndex) {
      lastFocusedFile = fileIndex;
      if (editorStrip.scrollWidth > editorStrip.clientWidth + 1) {
        editorStrip.scrollTo({
          left: editors[fileIndex].pane.offsetLeft,
          behavior: paused || reducedMotion.matches ? 'instant' : 'smooth',
        });
      }
    }

    const typedCommand = previewCommand.slice(
      0,
      Math.ceil(previewCommand.length * typingProgress),
    );
    setText(command, stage === 0 ? typedCommand : previewCommand);
    cursor.hidden = stage > 0;
    progress.hidden = stage !== 0 || typingProgress < 1;
    setText(progress, `Translating 2 messages into ${targetLabel}…`);
    results.forEach((result, index) => {
      result.hidden = index >= createdCount;
    });
    rerun.hidden = stage < 3;
    setText(
      secondCommand,
      stage === 3 ? typedCommand : stage === 4 ? previewCommand : '',
    );
    secondCursor.hidden = stage !== 3;
    secondProgress.hidden =
      !(stage === 3 && typingProgress === 1) &&
      !(stage === 4 && !updateComplete);
    setText(secondProgress, `Translating 1 new message into ${targetLabel}…`);
    complete.hidden = stage !== 4 || !updateComplete;
    const status = [
      'Translating…',
      createdCount === targetCount ? 'Complete' : 'Writing files…',
      'Source changed',
      'Translating…',
      updateComplete ? 'Up to date' : 'Updating files…',
    ][stage];
    setText(terminalState, status);
  }

  function tick(now: number) {
    if (lastTick) elapsed = (elapsed + now - lastTick) % totalDuration;
    lastTick = now;
    if (now - lastPaint >= 32) {
      render();
      lastPaint = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    cancelAnimationFrame(frame);
    lastTick = 0;
    const playing = !paused && inView && !document.hidden;
    root.dataset.playing = String(playing);
    playButton.setAttribute('aria-pressed', String(paused));
    const label = `${paused ? 'Play' : 'Pause'} translation preview`;
    playButton.setAttribute('aria-label', label);
    playButton.title = label;
    pauseIcon.hidden = paused;
    playIcon.hidden = !paused;
    if (playing) frame = requestAnimationFrame(tick);
  }

  playButton.addEventListener(
    'click',
    () => {
      paused = !paused;
      if (!paused) {
        lastFocusedFile = -1;
        render();
      }
      syncPlayback();
    },
    { signal: events.signal },
  );

  replayButton.addEventListener(
    'click',
    () => {
      elapsed = 0;
      paused = false;
      lastFocusedFile = -1;
      render();
      syncPlayback();
      setText(announcement, 'Replaying the translation workflow.');
    },
    { signal: events.signal },
  );

  stepButtons.forEach((button, index) => {
    button.disabled = false;
    button.addEventListener(
      'click',
      () => {
        elapsed = stepStarts[index];
        paused = false;
        lastFocusedFile = -1;
        render();
        syncPlayback();
        setText(
          announcement,
          `Playing from step ${index + 1}: ${previewSteps[index].title}.`,
        );
      },
      { signal: events.signal },
    );
  });

  reducedMotion.addEventListener(
    'change',
    () => {
      if (reducedMotion.matches) paused = true;
      syncPlayback();
    },
    { signal: events.signal },
  );
  document.addEventListener('visibilitychange', syncPlayback, {
    signal: events.signal,
  });
  const observer = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    },
    { threshold: 0.15 },
  );
  observer.observe(root);
  element('[data-preview-controls]').hidden = false;
  render();
  syncPlayback();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    events.abort();
  };
}
