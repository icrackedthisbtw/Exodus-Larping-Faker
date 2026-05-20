// ── Shared utilities ──────────────────────────────────────────────────────

window.fmt = {
  usd(n, compact = false) {
    if (compact && Math.abs(n) >= 1000) {
      return '$' + (n / 1000).toFixed(1) + 'k';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  },
  crypto(n, symbol) {
    const decimals = ['BTC', 'ETH'].includes(symbol) ? 6 : ['USDT', 'USDC', 'XRP', 'DOGE', 'ADA'].includes(symbol) ? 2 : 4;
    return parseFloat(n).toFixed(decimals) + ' ' + symbol;
  },
  pct(n) {
    const sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  },
  date(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  },
  shortAddr(addr) {
    if (!addr) return '—';
    if (addr.length <= 16) return addr;
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }
};

window.toast = function(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

window.openModal = function(id) {
  document.getElementById(id).classList.add('show');
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('show');
};

window.copyText = async function(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1500);
    }
    toast('Copied to clipboard', 'success');
  } catch {
    toast('Copy failed', 'error');
  }
};

// Generate a fake TX hash
window.fakeTxHash = function(prefix = '') {
  const chars = '0123456789abcdef';
  let hash = prefix;
  while (hash.length < 64) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
};

// Crypto icon letter + color
window.cryptoIcon = function(symbol, color, size = 40) {
  const letter = symbol.charAt(0);
  return `<div class="asset-icon" style="background:${hexToRgba(color,0.15)};color:${color};width:${size}px;height:${size}px;font-size:${Math.floor(size*0.4)}px;">${letter}</div>`;
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

window.hexToRgba = hexToRgba;
