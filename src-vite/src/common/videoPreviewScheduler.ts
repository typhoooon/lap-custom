import { watch } from 'vue';
import { config } from '@/common/config';
import { selectPreviewCandidates } from '@/common/previewSelection';
import { isMediaViewerWindowOpen, isPreviewFullScreen, isThumbnailPreviewSuspended } from '@/common/viewerState';

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
let suspendedUntil = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (!Number.isFinite(value)) return 8;
  // 0 means "no explicit cap". Visibility is still enforced by the candidate
  // filter below, so off-screen thumbnails never decode.
  if (value <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(64, value);
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
    autoplayEnabled()
      && !isThumbnailPreviewSuspended()
      && currentTime >= suspendedUntil
      && !(typeof document !== 'undefined' && document.hidden)
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

/**
 * Stop every preview immediately and keep the scheduler quiet for a short
 * transition. Used when the query context (album, collection, library view…)
 * changes: the old thumbnails are about to unmount and must release decoders
 * and audio before the new grid registers.
 */
export function pauseAllPreviewVideos(suspendMs = 400): void {
  suspendedUntil = Math.max(suspendedUntil, now() + Math.max(0, suspendMs));
  for (const id of [...active]) {
    active.delete(id);
    try {
      candidates.get(id)?.stop();
    } catch {
      // The old thumbnail may already be tearing down.
    }
  }
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    schedule();
  }, Math.max(0, suspendedUntil - now()) + 20);
  schedule();
}

/** Re-evaluate after the autoplay setting or concurrency limit changes. */
export function refreshPreviewScheduler(): void {
  schedule();
}

// Stop previews while a dedicated image/video viewer window is in front or an
// inline preview is fullscreen, then resume the visible candidates afterwards.
watch([isMediaViewerWindowOpen, isPreviewFullScreen], () => schedule());

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
