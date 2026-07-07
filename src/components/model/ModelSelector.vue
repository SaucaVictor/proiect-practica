<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProviderStore } from '@/stores/provider.store'
import { NVIDIA_MODELS } from '@/services/ai/models'

const emit = defineEmits<{
  'update:model': [model: string]
}>()

const providerStore = useProviderStore()
const { activeModelId, activeModel } = storeToRefs(providerStore)

const open = ref(false)

const tags = computed(() => {
  const model = activeModel.value
  const t = []
  if (model?.supportsVision) t.push('Vision')
  if (model?.supportsReasoning) t.push('Reasoning')
  return t
})

function select(modelId: string) {
  providerStore.setModel(modelId)
  emit('update:model', modelId)
  open.value = false
}
</script>

<template>
  <div class="model-selector">
    <button
      id="model-selector-btn"
      class="model-btn"
      :aria-expanded="open"
      aria-haspopup="listbox"
      aria-label="Select model"
      @click="open = !open"
    >
      <span class="model-name">{{ activeModel?.name ?? activeModelId }}</span>
      <span 
        v-for="tag in tags" 
        :key="tag" 
        class="model-tag"
        :class="{
          'model-tag--vision': tag === 'Vision',
          'model-tag--reasoning': tag === 'Reasoning'
        }"
      >{{ tag }}</span>
      <svg class="model-chevron" :class="{ 'rotate-180': open }" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="open" class="model-dropdown-overlay" @click="open = false">
          <div
            class="model-dropdown"
            role="listbox"
            :aria-label="'Select model'"
            @click.stop
          >
            <div class="model-dropdown-header">
              <span>NVIDIA NIM Models</span>
            </div>
            <div class="model-list">
              <button
                v-for="model in NVIDIA_MODELS"
                :key="model.id"
                role="option"
                :aria-selected="activeModelId === model.id"
                :class="['model-option', { 'model-option--active': activeModelId === model.id }]"
                @click="select(model.id)"
              >
                <div class="model-option-info">
                  <span class="model-option-name">{{ model.name }}</span>
                  <span class="model-option-desc">{{ model.description }}</span>
                </div>
                <div class="model-option-badges">
                  <span v-if="model.supportsVision" class="badge badge--vision">Vision</span>
                  <span v-if="model.supportsReasoning" class="badge badge--reasoning">Reasoning</span>
                  <span class="badge">{{ Math.round(model.contextWindow / 1000) }}K ctx</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.model-selector { @apply relative; }

.model-btn {
  @apply flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
         text-surface-700
         hover:bg-surface-200
         hover:text-surface-900
         transition-colors duration-150;
}

.model-name { @apply font-semibold text-surface-900; }

.model-tag {
  @apply text-xs px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-400 font-medium;
}

.model-tag--vision {
  @apply bg-sky-500/15 text-sky-400 !important;
}

.model-tag--reasoning {
  @apply bg-violet-500/15 text-violet-400 !important;
}

.model-chevron { @apply text-surface-600 transition-transform duration-200; }

/* Dropdown */
.model-dropdown-overlay {
  @apply fixed inset-0 z-50 flex items-start justify-center pt-14 px-4;
}

.model-dropdown {
  @apply max-h-[65vh] overflow-y-auto
         bg-surface-100
         border border-surface-200
         rounded-2xl shadow-2xl;
  width: min(540px, calc(100vw - 2rem));
}

.model-dropdown-header {
  @apply px-4 py-3 border-b border-surface-200
         text-sm font-semibold text-surface-950
         sticky top-0 bg-surface-100;
}

.model-list { @apply p-2; }

.model-option {
  @apply w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left
         hover:bg-surface-200
         transition-colors duration-100;
}

.model-option--active {
  @apply bg-accent-500/10;
}

.model-option-info {
  @apply flex flex-col flex-1 min-w-0;
}

.model-option-name {
  @apply text-sm font-medium text-surface-950;
}

.model-option-desc {
  @apply text-xs text-surface-600 mt-0.5 leading-snug;
}

.model-option-badges {
  @apply flex flex-wrap gap-1 flex-shrink-0 mt-0.5;
}

.badge {
  @apply text-xs px-1.5 py-0.5 rounded bg-surface-200
         text-surface-700 font-medium;
}

.badge--vision    { @apply bg-sky-500/15 text-sky-400; }
.badge--reasoning { @apply bg-violet-500/15 text-violet-400; }

/* Fade */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-150; }
.fade-enter-from, .fade-leave-to { @apply opacity-0; }

/* ── Mobile UI Enhancements ── */
@media (max-width: 480px) {
  .model-btn .model-tag {
    display: none !important;
  }
  .model-name {
    max-width: 120px;
    @apply truncate;
  }
}

@media (max-width: 640px) {
  .model-dropdown-overlay {
    @apply items-end justify-center pt-0 px-0;
  }
  .model-dropdown {
    @apply rounded-t-2xl rounded-b-none border-x-0 border-b-0 max-h-[55vh];
    width: 100% !important;
  }
}
</style>
