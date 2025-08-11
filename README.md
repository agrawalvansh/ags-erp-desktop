# AGS ERP – Offline Inventory & Accounting Suite

AGS ERP is a lightweight, **100 % offline** Enterprise Resource Planning system designed for Indian SMEs that still rely on pen-and-paper billing.  It bundles an elegant React + Tailwind UI with a blazing-fast Node/Express + SQLite API, giving you everything you need to manage products, invoices, orders and ledgers without internet connectivity or monthly fees.

---

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
| Backend     | Node.js ≥ 20 • Express 5 • better-sqlite3 • CORS |
| Database    | SQLite 3 (file: `backend/erp.db`) |

---

## ⚙️ Architecture

```
┌─────────────┐   HTTP/REST    ┌──────────────────────┐
│   React UI  │ ⟷  localhost  │ Express API (Node)   │──┐
│  (Vite dev) │  :5173 / 80    └──────────────────────┘  │
└─────────────┘                    │ SQLite (better-sqlite3)
                                   ▼
                               erp.db (file)
```

* In development the React dev-server runs on **:5173** with live-reload while the API listens on **:4000** (configurable).  
* In production the front-end is pre-built into `/dist` and can be served by any static host **or** by Express itself (see below).

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

## 🚀 Getting Started

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

Create a `.env` in project root (values shown are defaults):
```
PORT=4000             # API port
DATABASE_PATH=erp.db  # Relative to backend/
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

---

## 🛣 Roadmap

- 🔐 Authentication & user roles  
- 🧾 GST/tax modules & e-way bill  
- 📊 Reports dashboard (sales, stock, outstanding)  
- 🖥 Electron/TAURI wrapper for one-click desktop installer  
- ☁️ Optional cloud sync

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
