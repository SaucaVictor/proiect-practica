<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import {
  listCourseDates,
  listCourseFiles,
  getCourseTranscript,
  getCourseFileUrl,
  uploadCourseFile,
  deleteCourseFile,
  ingestCourseFile,
  type CourseFile
} from '@/services/supabase/courses'
import { supabase } from '@/services/supabase/client'
import { useToast } from '@/composables/useToast'
import PdfViewer from '@/components/chat/PdfViewer.vue'
import { extractTextFromPdfUrl, extractTextFromPdf } from '@/utils/pdf'
import type { ScheduleEntry } from '@/types/schedule'

const props = defineProps<{
  entry: ScheduleEntry
}>()

const emit = defineEmits<{
  'close': []
}>()

const toast = useToast()

// ─── State ──────────────────────────────────────────────────────────────────
const loading = ref(false)
const uploading = ref(false)
const dates = ref<DateNode[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadTargetDate = ref<string | null>(null)
const currentUser = ref<any>(null)
const showDatePicker = ref(false)
const newDateInput = ref(new Date().toISOString().split('T')[0])

interface DateNode {
  date: string
  expanded: boolean
  files: FileNode[]
  filesLoaded: boolean
}

interface FileNode {
  name: string
  type: CourseFile['type']
  size?: number
  isIndexed: boolean
  isIndexing: boolean
  indexingProgress: number
  previewOpen: boolean
  previewContent: string | null
  previewLoading: boolean
}

// ─── Lifecycle & Loading ─────────────────────────────────────────────────────
onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  currentUser.value = user
  await loadDates()
})

// Watch active indexing state to prevent page reload/navigation
function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = 'Un proces de indexare RAG este în desfășurare. Sigur doriți să părăsiți pagina?'
  return e.returnValue
}

watch(
  () => dates.value.some(d => d.files?.some(f => f.isIndexing)),
  (isIndexing) => {
    if (isIndexing) {
      window.addEventListener('beforeunload', onBeforeUnload)
    } else {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  },
  { deep: true }
)

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

// Watch prop changes when keeping the drawer alive via v-show
watch(
  () => props.entry,
  async (newVal, oldVal) => {
    if (newVal && newVal.id !== oldVal?.id) {
      showDatePicker.value = false
      await loadDates()
    }
  }
)

async function loadDates() {
  loading.value = true
  try {
    const rawDates = await listCourseDates(props.entry.subjectName)
    dates.value = rawDates.map(d => ({
      date: d.date,
      expanded: false,
      files: [],
      filesLoaded: false
    }))
  } catch (err: any) {
    toast.error('Eroare', 'Nu s-au putut încărca datele cursurilor.')
  } finally {
    loading.value = false
  }
}

async function toggleDate(node: DateNode) {
  node.expanded = !node.expanded
  if (node.expanded && !node.filesLoaded) {
    await loadFiles(node)
  }
}

async function loadFiles(node: DateNode) {
  try {
    const rawFiles = await listCourseFiles(props.entry.subjectName, node.date)
    
    // Fetch indexed status from document_chunks for all files in this date
    const { data: chunksData } = await supabase
      .from('document_chunks')
      .select('metadata')
      .eq('metadata->>subject_name', props.entry.subjectName)
      .eq('metadata->>session_date', node.date)

    const indexedFiles = new Set<string>()
    if (chunksData) {
      for (const c of chunksData) {
        if (c.metadata && typeof c.metadata === 'object') {
          const fn = (c.metadata as any).file_name
          if (fn) indexedFiles.add(fn)
        }
      }
    }

    node.files = rawFiles.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      isIndexed: indexedFiles.has(f.name),
      isIndexing: false,
      indexingProgress: 0,
      previewOpen: false,
      previewContent: null,
      previewLoading: false
    }))
    node.filesLoaded = true
  } catch (err: any) {
    toast.error('Eroare', 'Nu s-au putut încărca fișierele.')
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────
function confirmAddDate() {
  const dateStr = newDateInput.value
  if (!dateStr || !dateStr.trim()) return

  // Validate format (YYYY-MM-DD)
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr.trim())) {
    toast.error('Format invalid', 'Data trebuie să fie în formatul YYYY-MM-DD')
    return
  }

  // Check if date already exists
  if (dates.value.some(d => d.date === dateStr.trim())) {
    toast.warning('Există deja', `Data ${dateStr.trim()} există deja în listă.`)
    return
  }

  dates.value.unshift({
    date: dateStr.trim(),
    expanded: true,
    files: [],
    filesLoaded: true
  })
  toast.success('Sesiune adăugată', `A fost creată sesiunea pentru data ${dateStr.trim()}.`)
  showDatePicker.value = false
}

function triggerFileUpload(date: string) {
  uploadTargetDate.value = date
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0 || !uploadTargetDate.value) return

  uploading.value = true
  const dateStr = uploadTargetDate.value
  const filesList = Array.from(input.files)

  const dateNode = dates.value.find(d => d.date === dateStr)

  for (const file of filesList) {
    try {
      // 1. Upload to Supabase courses bucket
      await uploadCourseFile(props.entry.subjectName, dateStr, file)
      toast.success('Încărcare reușită', `Fișierul "${file.name}" a fost încărcat.`)

      // Refresh files list
      if (dateNode) {
        await loadFiles(dateNode)
        
        // Find the node and index it
        const fileNode = dateNode.files.find(f => f.name === file.name)
        if (fileNode) {
          await triggerIndexing(dateNode, fileNode, file)
        }
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Încărcare eșuată', `Nu s-a putut încărca "${file.name}": ${err?.message || err}`)
    }
  }

  uploading.value = false
}

async function triggerIndexing(dateNode: DateNode, fileNode: FileNode, fileObj?: File) {
  if (!currentUser.value) {
    toast.error('Eroare', 'Utilizator neautentificat.')
    return
  }

  fileNode.isIndexing = true
  fileNode.indexingProgress = 0

  try {
    let fullText = ''
    
    // If we have the File object (just uploaded), read from it.
    // Otherwise, we need to download it from storage.
    if (fileObj) {
      if (fileObj.name.toLowerCase().endsWith('.pdf')) {
        fullText = await extractTextFromPdf(fileObj)
      } else {
        fullText = await fileObj.text()
      }
    } else {
      const url = getCourseFileUrl(props.entry.subjectName, dateNode.date, fileNode.name)
      if (fileNode.name.toLowerCase().endsWith('.pdf')) {
        fullText = await extractTextFromPdfUrl(url)
      } else {
        const response = await fetch(url)
        fullText = await response.text()
      }
    }

    if (!fullText.trim()) {
      toast.warning('Fără text', `Fișierul "${fileNode.name}" nu conține text care poate fi extras.`)
      fileNode.isIndexing = false
      return
    }

    // Call ingest helper
    await ingestCourseFile(
      props.entry.subjectName,
      dateNode.date,
      fileNode.name,
      fullText,
      currentUser.value.id,
      (progress) => {
        fileNode.indexingProgress = progress
      }
    )

    fileNode.isIndexed = true
    toast.success('Indexat', `Fișierul "${fileNode.name}" a fost indexat în a doua minte!`)
  } catch (err: any) {
    console.error('Indexing failed:', err)
    toast.error('Indexare eșuată', `Nu s-a putut indexa "${fileNode.name}": ${err?.message || err}`)
  } finally {
    fileNode.isIndexing = false
  }
}

async function handleDelete(dateNode: DateNode, fileNode: FileNode) {
  if (!confirm(`Sigur doriți să ștergeți fișierul "${fileNode.name}"?`)) return

  try {
    await deleteCourseFile(props.entry.subjectName, dateNode.date, fileNode.name)
    toast.success('Șters', `Fișierul "${fileNode.name}" a fost șters.`)
    await loadFiles(dateNode)
  } catch (err: any) {
    toast.error('Eroare', `Nu s-a putut șterge fișierul: ${err?.message || err}`)
  }
}

// ─── Preview ─────────────────────────────────────────────────────────────────
async function previewFile(dateNode: DateNode, fileNode: FileNode) {
  if (fileNode.previewOpen) {
    fileNode.previewOpen = false
    fileNode.previewContent = null
    return
  }

  fileNode.previewOpen = true
  fileNode.previewContent = null

  if (fileNode.type === 'transcript') {
    fileNode.previewLoading = true
    try {
      const text = await getCourseTranscript(props.entry.subjectName, dateNode.date, fileNode.name)
      fileNode.previewContent = text ?? 'Transcriptul nu a putut fi încărcat.'
    } catch {
      fileNode.previewContent = 'Eroare la încărcarea transcriptului.'
    } finally {
      fileNode.previewLoading = false
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────


function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function getFileUrl(date: string, filename: string) {
  return getCourseFileUrl(props.entry.subjectName, date, filename)
}


</script>

<template>
  <div class="drawer-backdrop" @click.self="emit('close')">
    <div class="drawer-container" @click.stop>
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-left">
          <svg class="header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div>
            <h2 class="drawer-title">Resurse: {{ entry.subjectName }}</h2>
            <p class="drawer-subtitle">Manager materiale curs și indexare RAG</p>
          </div>
        </div>
        <button class="close-btn" aria-label="Închide drawer" @click="emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Actions -->
      <div class="drawer-actions">
        <div v-if="showDatePicker" class="date-picker-form">
          <input
            v-model="newDateInput"
            type="date"
            class="date-input"
          />
          <button class="save-date-btn" @click="confirmAddDate">
            Adaugă
          </button>
          <button class="cancel-date-btn" @click="showDatePicker = false">
            Renunță
          </button>
        </div>
        <button v-else class="add-date-btn" @click="showDatePicker = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Adaugă dată curs
        </button>
      </div>

      <!-- Content -->
      <div class="drawer-content">
        <!-- Loading -->
        <div v-if="loading" class="state-container">
          <div class="spinner" />
          <span>Se încarcă resursele...</span>
        </div>

        <!-- Empty state -->
        <div v-else-if="dates.length === 0" class="state-container opacity-60">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p>Nu există nicio sesiune de curs înregistrată pentru această materie.<br>Adăugați o dată sau înregistrați audio în pagina de apel.</p>
        </div>

        <!-- Tree -->
        <div v-else class="tree-root">
          <div v-for="dateNode in dates" :key="dateNode.date" class="tree-date-node">
            <!-- Date header -->
            <div class="date-header-row group">
              <button class="date-toggle-btn" @click="toggleDate(dateNode)">
                <svg class="chevron-icon" :class="{ 'chevron-icon--open': dateNode.expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 4.5l3 3 3-3" />
                </svg>
                <svg class="folder-icon text-amber-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span class="date-label">{{ dateNode.date }}</span>
              </button>

              <div class="date-actions">
                <button class="upload-btn" title="Încarcă resursă (PDF, TXT)" @click.stop="triggerFileUpload(dateNode.date)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Încarcă
                </button>
              </div>
            </div>

            <!-- Files list -->
            <div v-if="dateNode.expanded" class="files-container">
              <div v-if="dateNode.files.length === 0" class="empty-files">
                Fără materiale în această dată.
              </div>
              <div v-else v-for="file in dateNode.files" :key="file.name" class="file-item-group">
                <!-- File row -->
                <div class="file-row" :class="{ 'file-row--active': file.previewOpen }">
                  <button class="file-select-btn" @click="previewFile(dateNode, file)">
                    <span class="file-type-icon">
                      <!-- PDF Icon -->
                      <svg v-if="file.type === 'pdf'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-text-top">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <!-- Transcript Icon -->
                      <svg v-else-if="file.type === 'transcript'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-text-top">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <line x1="10" y1="9" x2="8" y2="9" />
                      </svg>
                      <!-- Audio Icon -->
                      <svg v-else-if="file.type === 'audio'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-text-top">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                      <!-- Default Attachment Icon -->
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-text-top">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </span>
                    <span class="file-name">{{ file.name }}</span>
                    <span v-if="file.isIndexing" class="indexing-badge">
                      Indexing {{ file.indexingProgress }}%
                    </span>
                    <span v-else-if="file.isIndexed" class="indexed-badge" title="Indexat în a doua minte">
                      Indexat
                    </span>
                    <span v-else-if="file.size" class="file-size">{{ formatSize(file.size) }}</span>
                  </button>

                  <div class="file-actions">
                    <!-- Manual Index for Second Brain (if not indexed yet) -->
                    <button
                      v-if="!file.isIndexed && !file.isIndexing && (file.type === 'pdf' || file.type === 'transcript')"
                      class="action-btn text-amber-500 hover:bg-amber-500/10"
                      title="Indexează în a doua minte"
                      @click.stop="triggerIndexing(dateNode, file)"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </button>
                    <!-- Delete Button -->
                    <button class="action-btn text-red-500 hover:bg-red-500/10" title="Șterge fișier" @click.stop="handleDelete(dateNode, file)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Preview window -->
                <div v-if="file.previewOpen" class="file-preview-panel">
                  <!-- Transcript / Text preview -->
                  <div v-if="file.type === 'transcript'">
                    <div v-if="file.previewLoading" class="preview-loading">
                      <div class="spinner spinner--sm" />
                      <span>Se deschide transcriptul...</span>
                    </div>
                    <div v-else class="transcript-wrapper">
                      <pre class="preview-text">{{ file.previewContent }}</pre>
                    </div>
                  </div>

                  <!-- PDF Viewer -->
                  <div v-else-if="file.type === 'pdf'" class="file-preview-pdf">
                    <PdfViewer
                      :url="getFileUrl(dateNode.date, file.name)"
                      :subject="entry.subjectName"
                      :date="dateNode.date"
                      :filename="file.name"
                      :hide-reference="true"
                    />
                  </div>

                  <!-- Audio Player -->
                  <div v-else-if="file.type === 'audio'" class="file-preview-audio">
                    <audio controls :src="getFileUrl(dateNode.date, file.name)" class="audio-player" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden Input for upload -->
    <input
      type="file"
      ref="fileInputRef"
      class="hidden"
      accept=".pdf,.txt"
      multiple
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.drawer-backdrop {
  @apply fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300;
}

.drawer-container {
  @apply w-full sm:w-[680px] h-full flex flex-col bg-[#1a1b1e] border-l border-[#212328] shadow-2xl overflow-hidden;
  animation: slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.drawer-header {
  @apply flex items-center justify-between px-5 py-4 border-b border-[#212328] flex-shrink-0;
}

.header-left {
  @apply flex items-center gap-3;
}

.header-icon {
  @apply text-accent-500;
}

.drawer-title {
  @apply text-base font-bold text-surface-900;
}

.drawer-subtitle {
  @apply text-xs text-surface-500 mt-0.5;
}

.close-btn {
  @apply flex items-center justify-center w-8 h-8 rounded-lg text-surface-400 hover:bg-[#212328] hover:text-surface-800 transition-colors;
}

/* ── Actions ────────────────────────────────────────────────────────────────── */
.drawer-actions {
  @apply px-5 py-3 border-b border-[#212328] flex justify-end flex-shrink-0;
}

.add-date-btn {
  @apply flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/15 transition-all;
}

.date-picker-form {
  @apply flex items-center gap-2 w-full;
}

.date-input {
  @apply h-8 px-2 rounded-lg text-xs bg-[#212328] border border-[#2d3139] text-[#c4c9d4] focus:outline-none focus:ring-1 focus:ring-accent-500 flex-1;
}

.save-date-btn {
  @apply px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-500 text-[#0e0f11] hover:bg-accent-400 transition-all;
}

.cancel-date-btn {
  @apply px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#212328] text-[#737c8e] hover:text-[#c4c9d4] hover:bg-[#2d3139] transition-all;
}

/* ── Content ────────────────────────────────────────────────────────────────── */
.drawer-content {
  @apply flex-1 overflow-y-auto p-4;
}

.state-container {
  @apply flex flex-col items-center justify-center gap-3 py-20 px-6 text-center text-sm text-[#464b55];
}

.spinner {
  @apply w-6 h-6 border-2 border-[#363a42] border-t-accent-500 rounded-full animate-spin;
}

.spinner--sm {
  @apply w-4 h-4 border-2;
}

/* ── Tree dates ─────────────────────────────────────────────────────────────── */
.tree-root {
  @apply flex flex-col gap-2;
}

.tree-date-node {
  @apply border border-[#212328] rounded-xl overflow-hidden bg-[#141517]/40;
}

.date-header-row {
  @apply flex items-center justify-between px-3 py-2.5 bg-[#141517] hover:bg-[#212328]/30 transition-colors;
}

.date-toggle-btn {
  @apply flex items-center gap-2 flex-1 min-w-0 text-left text-sm font-semibold text-[#c4c9d4];
}

.chevron-icon {
  @apply text-[#464b55] transition-transform duration-200;
}
.chevron-icon--open {
  transform: rotate(90deg);
}

.folder-icon {
  @apply flex-shrink-0;
}

.date-label {
  @apply truncate;
}

.date-actions {
  @apply flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150;
}

.upload-btn {
  @apply flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-[#212328] text-[#737c8e] hover:text-[#c4c9d4] hover:bg-[#2e3138] transition-colors;
}

/* ── Files Container ────────────────────────────────────────────────────────── */
.files-container {
  @apply flex flex-col border-t border-[#212328] bg-[#1a1b1e]/25 divide-y divide-[#212328]/50;
}

.empty-files {
  @apply text-xs italic text-[#464b55] px-8 py-3.5;
}

.file-item-group {
  @apply flex flex-col;
}

.file-row {
  @apply flex items-center justify-between px-3 py-2 hover:bg-[#212328]/20 transition-colors;
}

.file-row--active {
  @apply bg-accent-500/[0.04];
}

.file-select-btn {
  @apply flex items-center gap-2 flex-1 min-w-0 text-left text-xs text-[#9aa0b2];
}

.file-type-icon {
  @apply flex-shrink-0 text-sm;
}

.file-name {
  @apply truncate font-mono text-[11px];
}

.file-size {
  @apply text-[10px] font-mono text-[#464b55] ml-2 flex-shrink-0;
}

.indexed-badge {
  @apply text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0;
}

.indexing-badge {
  @apply text-[10px] font-semibold text-accent-400 animate-pulse ml-2 flex-shrink-0;
}

.file-actions {
  @apply flex items-center gap-0.5 pl-2;
}

.action-btn {
  @apply flex items-center justify-center w-6 h-6 rounded transition-all duration-100 flex-shrink-0;
}

/* ── Preview Panels ─────────────────────────────────────────────────────────── */
.file-preview-panel {
  @apply mx-3 mb-3 border border-[#2a2d33] rounded-lg overflow-hidden bg-[#141517] p-1;
}

.preview-loading {
  @apply flex items-center gap-2 p-3 text-xs text-surface-500;
}

.transcript-wrapper {
  @apply relative;
}

.preview-text {
  @apply text-xs p-3 whitespace-pre-wrap break-words font-mono max-h-60 overflow-y-auto leading-relaxed select-text text-[#9aa0b2];
}

.file-preview-pdf {
  @apply min-h-[340px];
}

.file-preview-audio {
  @apply p-2;
}

.audio-player {
  @apply w-full h-8;
}

/* ── Selection Tooltip ──────────────────────────────────────────────────────── */
.selection-tooltip {
  @apply absolute z-30 flex items-center;
  pointer-events: all;
}

.tooltip-btn {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-lg whitespace-nowrap bg-[#e8eaf0] text-[#0e0f11] border border-[#c4c9d4] hover:bg-white transition-all;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
