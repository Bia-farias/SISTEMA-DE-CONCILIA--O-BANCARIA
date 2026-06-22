/**
 * charts.js – Chart.js Dashboard Charts
 */

const CHARTS = (() => {
  const instances = {};

  // ---- Default chart options ----
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(13,24,41,0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 12, weight: '700', family: 'Inter' },
        bodyFont: { size: 11, family: 'Inter' },
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label || ''}: ${ctx.parsed.y ?? ctx.parsed}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: {
          color: '#475569',
          font: { size: 10, family: 'Inter' },
          maxRotation: 0,
          maxTicksLimit: 10,
        },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: {
          color: '#475569',
          font: { size: 10, family: 'Inter' },
          padding: 8,
        },
        border: { display: false },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeInOutQuart',
    },
  };

  // ---- Line Chart: Conciliações por Período ----
  function createTrendChart(canvasId, data) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const labels = data.labels.map(l => {
      const d = new Date(l);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Conciliado',
            data: data.datasets.conciliado,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#060d1a',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
          },
          {
            label: 'Pendente',
            data: data.datasets.pendente,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.06)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#060d1a',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
          {
            label: 'Divergente',
            data: data.datasets.divergente,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.05)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#060d1a',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#94a3b8',
              font: { size: 11, family: 'Inter', weight: '600' },
              boxWidth: 12,
              boxHeight: 3,
              usePointStyle: false,
              padding: 16,
            },
          },
          tooltip: {
            ...defaultOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} itens`,
            },
          },
        },
      },
    });
    return instances[canvasId];
  }

  // ---- Donut Chart: Distribuição de Pendências ----
  function createDonutChart(canvasId, summary) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const data = [
      summary.divergenciaValor  || 0,
      summary.naoRegistrado     || 0,
      summary.naoCompensado     || 0,
      summary.duplicidade       || 0,
    ];

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Divergência de Valor', 'Não Registrado', 'Não Compensado', 'Duplicidade'],
        datasets: [{
          data,
          backgroundColor: [
            'rgba(249,115,22,0.85)',
            'rgba(239,68,68,0.85)',
            'rgba(139,92,246,0.85)',
            'rgba(244,114,182,0.85)',
          ],
          borderColor: '#0d1829',
          borderWidth: 3,
          hoverBorderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...defaultOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} itens`,
            },
          },
        },
        animation: { animateRotate: true, duration: 1000, easing: 'easeInOutQuart' },
      },
    });

    return instances[canvasId];
  }

  // ---- Bar Chart: Status distribution ----
  function createStatusChart(canvasId, summary) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [
          'Conciliado',
          'Div. Data',
          'Provável',
          'Div. Valor',
          'Não Reg.',
          'Não Comp.',
          'Duplicid.',
        ],
        datasets: [{
          label: 'Qtd',
          data: [
            summary.conciliado            || 0,
            summary.conciliadoData        || 0,
            summary.provavelCorrespondencia || 0,
            summary.divergenciaValor      || 0,
            summary.naoRegistrado         || 0,
            summary.naoCompensado         || 0,
            summary.duplicidade           || 0,
          ],
          backgroundColor: [
            'rgba(16,185,129,0.75)',
            'rgba(245,158,11,0.75)',
            'rgba(59,130,246,0.75)',
            'rgba(249,115,22,0.75)',
            'rgba(239,68,68,0.75)',
            'rgba(139,92,246,0.75)',
            'rgba(244,114,182,0.75)',
          ],
          borderColor: [
            '#10b981', '#f59e0b', '#3b82f6', '#f97316', '#ef4444', '#8b5cf6', '#f472b6',
          ],
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          tooltip: {
            ...defaultOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} itens`,
            },
          },
        },
      },
    });

    return instances[canvasId];
  }

  // ---- Mini Sparkline ----
  function createSparkline(canvasId, data, color = '#3b82f6') {
    if (instances[canvasId]) instances[canvasId].destroy();
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: color.replace('rgb', 'rgba').replace(')', ',0.1)'),
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 600 },
      },
    });
  }

  function destroy(canvasId) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }
  }

  function destroyAll() {
    for (const id of Object.keys(instances)) destroy(id);
  }

  return {
    createTrendChart,
    createDonutChart,
    createStatusChart,
    createSparkline,
    destroy,
    destroyAll,
  };
})();
