// ── Chart helpers ─────────────────────────────────────────────────────────

Chart.defaults.color = '#9999bb';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

let priceChartInst = null;
let donutChartInst = null;

window.buildDonutChart = function(assets) {
  const ctx = document.getElementById('donut-chart').getContext('2d');
  const labels = assets.map(a => a.symbol);
  const values = assets.map(a => a.balance * a.priceUSD);
  const colors = assets.map(a => a.color);

  if (donutChartInst) donutChartInst.destroy();

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => hexToRgba(c, 0.85)),
        borderColor: colors,
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
              const pct = ((ctx.parsed/total)*100).toFixed(1);
              return ` ${ctx.label}: ${fmt.usd(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
};

window.buildPriceChart = function(canvasId, prices, labels, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const isUp = prices[prices.length-1] >= prices[0];
  const lineColor = isUp ? '#0ed4a4' : '#f45532';

  if (priceChartInst) priceChartInst.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, hexToRgba(lineColor, 0.3));
  gradient.addColorStop(1, hexToRgba(lineColor, 0.0));

  priceChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: lineColor,
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return new Date(parseInt(items[0].label)).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });
            },
            label(item) {
              return ' ' + fmt.usd(item.parsed.y);
            }
          },
          displayColors: false,
          backgroundColor: '#252537',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#9999bb',
          bodyColor: '#fff',
          bodyFont: { weight: '600', size: 14 },
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false },
        },
        y: {
          display: false,
          grid: { display: false },
        }
      }
    }
  });

  return priceChartInst;
};

// Mini sparkline for asset rows
window.buildSparkline = function(canvas, prices, color) {
  const isUp = prices[prices.length-1] >= prices[0];
  const lineColor = isUp ? '#0ed4a4' : '#f45532';

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: prices.map((_,i) => i),
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
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
};
