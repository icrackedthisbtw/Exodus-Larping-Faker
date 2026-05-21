const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, 'data', 'wallet.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'node_modules/cryptocurrency-icons/svg/color')));

// ── helpers ──────────────────────────────────────────────────────────────────

function readWallet() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeWallet(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Seeded pseudo-random so charts look consistent between refreshes
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generatePriceHistory(currentPrice, symbol, period) {
  const periodMap = { '1D': 24, '1W': 168, '1M': 720, '3M': 2160, '1Y': 8760 };
  const hours = periodMap[period] || 168;
  const volatility = { '1D': 0.004, '1W': 0.007, '1M': 0.012, '3M': 0.015, '1Y': 0.018 }[period] || 0.007;
  const rand = seededRandom(symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + hours);

  const rawPrices = [];
  let price = currentPrice * (0.7 + rand() * 0.5);

  for (let i = 0; i <= hours; i++) {
    const drift = 0.0001;
    const change = (rand() - 0.5 + drift) * volatility;
    price = Math.max(price * (1 + change), 0.000001);
    rawPrices.push(price);
  }

  // Scale so the last value equals currentPrice
  const scale = currentPrice / rawPrices[rawPrices.length - 1];
  const scaled = rawPrices.map(p => parseFloat((p * scale).toFixed(8)));

  // Downsample to ≤200 points
  const step = Math.max(1, Math.floor(scaled.length / 200));
  const prices = [];
  const labels = [];
  const now = Date.now();

  for (let i = 0; i < scaled.length; i += step) {
    prices.push(scaled[i]);
    labels.push(now - (scaled.length - 1 - i) * 3_600_000);
  }
  if (labels[labels.length - 1] !== now) {
    prices.push(currentPrice);
    labels.push(now);
  }

  return { prices, labels, currentPrice };
}

// ── API routes ─────────────────────────────────────────────────────────────

app.get('/api/wallet', (req, res) => {
  const w = readWallet();
  // Compute derived totals on every read
  w.portfolio.totalUSD = w.assets.reduce((sum, a) => sum + a.balance * a.priceUSD, 0);
  res.json(w);
});

app.put('/api/wallet', (req, res) => {
  writeWallet(req.body);
  res.json({ success: true });
});

// Update a single asset field
app.patch('/api/wallet/assets/:id', (req, res) => {
  const w = readWallet();
  const idx = w.assets.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Asset not found' });
  w.assets[idx] = { ...w.assets[idx], ...req.body };
  writeWallet(w);
  res.json(w.assets[idx]);
});

// Add asset
app.post('/api/wallet/assets', (req, res) => {
  const w = readWallet();
  const asset = { id: req.body.symbol.toLowerCase(), ...req.body };
  w.assets.push(asset);
  writeWallet(w);
  res.json(asset);
});

// Delete asset
app.delete('/api/wallet/assets/:id', (req, res) => {
  const w = readWallet();
  w.assets = w.assets.filter(a => a.id !== req.params.id);
  w.transactions = w.transactions.filter(t => t.assetId !== req.params.id);
  writeWallet(w);
  res.json({ success: true });
});

// Transactions
app.get('/api/wallet/transactions', (req, res) => {
  const w = readWallet();
  const { assetId } = req.query;
  const txs = assetId ? w.transactions.filter(t => t.assetId === assetId) : w.transactions;
  res.json(txs);
});

app.post('/api/wallet/transactions', (req, res) => {
  const w = readWallet();
  const tx = { id: `tx_${Date.now()}`, timestamp: new Date().toISOString(), ...req.body };
  w.transactions.unshift(tx);
  writeWallet(w);
  res.json(tx);
});

app.patch('/api/wallet/transactions/:id', (req, res) => {
  const w = readWallet();
  const idx = w.transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  w.transactions[idx] = { ...w.transactions[idx], ...req.body };
  writeWallet(w);
  res.json(w.transactions[idx]);
});

app.delete('/api/wallet/transactions/:id', (req, res) => {
  const w = readWallet();
  w.transactions = w.transactions.filter(t => t.id !== req.params.id);
  writeWallet(w);
  res.json({ success: true });
});

// Price chart data
app.get('/api/prices/:assetId', (req, res) => {
  const w = readWallet();
  const asset = w.assets.find(a => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const data = generatePriceHistory(asset.priceUSD, asset.symbol, req.query.period || '1W');
  res.json(data);
});

// Fallback → SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ███████╗██╗  ██╗ ██████╗ ██████╗ ██╗   ██╗███████╗');
  console.log('  ██╔════╝╚██╗██╔╝██╔═══██╗██╔══██╗██║   ██║██╔════╝');
  console.log('  █████╗   ╚███╔╝ ██║   ██║██║  ██║██║   ██║███████╗');
  console.log('  ██╔══╝   ██╔██╗ ██║   ██║██║  ██║██║   ██║╚════██║');
  console.log('  ███████╗██╔╝ ██╗╚██████╔╝██████╔╝╚██████╔╝███████║');
  console.log('  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝');
  console.log('');
  console.log(`  Wallet Simulator  →  http://localhost:${PORT}`);
  console.log(`  Admin Panel       →  http://localhost:${PORT}/admin.html`);
  console.log('');
});
