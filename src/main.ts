import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import '@/styles/index.css'
import '@/iot-interface/styles/iot-theme.css'
import * as pdfjsLib from 'pdfjs-dist'

// Configure pdf.js worker (use bundled legacy worker served via jsdelivr matching package version)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`


const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
