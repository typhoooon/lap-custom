import { config } from '@/common/config';
import { selectPreviewCandidates } from '@/common/previewSelection';

/**
 * Coordinates auto-playing thumbnail video previews.
 *
 * Virtual scrolling already limits how many thumbnails are mounted, but a large
 * window with small thumbnails can still expose dozens of videos. The scheduler
 * only starts the most relevant visible candidates (hovered first, then the
 * ones closest to the viewport centre) and caps concurrency.
 */

export interface PreviewCandidate {
  id: string;
  isEligible: () => boolean;
  start: () => void | boolean | Promise<void | boolean>;
  stop: () => void;
  visible: boolean;
  priority: number;
  hovered: boolean;
  failedUntil: number;
}

type PreviewCandidateSeed = Pick<PreviewCandidate, 'id' | 'isEligible' | 'start' | 'stop'>;

const candidates = new Map<string, PreviewCandidate>();
const active = new Set<string>();
let scheduled = false;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function autoplayEnabled(): boolean {
  return config.settings.grid.videoAutoplay !== false;
}

function autoplayLimit(): number {
  const value = Math.round(Number(config.settings.grid.videoAutoplayLimit));
  return Math.max(1, Math.min(16, Number.isFinite(value) ? value : 8));
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(run);
}

function run(): void {
  scheduled = false;
  const currentTime = now();

  const eligible = [...candidates.values()].filter(
    (candidate) => candidate.visible
      && candidate.failedUntil <= currentTime
      && candidate.isEligible(),
  );

  const next = new Set(
    autoplayEnabled() && !(typeof document !== 'undefined' && document.hidden)
      ? selectPreviewCandidates(eligible, autoplayLimit()).map((candidate) => candidate.id)
      : [],
  );

  for (const id of [...active]) {
    if (next.has(id)) continue;
    active.delete(id);
    try {
      candidates.get(id)?.stop();
    } catch (error) {
      console.warn('Failed to stop thumbnail video preview:', error);
    }
  }

  for (const candidate of eligible) {
    if (!next.has(candidate.id) || active.has(candidate.id)) continue;

    active.add(candidate.id);
    let result: void | boolean | Promise<void | boolean>;
    try {
      result = candidate.start();
    } catch {
      result = false;
    }

    if (result === false) {
      active.delete(candidate.id);
      candidate.failedUntil = currentTime + 5000;
      continue;
    }

    if (result && typeof (result as Promise<void | boolean>).then === 'function') {
      (result as Promise<void | boolean>)
        .then((ok) => {
          if (ok === false) {
            active.delete(candidate.id);
            candidate.failedUntil = now() + 5000;
            schedule();
          }
        })
        .catch(() => {
          active.delete(candidate.id);
          candidate.failedUntil = now() + 5000;
          schedule();
        });
    }
  }
}

export function registerPreviewCandidate(seed: PreviewCandidateSeed): void {
  candidates.set(seed.id, {
    ...seed,
    visible: false,
    priority: 0,
    hovered: false,
    failedUntil: 0,
  });
  schedule();
}

export function unregisterPreviewCandidate(id: string): void {
  const candidate = candidates.get(id);
  candidates.delete(id);
  if (!candidate) return;
  if (active.delete(id)) {
    try {
      candidate.stop();
    } catch {
      // The component is unmounting; its video may already be gone.
    }
  }
  schedule();
}

export function updatePreviewVisibility(id: string, visible: boolean, priority = 0): void {
  const candidate = candidates.get(id);
  if (!candidate) return;
  const wasVisible = candidate.visible;
  const changed = wasVisible !== visible || Math.abs(candidate.priority - priority) > 0.001;
  candidate.visible = visible;
  candidate.priority = priority;
  // Give a previously failed candidate a chance when it re-enters the viewport.
  if (visible && !wasVisible) {
    candidate.failedUntil = 0;
  }
  if (changed) schedule();
}

export function setPreviewHover(id: string, hovered: boolean): void {
  const candidate = candidates.get(id);
  if (!candidate || candidate.hovered === hovered) return;
  candidate.hovered = hovered;
  schedule();
}

/**
 * The thumbnail stopped its own preview (decode error, cloud-only, unmount
 * fallback). Free its slot without calling `stop()` again.
 */
export function releasePreviewSlot(id: string): void {
  if (!active.delete(id)) return;
  schedule();
}

/** Re-evaluate after the autoplay setting or concurrency limit changes. */
export function refreshPreviewScheduler(): void {
  schedule();
}

// Do not decode videos while the window is hidden (minimized / another tab).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const id of [...active]) {
        active.delete(id);
        try {
          candidates.get(id)?.stop();
        } catch {
          // Ignore teardown errors while the window is hidden.
        }
      }
    } else {
      schedule();
    }
  });
}
