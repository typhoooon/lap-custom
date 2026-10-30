import { ref } from 'vue';

/**
 * True while the separate image/video viewer window exists.
 *
 * Thumbnail previews live in the main window and would otherwise keep decoding
 * behind a full-screen viewer. The preview scheduler and hover previews read
 * this flag and stop/pause while it is set.
 */
export const isMediaViewerWindowOpen = ref(false);

/**
 * True while an inline preview (quick view / filmstrip) has taken over the
 * main window with its own fullscreen session.
 */
export const isPreviewFullScreen = ref(false);

/** True when thumbnail previews must stay quiet because a viewer owns the screen. */
export function isThumbnailPreviewSuspended(): boolean {
  return isMediaViewerWindowOpen.value || isPreviewFullScreen.value;
}
