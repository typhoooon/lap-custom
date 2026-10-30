<template>
  <ModalDialog
    :title="title"
    :width="380"
    :z-index="700"
    position-key="library-password-dialog"
    @cancel="cancel"
  >
    <div class="flex flex-col gap-2 text-sm">
      <p class="text-xs leading-5 text-base-content/50">{{ $t('library_lock.frontend_only') }}</p>

      <label v-if="mode === 'change' || mode === 'remove'" class="flex flex-col gap-1">
        <span>{{ $t('library_lock.current_password') }}</span>
        <input
          ref="firstInputRef"
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          class="input input-sm w-full"
          :placeholder="$t('library_lock.password_placeholder')"
          :disabled="busy"
          @keydown.enter.prevent="submit"
        />
      </label>

      <template v-if="mode === 'set' || mode === 'change'">
        <label class="flex flex-col gap-1">
          <span>{{ $t('library_lock.new_password') }}</span>
          <input
            ref="newInputRef"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            class="input input-sm w-full"
            :placeholder="$t('library_lock.password_placeholder')"
            :disabled="busy"
            @keydown.enter.prevent="submit"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span>{{ $t('library_lock.confirm_password') }}</span>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="input input-sm w-full"
            :placeholder="$t('library_lock.password_placeholder')"
            :disabled="busy"
            @keydown.enter.prevent="submit"
          />
        </label>
      </template>

      <label v-if="mode === 'unlock'" class="flex flex-col gap-1">
        <span>{{ $t('library_lock.unlock_prompt') }}</span>
        <input
          ref="firstInputRef"
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          class="input input-sm w-full"
          :placeholder="$t('library_lock.password_placeholder')"
          :disabled="busy"
          @keydown.enter.prevent="submit"
        />
      </label>

      <p v-if="mode === 'remove'" class="text-xs leading-5 text-warning">{{ $t('library_lock.remove_hint') }}</p>
      <p v-if="error" class="text-xs leading-5 text-error">{{ error }}</p>
    </div>

    <div class="mt-2 flex justify-end gap-2">
      <button type="button" class="t-button-default" :disabled="busy" @click="cancel">
        {{ $t('library_lock.cancel') }}
      </button>
      <button type="button" class="t-button-primary" :disabled="busy" @click="submit">
        <span v-if="busy" class="loading loading-spinner loading-xs mr-1"></span>
        {{ submitLabel }}
      </button>
    </div>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ModalDialog from '@/components/ModalDialog.vue';
import { useUIStore } from '@/stores/uiStore';
import {
  removeLibraryPassword,
  setLibraryPassword,
  verifyLibraryPassword,
} from '@/common/libraryLock';

const props = defineProps({
  mode: {
    type: String as () => 'unlock' | 'set' | 'change' | 'remove',
    required: true,
  },
  libraryId: {
    type: String,
    required: true,
  },
  libraryName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['done', 'cancel']);
const { t } = useI18n();
const uiStore = useUIStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const busy = ref(false);
const error = ref('');
const firstInputRef = ref<HTMLInputElement | null>(null);
const newInputRef = ref<HTMLInputElement | null>(null);

const title = computed(() => {
  const name = props.libraryName || props.libraryId;
  switch (props.mode) {
    case 'set': return t('library_lock.set_title', { library: name });
    case 'change': return t('library_lock.change_title', { library: name });
    case 'remove': return t('library_lock.remove_title', { library: name });
    default: return t('library_lock.unlock_title', { library: name });
  }
});

const submitLabel = computed(() => {
  switch (props.mode) {
    case 'set': return t('library_lock.set');
    case 'change': return t('library_lock.change');
    case 'remove': return t('library_lock.remove');
    default: return t('library_lock.unlock');
  }
});

function cancel() {
  if (busy.value) return;
  emit('cancel');
}

function showError(message: string) {
  error.value = message;
}

async function verifyCurrent(): Promise<boolean> {
  const ok = await verifyLibraryPassword(props.libraryId, currentPassword.value);
  if (!ok) {
    showError(t('library_lock.wrong_password'));
    currentPassword.value = '';
    await nextTick();
    firstInputRef.value?.focus();
  }
  return ok;
}

async function submit() {
  if (busy.value) return;
  error.value = '';

  if (props.mode === 'unlock' || props.mode === 'remove') {
    if (!currentPassword.value) {
      showError(t('library_lock.password_required'));
      return;
    }
    busy.value = true;
    try {
      if (!(await verifyCurrent())) return;
      if (props.mode === 'remove') removeLibraryPassword(props.libraryId);
      emit('done');
    } catch {
      showError(t('library_lock.crypto_unavailable'));
    } finally {
      busy.value = false;
    }
    return;
  }

  if (newPassword.value.length < 4) {
    showError(t('library_lock.too_short'));
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    showError(t('library_lock.mismatch'));
    return;
  }

  busy.value = true;
  try {
    if (props.mode === 'change' && !(await verifyCurrent())) return;
    await setLibraryPassword(props.libraryId, newPassword.value);
    emit('done');
  } catch {
    showError(t('library_lock.crypto_unavailable'));
  } finally {
    busy.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
}

onMounted(() => {
  uiStore.pushInputHandler('LibraryPasswordDialog');
  window.addEventListener('keydown', handleKeydown, true);
  nextTick(() => {
    (props.mode === 'set' ? newInputRef.value : firstInputRef.value)?.focus();
  });
});

onUnmounted(() => {
  uiStore.removeInputHandler('LibraryPasswordDialog');
  window.removeEventListener('keydown', handleKeydown, true);
});
</script>
