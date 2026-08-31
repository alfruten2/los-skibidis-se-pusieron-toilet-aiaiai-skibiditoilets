/**
 * SUCHAI 4 — Chart Manager
 * Gestión reactiva de gráficas Chart.js con soporte de cambio dinámico de tema.
 */
(function(window) {
  'use strict';

  /** Paletas de colores para gráficas por tema */
  var CHART_THEMES = {
    light: {
      grid: 'rgba(43, 37, 40, 0.08)',
      tick: '#8A7F82',
      legend: '#5C5356',
      tooltip: {
        bg: 'rgba(255, 255, 255, 0.95)',
        border: 'rgba(226, 109, 92, 0.3)',
        title: '#2B2528',
        body: '#5C5356'
      },
      eps: ['#E26D5C', '#D96B60', '#63519F'],
      temp: ['#D96B60', '#E26D5C', '#C9453A'],
      comms: ['#63519F', '#4A9F73']
    },
    dark: {
      grid: 'rgba(255, 255, 255, 0.05)',
      tick: '#7D7490',
      legend: '#ABA2BA',
      tooltip: {
        bg: 'rgba(27, 21, 40, 0.95)',
        border: 'rgba(240, 124, 111, 0.3)',
        title: '#F3F0F7',
        body: '#ABA2BA'
      },
      eps: ['#F07C6F', '#E5C07B', '#B89EFF'],
      temp: ['#E5C07B', '#F07C6F', '#F07C6F'],
      comms: ['#B89EFF', '#5BD48F']
    }
  };

  var MAX_POINTS = 60;

  /** Generar array de labels vacío */
  function emptyLabels() {
    return new Array(MAX_POINTS).fill('');
  }

  /** Generar array de datos en cero */
  function emptyData() {
    return new Array(MAX_POINTS).fill(0);
  }

  /** Construir defaults de Chart.js para un tema */
  function buildDefaults(theme) {
    var t = CHART_THEMES[theme] || CHART_THEMES.light;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: t.legend,
            font: { size: 10, family: "'JetBrains Mono', monospace" },
            boxWidth: 8, padding: 12
          }
        },
        tooltip: {
          backgroundColor: t.tooltip.bg,
          borderColor: t.tooltip.border,
          borderWidth: 1,
          titleColor: t.tooltip.title,
          bodyColor: t.tooltip.body,
          bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          padding: 10
        }
      }
    };
  }

  class ChartManager {
    constructor() {
      this.epsChart = null;
      this.tempChart = null;
      this.commsChart = null;
      this.currentTheme = 'light';
    }

    /** Inicializar todas las gráficas después de que el DOM esté listo */
    init() {
      this._initEPSChart();
      this._initTempChart();
      this._initCommsChart();
    }

    /** EPS — Voltajes de paneles solares */
    _initEPSChart() {
      var ctx = document.getElementById('eps-chart');
      if (!ctx) return;

      var t = CHART_THEMES[this.currentTheme];
      var defaults = buildDefaults(this.currentTheme);

      this.epsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'Panel X',
              data: emptyData(),
              borderColor: t.eps[0],
              backgroundColor: t.eps[0] + '1A',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Panel Y',
              data: emptyData(),
              borderColor: t.eps[1],
              backgroundColor: t.eps[1] + '1A',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Panel Z',
              data: emptyData(),
              borderColor: t.eps[2],
              backgroundColor: t.eps[2] + '1A',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            }
          ]
        },
        options: Object.assign({}, defaults, {
          scales: {
            x: { display: false },
            y: {
              min: 0, max: 5,
              grid: { color: t.grid },
              ticks: {
                color: t.tick,
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                callback: function(v) { return v + 'V'; }
              }
            }
          }
        })
      });
    }

    /** OBC — Temperaturas */
    _initTempChart() {
      var ctx = document.getElementById('temp-chart');
      if (!ctx) return;

      var t = CHART_THEMES[this.currentTheme];
      var defaults = buildDefaults(this.currentTheme);

      this.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'CPU',
              data: emptyData(),
              borderColor: t.temp[0],
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Board',
              data: emptyData(),
              borderColor: t.temp[1],
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Payload',
              data: emptyData(),
              borderColor: t.temp[2],
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            }
          ]
        },
        options: Object.assign({}, defaults, {
          scales: {
            x: { display: false },
            y: {
              min: -20, max: 50,
              grid: { color: t.grid },
              ticks: {
                color: t.tick,
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                callback: function(v) { return v + '°C'; }
              }
            }
          }
        })
      });
    }

    /** COMMS — RSSI y SNR (doble eje) */
    _initCommsChart() {
      var ctx = document.getElementById('comms-chart');
      if (!ctx) return;

      var t = CHART_THEMES[this.currentTheme];
      var defaults = buildDefaults(this.currentTheme);

      this.commsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'RSSI',
              data: emptyData(),
              borderColor: t.comms[0],
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false,
              yAxisID: 'y'
            },
            {
              label: 'SNR',
              data: emptyData(),
              borderColor: t.comms[1],
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: Object.assign({}, defaults, {
          scales: {
            x: { display: false },
            y: {
              position: 'left',
              min: -100, max: -50,
              grid: { color: t.grid },
              ticks: {
                color: t.tick,
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                callback: function(v) { return v + ' dBm'; }
              }
            },
            y1: {
              position: 'right',
              min: 0, max: 30,
              grid: { drawOnChartArea: false },
              ticks: {
                color: t.tick,
                font: { size: 9, family: "'JetBrains Mono', monospace" },
                callback: function(v) { return v + ' dB'; }
              }
            }
          }
        })
      });
    }

    /**
     * Cambiar tema de todas las gráficas sin destruirlas/recrearlas.
     * @param {string} theme - 'light' o 'dark'
     */
    setTheme(theme) {
      if (theme !== 'light' && theme !== 'dark') return;
      this.currentTheme = theme;
      var t = CHART_THEMES[theme];

      // Actualizar EPS
      if (this.epsChart) {
        this._applyChartTheme(this.epsChart, t, t.eps);
      }

      // Actualizar Temp
      if (this.tempChart) {
        this._applyChartTheme(this.tempChart, t, t.temp);
      }

      // Actualizar Comms
      if (this.commsChart) {
        this._applyChartTheme(this.commsChart, t, t.comms);
      }
    }

    /** Aplicar colores de tema a una gráfica individual */
    _applyChartTheme(chart, themeColors, datasetColors) {
      // Actualizar colores de datasets
      for (var i = 0; i < datasetColors.length && i < chart.data.datasets.length; i++) {
        chart.data.datasets[i].borderColor = datasetColors[i];
        chart.data.datasets[i].backgroundColor = datasetColors[i] + '1A';
      }

      // Actualizar leyenda
      if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = themeColors.legend;
      }

      // Actualizar tooltip
      if (chart.options.plugins && chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = themeColors.tooltip.bg;
        chart.options.plugins.tooltip.borderColor = themeColors.tooltip.border;
        chart.options.plugins.tooltip.titleColor = themeColors.tooltip.title;
        chart.options.plugins.tooltip.bodyColor = themeColors.tooltip.body;
      }

      // Actualizar ejes
      var scales = chart.options.scales;
      if (scales) {
        Object.keys(scales).forEach(function(key) {
          if (key === 'x') return;
          var axis = scales[key];
          if (axis.grid) {
            axis.grid.color = themeColors.grid;
          }
          if (axis.ticks) {
            axis.ticks.color = themeColors.tick;
          }
        });
      }

      chart.update('none');
    }

    /** Agregar punto de datos, desplazar si excede MAX_POINTS */
    _pushData(chart, datasetValues) {
      if (!chart) return;
      chart.data.labels.push('');
      if (chart.data.labels.length > MAX_POINTS) chart.data.labels.shift();

      for (var i = 0; i < datasetValues.length; i++) {
        chart.data.datasets[i].data.push(datasetValues[i]);
        if (chart.data.datasets[i].data.length > MAX_POINTS) {
          chart.data.datasets[i].data.shift();
        }
      }
      chart.update('none');
    }

    /** Actualizar todas las gráficas y valores DOM desde datos de telemetría */
    update(data) {
      if (!data) return;

      // Actualizar gráficas
      this._pushData(this.epsChart, [
        data.eps.solarPanelX,
        data.eps.solarPanelY,
        data.eps.solarPanelZ
      ]);

      this._pushData(this.tempChart, [
        data.obc.cpuTemp,
        data.obc.boardTemp,
        data.obc.payloadTemp
      ]);

      this._pushData(this.commsChart, [
        data.comms.rssi,
        data.comms.snr
      ]);

      // Actualizar valores DOM del EPS
      this._setText('#val-solar-x', data.eps.solarPanelX.toFixed(2) + ' V');
      this._setText('#val-solar-y', data.eps.solarPanelY.toFixed(2) + ' V');
      this._setText('#val-solar-z', data.eps.solarPanelZ.toFixed(2) + ' V');
      this._setText('#val-solar-current', data.eps.solarCurrent.toFixed(0) + ' mA');

      // Actualizar valores DOM del OBC
      this._setText('#val-cpu-temp', data.obc.cpuTemp.toFixed(1) + '°C');
      this._setText('#val-board-temp', data.obc.boardTemp.toFixed(1) + '°C');
      this._setText('#val-payload-temp', data.obc.payloadTemp.toFixed(1) + '°C');
      this._setText('#val-cpu-usage', data.obc.cpuUsage.toFixed(0) + '%');
      this._setText('#val-mem-usage', data.obc.memoryUsed + ' KB');

      // Actualizar valores DOM de COMMS
      this._setText('#val-rssi', data.comms.rssi.toFixed(1) + ' dBm');
      this._setText('#val-snr', data.comms.snr.toFixed(1) + ' dB');
      this._setText('#val-packets', data.comms.packetsSent.toLocaleString());
      this._setText('#val-packet-loss', data.comms.packetLossRate.toFixed(1) + '%');
      this._setText('#val-data-rate', data.comms.dataRate.toLocaleString() + ' bps');

      // Actualizar indicador de batería
      var charge = data.eps.batteryCharge;
      this._setText('#battery-percentage', charge.toFixed(0) + '%');
      this._setText('#battery-status', data.eps.batteryStatus);
      this._setText('#battery-voltage-val', data.eps.batteryVoltage.toFixed(2) + 'V');

      var fillEl = document.querySelector('.battery-fill');
      if (fillEl) {
        fillEl.style.height = charge.toFixed(0) + '%';
        if (charge > 50) {
          fillEl.style.background = 'linear-gradient(180deg, var(--accent-green), #059669)';
        } else if (charge > 20) {
          fillEl.style.background = 'linear-gradient(180deg, var(--accent-amber), #d97706)';
        } else {
          fillEl.style.background = 'linear-gradient(180deg, var(--accent-red), #dc2626)';
        }
      }

      // Actualizar color del porcentaje de batería
      var percEl = document.getElementById('battery-percentage');
      if (percEl) {
        var cs = getComputedStyle(document.documentElement);
        if (charge > 50) percEl.style.color = cs.getPropertyValue('--accent-green').trim();
        else if (charge > 20) percEl.style.color = cs.getPropertyValue('--accent-amber').trim();
        else percEl.style.color = cs.getPropertyValue('--accent-red').trim();
      }
    }

    /** Helper: establecer texto de un elemento por selector */
    _setText(selector, text) {
      var el = document.querySelector(selector);
      if (el) el.textContent = text;
    }

    /** Limpieza de gráficas */
    destroy() {
      if (this.epsChart) { this.epsChart.destroy(); this.epsChart = null; }
      if (this.tempChart) { this.tempChart.destroy(); this.tempChart = null; }
      if (this.commsChart) { this.commsChart.destroy(); this.commsChart = null; }
    }
  }

  window.ChartManager = ChartManager;
})(window);
