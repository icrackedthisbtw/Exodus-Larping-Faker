// ── Exodus Wallet Simulator — App Logic ──────────────────────────────────

let wallet      = null;
let currentAsset = null;
let currentPeriod = '1W';
let hideBalance  = false;
let sortCol      = 'value';
let sortAsc      = false;
let quickEditId  = null;

// ── Boot ──────────────────────────────────────────────────────────────────

async function init() {
  await loadWallet();
  renderAll();
  setupNav();
  setupExchangeDefaults();
  setupBackupPhrase();
}

async function loadWallet() {
  const r = await fetch('/api/wallet');
  wallet = await r.json();
}

function renderAll() {
  renderNavTotal();
  renderRingChart();
  renderStatsBar();
  renderAssetTable();
}

// ── Navigation ────────────────────────────────────────────────────────────

function setupNav() {
  document.querySelectorAll('.nav-tab[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'wallet' && !currentAsset) return;
      activateNavTab(btn);
      showView(btn.dataset.view);
    });
  });

  document.querySelectorAll('.time-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  document.querySelectorAll('.table-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.table-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  document.querySelectorAll('.asset-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = false; }
      renderAssetTable();
    });
  });

  document.getElementById('period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.period-tab');
    if (btn && currentAsset) loadPriceChart(btn.dataset.period);
  });
}

function activateNavTab(btn) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${name}-view`).classList.add('active');
  const tab = document.querySelector(`.nav-tab[data-view="${name}"]`);
  if (tab) activateNavTab(tab);
}

function backToPortfolio() {
  currentAsset = null;
  showView('portfolio');
}

window.toggleHide = function() {
  hideBalance = !hideBalance;
  renderAll();
};

// ── Nav total ─────────────────────────────────────────────────────────────

function renderNavTotal() {
  const total = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  document.getElementById('nav-total').textContent = hideBalance ? '••••••' : fmt.usd(total);
  const p = wallet.profile;
  const av = document.getElementById('nav-avatar');
  av.textContent = p.initial || 'E';
  av.style.background = p.avatarColor || '#e91e8c';
}

// ── Ring chart ────────────────────────────────────────────────────────────

function renderRingChart() {
  const total = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  const nonZero = wallet.assets.filter(a => a.balance > 0);

  // Amount display
  const totalStr = fmt.usd(total);
  const [dollars, cents] = totalStr.replace('$', '').split('.');
  document.getElementById('rc-amount').innerHTML =
    hideBalance ? '••••' : `${dollars}<span class="rc-cents">.${cents}</span>`;
  document.getElementById('rc-assets').textContent = `${nonZero.length} Assets`;

  buildDonutChart(nonZero, total);
}

// ── Stats bar ─────────────────────────────────────────────────────────────

function renderStatsBar() {
  const total     = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  const change24h = wallet.portfolio.change24h || 0;
  const changeUSD = wallet.portfolio.change24hUSD || total * change24h / 100;
  const highBal   = wallet.portfolio.highestBalance || total;

  // Best/worst asset by 24h change
  const sorted   = [...wallet.assets].filter(a => a.balance > 0).sort((a, b) => b.change24h - a.change24h);
  const bestAsset  = sorted[0];
  const worstAsset = sorted[sorted.length - 1];

  // Portfolio age
  const created = wallet.portfolio.createdAt ? new Date(wallet.portfolio.createdAt) : new Date(Date.now() - 86400000 * 900);
  const ageDays = Math.floor((Date.now() - created.getTime()) / 86400000);
  const ageYears = Math.floor(ageDays / 365);
  const ageMonths = Math.floor((ageDays % 365) / 30);
  const ageDaysRem = ageDays % 30;
  const ageStr = `${ageYears} Year, ${ageMonths} Month, ${ageDaysRem} Days`;

  const m = hideBalance ? '••••' : '';

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-cell">
      <div class="stat-label">24h Change</div>
      <div class="stat-value ${change24h >= 0 ? 'up' : 'down'}">
        ${hideBalance ? '••••' : (change24h >= 0 ? '+' : '') + fmt.usd(changeUSD)}
      </div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Highest Balance</div>
      <div class="stat-value">${hideBalance ? '••••' : fmt.usd(highBal)}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Portfolio Age</div>
      <div class="stat-value" style="color:var(--text);">${ageStr}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Best 24H Asset</div>
      <div class="stat-value up">${bestAsset ? bestAsset.name + ' +' + bestAsset.change24h.toFixed(2) + '%' : '—'}</div>
    </div>
    <div class="stat-cell">
      <div class="stat-label">Worst 24H Asset</div>
      <div class="stat-value down">${worstAsset ? worstAsset.name + ' ' + (worstAsset.change24h >= 0 ? '+' : '') + worstAsset.change24h.toFixed(2) + '%' : '—'}</div>
    </div>`;
}

// ── Asset table ───────────────────────────────────────────────────────────

function renderAssetTable() {
  if (!wallet) return;
  const total = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  const filterBalance = document.getElementById('filter-balance')?.checked ?? true;

  let assets = [...wallet.assets];
  if (filterBalance) assets = assets.filter(a => a.balance > 0);

  // Sort
  assets.sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case 'name':    va = a.name;             vb = b.name;             break;
      case 'price':   va = a.priceUSD;         vb = b.priceUSD;         break;
      case 'change':  va = a.change24h;        vb = b.change24h;        break;
      case 'balance': va = a.balance;          vb = b.balance;          break;
      case 'pct':
      case 'value':
      default:        va = a.balance*a.priceUSD; vb = b.balance*b.priceUSD;
    }
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  // Update header arrows
  document.querySelectorAll('.asset-table th[data-col]').forEach(th => {
    th.classList.remove('sorted');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = '↕';
  });
  const activeTh = document.querySelector(`.asset-table th[data-col="${sortCol}"]`);
  if (activeTh) {
    activeTh.classList.add('sorted');
    const arrow = activeTh.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = sortAsc ? '↑' : '↓';
  }

  const tbody = document.getElementById('asset-tbody');
  tbody.innerHTML = '';

  assets.forEach(asset => {
    const val   = asset.balance * asset.priceUSD;
    const pct   = total > 0 ? (val / total * 100) : 0;
    const isPos = asset.change24h >= 0;
    const sparkId = `spark_${asset.id}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="asset-name-cell">
          <div class="coin-icon-wrap">
            <div class="coin-hex-bg" style="background:${hexToRgba(asset.color, 0.15)};">
              ${asset.iconUrl
                ? `<img src="${asset.iconUrl}" alt="${asset.symbol}" onerror="this.parentNode.innerHTML='<div class=\\"coin-fallback\\" style=\\"background:${asset.color};\\">'+asset.symbol.charAt(0)+'</div>'">`
                : `<div class="coin-fallback" style="background:${asset.color};">${asset.symbol.charAt(0)}</div>`
              }
            </div>
          </div>
          <div class="asset-name-text">
            <div class="name">${asset.name}</div>
            <div class="symbol">${asset.symbol}</div>
          </div>
        </div>
      </td>
      <td>${asset.apy ? `<span class="apy-badge">${asset.apy}% APY</span>` : '<span style="color:var(--text-3);">—</span>'}</td>
      <td class="price-cell">${fmt.usd(asset.priceUSD)} USD</td>
      <td class="change-cell ${isPos ? 'up' : 'down'}">${isPos ? '+' : ''}${asset.change24h.toFixed(2)}%</td>
      <td class="sparkline-cell"><canvas id="${sparkId}" class="sparkline-canvas" width="110" height="40"></canvas></td>
      <td class="balance-cell" style="color:${asset.color};">${hideBalance ? '••••' : fmt.crypto(asset.balance, asset.symbol)}</td>
      <td class="value-cell">${hideBalance ? '••••' : fmt.usd(val)}</td>
      <td class="pct-cell">
        <div class="pct-bar-row">
          <div class="pct-bar-track"><div class="pct-bar-fill" style="width:${Math.min(pct,100)}%;background:${asset.color};"></div></div>
          <span class="pct-label">${pct.toFixed(1)}%</span>
        </div>
      </td>`;

    tr.addEventListener('click', () => openAsset(asset.id));
    tr.addEventListener('dblclick', e => { e.stopPropagation(); openQuickEdit(asset.id, tr); });
    tr.title = 'Click to view · Double-click to quick edit';
    tbody.appendChild(tr);
  });

  // Load sparklines
  assets.forEach(async asset => {
    try {
      const r = await fetch(`/api/prices/${asset.id}?period=1W`);
      const d = await r.json();
      const canvas = document.getElementById(`spark_${asset.id}`);
      if (canvas) buildSparkline(canvas, d.prices, asset.color);
    } catch {}
  });
}

// ── Quick Edit ────────────────────────────────────────────────────────────

function openQuickEdit(id, row) {
  const asset = wallet.assets.find(a => a.id === id);
  if (!asset) return;
  quickEditId = id;

  document.getElementById('qe-title').textContent = `Edit ${asset.symbol}`;
  document.getElementById('qe-balance').value = asset.balance;
  document.getElementById('qe-price').value   = asset.priceUSD;
  document.getElementById('qe-change').value  = asset.change24h;

  const popup = document.getElementById('quick-edit-popup');
  const rect  = row.getBoundingClientRect();
  popup.style.display = 'block';
  popup.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 260) + 'px';
  popup.style.left = Math.max(rect.left, 10) + 'px';
  document.getElementById('qe-overlay').style.display = 'block';
}

window.closeQuickEdit = function() {
  document.getElementById('quick-edit-popup').style.display = 'none';
  document.getElementById('qe-overlay').style.display = 'none';
  quickEditId = null;
};

window.saveQuickEdit = async function() {
  if (!quickEditId) return;
  const balance = parseFloat(document.getElementById('qe-balance').value);
  const price   = parseFloat(document.getElementById('qe-price').value);
  const change  = parseFloat(document.getElementById('qe-change').value);

  await fetch(`/api/wallet/assets/${quickEditId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balance, priceUSD: price, change24h: change })
  });

  closeQuickEdit();
  await loadWallet();
  renderAll();
  toast('Updated!', 'success');
};

// ── Single Asset View ─────────────────────────────────────────────────────

async function openAsset(id) {
  currentAsset = wallet.assets.find(a => a.id === id);
  if (!currentAsset) return;
  showView('wallet');

  renderWalletHeader();
  await loadPriceChart('1W');
  renderTransactions();

  document.getElementById('send-btn').onclick    = () => openSendModal();
  document.getElementById('receive-btn').onclick = () => openReceiveModal();
}

function renderWalletHeader() {
  const a   = currentAsset;
  const val = a.balance * a.priceUSD;
  const isPos = a.change24h >= 0;

  document.getElementById('wallet-asset-meta').innerHTML = `
    <div class="coin-icon-wrap" style="width:42px;height:42px;">
      <div class="coin-hex-bg" style="background:${hexToRgba(a.color, 0.15)};width:42px;height:42px;">
        ${a.iconUrl ? `<img src="${a.iconUrl}" alt="${a.symbol}" style="width:26px;height:26px;border-radius:50%;object-fit:contain;">` : ''}
      </div>
    </div>
    <div class="wallet-asset-name-wrap">
      <div class="asset-full-name">${a.name}</div>
      <div class="asset-sym">${a.symbol} · <span class="${isPos ? 'text-green' : 'text-red'}">${isPos ? '+' : ''}${a.change24h.toFixed(2)}%</span></div>
    </div>`;

  document.getElementById('wallet-balance-wrap').innerHTML = `
    <div class="wb-crypto" style="color:${a.color};">${hideBalance ? '••••' : fmt.crypto(a.balance, a.symbol)}</div>
    <div class="wb-usd">${hideBalance ? '••••' : fmt.usd(val)}</div>`;

  document.getElementById('chart-price-big').textContent = fmt.usd(a.priceUSD);
  document.getElementById('chart-price-sub').innerHTML =
    `<span class="${isPos ? 'text-green' : 'text-red'}">${isPos ? '+' : ''}${a.change24h.toFixed(2)}% (24h)</span>`;
}

async function loadPriceChart(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.period === period));
  try {
    const r = await fetch(`/api/prices/${currentAsset.id}?period=${period}`);
    const d = await r.json();
    buildPriceChart('price-chart', d.prices, d.labels, currentAsset.color);
  } catch(e) { console.error(e); }
}

function renderTransactions() {
  const list = document.getElementById('tx-list');
  const txs  = wallet.transactions.filter(t => t.assetId === currentAsset.id);

  if (!txs.length) {
    list.innerHTML = `<div class="empty-state">No transactions yet</div>`;
    return;
  }

  const icon = { received:'↓', sent:'↑', exchanged:'⇄', staking:'★', pending:'⌛' };

  list.innerHTML = txs.map(tx => {
    const isIn = tx.type === 'received' || tx.type === 'staking';
    return `
      <div class="tx-row" onclick="showTxDetail('${tx.id}')">
        <div class="tx-icon ${tx.type}">${icon[tx.type] || '•'}</div>
        <div class="tx-info">
          <div class="tx-type">${tx.type}</div>
          <div class="tx-date">${fmt.date(tx.timestamp)}</div>
          <div class="tx-addr">${isIn ? 'From: ' : 'To: '}${fmt.shortAddr(isIn ? tx.from : tx.to)}</div>
        </div>
        <div class="tx-amount-cell">
          <div class="crypto ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${fmt.crypto(tx.amount, currentAsset.symbol)}</div>
          <div class="usd">${fmt.usd(tx.valueUSD || 0)}</div>
        </div>
      </div>`;
  }).join('');
}

window.showTxDetail = function(id) {
  const tx    = wallet.transactions.find(t => t.id === id);
  const asset = wallet.assets.find(a => a.id === tx.assetId);
  if (!tx) return;

  document.getElementById('tx-modal-title').textContent =
    `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} ${asset?.symbol || ''}`;

  const rows = [
    ['Status',        `<span class="status-badge ${tx.status}">${tx.status}</span>`],
    ['Date',          fmt.date(tx.timestamp)],
    ['Amount',        `${tx.amount} ${asset?.symbol || ''}`],
    ['Value (USD)',   fmt.usd(tx.valueUSD || 0)],
    ['From',          tx.from],
    ['To',            tx.to],
    ['TX Hash',       tx.txHash],
    ['Confirmations', tx.confirmations],
    tx.fee > 0 ? ['Fee', `${tx.fee} ${asset?.symbol || ''}`] : null,
    tx.memo ? ['Memo', tx.memo] : null,
  ].filter(Boolean);

  document.getElementById('tx-modal-body').innerHTML =
    rows.map(([k,v]) => `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`).join('');

  openModal('tx-modal');
};

// ── Send ──────────────────────────────────────────────────────────────────

let sendInCrypto = true;

function openSendModal() {
  const a = currentAsset;
  sendInCrypto = true;
  document.getElementById('send-symbol').textContent = a.symbol;
  document.getElementById('send-amount').value = '';
  document.getElementById('send-address').value = '';
  document.getElementById('send-toggle-btn').textContent = a.symbol;
  document.getElementById('send-avail').textContent = fmt.crypto(a.balance, a.symbol);

  const p = a.priceUSD;
  document.getElementById('fee-slow').textContent = fmt.usd(p * 0.00008);
  document.getElementById('fee-med').textContent  = fmt.usd(p * 0.00015);
  document.getElementById('fee-fast').textContent = fmt.usd(p * 0.0003);

  document.querySelectorAll('.fee-option').forEach((o,i) => o.classList.toggle('active', i===1));
  openModal('send-modal');
}

window.selectFee = function(el) {
  document.querySelectorAll('.fee-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
};

window.sendMax = function() {
  if (!currentAsset) return;
  document.getElementById('send-amount').value = sendInCrypto
    ? currentAsset.balance
    : (currentAsset.balance * currentAsset.priceUSD).toFixed(2);
};

window.confirmSend = async function() {
  const a    = currentAsset;
  const addr = document.getElementById('send-address').value.trim();
  const amt  = parseFloat(document.getElementById('send-amount').value);

  if (!addr) { toast('Enter a recipient address', 'error'); return; }
  if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }

  const cryptoAmt = sendInCrypto ? amt : amt / a.priceUSD;
  if (cryptoAmt > a.balance) { toast('Insufficient balance', 'error'); return; }

  toast(`Sending ${fmt.crypto(cryptoAmt, a.symbol)}…`, 'info');
  closeModal('send-modal');

  setTimeout(async () => {
    await fetch('/api/wallet/transactions', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        assetId: a.id, type: 'sent', amount: cryptoAmt,
        valueUSD: cryptoAmt * a.priceUSD,
        from: a.address, to: addr,
        txHash: fakeTxHash(), status: 'confirmed', confirmations: 1,
        fee: a.priceUSD * 0.00015, memo: ''
      })
    });
    await fetch(`/api/wallet/assets/${a.id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ balance: parseFloat((a.balance - cryptoAmt).toFixed(8)) })
    });
    await loadWallet();
    currentAsset = wallet.assets.find(x => x.id === a.id);
    renderWalletHeader();
    renderTransactions();
    renderAll();
    toast(`Sent ${fmt.crypto(cryptoAmt, a.symbol)}`, 'success');
  }, 1800);
};

// ── Receive ───────────────────────────────────────────────────────────────

async function openReceiveModal() {
  const a = currentAsset;
  document.getElementById('receive-symbol').textContent = a.symbol;
  document.getElementById('receive-network').textContent = a.network;
  document.getElementById('receive-addr').textContent = a.address;
  document.getElementById('receive-warn').textContent = a.symbol;

  const canvas = document.getElementById('qr-canvas');
  try { await QRCode.toCanvas(canvas, a.address, { width: 176, color: { dark: '#000', light: '#fff' } }); } catch {}
  openModal('receive-modal');
}

window.copyAddress = function() {
  copyText(document.getElementById('receive-addr').textContent, document.getElementById('copy-addr-btn'));
};

// ── Exchange ──────────────────────────────────────────────────────────────

let pickerTarget = null;

function setupExchangeDefaults() {
  if (!wallet || wallet.assets.length < 2) return;
  setExchangeAsset('from', wallet.assets[0]);
  setExchangeAsset('to',   wallet.assets[1]);
  updateExchangeCalc();

  document.getElementById('from-amount').addEventListener('input', updateExchangeCalc);
  document.getElementById('swap-switch-btn').addEventListener('click', swapExchangeAssets);
  document.getElementById('from-asset-btn').addEventListener('click', () => openPicker('from'));
  document.getElementById('to-asset-btn').addEventListener('click', () => openPicker('to'));
  document.getElementById('exchange-btn').addEventListener('click', reviewExchange);
}

function setExchangeAsset(side, asset) {
  if (!asset) return;
  document.getElementById(`${side}-symbol`).textContent = asset.symbol;
  const img = document.getElementById(`${side}-icon`);
  if (img) { img.src = asset.iconUrl || ''; img.style.display = asset.iconUrl ? '' : 'none'; }
}

function updateExchangeCalc() {
  if (!wallet) return;
  const fromSym = document.getElementById('from-symbol').textContent;
  const toSym   = document.getElementById('to-symbol').textContent;
  const from    = wallet.assets.find(a => a.symbol === fromSym);
  const to      = wallet.assets.find(a => a.symbol === toSym);
  if (!from || !to) return;

  const fromAmt = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt   = fromAmt * from.priceUSD / to.priceUSD * 0.995;

  document.getElementById('to-amount').value = toAmt > 0 ? toAmt.toFixed(6) : '';
  document.getElementById('from-usd').textContent = `≈ ${fmt.usd(fromAmt * from.priceUSD)}`;
  document.getElementById('to-usd').textContent   = `≈ ${fmt.usd(toAmt   * to.priceUSD)}`;

  const netFee  = from.priceUSD * 0.0002;
  const exFee   = fromAmt * from.priceUSD * 0.005;
  document.getElementById('exchange-info').innerHTML = `
    <div class="exchange-info-row"><span>Exchange rate</span><span>1 ${fromSym} = ${(from.priceUSD/to.priceUSD).toFixed(6)} ${toSym}</span></div>
    <div class="exchange-info-row"><span>Network fee</span><span>~${fmt.usd(netFee)}</span></div>
    <div class="exchange-info-row"><span>Exchange fee (0.5%)</span><span>~${fmt.usd(exFee)}</span></div>`;
}

function swapExchangeAssets() {
  const fs = document.getElementById('from-symbol').textContent;
  const ts = document.getElementById('to-symbol').textContent;
  const fa = wallet.assets.find(a => a.symbol === fs);
  const ta = wallet.assets.find(a => a.symbol === ts);
  setExchangeAsset('from', ta);
  setExchangeAsset('to',   fa);
  document.getElementById('from-amount').value = document.getElementById('to-amount').value || '';
  updateExchangeCalc();
}

function openPicker(target) {
  pickerTarget = target;
  document.getElementById('picker-search').value = '';
  renderPicker('');
  openModal('picker-modal');
}

function renderPicker(filter) {
  const assets = wallet.assets.filter(a =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.symbol.toLowerCase().includes(filter.toLowerCase())
  );
  document.getElementById('picker-list').innerHTML = assets.map(a => `
    <div class="picker-row" onclick="pickAsset('${a.id}')">
      <div class="coin-hex-bg" style="background:${hexToRgba(a.color,0.15)};width:32px;height:32px;border-radius:50%;">
        ${a.iconUrl ? `<img src="${a.iconUrl}" style="width:20px;height:20px;border-radius:50%;object-fit:contain;">` : `<div style="width:20px;height:20px;border-radius:50%;background:${a.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${a.symbol.charAt(0)}</div>`}
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${a.name}</div>
        <div style="font-size:11px;color:var(--text-2);">${a.symbol} · ${fmt.usd(a.priceUSD)}</div>
      </div>
      <div style="font-size:12px;color:${a.color};">${fmt.crypto(a.balance, a.symbol)}</div>
    </div>`).join('');
}

window.filterPicker = function(q) { renderPicker(q); };
window.pickAsset = function(id) {
  setExchangeAsset(pickerTarget, wallet.assets.find(a => a.id === id));
  closeModal('picker-modal');
  updateExchangeCalc();
};

function reviewExchange() {
  const fromSym = document.getElementById('from-symbol').textContent;
  const toSym   = document.getElementById('to-symbol').textContent;
  const fromAmt = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt   = parseFloat(document.getElementById('to-amount').value) || 0;

  if (!fromAmt) { toast('Enter an amount', 'error'); return; }
  if (fromSym === toSym) { toast("Can't swap the same asset", 'error'); return; }

  const from = wallet.assets.find(a => a.symbol === fromSym);
  if (fromAmt > from.balance) { toast('Insufficient balance', 'error'); return; }

  document.getElementById('exchange-confirm-body').innerHTML = `
    <div class="detail-row"><span class="detail-key">You Send</span><span class="detail-val">${fromAmt} ${fromSym}</span></div>
    <div class="detail-row"><span class="detail-key">You Receive</span><span class="detail-val">≈ ${toAmt.toFixed(6)} ${toSym}</span></div>
    <div class="detail-row"><span class="detail-key">Rate</span><span class="detail-val">1 ${fromSym} = ${(from.priceUSD/wallet.assets.find(a=>a.symbol===toSym).priceUSD).toFixed(6)} ${toSym}</span></div>
    <div class="detail-row"><span class="detail-key">Fee (0.5%)</span><span class="detail-val">${fmt.usd(fromAmt*from.priceUSD*0.005)}</span></div>`;
  openModal('exchange-confirm-modal');
}

window.executeExchange = async function() {
  const fromSym = document.getElementById('from-symbol').textContent;
  const toSym   = document.getElementById('to-symbol').textContent;
  const fromAmt = parseFloat(document.getElementById('from-amount').value) || 0;
  const toAmt   = parseFloat(document.getElementById('to-amount').value) || 0;
  const from    = wallet.assets.find(a => a.symbol === fromSym);
  const to      = wallet.assets.find(a => a.symbol === toSym);

  closeModal('exchange-confirm-modal');
  toast('Exchange in progress…', 'info');

  setTimeout(async () => {
    await fetch('/api/wallet/transactions', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ assetId: from.id, type: 'exchanged', amount: fromAmt,
        valueUSD: fromAmt*from.priceUSD, from: from.address, to: to.address,
        txHash: fakeTxHash(), status: 'confirmed', confirmations: 1, fee: 0,
        memo: `Exchanged ${fromSym} → ${toSym}`, exchangeAsset: to.id, exchangeAmount: toAmt })
    });
    await fetch(`/api/wallet/assets/${from.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ balance: parseFloat((from.balance - fromAmt).toFixed(8)) })
    });
    await fetch(`/api/wallet/assets/${to.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ balance: parseFloat((to.balance + toAmt).toFixed(8)) })
    });
    await loadWallet();
    renderAll();
    document.getElementById('from-amount').value = '';
    document.getElementById('to-amount').value = '';
    toast(`Exchanged ${fromAmt} ${fromSym} → ${toAmt.toFixed(4)} ${toSym}`, 'success');
  }, 1500);
};

// ── Backup phrase ─────────────────────────────────────────────────────────

function setupBackupPhrase() {
  const words = ['abandon','ability','able','about','above','absent',
    'absorb','abstract','absurd','abuse','access','accident'];
  document.getElementById('phrase-grid').innerHTML = words.map((w,i) =>
    `<div class="phrase-word"><span class="num">${i+1}.</span> ${w}</div>`
  ).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', init);
