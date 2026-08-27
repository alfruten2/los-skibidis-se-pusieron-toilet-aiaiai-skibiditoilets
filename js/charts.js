/**
 * SUCHAI 4 — Chart Manager
 * Manages all Chart.js real-time telemetry charts and DOM value updates.
 */
(function(window) {
  'use strict';

  /** Common chart defaults for dark HUD theme */
  var CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 10, family: "'JetBrains Mono', monospace" },
          boxWidth: 8, padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(6,182,212,0.3)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
        padding: 10
      }
    }
  };

  var GRID_STYLE = { color: 'rgba(255,255,255,0.05)' };
  var TICK_STYLE = { color: '#64748b', font: { size: 9, family: "'JetBrains Mono', monospace" } };
  var MAX_POINTS = 60;

  /** Generate empty labels array */
  function emptyLabels() {
    return new Array(MAX_POINTS).fill('');
  }

  /** Generate zero-filled data array */
  function emptyData() {
    return new Array(MAX_POINTS).fill(0);
  }

  class ChartManager {
    constructor() {
      this.epsChart = null;
      this.tempChart = null;
      this.commsChart = null;
    }

    /** Initialize all charts after DOM is ready */
    init() {
      this._initEPSChart();
      this._initTempChart();
      this._initCommsChart();
    }

    /** EPS — Solar Panel Voltages */
    _initEPSChart() {
      var ctx = document.getElementById('eps-chart');
      if (!ctx) return;

      this.epsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'Panel X',
              data: emptyData(),
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Panel Y',
              data: emptyData(),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Panel Z',
              data: emptyData(),
              borderColor: '#818cf8',
              backgroundColor: 'rgba(129, 140, 248, 0.1)',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            }
          ]
        },
        options: Object.assign({}, CHART_DEFAULTS, {
          scales: {
            x: { display: false },
            y: {
              min: 0, max: 5,
              grid: GRID_STYLE,
              ticks: Object.assign({}, TICK_STYLE, {
                callback: function(v) { return v + 'V'; }
              })
            }
          }
        })
      });
    }

    /** OBC — Temperature readings */
    _initTempChart() {
      var ctx = document.getElementById('temp-chart');
      if (!ctx) return;

      this.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'CPU',
              data: emptyData(),
              borderColor: '#f59e0b',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Board',
              data: emptyData(),
              borderColor: '#fb923c',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            },
            {
              label: 'Payload',
              data: emptyData(),
              borderColor: '#f87171',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false
            }
          ]
        },
        options: Object.assign({}, CHART_DEFAULTS, {
          scales: {
            x: { display: false },
            y: {
              min: -20, max: 50,
              grid: GRID_STYLE,
              ticks: Object.assign({}, TICK_STYLE, {
                callback: function(v) { return v + '°C'; }
              })
            }
          }
        })
      });
    }

    /** COMMS — RSSI & SNR (dual axis) */
    _initCommsChart() {
      var ctx = document.getElementById('comms-chart');
      if (!ctx) return;

      this.commsChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: emptyLabels(),
          datasets: [
            {
              label: 'RSSI',
              data: emptyData(),
              borderColor: '#8b5cf6',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false,
              yAxisID: 'y'
            },
            {
              label: 'SNR',
              data: emptyData(),
              borderColor: '#10b981',
              borderWidth: 2, tension: 0.4,
              pointRadius: 0, fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: Object.assign({}, CHART_DEFAULTS, {
          scales: {
            x: { display: false },
            y: {
              position: 'left',
              min: -100, max: -50,
              grid: GRID_STYLE,
              ticks: Object.assign({}, TICK_STYLE, {
                callback: function(v) { return v + ' dBm'; }
              })
            },
            y1: {
              position: 'right',
              min: 0, max: 30,
              grid: { drawOnChartArea: false },
              ticks: Object.assign({}, TICK_STYLE, {
                callback: function(v) { return v + ' dB'; }
              })
            }
          }
        })
      });
    }

    /** Push data point, shift if over MAX_POINTS */
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

    /** Update all charts and DOM values from telemetry data */
    update(data) {
      if (!data) return;

      // ── Update Charts ──
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

      // ── Update EPS DOM values ──
      this._setText('#val-solar-x', data.eps.solarPanelX.toFixed(2) + ' V');
      this._setText('#val-solar-y', data.eps.solarPanelY.toFixed(2) + ' V');
      this._setText('#val-solar-z', data.eps.solarPanelZ.toFixed(2) + ' V');
      this._setText('#val-solar-current', data.eps.solarCurrent.toFixed(0) + ' mA');

      // ── Update OBC DOM values ──
      this._setText('#val-cpu-temp', data.obc.cpuTemp.toFixed(1) + '°C');
      this._setText('#val-board-temp', data.obc.boardTemp.toFixed(1) + '°C');
      this._setText('#val-payload-temp', data.obc.payloadTemp.toFixed(1) + '°C');
      this._setText('#val-cpu-usage', data.obc.cpuUsage.toFixed(0) + '%');
      this._setText('#val-mem-usage', data.obc.memoryUsed + ' KB');

      // ── Update Comms DOM values ──
      this._setText('#val-rssi', data.comms.rssi.toFixed(1) + ' dBm');
      this._setText('#val-snr', data.comms.snr.toFixed(1) + ' dB');
      this._setText('#val-packets', data.comms.packetsSent.toLocaleString());
      this._setText('#val-packet-loss', data.comms.packetLossRate.toFixed(1) + '%');
      this._setText('#val-data-rate', data.comms.dataRate.toLocaleString() + ' bps');

      // ── Update Battery Gauge ──
      var charge = data.eps.batteryCharge;
      this._setText('#battery-percentage', charge.toFixed(0) + '%');
      this._setText('#battery-status', data.eps.batteryStatus);
      this._setText('#battery-voltage-val', data.eps.batteryVoltage.toFixed(2) + 'V');

      var fillEl = document.querySelector('.battery-fill');
      if (fillEl) {
        fillEl.style.height = charge.toFixed(0) + '%';
        if (charge > 50) {
          fillEl.style.background = 'linear-gradient(180deg, #10b981, #059669)';
        } else if (charge > 20) {
          fillEl.style.background = 'linear-gradient(180deg, #f59e0b, #d97706)';
        } else {
          fillEl.style.background = 'linear-gradient(180deg, #ef4444, #dc2626)';
        }
      }

      // Update battery percentage color
      var percEl = document.getElementById('battery-percentage');
      if (percEl) {
        if (charge > 50) percEl.style.color = '#10b981';
        else if (charge > 20) percEl.style.color = '#f59e0b';
        else percEl.style.color = '#ef4444';
      }
    }

    /** Helper: set text content of an element by selector */
    _setText(selector, text) {
      var el = document.querySelector(selector);
      if (el) el.textContent = text;
    }

    /** Cleanup charts */
    destroy() {
      if (this.epsChart) { this.epsChart.destroy(); this.epsChart = null; }
      if (this.tempChart) { this.tempChart.destroy(); this.tempChart = null; }
      if (this.commsChart) { this.commsChart.destroy(); this.commsChart = null; }
    }
  }

  window.ChartManager = ChartManager;
})(window);
