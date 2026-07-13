# AGS ERP — Supplier Bill Scanner (OCR) Implementation

> Work through phases 1–9 strictly in order.
> Complete each phase verification before moving to the next.
> DO NOT skip ahead. DO NOT change files outside the current phase scope.

---

## WHAT WE ARE BUILDING

A wizard that lets the user scan/upload a photo of a physical supplier bill,
extract line items via offline OCR, match them to existing products, review
everything, and push the result as a purchase record to the supplier's
account — replacing manual re-typing of the entire bill.

Flow: **Upload → Scanning → Match → Preview → Confirmed**

This is a **supplier-only** feature. It does not touch customers, invoices,
orders, or quick sales.

---

## ARCHITECTURE DECISIONS — READ BEFORE STARTING

**OCR engine:** `ppu-paddle-ocr` (PaddleOCR PP-OCRv5 via ONNX Runtime,
pure Node.js, no Python). Two recognition models used depending on bill
language:
  - English bill → `PP-OCRv5 mobile English` model
  - Hindi / Marathi bill → `devanagari_PP-OCRv5_mobile_rec` model
  - Mixed → run both, merge results by row position

**Models download on first use only** — same UX pattern as the Vosk voice
model (`ensureVoiceModel` in main.cjs). Never bundled in the installer.
Cached permanently in `userData/ocr-models/` after first download.

**Bill ID:** Auto-generated `B-1`, `B-2`... via `document_sequences`
(same recycling pattern as invoices/orders/quick sales). The wizard
pre-fills an editable field with the next default ID. If the user types
their own value, that value is used as `bill_id` instead and the sequence
is NOT incremented. If left as default, the sequence increments normally.

**Image storage:** A checkbox on the Upload step. Ticked → image saved
permanently to `userData/bill-scans/{bill_id}.jpg`, path stored in DB.
Unticked → image is only used in memory during the wizard and discarded
after the bill is pushed (or if the wizard is cancelled).

**Supplier is pre-selected** before the wizard starts — user opens the
wizard from within a supplier's account page context.

---

## PHASE 1 — Package Install

```bash
npm install ppu-paddle-ocr onnxruntime-node sharp
```

All three go into `"dependencies"` (native bindings for onnxruntime-node
and sharp need `electron-builder install-app-deps` to rebuild).

```bash
npx electron-builder install-app-deps
```

**Verify:** `cat package.json | grep -E "ppu-paddle-ocr|onnxruntime-node|sharp"`
shows all three in dependencies.

### PHASE 1 VERIFICATION

```bash
npm run dev
```
App launches with no errors about missing native bindings.

---

## PHASE 2 — Database Schema (db.js)

Open `db.js`. Add this to the existing migration section (same pattern
as the invoice status migration — idempotent, safe to run every startup).

```js
// ─── MIGRATION: Supplier Bill Scanner ────────────────────────────────────

try {
  db.prepare('SELECT bill_id FROM supplier_bills LIMIT 1').get()
} catch (e) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_bills (
      bill_id        TEXT    PRIMARY KEY,
      supplier_id    TEXT    NOT NULL,
      bill_date      TEXT    NOT NULL,
      bill_no        TEXT,
      total_amount   REAL    DEFAULT 0,
      status         TEXT    DEFAULT 'draft',
      scan_image_path TEXT   DEFAULT NULL,
      created_at     TEXT    NOT NULL,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
    )
  `).run()
  console.log('[Migration] Created supplier_bills table')
}

try {
  db.prepare('SELECT id FROM supplier_bill_items LIMIT 1').get()
} catch (e) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_bill_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id       TEXT    NOT NULL,
      product_code  TEXT    DEFAULT NULL,
      product_name  TEXT    NOT NULL,
      quantity      REAL    NOT NULL,
      rate          REAL    NOT NULL,
      amount        REAL    NOT NULL,
      FOREIGN KEY(bill_id) REFERENCES supplier_bills(bill_id)
    )
  `).run()
  console.log('[Migration] Created supplier_bill_items table')
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_bill_items_bill
  ON supplier_bill_items(bill_id)
`).run()

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_bills_supplier
  ON supplier_bills(supplier_id)
`).run()

db.prepare(
  `INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('supplier_bill', 0)`
).run()

// ─── END MIGRATION ────────────────────────────────────────────────────────
```

### PHASE 2 VERIFICATION

```bash
npm run dev
```
Check startup logs for the two `[Migration] Created ...` lines (first run
only). Second run should show neither. No SQL errors.

---

## PHASE 3 — OCR Model Download (main.cjs)

Open `main.cjs`. Add this function BEFORE `app.whenReady()`, following
the exact same pattern as the existing `ensureVoiceModel` function
(place it right after that function if it exists).

```js
// ─── OCR Model Download (Bill Scanner) ───────────────────────────────────
async function ensureOcrModels(win, languageMode) {
  const fs = require('fs')
  const path = require('path')
  const https = require('https')

  const modelDir = path.join(app.getPath('userData'), 'ocr-models')
  fs.mkdirSync(modelDir, { recursive: true })

  const MODELS = {
    english: {
      name: 'english',
      url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec/resolve/main/inference.onnx',
      fileName: 'english_rec.onnx'
    },
    devanagari: {
      name: 'devanagari',
      url: 'https://huggingface.co/PaddlePaddle/devanagari_PP-OCRv5_mobile_rec/resolve/main/inference.onnx',
      fileName: 'devanagari_rec.onnx'
    },
    detection: {
      name: 'detection',
      url: 'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det/resolve/main/inference.onnx',
      fileName: 'detection.onnx'
    }
  }

  // Determine which models are needed based on languageMode
  const needed = ['detection']
  if (languageMode === 'english' || languageMode === 'mixed') needed.push('english')
  if (languageMode === 'devanagari' || languageMode === 'mixed') needed.push('devanagari')

  const results = {}

  for (const key of needed) {
    const model = MODELS[key]
    const destPath = path.join(modelDir, model.fileName)

    if (fs.existsSync(destPath)) {
      results[key] = destPath
      continue
    }

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath)
      https.get(model.url, (response) => {
        // Handle redirects (HuggingFace often redirects to CDN)
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirected) => {
            pipeWithProgress(redirected, file, win, model.name, resolve, reject)
          })
          return
        }
        pipeWithProgress(response, file, win, model.name, resolve, reject)
      }).on('error', reject)
    })

    results[key] = destPath
  }

  return results

  function pipeWithProgress(response, file, win, modelName, resolve, reject) {
    const total = parseInt(response.headers['content-length'], 10) || 0
    let downloaded = 0
    response.on('data', (chunk) => {
      downloaded += chunk.length
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
      if (win && !win.isDestroyed()) {
        win.webContents.send('ocr:model-progress', { model: modelName, percent })
      }
    })
    response.pipe(file)
    file.on('finish', () => { file.close(); resolve() })
    file.on('error', reject)
  }
}
// ──────────────────────────────────────────────────────────────────────────
```

### PHASE 3 VERIFICATION

```bash
npm run dev
```
App launches with no errors. Function is not yet called anywhere.

---

## PHASE 4 — OCR Processing Helpers (new files)

### FILE 1: `src/utils/billOcr.js`

Runs in MAIN PROCESS only — CommonJS. Handles running OCR and grouping
detected text into rows/columns.

```js
// Runs in MAIN PROCESS

const path = require('path')

let ocrInstance = null

async function initOcr(modelPaths) {
  const { PaddleOcrService } = require('ppu-paddle-ocr')
  ocrInstance = new PaddleOcrService()
  await ocrInstance.initialize()
  return ocrInstance
}

/**
 * Runs OCR on a preprocessed image path.
 * Returns raw detected text lines with bounding box positions.
 */
async function runOcr(imagePath) {
  if (!ocrInstance) throw new Error('OCR not initialized')
  const result = await ocrInstance.recognize(imagePath)
  // result.lines expected to contain { text, confidence, bbox: [x,y,w,h] }
  return result.lines || []
}

/**
 * Groups OCR text lines into table rows based on Y-position proximity,
 * then orders each row's words left-to-right by X-position.
 * Returns an array of row strings.
 */
function groupIntoRows(lines, yTolerance = 15) {
  if (!lines.length) return []

  const sorted = [...lines].sort((a, b) => a.bbox[1] - b.bbox[1])
  const rows = []
  let currentRow = [sorted[0]]
  let currentY = sorted[0].bbox[1]

  for (let i = 1; i < sorted.length; i++) {
    const line = sorted[i]
    if (Math.abs(line.bbox[1] - currentY) <= yTolerance) {
      currentRow.push(line)
    } else {
      rows.push(currentRow)
      currentRow = [line]
      currentY = line.bbox[1]
    }
  }
  rows.push(currentRow)

  return rows.map(row => {
    const sortedRow = row.sort((a, b) => a.bbox[0] - b.bbox[0])
    return sortedRow.map(w => w.text).join(' ')
  })
}

/**
 * Parses a table row string into { productName, quantity, rate, amount }.
 * Looks for the LAST two or three numbers in the row as qty/rate/amount,
 * everything before that is treated as the product name.
 */
function parseRowToLineItem(rowText) {
  const numberPattern = /\d+(?:\.\d+)?/g
  const numbers = [...rowText.matchAll(numberPattern)].map(m => ({
    value: parseFloat(m[0]),
    index: m.index
  }))

  if (numbers.length < 2) {
    return { productName: rowText.trim(), quantity: null, rate: null, amount: null, raw: rowText }
  }

  // Take the last 2-3 numbers as qty, rate, amount (in that order)
  const trailing = numbers.slice(-3)
  let quantity = null, rate = null, amount = null

  if (trailing.length === 3) {
    [quantity, rate, amount] = trailing.map(n => n.value)
  } else if (trailing.length === 2) {
    [quantity, rate] = trailing.map(n => n.value)
    amount = quantity * rate
  }

  // Product name is everything before the first of the trailing numbers
  const cutoffIndex = trailing[0].index
  const productName = rowText.slice(0, cutoffIndex).trim()

  return { productName, quantity, rate, amount, raw: rowText }
}

module.exports = { initOcr, runOcr, groupIntoRows, parseRowToLineItem }
```

### FILE 2: `src/utils/billPreprocess.js`

Runs in MAIN PROCESS. Uses `sharp` to clean up the image before OCR.

```js
// Runs in MAIN PROCESS

const sharp = require('sharp')
const path = require('path')
const os = require('os')

/**
 * Preprocesses a bill image for better OCR accuracy:
 * grayscale, contrast boost, resize to a reasonable width.
 * Returns the path to the processed temp file.
 */
async function preprocessImage(inputPath) {
  const tempPath = path.join(os.tmpdir(), `bill-preprocessed-${Date.now()}.png`)

  await sharp(inputPath)
    .resize({ width: 1800, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .toFile(tempPath)

  return tempPath
}

module.exports = { preprocessImage }
```

### FILE 3: `src/utils/billMatcher.js`

Runs in MAIN PROCESS. Reuses the exact fuzzy-match approach from
`voiceMatcher.js` — same Levenshtein + word overlap logic, adapted for
bill line items instead of voice commands.

```js
// Runs in MAIN PROCESS — CommonJS

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
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
      if (dist / Math.max(q.length, t.length) < 0.4) { hits++; break }
    }
  }
  return hits / Math.max(qw.length, tw.length)
}

function scoreProduct(query, product) {
  const target = `${product.name || ''} ${product.size || ''}`.trim()
  const wo = wordOverlap(query, target)
  const lev = levenshtein(query.toLowerCase(), target.toLowerCase())
  const ls = 1 - Math.min(lev / Math.max(query.length, target.length, 1), 1)
  return (wo * 0.7) + (ls * 0.3)
}

/**
 * Matches a raw OCR product name against the products table.
 * Returns best match + up to 2 alternatives, or null if nothing scores
 * above the threshold.
 */
function matchBillItem(productName, products) {
  if (!productName || !products.length) return null

  const scored = products
    .filter(p => !p.is_deleted)
    .map(p => ({ product: p, score: scoreProduct(productName, p) }))
    .sort((a, b) => b.score - a.score)

  if (!scored.length || scored[0].score < 0.3) return null

  return {
    product: scored[0].product,
    confidence: Math.round(scored[0].score * 100),
    alternatives: scored.slice(1, 3)
      .filter(s => s.score > 0.25)
      .map(s => ({ product: s.product, confidence: Math.round(s.score * 100) }))
  }
}

module.exports = { matchBillItem }
```

### PHASE 4 VERIFICATION

No run needed. Confirm all three files use `module.exports` (CommonJS,
since they run in the main process).

---

## PHASE 5 — IPC Handlers (ipcHandlers.js)

Add these handlers in a clearly marked section at the end of the file.

```js
// ════════════════════════════════════════════════════════════════════════════
// SUPPLIER BILL SCANNER HANDLERS
// ════════════════════════════════════════════════════════════════════════════

const { preprocessImage } = require('./src/utils/billPreprocess')
const { initOcr, runOcr, groupIntoRows, parseRowToLineItem } = require('./src/utils/billOcr')
const { matchBillItem } = require('./src/utils/billMatcher')

let ocrModelsReady = false

// Check if OCR models are already downloaded for the requested language mode
ipcMain.handle('bills:checkModels', wrap((languageMode) => {
  const fs = require('fs')
  const path = require('path')
  const modelDir = path.join(app.getPath('userData'), 'ocr-models')

  const needed = ['detection.onnx']
  if (languageMode === 'english' || languageMode === 'mixed') needed.push('english_rec.onnx')
  if (languageMode === 'devanagari' || languageMode === 'mixed') needed.push('devanagari_rec.onnx')

  const missing = needed.filter(f => !fs.existsSync(path.join(modelDir, f)))
  return { ready: missing.length === 0, missing }
}))

// Download OCR models for the requested language mode
ipcMain.handle('bills:downloadModels', async (event, languageMode) => {
  try {
    const { mainWindow } = require('./main.cjs')
    await ensureOcrModels(mainWindow, languageMode)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Process an uploaded bill image: preprocess → OCR → parse → match
ipcMain.handle('bills:scanImage', wrap(async (data) => {
  const { imagePath, languageMode, supplierId } = data

  // Step 1: Preprocess
  const processedPath = await preprocessImage(imagePath)

  // Step 2: OCR
  if (!ocrInstance) {
    await initOcr()
  }
  const rawLines = await runOcr(processedPath)

  // Step 3: Group into rows and parse
  const rowStrings = groupIntoRows(rawLines)
  const parsedRows = rowStrings
    .map(parseRowToLineItem)
    .filter(row => row.quantity !== null && row.rate !== null) // skip header/junk rows

  // Step 4: Match each row against products for this... actually all products
  const products = db.prepare(
    'SELECT code, name, size, packing_type, selling_price, is_deleted FROM products'
  ).all()

  const matchedRows = parsedRows.map(row => {
    const match = matchBillItem(row.productName, products)
    return {
      ocrProductName: row.productName,
      quantity: row.quantity,
      rate: row.rate,
      amount: row.amount,
      matchedProduct: match ? match.product : null,
      confidence: match ? match.confidence : 0,
      alternatives: match ? match.alternatives : []
    }
  })

  return { success: true, items: matchedRows }
}))

// Get the next default bill ID (without incrementing)
ipcMain.handle('bills:getNextId', wrap(() => {
  const seq = db.prepare(
    "SELECT last_number FROM document_sequences WHERE doc_type = 'supplier_bill'"
  ).get()
  return `B-${seq.last_number + 1}`
}))

// Push the confirmed bill to the supplier account
ipcMain.handle('bills:push', wrap((data) => {
  const {
    bill_id: userProvidedId, supplier_id, bill_date, bill_no,
    items, scan_image_path, keep_image
  } = data

  if (!supplier_id || !bill_date || !Array.isArray(items) || items.length === 0) {
    return { error: 'Missing required fields' }
  }

  const pushTxn = db.transaction(() => {
    let bill_id

    if (userProvidedId && userProvidedId.trim()) {
      // User typed their own ID — use it, do not touch the sequence
      bill_id = userProvidedId.trim()
      const exists = db.prepare('SELECT bill_id FROM supplier_bills WHERE bill_id = ?').get(bill_id)
      if (exists) throw new Error(`Bill ID ${bill_id} already exists`)
    } else {
      // Use default — increment sequence
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'supplier_bill'").run()
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'supplier_bill'").get()
      bill_id = `B-${seq.last_number}`
    }

    const totalAmount = items.reduce((sum, it) => sum + (it.quantity * it.rate), 0)

    db.prepare(`
      INSERT INTO supplier_bills
        (bill_id, supplier_id, bill_date, bill_no, total_amount, status, scan_image_path, created_at)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?)
    `).run(
      bill_id, supplier_id, bill_date, bill_no || null, totalAmount,
      keep_image ? scan_image_path : null,
      new Date().toISOString()
    )

    const insertItem = db.prepare(`
      INSERT INTO supplier_bill_items (bill_id, product_code, product_name, quantity, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const item of items) {
      insertItem.run(
        bill_id, item.product_code || null, item.product_name,
        item.quantity, item.rate, item.quantity * item.rate
      )
    }

    // Create the maal (purchase) entry for the supplier account
    db.prepare(`
      INSERT INTO supplier_maal_account
        (supplier_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(supplier_id, bill_date, bill_id, totalAmount, bill_no ? `Bill No. ${bill_no}` : '')

    return bill_id
  })

  try {
    const bill_id = pushTxn()
    return { success: true, bill_id }
  } catch (err) {
    return { error: err.message }
  }
}))

// Discard a temp preprocessed/uploaded image (called when user cancels
// the wizard or unticks "keep image")
ipcMain.handle('bills:discardImage', wrap((imagePath) => {
  try {
    const fs = require('fs')
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath)
    return { success: true }
  } catch (err) {
    return { success: false }
  }
}))

// Copy the uploaded image to permanent storage (called only if user
// ticked "keep image" before pushing)
ipcMain.handle('bills:saveImage', wrap((data) => {
  const { sourcePath, bill_id } = data
  try {
    const fs = require('fs')
    const path = require('path')
    const destDir = path.join(app.getPath('userData'), 'bill-scans')
    fs.mkdirSync(destDir, { recursive: true })
    const ext = path.extname(sourcePath) || '.jpg'
    const destPath = path.join(destDir, `${bill_id}${ext}`)
    fs.copyFileSync(sourcePath, destPath)
    return { success: true, path: destPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}))

// ════════════════════════════════════════════════════════════════════════════
```

### PHASE 5 VERIFICATION

```bash
npm run dev
```

In DevTools console:
```js
await window.api.invoke('bills:getNextId')
// Expected: "B-1" (or next number if bills already exist)

await window.api.invoke('bills:checkModels', 'english')
// Expected: { ready: false, missing: [...] } on first run
```

---

## PHASE 6 — Preload.js

Add to the `contextBridge.exposeInMainWorld` object:

```js
// Bill Scanner API
billsCheckModels:    (mode)  => ipcRenderer.invoke('bills:checkModels', mode),
billsDownloadModels: (mode)  => ipcRenderer.invoke('bills:downloadModels', mode),
billsScanImage:      (data)  => ipcRenderer.invoke('bills:scanImage', data),
billsGetNextId:      ()      => ipcRenderer.invoke('bills:getNextId'),
billsPush:           (data)  => ipcRenderer.invoke('bills:push', data),
billsDiscardImage:   (path)  => ipcRenderer.invoke('bills:discardImage', path),
billsSaveImage:       (data) => ipcRenderer.invoke('bills:saveImage', data),

onOcrModelProgress:  (cb) => ipcRenderer.on('ocr:model-progress', (_, d) => cb(d)),
offOcrModelProgress: ()   => ipcRenderer.removeAllListeners('ocr:model-progress'),
```

### PHASE 6 VERIFICATION

```bash
npm run dev
```
DevTools: `typeof window.api.billsScanImage` → `"function"`

---

## PHASE 7 — Wizard Shell + Step 1 (Upload)

### FILE: `src/modules/bills/BillScanner.jsx`

This is the wizard shell — manages step state and renders the active step.

```jsx
import { useState } from 'react'
import StepUpload from './StepUpload'
import StepScanning from './StepScanning'
import StepMatch from './StepMatch'
import StepPreview from './StepPreview'
import StepConfirmed from './StepConfirmed'

const STEPS = ['upload', 'scanning', 'match', 'preview', 'confirmed']

export default function BillScanner({ supplier, onClose }) {
  const [step, setStep] = useState('upload')
  const [wizardData, setWizardData] = useState({
    imagePath: null,
    languageMode: 'english',
    keepImage: false,
    billId: '',
    billDate: new Date().toISOString().split('T')[0],
    billNo: '',
    items: [],
    pushedBillId: null
  })

  function updateData(patch) {
    setWizardData(prev => ({ ...prev, ...patch }))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 py-4 bg-[#F2F4F6]/50 border-b border-[#C3C6D7]/10">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step === s ? 'bg-[#004AC6] text-white' :
                  STEPS.indexOf(step) > i ? 'bg-emerald-100 text-emerald-700' :
                  'bg-[#E6E8EA] text-[#64748B]'}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-[#E6E8EA]" />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {step === 'upload' && (
          <StepUpload
            supplier={supplier}
            data={wizardData}
            updateData={updateData}
            onNext={() => setStep('scanning')}
            onCancel={onClose}
          />
        )}
        {step === 'scanning' && (
          <StepScanning
            data={wizardData}
            updateData={updateData}
            onNext={() => setStep('match')}
            onBack={() => setStep('upload')}
          />
        )}
        {step === 'match' && (
          <StepMatch
            data={wizardData}
            updateData={updateData}
            onNext={() => setStep('preview')}
            onBack={() => setStep('upload')}
          />
        )}
        {step === 'preview' && (
          <StepPreview
            supplier={supplier}
            data={wizardData}
            updateData={updateData}
            onNext={() => setStep('confirmed')}
            onBack={() => setStep('match')}
          />
        )}
        {step === 'confirmed' && (
          <StepConfirmed
            data={wizardData}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
```

### FILE: `src/modules/bills/StepUpload.jsx`

```jsx
import { useState } from 'react'
import { Upload, FileImage } from 'lucide-react'

export default function StepUpload({ supplier, data, updateData, onNext, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [checkingModels, setCheckingModels] = useState(false)
  const [modelsReady, setModelsReady] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState({})

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const path = file.path // Electron gives full path
    updateData({ imagePath: path })
    setPreview(URL.createObjectURL(file))
  }

  async function checkAndDownloadModels() {
    setCheckingModels(true)
    const check = await window.api.billsCheckModels(data.languageMode)
    if (check.ready) {
      setModelsReady(true)
      setCheckingModels(false)
      return true
    }

    setModelsReady(false)
    window.api.onOcrModelProgress(({ model, percent }) => {
      setDownloadProgress(prev => ({ ...prev, [model]: percent }))
    })

    const res = await window.api.billsDownloadModels(data.languageMode)
    window.api.offOcrModelProgress()
    setCheckingModels(false)

    if (res.success) {
      setModelsReady(true)
      return true
    }
    return false
  }

  async function handleNext() {
    const ready = modelsReady || await checkAndDownloadModels()
    if (ready) onNext()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-[#191C1E]">Scan Supplier Bill</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Supplier: <strong className="text-[#0F172A]">{supplier.name}</strong>
        </p>
      </div>

      {/* Upload area */}
      <label className="border-2 border-dashed border-[#C3C6D7]/30 rounded-xl
                        p-8 flex flex-col items-center justify-center gap-2 cursor-pointer
                        hover:border-[#004AC6]/40 hover:bg-[#F2F4F6]/50 transition-all">
        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        {preview ? (
          <img src={preview} alt="Bill preview" className="max-h-64 rounded-lg" />
        ) : (
          <>
            <Upload className="w-8 h-8 text-[#C3C6D7]" />
            <p className="text-sm font-medium text-[#434655]">Click to upload a bill photo</p>
            <p className="text-xs text-[#64748B]">JPG, PNG</p>
          </>
        )}
      </label>

      {/* Language mode */}
      <div>
        <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
          Bill Language
        </label>
        <div className="flex gap-2">
          {['english', 'devanagari', 'mixed'].map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => { updateData({ languageMode: mode }); setModelsReady(null) }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all
                ${data.languageMode === mode
                  ? 'bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white'
                  : 'bg-[#E6E8EA] text-[#191C1E] hover:bg-[#E0E3E5]'}`}
            >
              {mode === 'english' ? 'English' : mode === 'devanagari' ? 'Hindi / Marathi' : 'Mixed'}
            </button>
          ))}
        </div>
      </div>

      {/* Keep image toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="keepImage"
          checked={data.keepImage}
          onChange={e => updateData({ keepImage: e.target.checked })}
          className="w-4 h-4 accent-[#004AC6] cursor-pointer"
        />
        <label htmlFor="keepImage" className="text-sm text-[#434655] cursor-pointer">
          Save a copy of this bill image for future reference
        </label>
      </div>

      {/* Model download progress */}
      {checkingModels && (
        <div className="bg-[#F2F4F6] rounded-lg p-4">
          <p className="text-xs font-bold text-[#434655] uppercase mb-2">
            {Object.keys(downloadProgress).length > 0
              ? 'Downloading OCR models (one-time, ~30MB)'
              : 'Checking OCR models...'}
          </p>
          {Object.entries(downloadProgress).map(([model, percent]) => (
            <div key={model} className="mb-1">
              <div className="flex justify-between text-xs text-[#64748B] mb-0.5">
                <span className="capitalize">{model}</span>
                <span>{percent}%</span>
              </div>
              <div className="w-full bg-white rounded-full h-1.5">
                <div className="bg-[#004AC6] h-1.5 rounded-full transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={!data.imagePath || checkingModels}
          onClick={handleNext}
          className="px-6 py-2.5 text-white font-bold text-sm rounded-xl
                     shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
        >
          {checkingModels ? 'Preparing...' : 'Next: Scan Bill'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-bold text-sm rounded-xl
                     hover:bg-[#E0E3E5] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

### PHASE 7 VERIFICATION

```bash
npm run dev
```
Manually mount `<BillScanner>` temporarily on any page to check it renders
without errors. Upload an image, verify the model download flow triggers
and shows progress.

---

## PHASE 8 — StepScanning, StepMatch, StepPreview, StepConfirmed

### FILE: `src/modules/bills/StepScanning.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function StepScanning({ data, updateData, onNext, onBack }) {
  const [status, setStatus] = useState('Preparing image...')
  const [error, setError] = useState(null)

  useEffect(() => {
    runScan()
  }, [])

  async function runScan() {
    try {
      setStatus('Reading bill text...')
      const res = await window.api.billsScanImage({
        imagePath: data.imagePath,
        languageMode: data.languageMode
      })

      if (!res.success) {
        setError(res.error || 'Scan failed')
        return
      }

      setStatus('Matching products...')
      updateData({ items: res.items })

      setTimeout(onNext, 400)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-[#BA1A1A] font-semibold">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-bold text-sm rounded-xl"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Loader2 className="w-10 h-10 text-[#004AC6] animate-spin" />
      <p className="text-sm font-semibold text-[#0F172A]">{status}</p>
    </div>
  )
}
```

### FILE: `src/modules/bills/StepMatch.jsx`

```jsx
import { useState, useEffect } from 'react'
import { Check, X, Search } from 'lucide-react'

export default function StepMatch({ data, updateData, onNext, onBack }) {
  const [items, setItems] = useState(data.items)
  const [products, setProducts] = useState([])
  const [searchingIndex, setSearchingIndex] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    window.api.getProducts().then(setProducts)
  }, [])

  function updateItem(index, patch) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...patch } : it))
  }

  function skipItem(index) {
    updateItem(index, { skipped: true })
  }

  function selectAlternative(index, altProduct) {
    updateItem(index, { matchedProduct: altProduct, confidence: 100, alternatives: [] })
  }

  function selectFromSearch(index, product) {
    updateItem(index, { matchedProduct: product, confidence: 100, alternatives: [] })
    setSearchingIndex(null)
    setSearchQuery('')
  }

  const filteredProducts = searchQuery
    ? products.filter(p =>
        `${p.name} ${p.size}`.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  function handleNext() {
    updateData({ items: items.filter(it => !it.skipped) })
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-[#191C1E]">Match Products</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Review each detected item and confirm the matching product.
        </p>
      </div>

      <div className="border border-[#C3C6D7]/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F2F4F6]">
              <th className="py-3 px-4 text-left text-[10px] font-extrabold text-[#434655] uppercase">Detected on Bill</th>
              <th className="py-3 px-4 text-center text-[10px] font-extrabold text-[#434655] uppercase">Qty</th>
              <th className="py-3 px-4 text-center text-[10px] font-extrabold text-[#434655] uppercase">Rate</th>
              <th className="py-3 px-4 text-left text-[10px] font-extrabold text-[#434655] uppercase">Matched Product</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEEF0]">
            {items.map((item, index) => (
              <tr key={index} className={item.skipped ? 'opacity-40' : ''}>
                <td className="py-3 px-4 text-sm text-[#64748B] italic">{item.ocrProductName}</td>
                <td className="py-3 px-4 text-center">
                  <input
                    type="number"
                    value={item.quantity ?? ''}
                    onChange={e => updateItem(index, { quantity: parseFloat(e.target.value) })}
                    className="w-16 text-center py-1.5 px-2 bg-[#F2F4F6] border-none rounded-lg text-sm"
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <input
                    type="number"
                    value={item.rate ?? ''}
                    onChange={e => updateItem(index, { rate: parseFloat(e.target.value) })}
                    className="w-20 text-center py-1.5 px-2 bg-[#F2F4F6] border-none rounded-lg text-sm"
                  />
                </td>
                <td className="py-3 px-4">
                  {item.matchedProduct ? (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-[#0F172A]">
                        {item.matchedProduct.name} {item.matchedProduct.size}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                        ${item.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          item.confidence >= 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-[#BA1A1A]'}`}>
                        {item.confidence}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-[#BA1A1A]" />
                      <span className="text-sm text-[#BA1A1A]">Not matched</span>
                    </div>
                  )}

                  {item.alternatives?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {item.alternatives.map((alt, ai) => (
                        <button
                          key={ai}
                          type="button"
                          onClick={() => selectAlternative(index, alt.product)}
                          className="text-[10px] bg-[#F2F4F6] hover:bg-[#E6E8EA] px-2 py-1 rounded"
                        >
                          {alt.product.name} ({alt.confidence}%)
                        </button>
                      ))}
                    </div>
                  )}

                  {searchingIndex === index && (
                    <div className="mt-2 relative">
                      <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search product..."
                        className="w-full py-1.5 px-2 bg-white border border-[#C3C6D7]/20 rounded-lg text-xs"
                      />
                      {filteredProducts.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-[#C3C6D7]/20 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {filteredProducts.map(p => (
                            <div
                              key={p.code}
                              onClick={() => selectFromSearch(index, p)}
                              className="px-3 py-2 text-xs hover:bg-[#F2F4F6] cursor-pointer"
                            >
                              {p.name} {p.size}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setSearchingIndex(index); setSearchQuery('') }}
                      className="p-1.5 rounded-full text-[#434655] hover:text-[#004AC6] hover:bg-white"
                    >
                      <Search size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => skipItem(index)}
                      className="p-1.5 rounded-full text-[#434655] hover:text-[#DC2626] hover:bg-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2.5 text-white font-bold text-sm rounded-xl
                     shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
        >
          Next: Preview
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-bold text-sm rounded-xl hover:bg-[#E0E3E5]"
        >
          Back
        </button>
      </div>
    </div>
  )
}
```

### FILE: `src/modules/bills/StepPreview.jsx`

```jsx
import { useEffect, useState } from 'react'

export default function StepPreview({ supplier, data, updateData, onNext, onBack }) {
  const [billId, setBillId] = useState(data.billId)
  const [billDate, setBillDate] = useState(data.billDate)
  const [billNo, setBillNo] = useState(data.billNo)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!billId) {
      window.api.billsGetNextId().then(setBillId)
    }
  }, [])

  const total = data.items.reduce((sum, it) => sum + (it.quantity * it.rate), 0)

  async function handlePush() {
    setPushing(true)
    setError(null)

    let savedImagePath = null
    if (data.keepImage) {
      const saveRes = await window.api.billsSaveImage({
        sourcePath: data.imagePath,
        bill_id: billId
      })
      if (saveRes.success) savedImagePath = saveRes.path
    }

    const res = await window.api.billsPush({
      bill_id: billId,
      supplier_id: supplier.supplier_id,
      bill_date: billDate,
      bill_no: billNo,
      items: data.items.map(it => ({
        product_code: it.matchedProduct?.code || null,
        product_name: it.matchedProduct?.name || it.ocrProductName,
        quantity: it.quantity,
        rate: it.rate
      })),
      scan_image_path: savedImagePath,
      keep_image: data.keepImage
    })

    setPushing(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (!data.keepImage) {
      window.api.billsDiscardImage(data.imagePath)
    }

    updateData({ pushedBillId: res.bill_id })
    onNext()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-[#191C1E]">Review & Confirm</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Verify everything before pushing to {supplier.name}'s account.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">Bill ID</label>
          <input
            type="text"
            value={billId}
            onChange={e => setBillId(e.target.value)}
            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">Bill Date</label>
          <input
            type="date"
            value={billDate}
            onChange={e => setBillDate(e.target.value)}
            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">Bill No. (optional)</label>
          <input
            type="text"
            value={billNo}
            onChange={e => setBillNo(e.target.value)}
            placeholder="As printed on bill"
            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15"
          />
        </div>
      </div>

      <div className="border border-[#C3C6D7]/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F2F4F6]">
              <th className="py-3 px-4 text-left text-[10px] font-extrabold text-[#434655] uppercase">Product</th>
              <th className="py-3 px-4 text-center text-[10px] font-extrabold text-[#434655] uppercase">Qty</th>
              <th className="py-3 px-4 text-right text-[10px] font-extrabold text-[#434655] uppercase">Rate</th>
              <th className="py-3 px-4 text-right text-[10px] font-extrabold text-[#434655] uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEEF0]">
            {data.items.map((item, i) => (
              <tr key={i}>
                <td className="py-3 px-4 text-sm font-medium text-[#0F172A]">
                  {item.matchedProduct?.name || item.ocrProductName}
                </td>
                <td className="py-3 px-4 text-center text-sm text-[#64748B]">{item.quantity}</td>
                <td className="py-3 px-4 text-right text-sm text-[#64748B]">₹{item.rate.toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-sm font-semibold text-[#2563EB]">
                  ₹{(item.quantity * item.rate).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#F2F4F6]/50">
              <td colSpan={3} className="py-3 px-4 text-sm font-bold text-[#191C1E] text-right">Grand Total</td>
              <td className="py-3 px-4 text-right text-lg font-black text-[#004AC6]">₹{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="text-sm text-[#BA1A1A]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pushing}
          onClick={handlePush}
          className="px-6 py-2.5 text-white font-bold text-sm rounded-xl
                     shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
        >
          {pushing ? 'Pushing...' : 'Push to Supplier Account'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-bold text-sm rounded-xl hover:bg-[#E0E3E5]"
        >
          Back
        </button>
      </div>
    </div>
  )
}
```

### FILE: `src/modules/bills/StepConfirmed.jsx`

```jsx
import { CheckCircle } from 'lucide-react'

export default function StepConfirmed({ data, onClose }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-[#191C1E]">Bill Pushed Successfully</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Bill <strong className="text-[#0F172A]">{data.pushedBillId}</strong> has been added
          to the supplier's account.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 text-white font-bold text-sm rounded-xl
                   shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all"
        style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
      >
        Done
      </button>
    </div>
  )
}
```

### PHASE 8 VERIFICATION

```bash
npm run dev
```
Full manual walkthrough of the wizard (see Full Flow Verification below).

---

## PHASE 9 — Integrate Into SupplierAccountDetail.jsx

Open `src/modules/accounts/SupplierAccountDetail.jsx`.

Add a "Scan Bill" button near the existing "Add Maal" button:

```jsx
import BillScanner from '../bills/BillScanner'

// Add state:
const [showBillScanner, setShowBillScanner] = useState(false)

// Add button near "Add Maal":
<button
  type="button"
  onClick={() => setShowBillScanner(true)}
  className="px-4 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-bold text-xs uppercase
             rounded-xl hover:bg-[#E0E3E5] transition-colors flex items-center gap-2"
>
  <ScanLine size={14} />
  Scan Bill
</button>

// Add modal wrapper somewhere in the JSX:
{showBillScanner && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
       style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
    <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      <BillScanner
        supplier={supplier}
        onClose={() => {
          setShowBillScanner(false)
          // Reload maal entries to show the newly pushed bill
          loadMaalEntries()
        }}
      />
    </div>
  </div>
)}
```

Import `ScanLine` from `lucide-react` at the top of the file if not
already imported.

Look at the existing `loadMaalEntries` function name in this file — use
the actual function name that refreshes the maal entries list.

---

## FULL FLOW VERIFICATION

```bash
npm run dev
```

1. Open a supplier's account detail page
2. Click "Scan Bill"
3. Upload a photo of an English printed bill, select "English" language
4. First time: model download progress shows, completes
5. Click "Next: Scan Bill" → scanning step runs automatically
6. Match screen shows detected rows with matched/unmatched products
7. Fix any unmatched rows using search
8. Click "Next: Preview"
9. Bill ID pre-filled as B-1 (or next number), editable
10. Verify totals look correct
11. Click "Push to Supplier Account"
12. Confirmation screen shows bill ID
13. Click Done → supplier's maal entries list shows the new bill entry
14. Repeat with a Hindi/Marathi bill using the Devanagari language mode
15. Test manually typing a custom bill ID in preview — confirm it's used
    instead of the auto-generated one, and the sequence does NOT increment

---

## WHAT NOT TO TOUCH

- Do not change customer-side files (this is supplier-only)
- Do not change invoice, order, or quick sale logic
- Do not change the voice input feature files
- Do not change existing supplier account CRUD handlers
- Do not change db.js beyond the additive migration in Phase 2
