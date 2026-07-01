import fs from 'fs'
import path from 'path'

// Helper to manually parse .env without external dependencies
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    console.warn('.env file not found.')
    return
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const firstEquals = trimmed.indexOf('=')
    if (firstEquals === -1) continue
    const key = trimmed.substring(0, firstEquals).trim()
    let value = trimmed.substring(firstEquals + 1).trim()
    
    // Strip optional quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1)
    }
    
    process.env[key] = value
  }
}

async function run() {
  loadEnv()

  const JIRA_URL = 'https://practica-devidevs-utcb-grupa-a-2.atlassian.net'
  const JIRA_EMAIL = process.env.JIRA_EMAIL
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || process.env.JIRA_API_KEY
  const ISSUE_KEY = 'IOT-12'

  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL or JIRA_API_TOKEN/JIRA_API_KEY not found in .env.')
    console.log('\nTe rog adaugă următoarele în fișierul tău .env și salvează-l:')
    console.log('JIRA_EMAIL=adresa_ta_de_email@atlassian.com')
    console.log('JIRA_API_TOKEN=api_token_ul_tau_generat_din_jira')
    process.exit(1)
  }

  console.log(`Conectare la Jira pentru task-ul ${ISSUE_KEY}...`)

  const authHeader = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')

  const commentText = `Salut! Participat la a treia ședință de practică online (Google Meet, Luni 29 iunie, 15:00 – 17:00).

Rezumat ședință și decizii luate:
1. **Stabilirea oficială a proiectelor de echipă**: Grupa noastră IoT va construi proiectul **ClassMonitor** (dashboard web pentru monitorizare senzori în timp real și control bidirecțional cu detecție de anomalii prin model AI mic).
2. **Organizarea spațiilor de lucru**: S-au configurat board-urile în Jira pentru fiecare echipă și s-a stabilit fluxul de lucru în Git (un repo unic privat per echipă, utilizare exclusivă de branch-uri și pull request-uri cu review obligatoriu, fără commit direct pe main).
3. **Decizii tehnice stabilite**: Utilizarea plăcilor ESP32/Arduino, broker public de MQTT (HiveMQ Cloud free), frontend Vue/Next și backend / DB cu Supabase. Fiecare membru își va genera o cheie API personală de Jira pentru conectarea directă din agentul AI local.
4. **Planificarea obiectivelor următoare**: Crearea documentelor de Product Brief, a diagramelor de arhitectură, a formatelor de payload JSON agreate și realizarea primului scaffold funcțional al aplicației.

*Timp total ședință raportat: 2 ore și 30 minute.*`

  // 1. Log 2h 30m of work
  console.log('Înregistrare 2h 30m de muncă (Worklog)...')
  try {
    const worklogResponse = await fetch(`${JIRA_URL}/rest/api/2/issue/${ISSUE_KEY}/worklog`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeSpent: '2h 30m',
        comment: 'Participare la ședința 3 de practică online. Stabilire proiect ClassMonitor, organizare board Jira și repo comun, decizii arhitectură IoT.'
      })
    })

    if (worklogResponse.ok) {
      console.log('✅ Cele 2 ore și 30 de minute au fost înregistrate cu succes în Jira!')
    } else {
      const errText = await worklogResponse.text()
      console.error(`❌ Erorare la înregistrarea orelor (Worklog): ${worklogResponse.status} - ${errText}`)
    }
  } catch (err) {
    console.error('❌ Erorare conexiune la înregistrarea orelor:', err)
  }

  // 2. Add description comment
  console.log('Adăugare comentariu cu detaliile tehnice ale task-ului...')
  try {
    const commentResponse = await fetch(`${JIRA_URL}/rest/api/2/issue/${ISSUE_KEY}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: commentText
      })
    })

    if (commentResponse.ok) {
      console.log('✅ Comentariul tehnic în limba română a fost adăugat cu succes pe Jira!')
    } else {
      const errText = await commentResponse.text()
      console.error(`❌ Eroare la adăugarea comentariului: ${commentResponse.status} - ${errText}`)
    }
  } catch (err) {
    console.error('❌ Eroare conexiune la adăugarea comentariului:', err)
  }
}

run()
