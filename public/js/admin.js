// ── Admin Panel Logic ────────────────────────────────────────────────────

let wallet = null;

async function loadWallet() {
  const res = await fetch('/api/wallet');
  wallet = await res.json();
  renderAll();
}

function renderAll() {
  renderStats();
  renderPortfolioMeta();
  renderAssets();
  renderTransactions();
}

// ── Stats bar ─────────────────────────────────────────────────────────────

function renderStats() {
  const total = wallet.assets.reduce((s, a) => s + a.balance * a.priceUSD, 0);
  const change = wallet.portfolio.change24h;
  const isUp = change >= 0;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Portfolio</div>
      <div class="stat-value">${fmt.usd(total)}</div>
      <div class="stat-sub ${isUp ? 'text-green' : 'text-red'}">${fmt.pct(change)} today</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Assets</div>
      <div class="stat-value">${wallet.assets.length}</div>
      <div class="stat-sub">${wallet.assets.filter(a => a.balance > 0).length} with balance</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${wallet.transactions.length}</div>
      <div class="stat-sub">${wallet.transactions.filter(t => t.status === 'confirmed').length} confirmed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Top Asset</div>
      <div class="stat-value">${wallet.assets.sort((a,b) => b.balance*b.priceUSD - a.balance*a.priceUSD)[0]?.symbol || '—'}</div>
      <div class="stat-sub">${fmt.pct(Math.max(...wallet.assets.map(a => a.balance*a.priceUSD / total * 100)))} of portfolio</div>
    </div>`;
}

// ── Portfolio Meta ────────────────────────────────────────────────────────

function renderPortfolioMeta() {
  const p = wallet.portfolio;
  document.getElementById('portfolio-meta').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">24h Change %</div>
      <input type="number" class="inline-input" step="0.01" value="${p.change24h}"
        onchange="wallet.portfolio.change24h = parseFloat(this.value); renderStats();" />
    </div>
    <div class="stat-card">
      <div class="stat-label">24h Change USD</div>
      <input type="number" class="inline-input" step="0.01" value="${p.change24hUSD}"
        onchange="wallet.portfolio.change24hUSD = parseFloat(this.value); renderStats();" />
    </div>`;
}

// ── Assets ────────────────────────────────────────────────────────────────

function renderAssets() {
  const tbody = document.getElementById('assets-tbody');
  tbody.innerHTML = wallet.assets.map((a, i) => `
    <tr id="asset-row-${a.id}">
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <input type="color" class="color-swatch" value="${a.color}"
            oninput="wallet.assets[${i}].color=this.value;document.getElementById('swatch-${a.id}').style.background=this.value;"
            title="Pick color"/>
          <div id="swatch-${a.id}" style="width:16px;height:16px;border-radius:50%;background:${a.color};flex-shrink:0;pointer-events:none;"></div>
        </div>
      </td>
      <td><input class="inline-input narrow" value="${a.symbol}" onchange="wallet.assets[${i}].symbol=this.value;"/></td>
      <td><input class="inline-input" value="${a.name}" onchange="wallet.assets[${i}].name=this.value;"/></td>
      <td><input class="inline-input narrow" type="number" step="any" value="${a.balance}" onchange="wallet.assets[${i}].balance=parseFloat(this.value);renderStats();"/></td>
      <td><input class="inline-input narrow" type="number" step="any" value="${a.priceUSD}" onchange="wallet.assets[${i}].priceUSD=parseFloat(this.value);renderStats();"/></td>
      <td>
        <input class="inline-input narrow" type="number" step="0.01" value="${a.change24h}"
          onchange="wallet.assets[${i}].change24h=parseFloat(this.value);renderStats();"/>
      </td>
      <td><input class="inline-input narrow" type="number" step="0.1" value="${a.apy ?? ''}" placeholder="—" onchange="wallet.assets[${i}].apy=this.value?parseFloat(this.value):null;"/></td>
      <td><input class="inline-input" value="${a.network || ''}" onchange="wallet.assets[${i}].network=this.value;"/></td>
      <td><input class="inline-input mono wide" value="${a.address}" onchange="wallet.assets[${i}].address=this.value;"/></td>
      <td><input class="inline-input mono wide" value="${a.iconUrl || ''}" placeholder="https://…" onchange="wallet.assets[${i}].iconUrl=this.value;"/></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteAsset('${a.id}')">Delete</button>
      </td>
    </tr>`
  ).join('');
}

window.deleteAsset = async function(id) {
  if (!confirm(`Delete asset ${id}?`)) return;
  await fetch(`/api/wallet/assets/${id}`, { method: 'DELETE' });
  await loadWallet();
  toast('Asset deleted', 'info');
};

window.addAssetRow = function() {
  const newAsset = {
    id: 'new_' + Date.now(),
    symbol: 'NEW',
    name: 'New Asset',
    balance: 0,
    priceUSD: 1,
    change24h: 0,
    address: '0x000000000000000000000000000000000000000',
    color: '#8b5cf6',
    network: 'Ethereum'
  };
  wallet.assets.push(newAsset);
  renderAssets();
  // Scroll to bottom of table
  document.getElementById('assets-tbody').lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  toast('New asset row added — fill in details and Save All', 'info');
};

// ── Transactions ──────────────────────────────────────────────────────────

function renderTransactions() {
  const tbody = document.getElementById('tx-tbody');
  const assetOptions = wallet.assets.map(a =>
    `<option value="${a.id}">${a.symbol}</option>`
  ).join('');

  const typeOptions = ['received','sent','exchanged','staking','pending'].map(t =>
    `<option value="${t}">${t}</option>`
  ).join('');

  const statusOptions = ['confirmed','pending','failed'].map(s =>
    `<option value="${s}">${s}</option>`
  ).join('');

  tbody.innerHTML = wallet.transactions.map((tx, i) => {
    const d = new Date(tx.timestamp);
    const dateStr = d.toISOString().slice(0,16); // YYYY-MM-DDTHH:MM
    return `
      <tr id="tx-row-${tx.id}">
        <td>
          <select class="inline-input" style="width:80px;"
            onchange="wallet.transactions[${i}].assetId=this.value;">
            ${wallet.assets.map(a => `<option value="${a.id}" ${a.id===tx.assetId?'selected':''}>${a.symbol}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="inline-input" style="width:100px;"
            onchange="wallet.transactions[${i}].type=this.value;">
            ${['received','sent','exchanged','staking','pending'].map(t =>
              `<option value="${t}" ${t===tx.type?'selected':''}>${t}</option>`
            ).join('')}
          </select>
        </td>
        <td><input class="inline-input narrow" type="number" step="any" value="${tx.amount}" onchange="wallet.transactions[${i}].amount=parseFloat(this.value);"/></td>
        <td><input class="inline-input narrow" type="number" step="0.01" value="${tx.valueUSD||0}" onchange="wallet.transactions[${i}].valueUSD=parseFloat(this.value);"/></td>
        <td>
          <select class="inline-input" style="width:100px;"
            onchange="wallet.transactions[${i}].status=this.value;">
            ${['confirmed','pending','failed'].map(s =>
              `<option value="${s}" ${s===tx.status?'selected':''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td><input class="inline-input" type="datetime-local" value="${dateStr}"
          onchange="wallet.transactions[${i}].timestamp=new Date(this.value).toISOString();"/></td>
        <td><input class="inline-input mono" value="${tx.from||''}" onchange="wallet.transactions[${i}].from=this.value;"/></td>
        <td><input class="inline-input mono" value="${tx.to||''}" onchange="wallet.transactions[${i}].to=this.value;"/></td>
        <td><input class="inline-input" value="${tx.memo||''}" onchange="wallet.transactions[${i}].memo=this.value;"/></td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteTx('${tx.id}')">Del</button>
        </td>
      </tr>`;
  }).join('');
}

window.deleteTx = async function(id) {
  if (!confirm('Delete this transaction?')) return;
  await fetch(`/api/wallet/transactions/${id}`, { method: 'DELETE' });
  await loadWallet();
  toast('Transaction deleted', 'info');
};

window.addTxRow = function() {
  const defaultAsset = wallet.assets[0];
  const newTx = {
    id: `tx_${Date.now()}`,
    assetId: defaultAsset.id,
    type: 'received',
    amount: 0,
    valueUSD: 0,
    from: '',
    to: defaultAsset.address,
    txHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    timestamp: new Date().toISOString(),
    status: 'confirmed',
    confirmations: 1,
    fee: 0,
    memo: ''
  };
  wallet.transactions.unshift(newTx);
  renderTransactions();
  document.getElementById('tx-tbody').firstElementChild?.scrollIntoView({ behavior: 'smooth' });
  toast('New transaction row added — fill in details and Save All', 'info');
};

// ── Save ──────────────────────────────────────────────────────────────────

window.saveAll = async function() {
  const status = document.getElementById('save-status');
  status.textContent = 'Saving…';

  try {
    // Fix up new asset IDs
    wallet.assets.forEach(a => {
      if (a.id.startsWith('new_')) {
        a.id = a.symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    });

    const res = await fetch('/api/wallet', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wallet)
    });

    if (!res.ok) throw new Error('Save failed');

    await loadWallet();
    status.textContent = 'Saved ✓';
    setTimeout(() => status.textContent = '', 2500);
    toast('All changes saved!', 'success');
  } catch (e) {
    status.textContent = 'Error saving';
    toast('Save failed: ' + e.message, 'error');
  }
};

// ── Keyboard shortcut ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveAll();
  }
});

window.addEventListener('DOMContentLoaded', loadWallet);
