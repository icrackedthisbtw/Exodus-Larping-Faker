// ── Chart helpers ─────────────────────────────────────────────────────────

Chart.defaults.color = '#606080';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

let priceChartInst = null;
let donutChartInst = null;
const sparkInstances = {};

window.buildDonutChart = function(assets, total) {
  const ctx    = document.getElementById('donut-chart').getContext('2d');
  const values = assets.map(a => a.balance * a.priceUSD);
  const colors = assets.map(a => a.color);

  if (donutChartInst) donutChartInst.destroy();

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: assets.map(a => a.symbol),
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#0b0b10',
        borderWidth: 3,
        hoverBorderWidth: 3,
        hoverOffset: 8,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: false,
      cutout: '80%',
      animation: { duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) { return items[0].label; },
            label(ctx) {
              const tot = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = tot > 0 ? ((ctx.parsed / tot) * 100).toFixed(1) : '0.0';
              return ` ${fmt.usd(ctx.parsed)} · ${pct}%`;
            }
          },
          backgroundColor: '#13131e',
          borderColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#fff',
          bodyColor: '#9999bb',
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
        }
      }
    }
  });
};

window.buildPriceChart = function(canvasId, prices, labels, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#00d4a4' : '#f45532';

  if (priceChartInst) priceChartInst.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, hexToRgba(lineColor, 0.25));
  gradient.addColorStop(1, hexToRgba(lineColor, 0.0));

  priceChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: lineColor,
        borderWidth: 1.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: '#0b0b10',
        pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return new Date(parseInt(items[0].label)).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
            },
            label(item) { return ' ' + fmt.usd(item.parsed.y); }
          },
          displayColors: false,
          backgroundColor: '#13131e',
          borderColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#606080',
          bodyColor: '#fff',
          bodyFont: { weight: '600', size: 14 },
        }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });

  return priceChartInst;
};

window.buildSparkline = function(canvas, prices, color) {
  if (!canvas) return;
  const id = canvas.id;
  if (sparkInstances[id]) { sparkInstances[id].destroy(); delete sparkInstances[id]; }

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#00d4a4' : '#f45532';

  sparkInstances[id] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: prices.map((_, i) => i),
      datasets: [{
        data: prices,
        borderColor: lineColor,
        borderWidth: 1.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
};
