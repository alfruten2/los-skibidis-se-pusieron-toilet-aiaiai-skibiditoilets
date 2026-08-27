/**
 * SUCHAI 4 — Main Application Controller
 * Ties together all modules: TelemetrySimulator, ChartManager,
 * OrbitTracker, and TerminalLog. Manages the main update loop,
 * clocks, demo mode buttons, and modal.
 */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ── Instantiate modules ──────────────────────────────────
  var telemetry = new TelemetrySimulator();
  var charts = new ChartManager();
  var orbit = new OrbitTracker('orbit-map');
  var terminal = new TerminalLog('terminal-output');

  // ── Initialize modules ───────────────────────────────────
  charts.init();
  orbit.init();
  terminal.init();

  // ── UTC Clock ────────────────────────────────────────────
  var utcClockEl = document.getElementById('utc-clock');

  function updateUTCClock() {
    if (!utcClockEl) return;
    var now = new Date();
    var h = ('0' + now.getUTCHours()).slice(-2);
    var m = ('0' + now.getUTCMinutes()).slice(-2);
    var s = ('0' + now.getUTCSeconds()).slice(-2);
    utcClockEl.textContent = h + ':' + m + ':' + s + ' UTC';
  }

  // ── Mission Elapsed Time ─────────────────────────────────
  var metEl = document.getElementById('met-counter');
  var launchDate = new Date('2024-03-01T00:00:00Z');

  function updateMET() {
    if (!metEl) return;
    var now = new Date();
    var diff = Math.floor((now - launchDate) / 1000); // seconds

    var days = Math.floor(diff / 86400);
    var rem = diff % 86400;
    var hours = Math.floor(rem / 3600);
    rem = rem % 3600;
    var mins = Math.floor(rem / 60);
    var secs = rem % 60;

    metEl.textContent =
      days + 'd ' +
      ('0' + hours).slice(-2) + ':' +
      ('0' + mins).slice(-2) + ':' +
      ('0' + secs).slice(-2);
  }

  // Run clocks immediately and every second
  updateUTCClock();
  updateMET();
  setInterval(updateUTCClock, 1000);
  setInterval(updateMET, 1000);

  // ── Quick Stats Elements ─────────────────────────────────
  var quickBattery = document.getElementById('quick-battery-val');
  var quickAltitude = document.getElementById('quick-altitude-val');
  var quickSpeed = document.getElementById('quick-speed-val');
  var quickCurrent = document.getElementById('quick-current-val');
  var quickMode = document.getElementById('quick-mode-val');

  var modeNames = {
    'nominal': 'Nominal',
    'eclipse': 'Eclipse',
    'payload-download': 'Descarga Payload'
  };

  // ── Main Update Loop (1 second interval) ─────────────────
  var tickCounter = 0;

  function mainLoop() {
    telemetry.update(1);
    var data = telemetry.getData();

    // Update charts
    charts.update(data);

    // Update orbit tracker
    orbit.update(data);

    // Update terminal every 3 ticks
    tickCounter++;
    if (tickCounter % 3 === 0) {
      terminal.addFrame(data);
    }

    // Update quick stats
    if (quickBattery) quickBattery.textContent = data.eps.batteryCharge.toFixed(0) + '%';
    if (quickAltitude) quickAltitude.textContent = data.orbit.altitude.toFixed(1) + ' km';
    if (quickSpeed) quickSpeed.textContent = data.orbit.velocity.toFixed(2) + ' km/s';
    if (quickCurrent) quickCurrent.textContent = data.eps.currentDraw.toFixed(0) + ' mA';
    if (quickMode) quickMode.textContent = modeNames[data.mode] || data.mode;
  }

  // Run first tick immediately, then every second
  mainLoop();
  setInterval(mainLoop, 1000);

  // ── Demo Mode Buttons ────────────────────────────────────
  var btnNominal = document.getElementById('btn-nominal');
  var btnEclipse = document.getElementById('btn-eclipse');
  var btnPayload = document.getElementById('btn-payload');
  var allModeButtons = [btnNominal, btnEclipse, btnPayload];

  function setActiveButton(activeBtn) {
    allModeButtons.forEach(function(btn) {
      if (btn) btn.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (btnNominal) {
    btnNominal.addEventListener('click', function() {
      telemetry.setMode('nominal');
      setActiveButton(btnNominal);
    });
  }

  if (btnEclipse) {
    btnEclipse.addEventListener('click', function() {
      telemetry.setMode('eclipse');
      setActiveButton(btnEclipse);
    });
  }

  if (btnPayload) {
    btnPayload.addEventListener('click', function() {
      telemetry.setMode('payload-download');
      setActiveButton(btnPayload);
    });
  }

  // ── Terminal Clear Button ────────────────────────────────
  var btnClear = document.getElementById('btn-clear-terminal');
  if (btnClear) {
    btnClear.addEventListener('click', function() {
      terminal.clear();
    });
  }

  // ── Info Modal ───────────────────────────────────────────
  var btnInfo = document.getElementById('btn-info');
  var modalOverlay = document.getElementById('modal-overlay');
  var btnCloseModal = document.getElementById('btn-close-modal');

  if (btnInfo && modalOverlay) {
    btnInfo.addEventListener('click', function() {
      modalOverlay.classList.add('active');
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    });
  }

  if (btnCloseModal && modalOverlay) {
    btnCloseModal.addEventListener('click', function() {
      modalOverlay.classList.remove('active');
    });
  }

  // ── Initial log message ──────────────────────────────────
  console.log('%c🛰️ SUCHAI 4 Ground Station Dashboard', 'color: #06b6d4; font-size: 16px; font-weight: bold;');
  console.log('%cTelemetry simulation active. Use demo controls to switch modes.', 'color: #94a3b8;');
});
