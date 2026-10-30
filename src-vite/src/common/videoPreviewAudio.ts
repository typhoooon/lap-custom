import { ref } from 'vue';

/**
 * Global audio ownership for thumbnail video previews.
 *
 * Only one preview may be audible at a time. Claiming audio mutes the previous
 * owner but leaves it playing (muted), matching the grid's autoplay behavior.
 */
export const activePreviewAudioId = ref<string | null>(null);

let activeVideo: HTMLVideoElement | null = null;

function clampVolume(value: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.8;
  return Math.min(1, Math.max(0, number));
}

export function claimPreviewAudio(id: string, video: HTMLVideoElement, volume: number): void {
  if (activeVideo && activeVideo !== video) {
    activeVideo.muted = true;
  }
  activePreviewAudioId.value = id;
  activeVideo = video;
  video.volume = clampVolume(volume);
  video.muted = video.volume <= 0;
}

export function releasePreviewAudio(id?: string): void {
  if (id != null && activePreviewAudioId.value !== id) return;
  if (activeVideo) {
    activeVideo.muted = true;
  }
  activeVideo = null;
  activePreviewAudioId.value = null;
}

export function setPreviewAudioVolume(volume: number): number {
  const next = clampVolume(volume);
  if (activeVideo) {
    activeVideo.volume = next;
    activeVideo.muted = next <= 0;
  }
  return next;
}
