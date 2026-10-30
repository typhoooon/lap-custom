<template>
  <div class="fixed inset-0 z-[900] flex items-center justify-center bg-base-300 text-base-content" data-tauri-drag-region>
    <div class="w-[360px] max-w-[calc(100vw-2rem)] rounded-box border border-base-content/10 bg-base-200/80 p-6 shadow-xl backdrop-blur">
      <div class="mb-4 flex items-center gap-3">
        <IconLock class="h-6 w-6 shrink-0 text-primary" />
        <div class="min-w-0">
          <div class="truncate text-base font-semibold">{{ libraryName }}</div>
          <div class="text-xs text-base-content/50">{{ $t('library_lock.locked_library') }}</div>
        </div>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span>{{ $t('library_lock.unlock_prompt') }}</span>
        <input
          ref="inputRef"
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="input input-sm w-full"
          :placeholder="$t('library_lock.password_placeholder')"
          :disabled="busy"
          @keydown.enter.prevent="unlock"
        />
      </label>

      <p v-if="error" class="mt-2 text-xs leading-5 text-error">{{ error }}</p>
      <p class="mt-3 text-[11px] leading-5 text-base-content/40">{{ $t('library_lock.frontend_only') }}</p>

      <div class="mt-4 flex items-center justify-between gap-2">
        <button type="button" class="t-button-default" :disabled="busy" @click="quit">
          {{ $t('library_lock.exit') }}
        </button>
        <button type="button" class="t-button-primary" :disabled="busy" @click="unlock">
          <span v-if="busy" class="loading loading-spinner loading-xs mr-1"></span>
          {{ $t('library_lock.unlock') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { IconLock } from '@/common/icons';
import { useUIStore } from '@/stores/uiStore';
import { verifyLibraryPassword } from '@/common/libraryLock';

const props = defineProps({
  libraryId: { type: String, required: true },
  libraryName: { type: String, default: '' },
});

const emit = defineEmits(['unlocked']);
const { t } = useI18n();
const uiStore = useUIStore();

const password = ref('');
const busy = ref(false);
const error = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

async function unlock() {
  if (busy.value) return;
  error.value = '';
  if (!password.value) {
    error.value = t('library_lock.password_required');
    return;
  }

  busy.value = true;
  try {
    if (!(await verifyLibraryPassword(props.libraryId, password.value))) {
      error.value = t('library_lock.wrong_password');
      password.value = '';
      await nextTick();
      inputRef.value?.focus();
      return;
    }
    emit('unlocked');
  } catch {
    error.value = t('library_lock.crypto_unavailable');
  } finally {
    busy.value = false;
  }
}

function quit() {
  void getCurrentWebviewWindow().close();
}

onMounted(() => {
  uiStore.pushInputHandler('LibraryLockScreen');
  nextTick(() => inputRef.value?.focus());
});

onUnmounted(() => {
  uiStore.removeInputHandler('LibraryLockScreen');
});
</script>
