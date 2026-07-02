<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  listCourseSubjects,
  listCourseDates,
  listCourseFiles,
  getCourseTranscript,
  getCourseFileUrl,
  type CourseFile,
} from '@/services/supabase/courses'
import { useReferencesStore } from '@/stores/references.store'
import PdfViewer from '@/components/chat/PdfViewer.vue'
import { extractTextFromPdfUrl } from '@/utils/pdf'

defineProps<{
  isMinimized?: boolean
}>()

const emit = defineEmits<{
  'send-message': [content: string, metadata?: Record<string, any>]
  'toggle-minimize': []
}>()

const refStore = useReferencesStore()

// ─── Tree state ───────────────────────────────────────────────────────────────
interface SubjectNode {
  name: string
  expanded: boolean
  dates: DateNode[]
  datesLoaded: boolean
}

interface DateNode {
  subject: string
  date: string
  expanded: boolean
  files: CourseFile[]
  filesLoaded: boolean
  previewFile: CourseFile | null
  previewContent: string | null
  previewLoading: boolean
}

const loading = ref(false)
const error = ref<string | null>(null)
const tree = ref<SubjectNode[]>([])

// Refs to transcript preview containers (for text selection)
const transcriptRefs = ref<Record<string, HTMLPreElement | null>>({})
// Refs to PDF viewer components (for scrollToPage)
const pdfViewerRefs = ref<Record<string, InstanceType<typeof PdfViewer> | null>>({})

// Selection tooltip state
const selTooltip = ref<{
  visible: boolean
  x: number
  y: number
  subject: string
  date: string
  filename: string
} | null>(null)

// ─── Load ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await refresh()
  document.addEventListener('mousedown', closeTooltipOnOutside)
  // If mounted via reference click, focus it immediately
  if (refStore.focusRef) {
    await handleFocusRef(refStore.focusRef)
  }
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('mousedown', closeTooltipOnOutside)
})

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const data = await listCourseSubjects()
    tree.value = data.map((s) => ({
      name: s.name,
      expanded: false,
      dates: [],
      datesLoaded: false,
    }))
    if (tree.value.length === 0) error.value = 'No courses found in storage.'
  } catch {
    error.value = 'Failed to load courses.'
  } finally {
    loading.value = false
  }
}

async function toggleSubject(node: SubjectNode) {
  node.expanded = !node.expanded
  if (node.expanded && !node.datesLoaded) {
    const dates = await listCourseDates(node.name)
    node.dates = dates.map((d) => ({
      subject: d.subject,
      date: d.date,
      expanded: false,
      files: [],
      filesLoaded: false,
      previewFile: null,
      previewContent: null,
      previewLoading: false,
    }))
    node.datesLoaded = true
  }
}

async function toggleDate(node: DateNode) {
  node.expanded = !node.expanded
  if (node.expanded && !node.filesLoaded) {
    node.files = await listCourseFiles(node.subject, node.date)
    node.filesLoaded = true
  }
}

async function expandAll() {
  loading.value = true
  try {
    for (const subjectNode of tree.value) {
      subjectNode.expanded = true
      if (!subjectNode.datesLoaded) {
        const dates = await listCourseDates(subjectNode.name)
        subjectNode.dates = dates.map((d) => ({
          subject: d.subject,
          date: d.date,
          expanded: true,
          files: [],
          filesLoaded: false,
          previewFile: null,
          previewContent: null,
          previewLoading: false,
        }))
        subjectNode.datesLoaded = true
      } else {
        for (const dateNode of subjectNode.dates) {
          dateNode.expanded = true
        }
      }

      for (const dateNode of subjectNode.dates) {
        if (!dateNode.filesLoaded) {
          dateNode.files = await listCourseFiles(dateNode.subject, dateNode.date)
          dateNode.filesLoaded = true
        }
      }
    }
  } catch (err) {
    console.error('Failed to expand all:', err)
  } finally {
    loading.value = false
  }
}

function collapseAll() {
  for (const subjectNode of tree.value) {
    subjectNode.expanded = false
    for (const dateNode of subjectNode.dates) {
      dateNode.expanded = false
    }
  }
}

function isSubjectRecursivelyExpanded(node: SubjectNode): boolean {
  if (!node.expanded) return false
  if (!node.datesLoaded) return false
  return node.dates.every((d) => d.expanded)
}

async function toggleSubjectRecursive(node: SubjectNode) {
  if (isSubjectRecursivelyExpanded(node)) {
    collapseSubjectRecursive(node)
  } else {
    loading.value = true
    try {
      await expandSubjectRecursive(node)
    } finally {
      loading.value = false
    }
  }
}

function collapseSubjectRecursive(node: SubjectNode) {
  node.expanded = false
  for (const d of node.dates) {
    d.expanded = false
  }
}

async function expandSubjectRecursive(node: SubjectNode) {
  node.expanded = true
  if (!node.datesLoaded) {
    const dates = await listCourseDates(node.name)
    node.dates = dates.map((d) => ({
      subject: d.subject,
      date: d.date,
      expanded: true,
      files: [],
      filesLoaded: false,
      previewFile: null,
      previewContent: null,
      previewLoading: false,
    }))
    node.datesLoaded = true
  } else {
    for (const d of node.dates) {
      d.expanded = true
    }
  }

  // Load files for all sub-dates
  for (const d of node.dates) {
    if (!d.filesLoaded) {
      d.files = await listCourseFiles(d.subject, d.date)
      d.filesLoaded = true
    }
  }
}

// ─── File preview ────────────────────────────────────────────────────────────
async function previewFile(dateNode: DateNode, file: CourseFile) {
  if (dateNode.previewFile?.name === file.name) {
    dateNode.previewFile = null
    dateNode.previewContent = null
    return
  }

  dateNode.previewFile = file
  dateNode.previewContent = null

  if (file.type === 'transcript') {
    dateNode.previewLoading = true
    const text = await getCourseTranscript(file.subject, file.date, file.name)
    dateNode.previewContent = text ?? 'Could not load transcript.'
    dateNode.previewLoading = false
  }
  // PDF and audio are handled by their own sub-components
}

// ─── Reference helpers ────────────────────────────────────────────────────────
function makeLabel(subject: string, date: string, filename: string) {
  return `${subject} › ${date} › ${filename}`
}

function addWholeFileRef(file: CourseFile) {
  refStore.addReferenceAsync({
    subject: file.subject,
    date: file.date,
    filename: file.name,
    refType: 'whole-file',
    label: makeLabel(file.subject, file.date, file.name),
  })
}

function addPdfPageRef(
  subject: string,
  date: string,
  filename: string,
  opts: { refType: 'pdf-page' | 'text-selection'; pageNumber?: number; selectedText?: string }
) {
  refStore.addReferenceAsync({
    subject,
    date,
    filename,
    refType: opts.refType,
    label: makeLabel(subject, date, filename),
    pageNumber: opts.pageNumber,
    selectedText: opts.selectedText,
  })
}

// ─── Transcript text selection ────────────────────────────────────────────────
function onTranscriptMouseUp(
  e: MouseEvent,
  subject: string,
  date: string,
  filename: string
) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    selTooltip.value = null
    return
  }
  const text = sel.toString().trim()
  if (!text) { selTooltip.value = null; return }

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  selTooltip.value = {
    visible: true,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    subject,
    date,
    filename,
  }
}

function addSelectionRef() {
  if (!selTooltip.value) return
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (!text) return

  // Compute character offset in the pre element
  const anchor = sel!.anchorNode
  const preKey = `${selTooltip.value.subject}/${selTooltip.value.date}/${selTooltip.value.filename}`
  const preEl = transcriptRefs.value[preKey]
  let startOffset: number | undefined
  let endOffset: number | undefined

  if (preEl && anchor) {
    // Walk text nodes to find the offset
    let idx = 0
    const walker = document.createTreeWalker(preEl, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node === sel!.anchorNode) {
        startOffset = idx + sel!.anchorOffset
      }
      if (node === sel!.focusNode) {
        endOffset = idx + sel!.focusOffset
      }
      idx += (node.textContent ?? '').length
    }
    if (startOffset !== undefined && endOffset !== undefined && startOffset > endOffset) {
      ;[startOffset, endOffset] = [endOffset, startOffset]
    }
  }

  refStore.addReferenceAsync({
    subject: selTooltip.value.subject,
    date: selTooltip.value.date,
    filename: selTooltip.value.filename,
    refType: 'text-selection',
    label: makeLabel(selTooltip.value.subject, selTooltip.value.date, selTooltip.value.filename),
    selectedText: text,
    startOffset,
    endOffset,
  })

  sel?.removeAllRanges()
  selTooltip.value = null
}

function closeTooltipOnOutside() {
  selTooltip.value = null
}

// ─── Teach AI (auto-send) ─────────────────────────────────────────────────────
async function teachAI(subject: string, date: string) {
  try {
    const files = await listCourseFiles(subject, date)
    if (files.length === 0) {
      alert('No files found to teach the AI.')
      return
    }

    let combinedText = ''
    const materialTypes = new Set<string>()

    for (const file of files) {
      if (file.type === 'transcript') {
        const text = await getCourseTranscript(subject, date, file.name)
        if (text) {
          combinedText += `\n\n=== Transcriere: ${file.name} ===\n${text}\n`
          materialTypes.add('transcrieri audio')
        }
      } else if (file.type === 'pdf') {
        const url = getCourseFileUrl(subject, date, file.name)
        const text = await extractTextFromPdfUrl(url)
        if (text) {
          combinedText += `\n\n=== Document PDF: ${file.name} ===\n${text}\n`
          materialTypes.add('documente PDF')
        }
      }
    }

    if (!combinedText.trim()) {
      alert('Could not extract any text content from files.')
      return
    }

    const materialsLabel = materialTypes.size > 0
      ? Array.from(materialTypes).join(' și ')
      : 'materiale de curs'

    const prompt = `Ești un asistent de predare expert, specializat în materia "${subject}". De acum devii tutorele meu personal pentru acest subiect.

Mai jos ai ${materialsLabel} din sesiunea de curs înregistrată pe ${date}. Acestea reprezintă sursa ta principală de adevăr pentru tot ce discutăm despre acest subiect — nu inventa informații care nu se regăsesc în ele.

${combinedText}

---

Te rog să faci următoarele:

1. **Confirmare** — confirmă că ai parcurs materialele.

2. **Hartă conceptuală** — structurează conținutul ierarhic: identifică 3-5 teme/concepte majore, iar sub fiecare listează pe scurt sub-noțiunile sau exemplele asociate. Nu doar rezuma liniar — arată cum se leagă ideile între ele.

3. **Puncte-cheie de reținut** — extrage 3-5 idei sau definiții esențiale, formulate clar, ca și cum ar apărea pe niște flashcard-uri de recapitulare.

4. **Zone posibil neclare** — semnalează, dacă e cazul, orice concepte care sunt menționate dar explicate insuficient în material, sau unde ai avea nevoie de context suplimentar ca să răspunzi complet la întrebări.

5. **Întrebări sugerate** — propune 3-5 întrebări la care te pot întreba în continuare, pornind de la material.

Reguli pentru restul conversației noastre pe acest subiect:
- Răspunde exclusiv pe baza materialelor furnizate mai sus; dacă ceva nu apare în ele, spune explicit "nu este acoperit în materialele furnizate" în loc să presupui.
- Dacă e relevant, menționează din ce document/transcriere provine o informație, ca să pot verifica sursa.
- Explică-mi conceptele ca unui student care vrea să înțeleagă în profunzime, nu doar să memoreze — folosește analogii sau exemple suplimentare atunci când clarifică ceva, dar marchează clar dacă analogia e a ta și nu vine din material.
- Dacă o întrebare de-a mea e ambiguă sau prea largă, cere-mi clarificări înainte să răspunzi.

Răspunde integral în limba română.`

    emit('send-message', prompt, { isTeachAI: true, subject, date })
  } catch (err: any) {
    console.error('Failed to teach AI:', err)
    alert(`Failed to teach AI: ${err?.message || err}`)
  }
}

async function handleFocusRef(fr: any) {
  if (!fr) return
  // Find subject + date + file in the tree and expand them
  const subjectNode = tree.value.find((s) => s.name === fr.subject)
  if (!subjectNode) { refStore.clearFocus(); return }
  subjectNode.expanded = true
  if (!subjectNode.datesLoaded) {
    const dates = await listCourseDates(subjectNode.name)
    subjectNode.dates = dates.map((d) => ({ subject: d.subject, date: d.date, expanded: false, files: [], filesLoaded: false, previewFile: null, previewContent: null, previewLoading: false }))
    subjectNode.datesLoaded = true
  }
  const dateNode = subjectNode.dates.find((d) => d.date === fr.date)
  if (!dateNode) { refStore.clearFocus(); return }
  dateNode.expanded = true
  if (!dateNode.filesLoaded) {
    dateNode.files = await listCourseFiles(fr.subject, fr.date)
    dateNode.filesLoaded = true
  }
  const file = dateNode.files.find((f) => f.name === fr.filename)
  if (!file) { refStore.clearFocus(); return }

  // Open preview
  await previewFile(dateNode, file)

  await nextTick()

  setTimeout(() => {
    // Scroll the file tree row into view
    const rowEl = document.getElementById(`file-row-${fr.subject}-${fr.date}-${fr.filename}`)
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }

    if (fr.refType === 'pdf-page' && fr.pageNumber) {
      const key = `${fr.subject}/${fr.date}/${fr.filename}`
      pdfViewerRefs.value[key]?.scrollToPage(fr.pageNumber)
    } else if (fr.refType === 'text-selection' && fr.startOffset !== undefined) {
      const key = `${fr.subject}/${fr.date}/${fr.filename}`
      const el = transcriptRefs.value[key]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        highlightRange(el, fr.startOffset, fr.endOffset ?? fr.startOffset + (fr.selectedText?.length ?? 0))
      }
    }
    refStore.clearFocus()
  }, 200)
}

// ─── Focus ref from store (scroll to reference) ────────────────────────────────
watch(
  () => refStore.focusRef,
  async (fr) => {
    await handleFocusRef(fr)
  }
)

function highlightRange(el: HTMLPreElement, start: number, end: number) {
  // Simple: wrap the text in a mark by rebuilding the node
  const full = el.textContent ?? ''
  el.innerHTML =
    escapeHtml(full.slice(0, start)) +
    `<mark class="transcript-highlight">${escapeHtml(full.slice(start, end))}</mark>` +
    escapeHtml(full.slice(end))
  const mark = el.querySelector('mark')
  mark?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    // fade out highlight after 3s
    mark?.classList.add('transcript-highlight--fade')
  }, 2500)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileIcon(file: CourseFile) {
  if (file.type === 'transcript') return '📝'
  if (file.type === 'pdf') return '📄'
  if (file.type === 'audio') return '🎵'
  return '📎'
}

function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function getFileUrl(file: CourseFile) {
  return getCourseFileUrl(file.subject, file.date, file.name)
}

function transcriptKey(subject: string, date: string, filename: string) {
  return `${subject}/${date}/${filename}`
}
</script>

<template>
  <div class="course-panel">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="panel-header-left cursor-pointer select-none" @click="emit('toggle-minimize')">
        <svg 
          class="header-chevron" 
          :class="{ 'chevron-closed': isMinimized }" 
          width="13" 
          height="13" 
          viewBox="0 0 12 12" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
        <span>Course Resources</span>
      </div>
      <div class="panel-header-actions" v-show="!isMinimized">
        <button class="panel-action-btn" title="Expand All" aria-label="Expand all folders" @click="expandAll">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <button class="panel-action-btn" title="Collapse All" aria-label="Collapse all folders" @click="collapseAll">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="10" y1="14" x2="3" y2="21" />
          </svg>
        </button>
        <button class="panel-refresh-btn" title="Refresh courses" aria-label="Refresh courses" @click="refresh">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-show="!isMinimized && loading" class="panel-state">
      <div class="panel-spinner" />
      <span>Loading courses…</span>
    </div>

    <!-- Error -->
    <div v-show="!isMinimized && error && tree.length === 0" class="panel-state panel-state--error">
      <span>{{ error }}</span>
    </div>

    <!-- Tree -->
    <div v-show="!isMinimized" class="panel-tree">
      <template v-for="subjectNode in tree" :key="subjectNode.name">
        <!-- Subject Row -->
        <div class="tree-subject">
          <div class="tree-row-container group">
            <button class="tree-row tree-row--subject flex-1 min-w-0" @click="toggleSubject(subjectNode)">
              <svg class="tree-chevron" :class="{ 'tree-chevron--open': subjectNode.expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <path d="M3 4.5l3 3 3-3" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span class="tree-label">{{ subjectNode.name }}</span>
            </button>
            
            <button 
              class="action-btn text-surface-500 hover:text-accent-500 mr-2 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity duration-150"
              :title="isSubjectRecursivelyExpanded(subjectNode) ? 'Collapse recursively' : 'Expand recursively'"
              @click.stop="toggleSubjectRecursive(subjectNode)"
            >
              <svg v-if="isSubjectRecursivelyExpanded(subjectNode)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="17 11 12 6 7 11" />
                <polyline points="17 18 12 13 7 18" />
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="7 13 12 18 17 13" />
                <polyline points="7 6 12 11 17 6" />
              </svg>
            </button>
          </div>

          <!-- Dates -->
          <div v-if="subjectNode.expanded" class="tree-children">
            <template v-for="dateNode in subjectNode.dates" :key="dateNode.date">
              <div class="tree-date-group">
                <!-- Date header row -->
                <div class="tree-date-header">
                  <button class="tree-row tree-row--date" @click="toggleDate(dateNode)">
                    <svg class="tree-chevron" :class="{ 'tree-chevron--open': dateNode.expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                      <path d="M3 4.5l3 3 3-3" />
                    </svg>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span class="tree-label">{{ dateNode.date }}</span>
                  </button>

                  <!-- Teach AI Button -->
                  <button
                    class="teach-btn"
                    title="Auto-send full transcript to the AI"
                    @click.stop="teachAI(dateNode.subject, dateNode.date)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Teach AI
                  </button>
                </div>

                <!-- Files -->
                <div v-if="dateNode.expanded" class="tree-files">
                  <template v-for="file in dateNode.files" :key="file.name">
                    <div class="tree-file-group">
                      <!-- File row -->
                      <div :id="`file-row-${subjectNode.name}-${dateNode.date}-${file.name}`" class="tree-file-row">
                        <button
                          class="tree-row tree-row--file"
                          :class="{ 'tree-row--file-active': dateNode.previewFile?.name === file.name }"
                          @click="previewFile(dateNode, file)"
                        >
                          <span class="file-icon">{{ fileIcon(file) }}</span>
                          <span class="tree-label file-name">{{ file.name }}</span>
                          <span class="file-size">{{ formatSize(file.size) }}</span>
                        </button>

                        <!-- Reference whole file button -->
                        <button
                          class="ref-whole-btn"
                          title="Reference this whole file in chat"
                          @click.stop="addWholeFileRef(file)"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </button>
                      </div>

                      <!-- ── Transcript preview ───────────────────────── -->
                      <div
                        v-if="dateNode.previewFile?.name === file.name && file.type === 'transcript'"
                        class="file-preview"
                      >
                        <div v-if="dateNode.previewLoading" class="preview-loading">
                          <div class="panel-spinner panel-spinner--sm" />
                          <span>Loading transcript…</span>
                        </div>
                        <div
                          v-else
                          class="transcript-wrapper"
                          :class="{ 'z-20': selTooltip?.visible && selTooltip.filename === file.name }"
                          @mouseup="onTranscriptMouseUp($event, file.subject, file.date, file.name)"
                        >
                          <pre
                            :ref="(el) => { transcriptRefs[transcriptKey(file.subject, file.date, file.name)] = el as HTMLPreElement }"
                            class="preview-text"
                          >{{ dateNode.previewContent }}</pre>

                          <!-- Selection tooltip -->
                          <Transition name="tooltip-fade">
                            <div
                              v-if="selTooltip?.visible && selTooltip.filename === file.name"
                              class="selection-tooltip"
                              :style="{ left: `${selTooltip.x}px`, top: `${selTooltip.y - 40}px` }"
                              @mousedown.stop
                            >
                              <button class="tooltip-btn" @click.stop="addSelectionRef">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                Add reference
                              </button>
                            </div>
                          </Transition>
                        </div>
                      </div>

                      <!-- ── PDF viewer ──────────────────────────────── -->
                      <div
                        v-if="dateNode.previewFile?.name === file.name && file.type === 'pdf'"
                        class="file-preview file-preview--pdf"
                      >
                        <PdfViewer
                          :ref="(el) => { pdfViewerRefs[transcriptKey(file.subject, file.date, file.name)] = el as any }"
                          :url="getFileUrl(file)"
                          :subject="file.subject"
                          :date="file.date"
                          :filename="file.name"
                          @add-reference="addPdfPageRef(file.subject, file.date, file.name, $event)"
                        />
                      </div>

                      <!-- ── Audio player ────────────────────────────── -->
                      <div
                        v-if="dateNode.previewFile?.name === file.name && file.type === 'audio'"
                        class="file-preview file-preview--audio"
                      >
                        <audio controls :src="getFileUrl(file)" class="audio-player" />
                      </div>
                    </div>
                  </template>

                  <div v-if="dateNode.files.length === 0 && dateNode.filesLoaded" class="tree-empty">
                    No files found.
                  </div>
                </div>
              </div>
            </template>

            <div v-if="subjectNode.dates.length === 0 && subjectNode.datesLoaded" class="tree-empty">
              No recordings found.
            </div>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="tree.length === 0 && !loading" class="panel-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" class="opacity-30" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <p class="text-center text-sm opacity-50">No courses yet.<br>Record a class in the Audio page.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-panel {
  @apply flex flex-col h-full bg-surface-100 dark:bg-surface-50
         border-l border-surface-200 dark:border-surface-200 overflow-hidden;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.panel-header {
  @apply flex items-center justify-between px-3 py-2.5
         border-b border-surface-200 dark:border-surface-200 flex-shrink-0;
}

.panel-header-left {
  @apply flex items-center gap-2 text-xs font-semibold
         text-surface-700 dark:text-surface-700 uppercase tracking-wider
         hover:text-surface-950 dark:hover:text-surface-900;
}

.header-chevron {
  @apply text-surface-400 transition-transform duration-150;
}

.chevron-closed {
  transform: rotate(-90deg);
}

.panel-refresh-btn {
  @apply flex items-center justify-center w-6 h-6 rounded
         text-surface-500 hover:text-surface-900 dark:hover:text-surface-900
         hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors;
}

.panel-header-actions {
  @apply flex items-center gap-1;
}

.panel-action-btn {
  @apply flex items-center justify-center w-6 h-6 rounded
         text-surface-500 hover:text-accent-600 dark:hover:text-accent-400
         hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors;
}

/* ─── State ─────────────────────────────────────────────────────────────── */
.panel-state {
  @apply flex flex-col items-center justify-center gap-3 flex-1
         text-surface-500 dark:text-surface-600 text-sm px-4 text-center;
}

.panel-state--error { @apply text-red-500; }

.panel-spinner {
  @apply w-5 h-5 border-2 border-surface-300 border-t-accent-500 rounded-full;
  animation: spin 1s linear infinite;
}

.panel-spinner--sm { @apply w-3.5 h-3.5; }

/* ─── Tree ───────────────────────────────────────────────────────────────── */
.panel-tree {
  @apply flex-1 overflow-y-auto p-2;
}

.tree-subject { @apply mb-0.5; }

.tree-children { @apply pl-3 mt-0.5; }

.tree-date-group { @apply mb-1; }

.tree-date-header {
  @apply flex items-center gap-1;
}

.tree-date-header .tree-row--date { @apply flex-1; }

.tree-files { @apply pl-2 mt-0.5; }

.tree-file-group { @apply mb-0.5; }

.tree-file-row {
  @apply flex items-center gap-0.5 sticky top-0 z-10 bg-surface-100 dark:bg-surface-50;
}

.tree-file-row .tree-row--file {
  @apply flex-1;
}

.tree-row-container {
  @apply flex items-center justify-between w-full;
}

.action-btn {
  @apply flex items-center justify-center w-5 h-5 rounded hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors duration-100;
}

.tree-row {
  @apply flex items-center gap-1.5 w-full min-w-0 px-2 py-1.5 rounded-md
         text-left text-sm text-surface-800 dark:text-surface-900
         hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors duration-100;
}

.tree-row--subject { @apply font-medium; }
.tree-row--date { @apply text-xs text-surface-700 dark:text-surface-700; }
.tree-row--file { @apply text-xs text-surface-600 dark:text-surface-600 pl-5; }
.tree-row--file-active {
  @apply bg-accent-500/10 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400;
}

.tree-chevron {
  @apply flex-shrink-0 text-surface-400 transition-transform duration-150;
}
.tree-chevron--open { transform: rotate(0deg); }
.tree-chevron:not(.tree-chevron--open) { transform: rotate(-90deg); }

.tree-label { @apply flex-1 min-w-0 truncate; }
.file-icon { @apply flex-shrink-0; }
.file-name { @apply font-mono text-xs; }
.file-size { @apply flex-shrink-0 text-xs text-surface-400 font-mono; }
.tree-empty { @apply text-xs text-surface-400 px-3 py-1.5 italic; }

/* ─── Teach AI ───────────────────────────────────────────────────────────── */
.teach-btn {
  @apply flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0
         text-accent-600 dark:text-accent-400
         hover:bg-accent-500/10 dark:hover:bg-accent-500/20 transition-colors duration-100;
}

/* ─── Ref whole file button ──────────────────────────────────────────────── */
.ref-whole-btn {
  @apply flex items-center justify-center w-6 h-6 rounded flex-shrink-0
         text-surface-400 hover:text-accent-500 dark:hover:text-accent-400
         hover:bg-accent-500/10 transition-colors duration-100;
}

/* ─── File previews ──────────────────────────────────────────────────────── */
.file-preview {
  @apply mx-2 mb-2 rounded-lg border border-surface-200 dark:border-surface-300
         bg-surface-50 dark:bg-surface-0 overflow-hidden;
}

.file-preview--pdf {
  @apply min-h-80;
}

.file-preview--audio { @apply p-2; }

.preview-loading {
  @apply flex items-center gap-2 p-3 text-xs text-surface-500;
}

/* ─── Transcript ─────────────────────────────────────────────────────────── */
.transcript-wrapper {
  @apply relative;
}

.preview-text {
  @apply text-xs p-3 whitespace-pre-wrap break-words font-mono
         text-surface-700 dark:text-surface-800
         max-h-64 overflow-y-auto leading-relaxed select-text;
}

:deep(.transcript-highlight) {
  @apply bg-amber-400/40 dark:bg-amber-500/30 rounded px-0.5;
  transition: background 1.5s ease;
}

:deep(.transcript-highlight--fade) {
  background: transparent;
}

/* ─── Selection tooltip ──────────────────────────────────────────────────── */
.selection-tooltip {
  @apply absolute z-30 flex items-center;
  pointer-events: all;
}

.tooltip-btn {
  @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
         bg-surface-950 dark:bg-surface-50
         text-surface-50 dark:text-surface-950
         shadow-lg border border-surface-800 dark:border-surface-300
         whitespace-nowrap;
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

/* ─── Audio ──────────────────────────────────────────────────────────────── */
.audio-player {
  @apply w-full h-8;
  accent-color: theme('colors.accent.500');
}

/* ─── Spinner ────────────────────────────────────────────────────────────── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
