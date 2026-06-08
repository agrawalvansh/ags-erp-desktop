# AGS ERP — Voice Input Implementation Prompt for Cursor

## PROJECT CONTEXT

- **Stack:** Electron 37, React 19, Vite 6, Tailwind CSS 4, SQLite via better-sqlite3
- **IPC pattern:** Renderer → `window.api.invoke('channel', payload)` → `ipcMain.handle` in `ipcHandlers.js`
- **Main push events:** `mainWindow.webContents.send('channel', data)` → `window.api.onX(cb)` in renderer
- **Design tokens:** Primary `#004AC6`, Container `#2563EB`, Error `#DC2626`, Surface `#F2F4F6`
- **DO NOT** change any existing IPC handler logic, PDF generators, or form validation

---

## WHAT WE ARE BUILDING

A mic button inside the AddItemForm of four pages. The flow is:

```
User clicks mic
    ↓
Mic listens (continuous, stays on until user clicks again or says stop word)
    ↓
Vosk streams partial text live to screen as user speaks
    ↓
User clicks mic again OR says "stop" / "done"
    ↓
Main process receives full text
    ↓
Parse text into fields: productQuery, size, qty, packingType, spokenRate, remark
    ↓
Fuzzy match productQuery+size against products table in SQLite
    ↓
Return best match + confidence score + alternatives
    ↓
Populate the existing form fields exactly as if the user typed them
    ↓
Show result card — user reviews, clicks "Add Item" or presses Enter
    ↓
Mic auto-restarts for next item (continuous mode)
```

### CRITICAL — Rate / Price Behaviour

This is the most important rule. Read carefully:

- If the user **speaks a rate** (e.g. "at two hundred", "200 rupees") →  
  put that spoken value into the rate/selling_price form field.

- If the user **does not speak a rate** →  
  put the `selling_price` from the matched product record into the rate form field.

- **In both cases, just populate the form field value and stop.**  
  Do NOT call any price-sync handler. Do NOT trigger any DB write.  
  The existing form already has price override and pricelist-sync logic at the backend.  
  VoiceInput's only job is to fill the field. The form does the rest.

### Stop Words (always active while mic is on)

| Word spoken | Behaviour |
|---|---|
| `stop` / `done` | End listening, process what was captured |
| `cancel` | End listening, clear everything, show nothing |

### Two Modes

| Mode | Fields populated | Notes |
|---|---|---|
| `invoice` | productName, productSize, qty, packingType, sellingPrice | Rate: spoken or from DB |
| `order` | productName, productSize, qty, packingType, itemRemark | No rate. Remark: if user says "remark X" or "note X" |

---

## FILES OVERVIEW

### New files (create from scratch)

```
src/utils/voiceParser.js        — pure JS: text → structured fields
src/utils/voiceMatcher.js       — CommonJS: fuzzy match fields against products DB
src/components/VoiceInput.jsx   — React component: mic button + live text + result card
```

### Modified files

```
main.cjs          — mic permission + model download function
ipcHandlers.js    — 5 new voice IPC handlers + vocab refresh on product create
preload.js        — expose voice API methods
Invoice.jsx       — add <VoiceInput mode="invoice" />
CreateQuickSales  — add <VoiceInput mode="invoice" />
AddCustomerOrder  — add <VoiceInput mode="order" />
AddSupplierOrder  — add <VoiceInput mode="order" />
```

---

## PHASE 1 — Packages + Mic Permission + Model Download

### 1A — Install packages

```bash
npm install vosk extract-zip
```

Both must go in `"dependencies"` (not devDependencies).  
Native bindings require `electron-builder install-app-deps` to rebuild for Electron's Node version.

```bash
npx electron-builder install-app-deps
```

**Verify:** `cat package.json | grep -E "vosk|extract-zip"` shows both in `dependencies`.

---

### 1B — Mic permission in main.cjs

Open `main.cjs`. Inside `app.whenReady()`, after the BrowserWindow is created, add:

```js
// Grant microphone permission for voice input
const { session } = require('electron')
session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  if (permission === 'media') callback(true)
  else callback(false)
})
```

---

### 1C — Model download function in main.cjs

Add these requires at the very top of `main.cjs` alongside existing requires:

```js
const https    = require('https')
const fs       = require('fs')
const path     = require('path')
```

Add this function BEFORE the `app.whenReady()` block:

```js
async function ensureVoiceModel(win) {
  const extract       = require('extract-zip')
  const MODEL_URL     = 'https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip'
  const MODEL_NAME    = 'vosk-model-small-en-in-0.4'
  const modelDir      = path.join(app.getPath('userData'), 'voice-model')
  const modelPath     = path.join(modelDir, MODEL_NAME)
  const zipPath       = path.join(modelDir, 'model.zip')

  if (fs.existsSync(modelPath)) return { exists: true, modelPath }

  fs.mkdirSync(modelDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath)
    https.get(MODEL_URL, (res) => {
      const total = parseInt(res.headers['content-length'], 10)
      let received = 0
      res.on('data', chunk => {
        received += chunk.length
        const percent = Math.round((received / total) * 100)
        if (win && !win.isDestroyed()) {
          win.webContents.send('voice:model-progress', { percent })
        }
      })
      res.pipe(file)
      file.on('finish', async () => {
        file.close()
        try {
          await extract(zipPath, { dir: modelDir })
          fs.unlinkSync(zipPath)
          resolve({ exists: true, modelPath })
        } catch (err) { reject(err) }
      })
    }).on('error', err => {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
      reject(err)
    })
  })
}
```

Also export `mainWindow` from `main.cjs` so `ipcHandlers.js` can reference it.  
Find where `mainWindow` is declared and add after it is assigned:

```js
module.exports = { mainWindow: null }
// then right after: mainWindow = new BrowserWindow(...)
module.exports.mainWindow = mainWindow
```

---

### PHASE 1 VERIFICATION

```bash
npm run dev
```

Expected: app launches with no errors about `vosk` or `extract-zip`.  
If native binding error → run `npx electron-builder install-app-deps` and retry.

---

## PHASE 2 — Three Utility Files

### FILE 1: src/utils/voiceParser.js

```js
// Runs in RENDERER — ES module exports

const NUMBER_MAP = {
  zero:0, one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20,
  thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
  hundred:100, thousand:1000,
  // romanised Hindi numbers
  ek:1, do:2, teen:3, char:4, paanch:5,
  chhe:6, saat:7, aath:8, nau:9, das:10,
  pachas:50, sau:100, hazaar:1000
}

const PACKING_MAP = {
  kg:'Kg', kilo:'Kg', kilogram:'Kg',
  piece:'Pc', pieces:'Pc', pc:'Pc', pcs:'Pc',
  dozen:'Dz', dz:'Dz',
  box:'Box', boxes:'Box',
  packet:'Packet', packets:'Packet',
  kodi:'Kodi', theli:'Theli', set:'Set',
  gram:'Pc', grams:'Pc'
}

function wordsToNumber(str) {
  let total = 0, current = 0
  for (const token of str.toLowerCase().trim().split(/\s+/)) {
    const n = NUMBER_MAP[token] ?? parseFloat(token)
    if (isNaN(n)) continue
    if (n === 100)        { current = current === 0 ? 100 : current * 100 }
    else if (n === 1000)  { total += (current || 1) * 1000; current = 0 }
    else                  { current += n }
  }
  return total + current
}

function extractRate(text) {
  // Match "at 200", "@ 200", "for 200", "200 rupees", "rs 200", "₹200"
  const patterns = [
    /(?:at|@|for|rs\.?|rupees?|₹)\s*([\d,]+(?:\.\d+)?)/i,
    /([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹)/i
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(val) && val > 0) return val
    }
  }
  // Try word-based: "at two hundred"
  const wordMatch = /(?:at|@|for|rs\.?|rupees?)\s+([a-z\s]+?)(?:\s+rupees?)?(?:\s|$)/i.exec(text)
  if (wordMatch) {
    const n = wordsToNumber(wordMatch[1])
    if (n > 0) return n
  }
  return null  // null = not spoken, fetch from DB
}

function extractQty(text) {
  const direct = /^(\d+(?:\.\d+)?)\s/.exec(text.trim())
  if (direct) return parseFloat(direct[1])
  const words = text.toLowerCase().split(/\s+/)
  for (let i = 0; i < Math.min(words.length, 4); i++) {
    const n = wordsToNumber(words[i])
    if (n > 0) return n
  }
  return 1
}

function extractPacking(text) {
  const lower = text.toLowerCase()
  for (const [word, mapped] of Object.entries(PACKING_MAP)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return mapped
  }
  return null
}

function extractRemark(text) {
  const m = /(?:remark|note)\s+(.+)$/i.exec(text)
  return m ? m[1].trim() : null
}

function cleanForProductQuery(text, spokenRate, packing) {
  let t = text
  // Remove rate phrase
  t = t.replace(/(?:at|@|for|rs\.?|rupees?|₹)\s*[\d,a-z\s]+?(?=\s|$)/gi, '')
  // Remove trailing number (price)
  t = t.replace(/\d+(?:\.\d+)?\s*(?:rupees?|rs\.?)?$/i, '')
  // Remove leading number (qty)
  t = t.replace(/^\d+(?:\.\d+)?\s*/, '')
  // Remove packing words
  if (packing) {
    const pkWords = Object.keys(PACKING_MAP).join('|')
    t = t.replace(new RegExp(`\\b(?:${pkWords})\\b`, 'gi'), '')
  }
  // Remove command words
  t = t.replace(/\b(?:add|next|stop|done|cancel|remark|note)\b/gi, '')
  // Remove remark content
  t = t.replace(/(?:remark|note)\s+.+$/i, '')
  return t.trim().replace(/\s+/g, ' ')
}

export function parseVoiceText(rawText, mode) {
  const text = rawText.toLowerCase().trim()

  // Detect stop/cancel trigger
  const lastWord = text.split(/\s+/).pop()
  const trigger = ['stop', 'done'].includes(lastWord)
    ? 'stop'
    : lastWord === 'cancel' ? 'cancel' : null

  const cleanText = text.replace(/\b(?:stop|done|cancel)\b/gi, '').trim()

  const spokenRate  = mode === 'order' ? null : extractRate(cleanText)
  const qty         = extractQty(cleanText)
  const packing     = extractPacking(cleanText)
  const remark      = mode === 'order' ? extractRemark(cleanText) : null
  const productQuery = cleanForProductQuery(cleanText, spokenRate, packing)

  return {
    productQuery: productQuery || cleanText,
    qty,
    packing,       // null in order mode (fetched from matched product)
    spokenRate,    // null if user did not speak a rate — fetch from DB instead
    remark,        // order mode only
    trigger,
    rawText
  }
}
```

---

### FILE 2: src/utils/voiceMatcher.js

```js
// Runs in MAIN PROCESS only — CommonJS exports

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function wordOverlap(query, target) {
  const qw = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const tw = target.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  if (!qw.length) return 0
  let hits = 0
  for (const q of qw) {
    for (const t of tw) {
      const dist = levenshtein(q, t)
      if (dist / Math.max(q.length, t.length) < 0.35) { hits++; break }
    }
  }
  return hits / Math.max(qw.length, tw.length)
}

function scoreProduct(query, product) {
  const target = `${product.name || ''} ${product.size || ''}`.trim()
  const wo     = wordOverlap(query, target)
  const lev    = levenshtein(query.toLowerCase(), target.toLowerCase())
  const ls     = 1 - Math.min(lev / Math.max(query.length, target.length, 1), 1)
  return (wo * 0.65) + (ls * 0.35)
}

function matchProduct(parsed, products, mode) {
  const { productQuery, qty, packing, spokenRate, remark } = parsed

  if (!productQuery || !products.length) return null

  const scored = products
    .filter(p => !p.is_deleted)
    .map(p => ({ p, score: scoreProduct(productQuery, p) }))
    .sort((a, b) => b.score - a.score)

  if (!scored.length || scored[0].score < 0.35) return null

  const best = scored[0].p
  const confidence = Math.round(scored[0].score * 100)
  const alternatives = scored.slice(1, 3)
    .filter(s => s.score > 0.30)
    .map(s => ({
      product: s.p,
      confidence: Math.round(s.score * 100)
    }))

  // Packing: spoken packing (invoice) OR matched product's packing (order)
  const finalPacking = mode === 'order'
    ? (best.packing_type || 'Pc')
    : (packing || best.packing_type || 'Pc')

  // Rate: spoken rate if given, else DB price
  // VoiceInput just puts this value into the form field — the form handles the rest
  const finalRate = mode === 'order'
    ? null
    : (spokenRate !== null ? spokenRate : best.selling_price)

  const rateSource = mode === 'order'
    ? null
    : (spokenRate !== null ? 'spoken' : 'pricelist')

  return {
    product: best,
    confidence,
    alternatives,
    qty,
    finalPacking,
    finalRate,    // populate this into the rate form field — do nothing else
    rateSource,
    remark: remark || null
  }
}

module.exports = { matchProduct }
```

---

### FILE 3: src/utils/voiceVocabulary.js

```js
// Runs in MAIN PROCESS — CommonJS (called from ipcHandlers.js)

const NUMBER_WORDS = [
  'zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
  'eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy',
  'eighty','ninety','hundred','thousand','half','quarter',
  'ek','do','teen','char','paanch','chhe','saat','aath','nau','das',
  'pachas','sau','hazaar','adha','dedh'
]

const PACKING_WORDS = [
  'kg','kilo','kilogram','piece','pieces','pc','pcs',
  'dozen','dz','box','boxes','packet','packets',
  'kodi','theli','set','gram','grams'
]

const COMMAND_WORDS = [
  'add','next','stop','done','cancel',
  'at','for','rupees','rate','price',
  'remark','note','[unk]'
]

function buildVocabulary(products) {
  const words = new Set()

  products.forEach(p => {
    if (p.name) p.name.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 1) words.add(w) })
    if (p.size) p.size.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 1) words.add(w) })
  })

  ;[...NUMBER_WORDS, ...PACKING_WORDS, ...COMMAND_WORDS].forEach(w => words.add(w))

  return JSON.stringify([...words])
}

module.exports = { buildVocabulary }
```

---

### PHASE 2 VERIFICATION

No run needed. Check exports:
- `voiceParser.js` → ES module (`export function parseVoiceText`)
- `voiceMatcher.js` → CommonJS (`module.exports = { matchProduct }`)
- `voiceVocabulary.js` → CommonJS (`module.exports = { buildVocabulary }`)

---

## PHASE 3 — IPC Handlers

Open `ipcHandlers.js`. At the top alongside existing requires, add:

```js
const vosk               = require('vosk')
const pathVoice          = require('path')
const fsVoice            = require('fs')
const { matchProduct }   = require('./src/utils/voiceMatcher')
const { buildVocabulary} = require('./src/utils/voiceVocabulary')
```

Add a module-level state block after requires, before any `ipcMain.handle` calls:

```js
// ─── Voice state (one recognizer at a time) ───────────────────────────────
const vs = {
  model:      null,   // loaded Vosk model
  rec:        null,   // active KaldiRecognizer
  vocab:      null,   // current grammar JSON string
  products:   [],     // cached products for matching
  listening:  false
}
// ──────────────────────────────────────────────────────────────────────────
```

Add the following handlers at the end of `ipcHandlers.js` under a clear comment:

```js
// ════════════════════════════════════════════════════════════════════════════
// VOICE INPUT HANDLERS
// ════════════════════════════════════════════════════════════════════════════

// voice:init — load model + build vocabulary from current products table
ipcMain.handle('voice:init', async () => {
  try {
    const modelPath = pathVoice.join(app.getPath('userData'), 'voice-model', 'vosk-model-small-en-in-0.4')
    if (!fsVoice.existsSync(modelPath)) return { success: false, reason: 'model-not-downloaded' }

    if (!vs.model) {
      vosk.setLogLevel(-1)
      vs.model = new vosk.Model(modelPath)
    }

    vs.products = db.prepare(
      'SELECT code, name, size, packing_type, selling_price, is_deleted FROM products'
    ).all()

    vs.vocab = buildVocabulary(vs.products.filter(p => !p.is_deleted))

    return { success: true, productCount: vs.products.filter(p => !p.is_deleted).length }
  } catch (err) {
    console.error('voice:init', err)
    return { success: false, reason: err.message }
  }
})

// voice:start — create fresh recognizer, begin session
ipcMain.handle('voice:start', () => {
  try {
    if (!vs.model) return { success: false, reason: 'model-not-loaded' }
    if (vs.rec) { vs.rec.free(); vs.rec = null }
    vs.rec = new vosk.KaldiRecognizer(vs.model, 16000, vs.vocab)
    vs.rec.setWords(false)
    vs.listening = true
    return { success: true }
  } catch (err) {
    return { success: false, reason: err.message }
  }
})

// voice:chunk — feed PCM chunk; return partial text
ipcMain.handle('voice:chunk', (_, arrayBuffer) => {
  if (!vs.rec || !vs.listening) return { partial: '' }
  try {
    const buf = Buffer.from(arrayBuffer)
    const accepted = vs.rec.acceptWaveform(buf)
    if (accepted) {
      const text = JSON.parse(vs.rec.result()).text || ''
      return { partial: '', intermediate: text }
    }
    const partial = JSON.parse(vs.rec.partialResult()).partial || ''
    return { partial }
  } catch { return { partial: '' } }
})

// voice:stop — flush final text → parse → match → return populated fields
ipcMain.handle('voice:stop', (_, mode) => {
  try {
    vs.listening = false
    if (!vs.rec) return { success: false, reason: 'no-recognizer' }

    const finalText = JSON.parse(vs.rec.finalResult()).text || ''
    vs.rec.free()
    vs.rec = null

    if (!finalText.trim()) return { success: false, reason: 'empty', rawText: '' }

    // ── Parse text into fields ────────────────────────────────────────────
    const text = finalText.toLowerCase().trim()
    const lastWord = text.split(/\s+/).pop()

    if (lastWord === 'cancel') {
      return { success: false, reason: 'cancelled', rawText: finalText }
    }

    const trigger = ['stop', 'done'].includes(lastWord) ? 'stop' : null
    const clean = text.replace(/\b(?:stop|done|cancel)\b/gi, '').trim()

    // Rate — null means "not spoken, use DB price"
    let spokenRate = null
    if (mode !== 'order') {
      const rm = /(?:at|@|for|rs\.?|rupees?|₹)\s*([\d,]+(?:\.\d+)?)/i.exec(clean)
              ?? /([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹)/i.exec(clean)
      if (rm) spokenRate = parseFloat(rm[1].replace(/,/g, ''))
    }

    // Qty
    const qm = /^(\d+(?:\.\d+)?)\s/.exec(clean.trim())
    const qty = qm ? parseFloat(qm[1]) : 1

    // Packing (invoice only)
    const PMAP = { kg:'Kg',kilo:'Kg',piece:'Pc',pieces:'Pc',pc:'Pc',pcs:'Pc',
      dozen:'Dz',dz:'Dz',box:'Box',boxes:'Box',packet:'Packet',
      packets:'Packet',kodi:'Kodi',theli:'Theli',set:'Set' }
    let packing = null
    if (mode !== 'order') {
      for (const [w, v] of Object.entries(PMAP)) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(clean)) { packing = v; break }
      }
    }

    // Remark (order only)
    let remark = null
    if (mode === 'order') {
      const rem = /(?:remark|note)\s+(.+)$/i.exec(clean)
      if (rem) remark = rem[1].trim()
    }

    // Product query — what's left after stripping everything else
    let productQuery = clean
      .replace(/(?:at|@|for|rs\.?|rupees?|₹)\s*[\d,\w\s]+?(?=\s|$)/gi, '')
      .replace(/\d+(?:\.\d+)?\s*(?:rupees?|rs\.?)?$/i, '')
      .replace(/^\d+(?:\.\d+)?\s*/, '')
      .replace(new RegExp(`\\b(?:${Object.keys(PMAP).join('|')})\\b`, 'gi'), '')
      .replace(/\b(?:add|next|stop|done|cancel|remark|note)\b/gi, '')
      .replace(/(?:remark|note)\s+.+$/i, '')
      .trim().replace(/\s+/g, ' ')

    // ── Fuzzy match against products DB ──────────────────────────────────
    const matched = matchProduct(
      { productQuery: productQuery || clean, qty, packing, spokenRate, remark },
      vs.products,
      mode
    )

    if (!matched) {
      return {
        success: false,
        reason: 'no-match',
        rawText: finalText,
        productQuery
      }
    }

    return { success: true, rawText: finalText, trigger, matched }

  } catch (err) {
    console.error('voice:stop', err)
    return { success: false, reason: err.message, rawText: '' }
  }
})

// voice:download-model — triggers the download with progress events
ipcMain.handle('voice:download-model', async () => {
  try {
    const { mainWindow } = require('./main.cjs')
    const result = await ensureVoiceModel(mainWindow)
    return result
  } catch (err) {
    return { exists: false, error: err.message }
  }
})

// voice:refresh-vocab — call after any product is created/edited
// (already wired into products:create below — see note)
ipcMain.handle('voice:refresh-vocab', () => {
  try {
    if (!vs.model) return { success: false }
    vs.products = db.prepare(
      'SELECT code, name, size, packing_type, selling_price, is_deleted FROM products'
    ).all()
    vs.vocab = buildVocabulary(vs.products.filter(p => !p.is_deleted))
    return { success: true }
  } catch (err) {
    return { success: false }
  }
})

// ════════════════════════════════════════════════════════════════════════════
// VOCAB REFRESH ON PRODUCT CREATE
// ════════════════════════════════════════════════════════════════════════════
// Find the existing products:create handler in ipcHandlers.js.
// After the product is successfully inserted (inside the try block, after db.run/prepare),
// add this one block — it is non-critical so it's wrapped safely:
//
//   try {
//     vs.products = db.prepare(
//       'SELECT code, name, size, packing_type, selling_price, is_deleted FROM products'
//     ).all()
//     if (vs.model) vs.vocab = buildVocabulary(vs.products.filter(p => !p.is_deleted))
//   } catch (_) { /* non-critical */ }
//
// Do NOT change any other part of the products:create handler.
```

---

### PHASE 3 VERIFICATION

```bash
npm run dev
```

Open DevTools console and run:
```js
await window.api.invoke('voice:init')
// Expected: { success: false, reason: 'model-not-downloaded' }
// This confirms the handler is registered and model path check works.
```

---

## PHASE 4 — Preload Exposure

Open `preload.js`. Inside the `contextBridge.exposeInMainWorld(...)` object, add:

```js
// ── Voice Input API ────────────────────────────────────────────────────────
voiceInit:          ()    => ipcRenderer.invoke('voice:init'),
voiceStart:         ()    => ipcRenderer.invoke('voice:start'),
voiceChunk:         (buf) => ipcRenderer.invoke('voice:chunk', buf),
voiceStop:          (mode)=> ipcRenderer.invoke('voice:stop', mode),
voiceDownload:      ()    => ipcRenderer.invoke('voice:download-model'),
voiceRefreshVocab:  ()    => ipcRenderer.invoke('voice:refresh-vocab'),

onVoiceProgress: (cb) => ipcRenderer.on('voice:model-progress', (_, d) => cb(d)),
offVoiceProgress: () => ipcRenderer.removeAllListeners('voice:model-progress'),
// ──────────────────────────────────────────────────────────────────────────
```

---

### PHASE 4 VERIFICATION

```bash
npm run dev
```

In DevTools:
```js
typeof window.api.voiceInit         // "function"
typeof window.api.voiceStop         // "function"
typeof window.api.onVoiceProgress   // "function"
```

---

## PHASE 5 — VoiceInput.jsx Component

Create file: `src/components/VoiceInput.jsx`

### States

```
IDLE         → mic button visible, blue, ready to click
DOWNLOADING  → progress bar shown (first-time model download)
LISTENING    → button pulsing red, partial text shown live
PROCESSING   → spinner while main process matches
RESULT       → result card with matched product + form values + action buttons
ERROR        → inline error message with retry option
```

### Key behaviour notes for implementation

1. Audio capture uses `getUserMedia` → `ScriptProcessor` → `float32 → Int16` → IPC chunk
2. Each chunk result may contain `partial` (live preview) or `intermediate` (Vosk accepted phrase)
3. After mic stops → `voice:stop` returns `matched` object
4. `matched.finalRate` is the value to put in the rate field — regardless of whether it came from speech or DB
5. `matched.rateSource` is `'spoken'` or `'pricelist'` — show this label in the UI for clarity
6. Clicking "Add Item" calls `onResult(formValues)` then auto-restarts mic after 300ms
7. Clicking retry clears result and restarts mic immediately
8. Clicking cancel or X clears everything, mic stays off

### Props

```js
/**
 * @param {'invoice'|'order'} mode
 * @param {function}          onResult   — called with populated form values
 * @param {boolean}           disabled   — disables mic button
 */
```

### onResult payload

For `mode="invoice"`:
```js
{
  productCode:  string,   // product.code from matched record
  productName:  string,   // product.name
  productSize:  string,   // product.size
  qty:          number,
  packingType:  string,   // finalPacking
  sellingPrice: number,   // finalRate — put this in the rate field, nothing else
  rateSource:   string    // 'spoken' | 'pricelist' — for UI label only
}
```

For `mode="order"`:
```js
{
  productCode:  string,
  productName:  string,
  productSize:  string,
  qty:          number,
  packingType:  string,   // from matched product record
  remark:       string    // '' if not spoken
}
```

### float32 → Int16 conversion (exact function to use)

```js
function float32ToInt16(buffer) {
  const out = new Int16Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}
```

### Audio setup

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
})
const ctx       = new AudioContext({ sampleRate: 16000 })
const source    = ctx.createMediaStreamSource(stream)
const processor = ctx.createScriptProcessor(4096, 1, 1)

processor.onaudioprocess = async (e) => {
  if (!listening) return
  const int16 = float32ToInt16(e.inputBuffer.getChannelData(0))
  const res   = await window.api.voiceChunk(int16.buffer)

  // Show partial text live
  if (res.partial) setPartialText(res.partial)

  // Detect stop/cancel words in partial stream
  const lastWord = (res.partial || '').trim().toLowerCase().split(/\s+/).pop()
  if (['stop', 'done', 'cancel'].includes(lastWord)) await stopListening()
}

source.connect(processor)
processor.connect(ctx.destination)
```

### UI elements to build

**Mic button:** `w-10 h-10 rounded-full` — blue gradient when idle, red pulsing when listening, gray spinner when processing.

**Partial text:** `text-sm text-[#64748B] italic` — appears next to button while listening.

**Download prompt:** `text-xs text-[#2563EB] underline` — shows when model not downloaded yet.

**Progress bar:** `bg-[#F2F4F6] rounded-full h-2` with animated blue fill.

**Result card:** `bg-white rounded-xl border border-[#C3C6D7]/20 shadow-sm` with sections:
- "You said" header strip (bg-[#F2F4F6]/50)
- Matched product row: name, size, confidence badge (green ≥80 / amber ≥60 / red <60)
- Fields row: Qty + Packing + Rate (with source label) or Remark
- Alternatives if confidence < 65%
- Action buttons: "Add Item" (blue gradient) | retry icon | cancel icon

---

### PHASE 5 VERIFICATION

```bash
npm run dev
```

Navigate to Invoice page. The component is not wired yet.  
Check terminal for no compile errors on the new file.

---

## PHASE 6 — Wire Into All Four Pages

For each page, make **exactly two changes**:
1. Add the import
2. Place `<VoiceInput>` above the product search input inside AddItemForm
3. Add the `onResult` handler that populates **existing** form state

**CRITICAL:** Do not restructure existing state. Do not add new state.  
Find the exact state setter names already in each file and use them.  
VoiceInput just fills the same fields the user would type manually.

---

### 6A — Invoice.jsx

```js
import VoiceInput from '../../components/VoiceInput'
```

Find the product search input area inside the AddItemForm. Add above it:

```jsx
<VoiceInput
  mode="invoice"
  disabled={/* existing isSaving or isLoading state */}
  onResult={(v) => {
    // Step 1: Find product in the already-loaded products array
    const product = products.find(p => p.code === v.productCode)

    // Step 2: Call the same function that runs when user picks from dropdown
    // Look for the function called on dropdown item click — it sets product name,
    // code, size etc. Pass the matched product to it.
    if (product) handleProductSelect(product)  // use actual function name from this file

    // Step 3: Set qty, packing, and rate into the same newItem state
    // Use the actual state setter name from this file (setNewItem or equivalent)
    setNewItem(prev => ({
      ...prev,
      quantity:      String(v.qty),
      packing_type:  v.packingType,
      selling_price: String(v.sellingPrice),  // put finalRate here — form handles the rest
    }))
  }}
/>
```

> **Note:** Replace `handleProductSelect` and `setNewItem` with the actual function/setter names in Invoice.jsx. Do not guess — read the file first.

---

### 6B — CreateQuickSales.jsx

```js
import VoiceInput from '../../components/VoiceInput'
```

Same as Invoice.jsx. Use `mode="invoice"`. CreateQuickSales has an identical AddItemForm structure. Match its actual state setter names.

---

### 6C — AddCustomerOrder.jsx

```js
import VoiceInput from '../../components/VoiceInput'
```

```jsx
<VoiceInput
  mode="order"
  onResult={(v) => {
    const product = products.find(p => p.code === v.productCode)
    if (product) handleProductSelect(product)  // actual name from this file

    setNewItem(prev => ({
      ...prev,
      quantity:     String(v.qty),
      packing_type: v.packingType,
      item_remark:  v.remark || prev.item_remark,
      // No selling_price in order mode
    }))
  }}
/>
```

---

### 6D — AddSupplierOrder.jsx

Identical to AddCustomerOrder.jsx. Same import, same `mode="order"`, same onResult structure. Match actual state setter names from this file.

---

### PHASE 6 VERIFICATION

```bash
npm run dev
```

Manual checks:
- [ ] Invoice page → mic button visible above product search
- [ ] Click mic → browser asks microphone permission → Allow
- [ ] Button turns red, "Listening..." text appears
- [ ] Click mic again → shows "Processing..." → error "no-match" or "empty" (correct — model not downloaded)
- [ ] AddCustomerOrder page → mic button visible
- [ ] No console errors on any page

---

## FULL FLOW VERIFICATION (after model is downloaded)

To trigger model download: on the Invoice page, if model not present, a "Download voice model" link shows. Click it → 36 MB downloads → mic activates.

### Invoice mode test

```
1. Click mic → button pulses red
2. Say: "five kg namak at two hundred"
3. Watch partial text appear: "five kg namak at two hundred"
4. Click mic to stop
5. Result card shows:
     You said: "five kg namak at two hundred"
     Namak 1 Kg — 94%
     Qty: 5 Kg   Rate: ₹200 (spoken)
6. Click "Add Item"
7. Item appears in line items table
8. Mic auto-restarts for next item
```

### Order mode test

```
1. Open AddCustomerOrder → click mic
2. Say: "ten packets namak remark for ramesh bhai"
3. Result card shows:
     Namak — 10 Packet
     Remark: for ramesh bhai
     (no rate row)
4. Click "Add Item" → item added with remark
```

### Rate behaviour test

```
Scenario A — user speaks rate:
  Say: "5 sami at 250"
  DB has sami at ₹200
  Form populates rate field with 250 ✓
  Existing form logic sees 250 in the field (same as if user typed it)

Scenario B — user does not speak rate:
  Say: "5 sami"
  DB has sami at ₹200
  Form populates rate field with 200 ✓
  Existing form logic sees 200 in the field (same as if user typed it)

In both cases VoiceInput only sets the field value — nothing else.
```

---

## HARD LIMITS — DO NOT TOUCH

- `generateInvoicePDF.js` / `generateOrderPDF.js` / `generateQuickSalePDF.js`
- Any existing IPC handler logic other than the vocab refresh addition in `products:create`
- Existing form validation, price sync, or submission logic in any page
- `db.js` schema
- NavBar, Layout, or any page not listed in this document
- The manual AddItemForm — voice input runs alongside it, not instead of it

