import { createHeroShader } from './shader';
import { mountTranslationPreview } from './translation-preview';

let activeRoot: HTMLElement | null = null;
let dispose: (() => void) | undefined;

export function mountHomepage() {
  const root = document.querySelector<HTMLElement>('.langnostic-home');
  if (root === activeRoot) return;
  dispose?.();
  activeRoot = root;
  if (!root) return;

  const events = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = root.querySelector<HTMLCanvasElement>('.hero-canvas');
  const motionButton = root.querySelector<HTMLButtonElement>('.motion-toggle');
  let paused = reducedMotion.matches;
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const shader = canvas ? createHeroShader(canvas, paused, isDark()) : null;
  const themeObserver = new MutationObserver(() => shader?.setDark(isDark()));
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const syncMotion = () => {
    shader?.setPaused(paused);
    motionButton?.setAttribute('aria-pressed', String(paused));
    const label = paused ? 'Play animation' : 'Pause animation';
    motionButton?.setAttribute('aria-label', label);
    motionButton?.setAttribute('title', label);
  };

  const preview = root.querySelector<HTMLElement>('[data-translation-preview]');
  const disposePreview = preview ? mountTranslationPreview(preview) : undefined;
  motionButton?.addEventListener(
    'click',
    () => {
      paused = !paused;
      syncMotion();
    },
    { signal: events.signal },
  );
  reducedMotion.addEventListener(
    'change',
    () => {
      paused = reducedMotion.matches;
      syncMotion();
    },
    { signal: events.signal },
  );
  syncMotion();
  if (motionButton) motionButton.hidden = !shader;

  dispose = () => {
    events.abort();
    themeObserver.disconnect();
    shader?.dispose();
    disposePreview?.();
    activeRoot = null;
    dispose = undefined;
  };
  document.addEventListener('astro:before-swap', () => dispose?.(), {
    once: true,
    signal: events.signal,
  });
}
