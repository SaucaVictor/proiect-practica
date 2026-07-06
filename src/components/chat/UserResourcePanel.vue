<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  listUserResources,
  createUserFolder,
  uploadUserResource,
  deleteUserResource,
  getUserResourceSignedUrl,
  getUserResourceText,
  getResourceAncestors,
  type UserResource
} from '@/services/supabase/userResources'
import { supabase } from '@/services/supabase/client'
import { useReferencesStore } from '@/stores/references.store'
import { useToast } from '@/composables/useToast'
import UserResourceTree from './UserResourceTree.vue'
import { extractTextFromPdfUrl, extractTextFromPdf } from '@/utils/pdf'
import { generateEmbedding, chunkText } from '@/services/ai/embeddings'

// Node representation in the local panel state
export interface ResourceNode {
  id: string
  name: string
  type: 'folder' | 'file'
  file_path?: string
  size?: number
  mime_type?: string
  parent_id: string | null
  expanded: boolean
  children: ResourceNode[]
  childrenLoaded: boolean
  previewFile: ResourceNode | null
  previewContent: string | null
  previewLoading: boolean
  isIndexing?: boolean
  indexingProgress?: number
}

defineProps<{
  isMinimized?: boolean
}>()

const emit = defineEmits<{
  'send-message': [content: string, metadata?: Record<string, any>]
  'toggle-minimize': []
}>()

const refStore = useReferencesStore()
const toast = useToast()

const loading = ref(false)
const uploading = ref(false)
const error = ref<string | null>(null)
const tree = ref<ResourceNode[]>([])

// Reference to the hidden file input
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadParentId = ref<string | null>(null)

onMounted(async () => {
  await refresh()
  // If mounted via reference click, focus it immediately
  if (refStore.focusRef && refStore.focusRef.isUserResource) {
    await handleFocusRef(refStore.focusRef)
  }
})

async function handleFocusRef(fr: any) {
  if (!fr || !fr.isUserResource || !fr.filePath) return

  try {
    // 1. Find the database resource matching the filePath
    const { data: fileItem, error: fileError } = await supabase
      .from('user_resources')
      .select('*')
      .eq('file_path', fr.filePath)
      .single()

    if (fileError || !fileItem) {
      refStore.clearFocus()
      return
    }

    // 2. Fetch the chain of folder ancestors (root-most folder first)
    const ancestors = await getResourceAncestors(fileItem.id)

    // 3. Sequential expansion
    let currentNodesList = tree.value
    for (const folder of ancestors) {
      let localNode = currentNodesList.find(n => n.id === folder.id)
      if (!localNode) {
        // Just in case it's not loaded
        await refresh()
        localNode = tree.value.find(n => n.id === folder.id)
        if (!localNode) break
      }
      
      localNode.expanded = true
      if (!localNode.childrenLoaded) {
        await reloadFolderNode(localNode)
      }
      currentNodesList = localNode.children
    }

    // 4. Try to find the file node locally and highlight/preview
    const fileNode = findNode(tree.value, fileItem.id)
    if (fileNode) {
      await handlePreviewFile(fileNode)
    }

    // 5. Scroll file into view
    await nextTick()
    setTimeout(() => {
      const rowEl = document.getElementById(`file-row-user-${fileItem.id}`)
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
      refStore.clearFocus()
    }, 200)

  } catch (err) {
    console.error('Error during handleFocusRef in user resource:', err)
    refStore.clearFocus()
  }
}

watch(
  () => refStore.focusRef,
  async (fr) => {
    if (fr && fr.isUserResource) {
      await handleFocusRef(fr)
    }
  }
)

async function refresh() {
  loading.value = true
  error.value = null
  try {
    const data = await listUserResources(null)
    tree.value = data.map(item => ({
      ...item,
      expanded: false,
      children: [],
      childrenLoaded: false,
      previewFile: null,
      previewContent: null,
      previewLoading: false
    }))
  } catch (err: any) {
    error.value = 'Failed to load resources.'
    toast.error('Load Error', err?.message || 'Could not fetch resources.')
  } finally {
    loading.value = false
  }
}

// Recursive node finder helper
function findNode(nodes: ResourceNode[], id: string): ResourceNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

async function handleToggleFolder(node: ResourceNode) {
  node.expanded = !node.expanded
  if (node.expanded && !node.childrenLoaded) {
    await reloadFolderNode(node)
  }
}

async function reloadFolderNode(node: ResourceNode) {
  node.previewFile = null
  node.previewContent = null
  try {
    const children = await listUserResources(node.id)
    node.children = children.map(item => ({
      ...item,
      expanded: false,
      children: [],
      childrenLoaded: false,
      previewFile: null,
      previewContent: null,
      previewLoading: false
    }))
    node.childrenLoaded = true
  } catch (err: any) {
    toast.error('Error', 'Failed to reload folder contents.')
  }
}

async function reloadFolderById(id: string) {
  const node = findNode(tree.value, id)
  if (node) {
    await reloadFolderNode(node)
  } else {
    await refresh()
  }
}

// Folder Creation
async function handleCreateFolder(parentId: string | null = null) {
  const folderName = prompt('Enter new folder name:')
  if (!folderName || !folderName.trim()) return

  try {
    const node = await createUserFolder(folderName, parentId)
    if (node) {
      toast.success('Folder created', `Folder "${folderName}" created successfully.`)
      if (parentId) {
        await reloadFolderById(parentId)
        // Auto expand parent
        const parent = findNode(tree.value, parentId)
        if (parent) parent.expanded = true
      } else {
        await refresh()
      }
    } else {
      toast.error('Error', 'Failed to create folder.')
    }
  } catch (err: any) {
    toast.error('Error', err?.message || 'Could not create folder.')
  }
}

// File Upload Triggers
function triggerFileUpload(parentId: string | null = null) {
  uploadParentId.value = parentId
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  uploading.value = true
  const parentId = uploadParentId.value
  const files = Array.from(input.files)

  let successCount = 0
  let failCount = 0

  for (const file of files) {
    try {
      const uploaded = await uploadUserResource(file, parentId)
      if (uploaded) {
        successCount++
        
        // Reload folder/refresh tree so the node is added to the UI tree
        if (parentId) {
          await reloadFolderById(parentId)
          const parent = findNode(tree.value, parentId)
          if (parent) parent.expanded = true
        } else {
          await refresh()
        }

        // Find the newly created node in the tree and trigger ingestion
        const node = findNode(tree.value, uploaded.id)
        if (node) {
          processIngestion(node, file)
        }
      } else {
        failCount++
      }
    } catch (err: any) {
      console.error(err)
      failCount++
      toast.error('Upload Failed', `Could not upload "${file.name}": ${err?.message || 'Unknown error'}`)
    }
  }

  uploading.value = false

  if (successCount > 0) {
    toast.success('Upload Completed', `Successfully uploaded ${successCount} file(s).`)
  }
}

async function processIngestion(node: ResourceNode, file: File) {
  node.isIndexing = true
  node.indexingProgress = 0

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not logged in')

    let fullText = ''
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')

    if (isPdf) {
      fullText = await extractTextFromPdf(file)
    } else if (isTxt) {
      fullText = await file.text()
    }

    if (fullText.trim().length === 0) {
      node.isIndexing = false
      return
    }

    const chunks = chunkText(fullText)
    if (chunks.length === 0) {
      node.isIndexing = false
      return
    }

    let ingested = 0
    for (let i = 0; i < chunks.length; i++) {
      // Check if the resource was deleted during indexing
      if (!findNode(tree.value, node.id)) {
        console.log(`[RAG] Ingestion aborted for deleted resource: ${node.name} (${node.id})`)
        return
      }

      const chunk = chunks[i]
      const embedding = await generateEmbedding(chunk, 'passage')

      const { error } = await supabase.from('document_chunks').insert({
        resource_id: node.id,
        user_id: user.id,
        content: chunk,
        embedding,
        metadata: { chunk_index: i, total_chunks: chunks.length }
      })

      if (error) {
        console.error(`[RAG] Failed to insert chunk ${i}:`, error)
      } else {
        ingested++
      }

      // Update real-time progress
      node.indexingProgress = Math.round(((i + 1) / chunks.length) * 100)
    }

    console.log(`[RAG] Ingestion complete: ${ingested}/${chunks.length} chunks.`)
  } catch (err: any) {
    console.error('[RAG] Ingestion failed:', err)
  } finally {
    node.isIndexing = false
  }
}

// Deletion
async function handleDeleteResource(node: ResourceNode) {
  const confirmMsg = node.type === 'folder' 
    ? `Are you sure you want to delete folder "${node.name}" and all its contents?`
    : `Are you sure you want to delete file "${node.name}"?`

  if (!confirm(confirmMsg)) return

  try {
    const success = await deleteUserResource(node.id)
    if (success) {
      toast.success('Deleted', `Resource "${node.name}" deleted.`)
      if (node.parent_id) {
        await reloadFolderById(node.parent_id)
      } else {
        await refresh()
      }
    } else {
      toast.error('Delete Failed', 'Failed to delete resource.')
    }
  } catch (err: any) {
    toast.error('Delete Failed', err?.message || 'Error occurred during deletion.')
  }
}

// File Previews
async function handlePreviewFile(node: ResourceNode) {
  if (node.previewFile !== null) {
    node.previewFile = null
    node.previewContent = null
    return
  }

  node.previewFile = node
  node.previewLoading = true

  try {
    if (node.name.toLowerCase().endsWith('.txt') && node.file_path) {
      const text = await getUserResourceText(node.file_path)
      node.previewContent = text ?? 'Could not load file text.'
    } else if (node.name.toLowerCase().endsWith('.pdf') && node.file_path) {
      const signedUrl = await getUserResourceSignedUrl(node.file_path)
      node.previewContent = signedUrl ?? 'Could not retrieve PDF URL.'
    }
  } catch (err: any) {
    node.previewContent = 'Error loading preview.'
    toast.error('Preview Error', err?.message || 'Failed to preview resource.')
  } finally {
    node.previewLoading = false
  }
}

// Referencing Helpers
function handleAddWholeRef(node: ResourceNode, folderPath: string[]) {
  if (!node.file_path) return
  const label = ['Your resources', ...folderPath, node.name].join(' › ')
  refStore.addReferenceAsync({
    filename: node.name,
    refType: 'whole-file',
    label,
    isUserResource: true,
    filePath: node.file_path,
  })
  toast.success('Reference Added', `Added whole file "${node.name}" to pending references.`)
}

function handleAddPdfPageRef(node: ResourceNode, folderPath: string[], opts: any) {
  if (!node.file_path) return
  const label = ['Your resources', ...folderPath, node.name].join(' › ')
  refStore.addReferenceAsync({
    filename: node.name,
    refType: opts.refType,
    label,
    isUserResource: true,
    filePath: node.file_path,
    pageNumber: opts.pageNumber,
    selectedText: opts.selectedText
  })
  toast.success('Reference Added', `Added PDF Page ${opts.pageNumber} as reference.`)
}

function handleAddSelectionRef(node: ResourceNode, folderPath: string[], opts: any) {
  if (!node.file_path) return
  const label = ['Your resources', ...folderPath, node.name].join(' › ')
  refStore.addReferenceAsync({
    filename: node.name,
    refType: 'text-selection',
    label,
    isUserResource: true,
    filePath: node.file_path,
    selectedText: opts.selectedText,
    startOffset: opts.startOffset,
    endOffset: opts.endOffset
  })
  toast.success('Reference Added', `Added selection as reference.`)
}

// Recursive Expand/Collapse
async function handleToggleFolderRecursive(node: ResourceNode) {
  if (isFolderRecursivelyExpanded(node)) {
    collapseFolderRecursively(node)
  } else {
    loading.value = true
    try {
      await expandFolderRecursively(node)
    } finally {
      loading.value = false
    }
  }
}

function isFolderRecursivelyExpanded(node: ResourceNode): boolean {
  if (!node.expanded) return false
  const subfolders = node.children.filter(c => c.type === 'folder')
  if (subfolders.length === 0) return true
  return subfolders.every(sf => isFolderRecursivelyExpanded(sf))
}

function collapseFolderRecursively(node: ResourceNode) {
  node.expanded = false
  for (const c of node.children) {
    if (c.type === 'folder') {
      collapseFolderRecursively(c)
    }
  }
}

async function expandFolderRecursively(node: ResourceNode) {
  node.expanded = true
  if (!node.childrenLoaded) {
    await reloadFolderNode(node)
  }
  await Promise.all(
    node.children
      .filter(c => c.type === 'folder')
      .map(c => expandFolderRecursively(c))
  )
}

// Teach AI Folder
async function handleTeachAIFolder(node: ResourceNode) {
  loading.value = true
  toast.info('Analyzing folder...', `Gathering contents from "${node.name}"...`)
  try {
    const filesList: UserResource[] = []
    
    const collectFiles = async (folderId: string) => {
      const { data: children, error: cError } = await supabase
        .from('user_resources')
        .select('*')
        .eq('parent_id', folderId)
        
      if (cError || !children) return
      
      for (const child of children) {
        if (child.type === 'file') {
          filesList.push(child)
        } else if (child.type === 'folder') {
          await collectFiles(child.id)
        }
      }
    }
    
    await collectFiles(node.id)
    
    if (filesList.length === 0) {
      toast.warning('No files found', 'This folder contains no files to teach the AI.')
      loading.value = false
      return
    }
    
    let combinedText = ''
    const docTypes = new Set<string>()
    
    for (const file of filesList) {
      if (!file.file_path) continue
      
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await getUserResourceText(file.file_path)
        if (text) {
          combinedText += `\n\n=== Document text: ${file.name} ===\n${text}\n`
          docTypes.add('documente text')
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const url = await getUserResourceSignedUrl(file.file_path)
        if (url) {
          const text = await extractTextFromPdfUrl(url)
          if (text) {
            combinedText += `\n\n=== Document PDF: ${file.name} ===\n${text}\n`
            docTypes.add('documente PDF')
          }
        }
      }
    }
    
    if (!combinedText.trim()) {
      toast.error('Extraction failed', 'Could not read text content from files in this folder.')
      loading.value = false
      return
    }
    
    const docsLabel = docTypes.size > 0
      ? Array.from(docTypes).join(' și ')
      : 'materiale de studiu'
      
    const prompt = `Ești un asistent de predare expert. De acum devii tutorele meu personal și vom discuta pornind de la materialele din folderul "${node.name}".
    
Acestea reprezintă sursa ta principală de adevăr pentru tot ce discutăm — nu inventa informații care nu se regăsesc în ele.

Mai jos ai ${docsLabel} furnizate de mine:

${combinedText}

---

Te rog să faci următoarele:

1. **Confirmare** — confirmă că ai parcurs materialele din folderul "${node.name}".

2. **Hartă conceptuală** — structurează conținutul ierarhic: identifică 3-5 teme/concepte majore din aceste materiale, iar sub fiecare listează pe scurt sub-noțiunile sau exemplele asociate.

3. **Puncte-cheie de reținut** — extrage 3-5 idei sau definiții esențiale, formulate clar.

4. **Zone posibil neclare** — semnalează, dacă e cazul, orice concepte care sunt menționate dar explicate insuficient în aceste documente.

5. **Întrebări sugerate** — propune 3-5 întrebări la care te pot întreba în continuare, pornind de la material.

Reguli pentru restul conversației noastre:
- Răspunde exclusiv pe baza materialelor furnizate mai sus; dacă ceva nu apare în ele, spune explicit "nu este acoperit în materialele furnizate" în loc să presupui.
- Menționează din ce document provine o informație când îmi răspunzi.
- Explică-mi conceptele clar și în profunzime, cu exemple sau analogii, dar marchează clar dacă exemplul e al tău și nu vine direct din material.

Răspunde integral în limba română.`

    emit('send-message', prompt, { isTeachAI: true, userFolderName: node.name })
    toast.success('AI Instructed', 'Combined resource contents sent to the AI.')
  } catch (err: any) {
    console.error('Failed to teach AI from folder:', err)
    toast.error('Teach AI Error', err?.message || 'Error occurred while teaching AI.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="user-panel">
    <!-- Header -->
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
        <span>Your Resources</span>
      </div>
      <div class="panel-header-actions" v-show="!isMinimized">
        <button 
          class="panel-action-btn" 
          title="Create Folder" 
          aria-label="Create new folder" 
          @click="handleCreateFolder(null)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button 
          class="panel-action-btn" 
          title="Upload Resource (PDF, TXT)" 
          aria-label="Upload files" 
          @click="triggerFileUpload(null)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        <button 
          class="panel-refresh-btn" 
          title="Refresh Resources" 
          aria-label="Refresh list" 
          @click="refresh"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input 
      type="file" 
      ref="fileInputRef" 
      class="hidden" 
      accept=".pdf,.txt" 
      multiple 
      @change="handleFileChange" 
    />

    <!-- Uploading indicator -->
    <div v-if="uploading" class="uploading-banner">
      <div class="panel-spinner panel-spinner--sm" />
      <span>Uploading files…</span>
    </div>

    <!-- Content tree area -->
    <div v-show="!isMinimized" class="panel-tree flex-1 overflow-y-auto">
      <div v-if="loading" class="panel-state">
        <div class="panel-spinner" />
        <span>Loading resources…</span>
      </div>

      <div v-else-if="error" class="panel-state panel-state--error">
        <span>{{ error }}</span>
      </div>

      <div v-else-if="tree.length === 0" class="panel-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="opacity-30">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <p class="text-center text-xs opacity-50">
          Your resources is empty.<br />
          Click <span class="font-semibold">+</span> folder or upload icon to add work.
        </p>
      </div>

      <UserResourceTree 
        v-else 
        :nodes="tree" 
        :folder-path="[]"
        @toggle-folder="handleToggleFolder"
        @toggle-folder-recursive="handleToggleFolderRecursive"
        @teach-ai-folder="handleTeachAIFolder"
        @create-folder="pId => handleCreateFolder(pId)"
        @upload-file="pId => triggerFileUpload(pId)"
        @delete-resource="handleDeleteResource"
        @preview-file="handlePreviewFile"
        @add-whole-ref="handleAddWholeRef"
        @add-pdf-page-ref="handleAddPdfPageRef"
        @add-selection-ref="handleAddSelectionRef"
      />
    </div>
  </div>
</template>

<style scoped>
.user-panel {
  @apply flex flex-col h-full bg-surface-100 dark:bg-surface-50
         border-b border-surface-200 dark:border-surface-200 overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-3 py-2.5
         border-b border-surface-200 dark:border-surface-200 flex-shrink-0 bg-surface-100 dark:bg-surface-50;
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

.panel-header-actions {
  @apply flex items-center gap-1.5;
}

.panel-action-btn,
.panel-refresh-btn {
  @apply flex items-center justify-center w-6 h-6 rounded
         text-surface-500 hover:text-accent-600 dark:hover:text-accent-400
         hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors;
}

.uploading-banner {
  @apply flex items-center justify-center gap-2 py-1.5 px-3 bg-accent-500/10 border-b border-accent-500/20 text-xs text-accent-700 dark:text-accent-400 font-medium;
}

.panel-state {
  @apply flex flex-col items-center justify-center gap-3 py-8 px-4 text-center text-sm text-surface-500 dark:text-surface-600;
}

.panel-state--error {
  @apply text-red-500;
}

.panel-spinner {
  @apply w-5 h-5 border-2 border-surface-300 border-t-accent-500 rounded-full animate-spin;
}

.panel-spinner--sm {
  @apply w-3.5 h-3.5;
}

.panel-tree {
  @apply p-2;
}
</style>
