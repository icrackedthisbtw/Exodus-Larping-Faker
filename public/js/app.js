// ── Exodus Wallet Simulator — Main App ───────────────────────────────────

const API = '';
let wallet = null;
let currentAsset = null;
let currentPeriod = '1W';
let sendInCrypto = true;
let selectedFee = 'medium';
let assetPickerTarget = null; // 'from' | 'to'
let exchangeFrom = null;
let exchangeTo = null;
let hideBalance = false;

// ── Boot ──────────────────────────────────────────────────────────────────

async function init() {
  await loadWallet();
  renderPortfolio();
  setupNavigation();
  setupExchange();
  setupSettings();
  setupBackupPhrase();
}

async function loadWallet() {
  const res = await fetch(`${API}/api/wallet`);
  wallet = await res.json();
}

// ── Navigation ────────────────────────────────────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'wallet' && !currentAsset) return; // must select an asset first
      showView(view);
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    showView('portfolio');
    document.querySelector('[data-view="portfolio"]').classList.add('active');
    document.querySelector('[data-view="wallet"]').classList.remove('active');
  });

  document.getElementById('hide-balance-btn').addEventListener('click', () => {
    hideBalance = !hideBalance;
    renderPortfolio();
  });
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${name}-view`).classList.add('active');
}

// ── Portfolio ─────────────────────────────────────────────────────────────

function renderPortfolio() {
  if (!wallet) return;

  const total = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  const change24h = wallet.portfolio.change24h || 0;
  const changeUSD = wallet.portfolio.change24hUSD || (total * change24h / 100);

  const mask = s => hideBalance ? '••••••' : s;

  document.getElementById('total-value').textContent = mask(fmt.usd(total));

  const pill = document.getElementById('portfolio-change-pill');
  const isUp = change24h >= 0;
  pill.className = `change-pill ${isUp ? 'positive' : 'negative'}`;
  pill.textContent = mask(fmt.pct(change24h));

  document.getElementById('portfolio-change-usd').textContent =
    mask((isUp ? '+' : '') + fmt.usd(changeUSD) + ' today');

  // Donut chart
  const nonZero = wallet.assets.filter(a => a.balance > 0);
  buildDonutChart(nonZero);
  document.getElementById('donut-count').textContent = nonZero.length;

  // Legend
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = '';
  nonZero.slice(0, 6).forEach(a => {
    const val = a.balance * a.priceUSD;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    legend.innerHTML += `
      <div class="legend-item" onclick="openAsset('${a.id}')">
        <div class="legend-dot" style="background:${a.color}"></div>
        <span class="legend-name">${a.symbol}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
  });

  // Asset list
  const list = document.getElementById('asset-list');
  list.innerHTML = '';
  const sorted = [...wallet.assets].sort((a, b) => (b.balance * b.priceUSD) - (a.balance * a.priceUSD));

  sorted.forEach(asset => {
    const val = asset.balance * asset.priceUSD;
    const isPos = asset.change24h >= 0;
    const sparkId = `spark_${asset.id}`;

    list.innerHTML += `
      <div class="asset-row" onclick="openAsset('${asset.id}')">
        ${cryptoIcon(asset.symbol, asset.color, 40)}
        <div class="asset-info">
          <div class="asset-name">${asset.name}</div>
          <div class="asset-symbol">${asset.symbol}</div>
        </div>
        <canvas class="asset-sparkline" id="${sparkId}" width="80" height="36"></canvas>
        <div class="asset-values">
          <div class="asset-usd">${mask(fmt.usd(val))}</div>
          <div class="asset-balance">${mask(fmt.crypto(asset.balance, asset.symbol))}</div>
        </div>
        <div class="asset-change">
          <span class="${isPos ? 'pos' : 'neg'}">${fmt.pct(asset.change24h)}</span>
        </div>
      </div>`;
  });

  // Load sparklines asynchronously
  sorted.forEach(async asset => {
    try {
      const res = await fetch(`${API}/api/prices/${asset.id}?period=1W`);
      const data = await res.json();
      const canvas = document.getElementById(`spark_${asset.id}`);
      if (canvas) buildSparkline(canvas, data.prices, asset.color);
    } catch {}
  });
}

// ── Single Asset / Wallet View ────────────────────────────────────────────

async function openAsset(id) {
  currentAsset = wallet.assets.find(a => a.id === id);
  if (!currentAsset) return;

  showView('wallet');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-view="wallet"]').classList.add('active');

  renderWalletHeader();
  await loadPriceChart('1W');
  renderTransactions();
}

function renderWalletHeader() {
  const a = currentAsset;
  const val = a.balance * a.priceUSD;
  const isPos = a.change24h >= 0;

  document.getElementById('wallet-asset-header').innerHTML = `
    ${cryptoIcon(a.symbol, a.color, 44)}
    <div>
      <div style="font-size:18px;font-weight:700;">${a.name}</div>
      <span class="${isPos ? 'pos' : 'neg'}" style="font-size:13px;padding:2px 8px;border-radius:20px;">
        ${fmt.pct(a.change24h)}
      </span>
    </div>
    <div style="flex:1;"></div>
    <div class="wallet-asset-balance">
      <div class="big">${fmt.crypto(a.balance, a.symbol)}</div>
      <div class="usd">${fmt.usd(val)}</div>
    </div>`;

  document.getElementById('send-btn').onclick = () => openSendModal(a);
  document.getElementById('receive-btn').onclick = () => openReceiveModal(a);

  document.getElementById('chart-price').textContent = fmt.usd(a.priceUSD);
  const priceChange = document.getElementById('chart-price-change');
  priceChange.innerHTML = `<span class="${isPos ? 'text-green' : 'text-red'}">${fmt.pct(a.change24h)} (24h)</span>`;
}

async function loadPriceChart(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === period);
  });

  try {
    const res = await fetch(`${API}/api/prices/${currentAsset.id}?period=${period}`);
    const data = await res.json();
    buildPriceChart('price-chart', data.prices, data.labels, currentAsset.color);
  } catch(e) {
    console.error('Chart load failed', e);
  }
}

document.getElementById('period-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.period-tab');
  if (btn && currentAsset) loadPriceChart(btn.dataset.period);
});

function renderTransactions() {
  const list = document.getElementById('tx-list');
  const txs = wallet.transactions.filter(t => t.assetId === currentAsset.id);

  if (!txs.length) {
    list.innerHTML = `<div class="empty-state"><p>No transactions yet</p></div>`;
    return;
  }

  list.innerHTML = txs.map(tx => {
    const isIn = tx.type === 'received' || tx.type === 'staking';
    const sign = isIn ? '+' : '-';
    const icon = {
      received:  '↓',
      sent:      '↑',
      exchanged: '⇄',
      staking:   '★',
      pending:   '⌛',
    }[tx.type] || '•';

    return `
      <div class="tx-row" onclick="showTxDetail('${tx.id}')">
        <div class="tx-icon ${tx.type}">${icon}</div>
        <div class="tx-info">
          <div class="tx-type">${tx.type}</div>
          <div class="tx-date">${fmt.date(tx.timestamp)}</div>
          <div class="tx-from">${isIn ? 'From: ' : 'To: '}${fmt.shortAddr(isIn ? tx.from : tx.to)}</div>
        </div>
        <div class="tx-amount">
          <div class="crypto ${isIn ? 'incoming' : 'outgoing'}">${sign}${fmt.crypto(tx.amount, currentAsset.symbol)}</div>
          <div class="usd">${fmt.usd(tx.valueUSD || 0)}</div>
        </div>
      </div>`;
  }).join('');
}

function showTxDetail(id) {
  const tx = wallet.transactions.find(t => t.id === id);
  if (!tx) return;
  const asset = wallet.assets.find(a => a.id === tx.assetId);

  document.getElementById('tx-modal-title').textContent = `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} ${asset?.symbol || ''}`;

  const rows = [
    ['Status', `<span class="status-badge ${tx.status}">${tx.status}</span>`],
    ['Date', fmt.date(tx.timestamp)],
    ['Amount', `${tx.amount} ${asset?.symbol || ''}`],
    ['Value (USD)', fmt.usd(tx.valueUSD || 0)],
    ['From', tx.from],
    ['To', tx.to],
    ['TX Hash', tx.txHash],
    ['Confirmations', tx.confirmations],
    tx.fee > 0 ? ['Network Fee', `${tx.fee} ${asset?.symbol || ''}`] : null,
    tx.memo ? ['Memo', tx.memo] : null,
  ].filter(Boolean);

  document.getElementById('tx-modal-body').innerHTML = rows.map(([k, v]) =>
    `<div class="detail-row">
      <span class="detail-key">${k}</span>
      <span class="detail-val">${v}</span>
    </div>`
  ).join('');

  openModal('tx-modal');
}

// ── Send Modal ────────────────────────────────────────────────────────────

function openSendModal(asset) {
  sendInCrypto = true;
  selectedFee = 'medium';
  document.getElementById('send-modal-symbol').textContent = asset.symbol;
  document.getElementById('send-amount').value = '';
  document.getElementById('send-address').value = '';
  document.getElementById('send-toggle-currency').textContent = asset.symbol;
  document.getElementById('send-available').textContent = `${fmt.crypto(asset.balance, asset.symbol)}`;

  const p = asset.priceUSD;
  document.getElementById('fee-slow').textContent   = fmt.usd(p * 0.00008);
  document.getElementById('fee-medium').textContent = fmt.usd(p * 0.00015);
  document.getElementById('fee-fast').textContent   = fmt.usd(p * 0.0003);

  document.querySelectorAll('.fee-option').forEach(o => o.classList.remove('active'));
  document.querySelectorAll('.fee-option')[1].classList.add('active');

  document.getElementById('send-amount').oninput = () => {
    updateSendUSD();
  };

  openModal('send-modal');
}

function updateSendUSD() {
  // live USD estimate shown via hint
  const a = currentAsset;
  if (!a) return;
  const v = parseFloat(document.getElementById('send-amount').value) || 0;
  const usd = sendInCrypto ? v * a.priceUSD : v;
  document.querySelector('#send-modal .balance-hint').innerHTML =
    `Available: <span onclick="sendMax()">${fmt.crypto(a.balance, a.symbol)}</span>` +
    (v > 0 ? ` &nbsp;·&nbsp; ≈ ${fmt.usd(sendInCrypto ? usd : usd / a.priceUSD * a.priceUSD)}` : '');
}

window.selectFee = function(el, speed) {
  document.querySelectorAll('.fee-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  selectedFee = speed;
};

window.sendMax = function() {
  if (!currentAsset) return;
  document.getElementById('send-amount').value = sendInCrypto
    ? currentAsset.balance
    : (currentAsset.balance * currentAsset.priceUSD).toFixed(2);
  updateSendUSD();
};

window.confirmSend = function() {
  const addr = document.getElementById('send-address').value.trim();
  const amt  = parseFloat(document.getElementById('send-amount').value);

  if (!addr) { toast('Enter a recipient address', 'error'); return; }
  if (!amt || amt <= 0) { toast('Enter an amount', 'error'); return; }

  const a = currentAsset;
  const cryptoAmt = sendInCrypto ? amt : amt / a.priceUSD;

  if (cryptoAmt > a.balance) { toast('Insufficient balance', 'error'); return; }

  toast(`Sending ${fmt.crypto(cryptoAmt, a.symbol)} to ${fmt.shortAddr(addr)}…`, 'info');
  closeModal('send-modal');

  setTimeout(async () => {
    // Add fake transaction
    const tx = {
      assetId: a.id,
      type: 'sent',
      amount: cryptoAmt,
      valueUSD: cryptoAmt * a.priceUSD,
      from: a.address,
      to: addr,
      txHash: fakeTxHash(),
      status: 'confirmed',
      confirmations: 1,
      fee: a.priceUSD * 0.00015,
      memo: ''
    };

    await fetch(`${API}/api/wallet/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });

    // Deduct balance
    await fetch(`${API}/api/wallet/assets/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: parseFloat((a.balance - cryptoAmt).toFixed(8)) })
    });

    await loadWallet();
    currentAsset = wallet.assets.find(x => x.id === a.id);
    renderWalletHeader();
    renderTransactions();
    toast(`Transaction confirmed! Sent ${fmt.crypto(cryptoAmt, a.symbol)}`, 'success');
  }, 2000);
};

// ── Receive Modal ─────────────────────────────────────────────────────────

async function openReceiveModal(asset) {
  document.getElementById('receive-modal-symbol').textContent = asset.symbol;
  document.getElementById('receive-network').textContent = asset.network;
  document.getElementById('receive-address-box').textContent = asset.address;
  document.getElementById('receive-asset-warn').textContent = asset.symbol;

  // Generate QR code
  const canvas = document.getElementById('qr-canvas');
  try {
    await QRCode.toCanvas(canvas, asset.address, {
      width: 180,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch {}

  openModal('receive-modal');
}

window.copyAddress = function() {
  const addr = document.getElementById('receive-address-box').textContent;
  copyText(addr, document.getElementById('copy-addr-btn'));
};

// ── Exchange ──────────────────────────────────────────────────────────────

function setupExchange() {
  document.getElementById('from-amount').addEventListener('input', updateExchangeCalc);
  document.getElementById('swap-switch').addEventListener('click', swapExchangeAssets);
  document.getElementById('from-asset-btn').addEventListener('click', () => openAssetPicker('from'));
  document.getElementById('to-asset-btn').addEventListener('click', () => openAssetPicker('to'));
  document.getElementById('exchange-btn').addEventListener('click', reviewExchange);
}

function updateExchangeCalc() {
  if (!wallet) return;
  const from = wallet.assets.find(a => a.symbol === document.getElementById('from-symbol').textContent);
  const to   = wallet.assets.find(a => a.symbol === document.getElementById('to-symbol').textContent);
  if (!from || !to) return;

  const fromAmt = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt   = fromAmt * from.priceUSD / to.priceUSD * 0.995; // 0.5% fee

  document.getElementById('to-amount').value = toAmt > 0 ? toAmt.toFixed(6) : '';
  document.getElementById('from-usd').textContent = `≈ ${fmt.usd(fromAmt * from.priceUSD)}`;
  document.getElementById('to-usd').textContent   = `≈ ${fmt.usd(toAmt * to.priceUSD)}`;
  document.getElementById('exchange-rate-text').textContent =
    `1 ${from.symbol} = ${(from.priceUSD / to.priceUSD).toFixed(6)} ${to.symbol}`;

  const networkFee = from.priceUSD * 0.0002;
  const exchangeFee = fromAmt * from.priceUSD * 0.005;
  document.getElementById('exchange-fee-text').textContent  = `~${fmt.usd(networkFee)}`;
  document.getElementById('exchange-fee2-text').textContent = `~${fmt.usd(exchangeFee)}`;
}

function swapExchangeAssets() {
  const fs = document.getElementById('from-symbol').textContent;
  const ts = document.getElementById('to-symbol').textContent;
  const fromAsset = wallet.assets.find(a => a.symbol === fs);
  const toAsset   = wallet.assets.find(a => a.symbol === ts);

  setExchangeAsset('from', toAsset);
  setExchangeAsset('to', fromAsset);
  document.getElementById('from-amount').value = document.getElementById('to-amount').value;
  updateExchangeCalc();
}

function setExchangeAsset(side, asset) {
  if (!asset) return;
  document.getElementById(`${side}-symbol`).textContent = asset.symbol;
  document.getElementById(`${side}-dot`).style.background = asset.color;
}

function openAssetPicker(target) {
  assetPickerTarget = target;
  document.getElementById('asset-search').value = '';
  renderAssetPicker('');
  openModal('asset-picker-modal');
}

function renderAssetPicker(filter) {
  const list = document.getElementById('asset-picker-list');
  const assets = wallet.assets.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  list.innerHTML = assets.map(a => `
    <div class="asset-row" style="padding:10px 8px;" onclick="pickExchangeAsset('${a.id}')">
      ${cryptoIcon(a.symbol, a.color, 36)}
      <div class="asset-info">
        <div class="asset-name">${a.name}</div>
        <div class="asset-symbol">${a.symbol} · ${fmt.usd(a.priceUSD)}</div>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);">${fmt.crypto(a.balance, a.symbol)}</div>
    </div>`
  ).join('');
}

window.filterAssetPicker = function(q) { renderAssetPicker(q); };

window.pickExchangeAsset = function(id) {
  const asset = wallet.assets.find(a => a.id === id);
  setExchangeAsset(assetPickerTarget, asset);
  closeModal('asset-picker-modal');
  updateExchangeCalc();
};

function reviewExchange() {
  const fromSymbol = document.getElementById('from-symbol').textContent;
  const toSymbol   = document.getElementById('to-symbol').textContent;
  const fromAmt    = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt      = parseFloat(document.getElementById('to-amount').value) || 0;

  if (!fromAmt) { toast('Enter an amount to exchange', 'error'); return; }
  if (fromSymbol === toSymbol) { toast("Can't exchange the same asset", 'error'); return; }

  const from = wallet.assets.find(a => a.symbol === fromSymbol);
  if (fromAmt > from.balance) { toast('Insufficient balance', 'error'); return; }

  const body = document.getElementById('exchange-confirm-body');
  body.innerHTML = `
    <div class="detail-row"><span class="detail-key">You Send</span><span class="detail-val">${fromAmt} ${fromSymbol}</span></div>
    <div class="detail-row"><span class="detail-key">You Receive</span><span class="detail-val">≈ ${toAmt.toFixed(6)} ${toSymbol}</span></div>
    <div class="detail-row"><span class="detail-key">Rate</span><span class="detail-val">1 ${fromSymbol} = ${(from.priceUSD / wallet.assets.find(a=>a.symbol===toSymbol).priceUSD).toFixed(6)} ${toSymbol}</span></div>
    <div class="detail-row"><span class="detail-key">Fee</span><span class="detail-val">${fmt.usd(fromAmt * from.priceUSD * 0.005)}</span></div>
  `;
  openModal('exchange-confirm-modal');
}

window.executeExchange = async function() {
  const fromSymbol = document.getElementById('from-symbol').textContent;
  const toSymbol   = document.getElementById('to-symbol').textContent;
  const fromAmt    = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt      = parseFloat(document.getElementById('to-amount').value) || 0;

  const from = wallet.assets.find(a => a.symbol === fromSymbol);
  const to   = wallet.assets.find(a => a.symbol === toSymbol);

  closeModal('exchange-confirm-modal');
  toast('Exchange in progress…', 'info');

  setTimeout(async () => {
    // Record transactions
    await fetch(`${API}/api/wallet/transactions`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        assetId: from.id, type: 'exchanged', amount: fromAmt,
        valueUSD: fromAmt * from.priceUSD, from: from.address, to: to.address,
        txHash: fakeTxHash(), status: 'confirmed', confirmations: 1,
        fee: 0, memo: `Exchanged ${fromSymbol} → ${toSymbol}`,
        exchangeAsset: to.id, exchangeAmount: toAmt
      })
    });

    // Update balances
    await fetch(`${API}/api/wallet/assets/${from.id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ balance: parseFloat((from.balance - fromAmt).toFixed(8)) })
    });
    await fetch(`${API}/api/wallet/assets/${to.id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ balance: parseFloat((to.balance + toAmt).toFixed(8)) })
    });

    await loadWallet();
    renderPortfolio();

    document.getElementById('from-amount').value = '';
    document.getElementById('to-amount').value = '';
    document.getElementById('from-usd').textContent = '≈ $0.00';
    document.getElementById('to-usd').textContent = '≈ $0.00';

    toast(`Exchanged ${fromAmt} ${fromSymbol} → ${toAmt.toFixed(4)} ${toSymbol}`, 'success');
  }, 1500);
};

// ── Settings ──────────────────────────────────────────────────────────────

function setupSettings() {
  document.getElementById('currency-select').addEventListener('change', e => {
    toast(`Currency set to ${e.target.value}`, 'info');
  });
}

function setupBackupPhrase() {
  // Deterministic fake 12-word phrase
  const words = ['abandon','ability','able','about','above','absent','absorb','abstract',
    'absurd','abuse','access','accident','mirror','glove','pride','fossil','stereo',
    'evolve','desert','index','planet','voyage','lunar','echo'];
  const phrase = words.slice(0, 12);
  const grid = document.getElementById('backup-phrase-grid');
  grid.innerHTML = phrase.map((w, i) => `
    <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;">
      <span style="color:var(--text-muted);font-size:11px;">${i+1}.</span> ${w}
    </div>`
  ).join('');
}

window.showBackupModal = function() { openModal('backup-modal'); };

window.toggle2FA = function(btn) {
  btn.classList.toggle('on');
  toast(`2FA ${btn.classList.contains('on') ? 'enabled' : 'disabled'}`, 'info');
};

// ── Init ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', init);

// Initialize exchange asset defaults after wallet loads
async function setupExchangeDefaults() {
  if (!wallet || wallet.assets.length < 2) return;
  setExchangeAsset('from', wallet.assets[0]);
  setExchangeAsset('to', wallet.assets[1]);
  updateExchangeCalc();
}

// Re-hook init
const _origInit = init;
window.init = async function() {
  await _origInit();
  await setupExchangeDefaults();
};
window.addEventListener('DOMContentLoaded', () => {
  // Re-init to get exchange defaults
});
