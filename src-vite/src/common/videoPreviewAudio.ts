import { ref } from 'vue';
import { config } from '@/common/config';

/**
 * Global audio ownership for thumbnail video previews.
 *
 * In the default single-audio mode only one preview may be audible at a time;
 * claiming audio mutes the previous owner but leaves it playing (muted). The
 * single-audio switch can be turned off to let every unmuted preview play its
 * own sound.
 */
export const activePreviewAudioIds = ref<Set<string>>(new Set());

const activeVideos = new Map<string, HTMLVideoElement>();

function clampVolume(value: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.8;
  return Math.min(1, Math.max(0, number));
}

function publishActiveIds(): void {
  activePreviewAudioIds.value = new Set(activeVideos.keys());
}

export function isPreviewAudioActive(id: string): boolean {
  return activePreviewAudioIds.value.has(id);
}

export function claimPreviewAudio(id: string, video: HTMLVideoElement, volume: number): void {
  const singleAudio = config.settings.grid.videoSingleAudio !== false;

  if (singleAudio) {
    for (const [otherId, otherVideo] of activeVideos) {
      if (otherId !== id) otherVideo.muted = true;
    }
    activeVideos.clear();
  }

  activeVideos.set(id, video);
  video.volume = clampVolume(volume);
  video.muted = video.volume <= 0;
  publishActiveIds();
}

export function releasePreviewAudio(id?: string): void {
  if (id != null) {
    const video = activeVideos.get(id);
    if (!video) return;
    video.muted = true;
    activeVideos.delete(id);
  } else {
    for (const video of activeVideos.values()) video.muted = true;
    activeVideos.clear();
  }
  publishActiveIds();
}

export function setPreviewAudioVolume(volume: number): number {
  const next = clampVolume(volume);
  for (const video of activeVideos.values()) {
    video.volume = next;
    video.muted = next <= 0;
  }
  return next;
}

/**
 * Turning single-audio back on must silence every owner but one. Called from a
 * component watcher (not at module load) so the config store is already active.
 */
export function enforceSingleAudioMode(): void {
  if (activeVideos.size <= 1) return;
  const entries = [...activeVideos.entries()];
  for (let i = 1; i < entries.length; i++) {
    entries[i][1].muted = true;
    activeVideos.delete(entries[i][0]);
  }
  publishActiveIds();
}
