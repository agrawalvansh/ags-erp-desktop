# AGS ERP – Web + Offline Desktop Inventory & Accounting Suite

AGS ERP is a lightweight ERP that runs in two variants:

- **Offline Desktop App (Electron)** – 100% local, no internet required. Ideal for shops that prefer on‑prem usage with a simple installer.
- **Web App (Cloud)** – Deployed to Vercel (frontend) and AWS EC2 (API), secured via Cloudflare Tunnel/PM2/systemd.

Built with React.js, Node.js and SQLite, with Electron.js + IPC for the desktop app. Manage products, invoices, orders and ledgers without monthly fees.

---

## 🧭 Variants: Web vs Desktop

- **Web App (Cloud)**
  - Frontend served from `/dist` on any static host (e.g., Vercel)
  - API on AWS EC2 (Express), typically behind Cloudflare Tunnel with PM2/systemd
  - Best for distributed access and remote availability

- **Offline Desktop App (Electron)**
  - Bundles the React UI with an embedded Express + SQLite runtime
  - Data stored locally in a single SQLite file
  - Best for single‑machine usage with no dependency on the internet

## ✨ Feature Highlights

• **Product Master** – maintain products with code, size, packing type, cost & selling price.  
• **Customer / Supplier Masters** – contact & address book with auto-suggest.  
• **GST-ready Invoices** – create, edit, print; automatic incremental invoice IDs (`AGS-I-0001…`).  
• **Accounts Ledger** – track _Maal_ (sales/purchase) & _Jama_ (payments/receipts) for both customers and suppliers.  
• **Sales & Purchase Orders** – draft orders before invoicing or sending to vendors.  
• **Price-List Management** – maintain standard rate cards, bulk import coming soon.  
• **Search & Filters** – instant fuzzy search across masters.  
• **Responsive & Print Friendly** – works on desktop, tablet and produces crisp PDF invoices.  
• **Zero-Config Database** – all data lives in a single `erp.db` file; automatic schema migration & sample seeding on first run.

---

## 🏗 Tech Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React 19 • Vite 6 • Tailwind CSS 4 • React-Router 7 • Lucide-React • Framer-Motion |
| Backend     | Node.js ≥ 20 • Express 5 • better-sqlite3 • AWS EC2 • Cloudflare Tunnel |
| Database    | SQLite 3 (file: `backend/erp.db`) |
| Desktop Shell | Electron (IPC) |

---

## 📂 Folder Layout

```
AGS
├─ backend/               # Express API + database
│  ├─ db.js               # Schema & connection
│  ├─ server.js           # REST endpoints
│  └─ erp.db              # Created on first run
├─ src/                   # React application (feature-first structure)
│  ├─ modules/
│  │  ├─ invoice/
│  │  ├─ accounts/
│  │  ├─ orders/
│  │  └─ priceList/
│  ├─ App.jsx, main.jsx…
├─ public/                # Static assets
├─ dist/                  # Production build output (git-ignored)
├─ package.json           # Front-end deps & scripts
├─ vite.config.js         # Vite config
└─ README.md
```

---

## 🛠️ Design Overview

The AGS ERP application follows a classic **client-server** model while remaining completely _offline-first_. At a glance:

1. **React UI (Vite)** – Functional components & hooks render pages, manage local state, and call the API with the native `fetch` client. Each feature (Invoices, Accounts, Orders…) lives inside its own _module_ directory under `src/modules`, keeping concerns isolated.
2. **Express REST API** – A thin Node.js layer exposing CRUD endpoints under `/api/*`.  It contains no ORM – instead it uses **better-sqlite3** for fast, synchronous SQL that keeps the codebase tiny and predictable.
3. **SQLite database (`erp.db`)** – A single-file relational DB stored beside the API.  All tables are created / migrated automatically on boot from `backend/db.js`, so there is _zero_ manual DBA work.
4. **Data Flow** –
  ```mermaid
  graph LR;
    R[Electron Renderer] -- IPC (fetch) --> E[Embedded Express API]
    E -- synchronous SQL (better-sqlite3) --> D[(SQLite file\nerp.db in userData)]
    D -- rows --> E --> R
  ```

  - **Renderer (React UI)** calls the embedded API using `IPC fetch`.
  - **Embedded Express API** (running in the Electron main/Node context) performs SQL using `better-sqlite3`.
  - **Database file** lives in the OS user data directory (e.g., `%APPDATA%/AGS-ERP/erp.db`), ensuring write access and safety across updates.
  
5. **Offline-first UX** – Because everything runs locally, page loads and queries are instant and never break due to network issues.  Future optional cloud-sync will push/merge the same SQLite data to a remote server when connectivity is available.
6. **Error Handling** – API routes wrap DB operations with `try/catch`, returning status codes + JSON messages that components surface with toast notifications.
7. **Extensibility** – Adding a new master or transaction type usually needs _one_ new table in `db.js`, plus its route file and a small React module – no complicated boilerplate.

---

## 🚀 Getting Started

Choose your target and follow the respective steps.

### A) Web App (Cloud)

1. **Prerequisites**  
   • Node.js ≥ 20 ‑ download from <https://nodejs.org/>  
   • Git (for cloning)  

2. **Clone & install**
   ```bash
   git clone https://github.com/your-org/ags-erp.git
   cd AGS
   # Front-end deps
   npm install
   # API deps
   cd backend && npm install && cd ..
   ```

3. **Run in Development** _(two terminals)_
   ```bash
   # Terminal 1 – API
   cd backend
   npm run dev           # nodemon on http://localhost:4000

   # Terminal 2 – Front-end
   npm run dev           # Vite on http://localhost:5173
   ```
   Database `backend/erp.db` will be created automatically with sample product rows.

4. **Build for Production**
   ```bash
   npm run build         # creates /dist with static files
   ```

5. **Serve build with Express** (optional)
   Uncomment the snippet in `backend/server.js`:
   ```js
   const path = require('path');
   app.use(express.static(path.resolve(__dirname, '../dist')));
   app.get('*', (_, res) =>
     res.sendFile(path.resolve(__dirname, '../dist/index.html'))
   );
   ```
   Now `npm start` inside `backend` will serve both API and UI from **:4000**.

---

### B) Offline Desktop App (Electron)

This variant lives in a dedicated branch that contains the Electron wrapper and packaging config. General guidance:

1. **Prerequisites**  
   • Node.js ≥ 20  
   • Git  
   • Build tools for native modules (required by `better-sqlite3`)  
     - Windows: Visual Studio Build Tools + Python (via windows-build-tools)  
     - macOS: Xcode Command Line Tools  
     - Linux: `build-essential`, Python

2. **Clone & install**  
   - Checkout the desktop branch that contains Electron integration.  
   - Install root and backend dependencies:  
     ```bash
     npm install
     ```

3. **Run in Development**  
   - Start the Electron shell:  
     ```bash
     npm run dev
     ```

4. **Build Desktop Installer**  
   - Use the packaging script provided in the desktop branch:  
     ```bash
     npm run build
     ```

5. **Data Location (Desktop)**  
   - The app stores the SQLite DB in the OS‑specific user data directory (e.g., `app.getPath('userData')`), ensuring write access and per‑user isolation.  
   - Do not hardcode paths like `./erp.db` for production builds.

> Tip: Refer to the README within the desktop branch for exact script names and packager options.

---

## 🗄 Database Schema (simplified)

```
products               customers                suppliers
┌ code PK ─┐           ┌ customer_id PK ─┐      ┌ supplier_id PK ─┐
│ name     │           │ name           │      │ name           │
│ size     │           │ address        │      │ address        │
│ prices…  │           │ mobile         │      │ mobile         │
└──────────┘           └─────────────────┘      └─────────────────┘

invoices               invoice_items            customer_maal_account
┌ invoice_id PK ─┐     ┌ id PK ─────────┐       ┌ id PK ─────────────┐
│ customer_id FK │◄─── │ invoice_id FK  │       │ customer_id FK    │
│ date, totals…  │     │ product_code FK│       │ date, amount…     │
└─────────────────┘     └────────────────┘       └────────────────────┘

(customer_jama_account, supplier_* tables follow same pattern)
```

Full DDL lives in `backend/db.js` and runs automatically; no manual migration needed.

---

## 🔌 REST API (excerpt)

| Method | Endpoint                                   | Description                    |
|--------|---------------------------------------------|--------------------------------|
| GET    | `/api/products`                            | List all products              |
| POST   | `/api/products`                            | Add product                    |
| GET    | `/api/customers`                           | List customers                 |
| POST   | `/api/invoices`                            | Create invoice with items      |
| GET    | `/api/invoices/:id`                        | Fetch single invoice           |
| GET    | `/api/invoices/next-id`                    | Get next invoice number        |
| POST   | `/api/transactions`                        | Record customer payment (Jama) |
| …      | _(see `backend/server.js` for complete list)_ |                                |

All endpoints accept/return **JSON**.

---

## 🛠 Environment Variables

Create a `.env` in project root only for Website (values shown are defaults):
```
VITE_API_URL=https://api.amitgeneralstore.software/  #API URL
```

---

## 🏃‍♂️ NPM Scripts (root)

| Script        | Purpose                               |
|---------------|---------------------------------------|
| `npm run dev` | Start Vite dev-server                 |
| `npm run build` | Build front-end to `/dist`           |
| `npm run preview` | Preview production build locally   |

Inside **backend**:
| Script          | Purpose                           |
|-----------------|-----------------------------------|
| `npm run dev`   | Nodemon auto-reload API           |
| `npm start`     | Start API without nodemon         |

For the **Desktop App (Electron)**, the exact script names (e.g., `electron:dev`, `electron:build`) are defined in the desktop branch `package.json`.

---

## 💽 Desktop Packaging Notes (SQLite + Electron)

- **Module resolution in asar**  
  Use relative requires: `require('./module')` instead of `require(path.join(__dirname, 'module'))` to avoid resolution issues when packaged.

- **Writable database path**  
  Do not write to the app bundle. Use Electron’s `app.getPath('userData')` and place the DB there, e.g.:  
  ```js
  const { app } = require('electron');
  const path = require('path');
  const dbPath = path.join(app.getPath('userData'), 'erp.db');
  ```

- **better-sqlite3**  
  Ensure `better-sqlite3` is in `dependencies` (not `devDependencies`). For packaged builds, rebuild native modules as needed (e.g., `electron-rebuild`).

These practices ensure the desktop build works reliably in both development and packaged installers.

---

## 🤝 Contributing

1. Fork the repo, create a feature branch.  
2. Commit with conventional messages.  
3. Open a Pull Request – we love improvements!

---

## 📝 License

Released under the **MIT License**.  See `LICENSE` for details.

---

> Crafted with ❤️  by **Vansh Agrawal**.  Feel free to reach out for suggestions or feedback!
