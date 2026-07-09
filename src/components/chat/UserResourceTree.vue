<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { ResourceNode } from './UserResourcePanel.vue'
import PdfViewer from '@/components/chat/PdfViewer.vue'
import { useReferencesStore } from '@/stores/references.store'

const props = defineProps<{
  nodes: ResourceNode[]
  folderPath: string[]
}>()

const emit = defineEmits<{
  'toggle-folder': [node: ResourceNode]
  'toggle-folder-recursive': [node: ResourceNode]
  'teach-ai-folder': [node: ResourceNode]
  'create-folder': [parentId: string]
  'upload-file': [parentId: string]
  'delete-resource': [node: ResourceNode]
  'preview-file': [node: ResourceNode]
  'add-whole-ref': [node: ResourceNode, folderPath: string[]]
  'add-pdf-page-ref': [node: ResourceNode, folderPath: string[], opts: any]
  'add-selection-ref': [node: ResourceNode, folderPath: string[], opts: { selectedText: string; startOffset?: number; endOffset?: number }]
}>()

const transcriptRefs = ref<Record<string, HTMLPreElement | null>>({})
const pdfViewerRefs = ref<Record<string, InstanceType<typeof PdfViewer> | null>>({})

// Selection tooltip state
const selTooltip = ref<{
  visible: boolean
  x: number
  y: number
  nodeId: string
} | null>(null)

function onTranscriptMouseUp(e: MouseEvent, nodeId: string) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    selTooltip.value = null
    return
  }
  const text = sel.toString().trim()
  if (!text) {
    selTooltip.value = null
    return
  }

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  selTooltip.value = {
    visible: true,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    nodeId
  }
}

function addSelectionRef(node: ResourceNode) {
  if (!selTooltip.value) return
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (!text) return

  const anchor = sel!.anchorNode
  const preEl = transcriptRefs.value[node.id]
  let startOffset: number | undefined
  let endOffset: number | undefined

  if (preEl && anchor) {
    let idx = 0
    const walker = document.createTreeWalker(preEl, NodeFilter.SHOW_TEXT)
    let textNode: Node | null
    while ((textNode = walker.nextNode())) {
      if (textNode === sel!.anchorNode) {
        startOffset = idx + sel!.anchorOffset
      }
      if (textNode === sel!.focusNode) {
        endOffset = idx + sel!.focusOffset
      }
      idx += (textNode.textContent ?? '').length
    }
    if (startOffset !== undefined && endOffset !== undefined && startOffset > endOffset) {
      ;[startOffset, endOffset] = [endOffset, startOffset]
    }
  }

  emit('add-selection-ref', node, props.folderPath, {
    selectedText: text,
    startOffset,
    endOffset
  })

  sel?.removeAllRanges()
  selTooltip.value = null
}

function closeTooltipOnOutside() {
  selTooltip.value = null
}

onMounted(() => {
  document.addEventListener('mousedown', closeTooltipOnOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', closeTooltipOnOutside)
})

function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const refStore = useReferencesStore()

watch(
  () => refStore.focusRef,
  async (fr) => {
    if (!fr || !fr.isUserResource || !fr.filePath) return

    const node = props.nodes.find(n => n.type === 'file' && n.file_path === fr.filePath)
    if (!node) return

    await nextTick()
    setTimeout(() => {
      if (fr.refType === 'pdf-page' && fr.pageNumber) {
        pdfViewerRefs.value[node.id]?.scrollToPage(fr.pageNumber)
      } else if (fr.refType === 'text-selection' && fr.startOffset !== undefined) {
        const el = transcriptRefs.value[node.id]
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          highlightRange(el, fr.startOffset, fr.endOffset ?? fr.startOffset + (fr.selectedText?.length ?? 0))
        }
      }
    }, 250)
  }
)

function highlightRange(el: HTMLPreElement, start: number, end: number) {
  const full = el.textContent ?? ''
  el.innerHTML =
    escapeHtml(full.slice(0, start)) +
    `<mark class="transcript-highlight">${escapeHtml(full.slice(start, end))}</mark>` +
    escapeHtml(full.slice(end))
  const mark = el.querySelector('mark')
  mark?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    mark?.classList.add('transcript-highlight--fade')
  }, 2500)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function isFolderRecursivelyExpanded(node: ResourceNode): boolean {
  if (!node.expanded) return false
  const subfolders = node.children.filter(c => c.type === 'folder')
  if (subfolders.length === 0) return true
  return subfolders.every(sf => isFolderRecursivelyExpanded(sf))
}

function fileIcon(node: ResourceNode) {
  if (node.name.toLowerCase().endsWith('.pdf')) return '📄'
  if (node.name.toLowerCase().endsWith('.txt')) return '📝'
  return '📎'
}
</script>

<template>
  <div class="tree-nodes">
    <div v-for="node in nodes" :key="node.id" class="tree-node-item">
      <!-- FOLDER ROW -->
      <div v-if="node.type === 'folder'" class="tree-folder-group">
        <div class="tree-row-container group">
          <button class="tree-row tree-row--folder" @click="emit('toggle-folder', node)">
            <svg 
              class="tree-chevron" 
              :class="{ 'tree-chevron--open': node.expanded }" 
              width="12" 
              height="12" 
              viewBox="0 0 12 12" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.5" 
              stroke-linecap="round"
            >
              <path d="M3 4.5l3 3 3-3" />
            </svg>
            <svg 
              class="folder-icon text-amber-500" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.5" 
              stroke-linecap="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span class="tree-label">{{ node.name }}</span>
          </button>
          
          <!-- Actions -->
          <div class="row-actions flex items-center gap-0.5 px-2">
            <!-- Teach AI Folder -->
            <button 
              class="action-btn text-accent-600 dark:text-accent-400 hover:text-accent-800" 
              title="Teach AI from folder contents"
              @click.stop="emit('teach-ai-folder', node)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
            
            <!-- Recursive Toggle -->
            <button 
              class="action-btn text-surface-500 hover:text-accent-500" 
              :title="isFolderRecursivelyExpanded(node) ? 'Collapse recursively' : 'Expand recursively'"
              @click.stop="emit('toggle-folder-recursive', node)"
            >
              <svg v-if="isFolderRecursivelyExpanded(node)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="17 11 12 6 7 11" />
                <polyline points="17 18 12 13 7 18" />
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="7 13 12 18 17 13" />
                <polyline points="7 6 12 11 17 6" />
              </svg>
            </button>

            <button 
              class="action-btn text-surface-500 hover:text-accent-500" 
              title="Create folder inside"
              @click.stop="emit('create-folder', node.id)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </button>
            <button 
              class="action-btn text-surface-500 hover:text-accent-500" 
              title="Upload file inside"
              @click.stop="emit('upload-file', node.id)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button 
              class="action-btn text-surface-500 hover:text-red-500" 
              title="Delete folder"
              @click.stop="emit('delete-resource', node)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Render Nested Children Recursively -->
        <div v-if="node.expanded" class="tree-children pl-4 border-l border-surface-200 dark:border-surface-300/40 ml-2 mt-0.5">
          <UserResourceTree 
            v-if="node.children.length > 0" 
            :nodes="node.children" 
            :folder-path="[...folderPath, node.name]"
            @toggle-folder="n => emit('toggle-folder', n)"
            @toggle-folder-recursive="n => emit('toggle-folder-recursive', n)"
            @teach-ai-folder="n => emit('teach-ai-folder', n)"
            @create-folder="pId => emit('create-folder', pId)"
            @upload-file="pId => emit('upload-file', pId)"
            @delete-resource="n => emit('delete-resource', n)"
            @preview-file="n => emit('preview-file', n)"
            @add-whole-ref="(n, p) => emit('add-whole-ref', n, p)"
            @add-pdf-page-ref="(n, p, o) => emit('add-pdf-page-ref', n, p, o)"
            @add-selection-ref="(n, p, o) => emit('add-selection-ref', n, p, o)"
          />
          <div v-else class="tree-empty py-1">Folder is empty</div>
        </div>
      </div>

      <!-- FILE ROW -->
      <div v-else-if="node.type === 'file'" class="tree-file-group">
        <div :id="`file-row-user-${node.id}`" class="tree-row-container tree-file-row group">
          <button 
            class="tree-row tree-row--file" 
            :class="{ 'tree-row--file-active': node.previewFile !== null }"
            @click="emit('preview-file', node)"
          >
            <span class="file-icon mr-1.5 flex-shrink-0">{{ fileIcon(node) }}</span>
            <span class="tree-label file-name">{{ node.name }}</span>
            <span v-if="node.isIndexing" class="ml-2 text-[10px] text-accent-500 font-semibold animate-pulse">
              Indexing {{ node.indexingProgress ?? 0 }}%
            </span>
            <span v-else-if="node.size" class="file-size ml-2 font-mono text-xs text-surface-400 flex-shrink-0">{{ formatSize(node.size) }}</span>
          </button>

          <!-- Actions -->
          <div class="row-actions flex items-center gap-0.5 px-2">
            <button 
              class="ref-whole-btn text-surface-400 hover:text-accent-500" 
              title="Reference this whole file in chat"
              @click.stop="emit('add-whole-ref', node, folderPath)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button 
              class="action-btn text-surface-500 hover:text-red-500" 
              title="Delete file"
              @click.stop="emit('delete-resource', node)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Inline Preview Content -->
        <div v-if="node.previewFile !== null" class="file-preview">
          <!-- Text Content Preview -->
          <template v-if="node.name.toLowerCase().endsWith('.txt')">
            <div v-if="node.previewLoading" class="preview-loading">
              <div class="panel-spinner panel-spinner--sm" />
              <span>Loading content…</span>
            </div>
            <div 
              v-else 
              class="transcript-wrapper"
              :class="{ 'z-20': selTooltip?.visible && selTooltip.nodeId === node.id }"
              @mouseup="onTranscriptMouseUp($event, node.id)"
            >
              <pre 
                :ref="el => { transcriptRefs[node.id] = el as HTMLPreElement }" 
                class="preview-text"
              >{{ node.previewContent }}</pre>

              <!-- Selection tooltip -->
              <Transition name="tooltip-fade">
                <div 
                  v-if="selTooltip?.visible && selTooltip.nodeId === node.id" 
                  class="selection-tooltip"
                  :style="{ left: `${selTooltip.x}px`, top: `${selTooltip.y - 40}px` }"
                  @mousedown.stop
                >
                  <button class="tooltip-btn" @click.stop="addSelectionRef(node)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Add reference
                  </button>
                </div>
              </Transition>
            </div>
          </template>

          <!-- PDF Viewer Preview -->
          <template v-else-if="node.name.toLowerCase().endsWith('.pdf')">
            <div v-if="node.previewLoading" class="preview-loading">
              <div class="panel-spinner panel-spinner--sm" />
              <span>Generating preview URL…</span>
            </div>
            <PdfViewer 
              v-else-if="node.previewContent"
              :ref="el => { pdfViewerRefs[node.id] = el as any }"
              :url="node.previewContent"
              subject="user"
              date="resources"
              :filename="node.name"
              @add-reference="opts => emit('add-pdf-page-ref', node, folderPath, opts)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-nodes {
  @apply flex flex-col w-full;
}

.tree-row-container {
  @apply flex items-center justify-between w-full;
}

.tree-row {
  @apply flex items-center w-full min-w-0 px-2 py-1.5 rounded-md text-left text-sm transition-colors duration-100;
  color: #9aa0b2; /* surface-800 = readable text */
}
.tree-row:hover { background: #212328; color: #c4c9d4; }

.tree-row--folder {
  @apply font-medium;
  color: #c4c9d4; /* surface-900 */
}

.tree-file-row {
  @apply sticky top-0 z-10;
  background: #1a1b1e; /* surface-100 */
}

.tree-row--file {
  @apply pl-6 text-xs;
  color: #737c8e; /* surface-700 */
}
.tree-row--file:hover { color: #9aa0b2; }

.tree-row--file-active {
  background: rgba(92, 114, 243, 0.12);
  color: #7c97f8;
}

.tree-chevron {
  @apply flex-shrink-0 transition-transform duration-150 mr-1;
  color: #464b55; /* surface-500 */
}

.tree-chevron--open {
  transform: rotate(0deg);
}

.tree-chevron:not(.tree-chevron--open) {
  transform: rotate(-90deg);
}

.folder-icon {
  @apply flex-shrink-0 mr-1.5;
}

.tree-label {
  @apply flex-1 min-w-0 truncate;
}

.file-name {
  @apply font-mono text-xs;
}

/* Action buttons — default semi-visible, high visibility on hover */
.action-btn {
  @apply flex items-center justify-center w-5 h-5 rounded transition-colors duration-100;
  color: #464b55;
}
.action-btn:hover { background: #212328; color: #9aa0b2; }

.ref-whole-btn {
  @apply flex items-center justify-center w-5 h-5 rounded transition-colors duration-100;
  color: #464b55;
}
.ref-whole-btn:hover { color: #7c97f8; background: rgba(92, 114, 243, 0.1); }

.tree-empty {
  @apply text-xs px-6 italic;
  color: #464b55;
}

/* Previews */
.file-preview {
  @apply mx-2 my-1 rounded-lg overflow-hidden;
  border: 1px solid #2a2d33;
  background: #141517;
}

.preview-loading {
  @apply flex items-center gap-2 p-3 text-xs;
  color: #565d6b;
}

.panel-spinner {
  @apply w-4 h-4 border-2 rounded-full animate-spin;
  border-color: #363a42;
  border-top-color: #5c72f3;
}

.panel-spinner--sm {
  @apply w-3.5 h-3.5;
}

.transcript-wrapper {
  @apply relative p-2 overflow-x-auto max-h-60;
}

.preview-text {
  @apply text-xs font-mono whitespace-pre-wrap select-text leading-relaxed;
  color: #9aa0b2;
}

.selection-tooltip {
  @apply absolute z-50 rounded px-2 py-1 shadow-lg flex items-center gap-1;
  background: #e8eaf0;
  color: #0e0f11;
  border: 1px solid #cbd5e1;
}

.tooltip-btn {
  @apply flex items-center gap-1 font-medium hover:text-accent-500 transition-colors;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  @apply transition-opacity duration-100;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  @apply opacity-0;
}

:deep(.transcript-highlight) {
  @apply bg-amber-400/40 rounded px-0.5;
  transition: background 1.5s ease;
}

:deep(.transcript-highlight--fade) {
  background: transparent;
}
</style>
