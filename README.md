# Exodus Larping Faker

A fully dynamic, server-rendered Exodus wallet simulator. Every number — balances, prices, transaction history, addresses — is editable through the built-in admin panel. Designed to run as a native Node.js server, including on Google Cloud Shell.

## Features

- **Portfolio view** — donut allocation chart, asset list with sparklines, 24h change
- **Wallet view** — individual asset page with interactive price charts (1D/1W/1M/3M/1Y), full transaction history
- **Send / Receive modals** — realistic fee selector, QR code, address display with copy
- **Exchange** — token swap UI with live rate calculation
- **Admin panel** — edit every value (balances, prices, %, transactions, addresses) with one-click save
- All data stored in `data/wallet.json` — easily edit by hand or via the admin panel
- Generates realistic seeded price chart history per asset

## Quick Start

```bash
npm install
npm start
```

Open: **http://localhost:8080**
Admin: **http://localhost:8080/admin.html**

## Google Cloud Shell

```bash
git clone <repo-url>
cd Exodus-Larping-Faker
npm install
npm start
# Click "Web Preview" → Preview on port 8080
```

## Editing Data

### Via Admin Panel (recommended)
Go to `/admin.html` — edit any field inline and click **Save All Changes** (or Ctrl+S).

### Via JSON
Edit `data/wallet.json` directly and restart the server.

Transaction types: `received`, `sent`, `exchanged`, `staking`, `pending`
Status values: `confirmed`, `pending`, `failed`

## Port

Default: **8080** (Cloud Shell compatible). Override with `PORT=3000 npm start`.
