/**
 * SUCHAI 4 — Controlador Principal de Aplicación (v2.0)
 *
 * Integra: TelemetrySimulator, ChartManager, OrbitTracker, SatNOGSClient.
 * La simulación avanza a velocidad de demostración fija (8× tiempo real),
 * permitiendo apreciar un ciclo orbital completo (~12 min) en una presentación.
 * No hay controles manuales de modo ni Time Warp — el satélite se comporta
 * de forma autónoma según su posición orbital real.
 */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ── Velocidad de demostración (8 segundos de órbita por cada 1 s real) ──
  // Una órbita completa (5700 s) ocurre en ~712 s reales (~12 min).
  var SIM_SPEED = 8;

  // ── Instanciar módulos ──────────────────────────────────────────────────
  var telemetry = new TelemetrySimulator();
  var charts    = new ChartManager();
  var orbit     = new OrbitTracker('orbit-map');

  charts.init();
  orbit.init();

  // ── Sistema de Temas ────────────────────────────────────────────────────
  var themeToggle  = document.getElementById('theme-toggle');
  var themeIcon    = document.getElementById('theme-icon');
  var currentTheme = localStorage.getItem('suchai-theme') || 'light';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
    localStorage.setItem('suchai-theme', theme);
    currentTheme = theme;
    if (orbit  && orbit.setTheme)  orbit.setTheme(theme);
    if (charts && charts.setTheme) charts.setTheme(theme);
  }

  applyTheme(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Reloj UTC ───────────────────────────────────────────────────────────
  var utcClockEl = document.getElementById('utc-clock');
  function updateUTCClock() {
    if (!utcClockEl) return;
    var n = new Date();
    utcClockEl.textContent =
      ('0' + n.getUTCHours()).slice(-2) + ':' +
      ('0' + n.getUTCMinutes()).slice(-2) + ':' +
      ('0' + n.getUTCSeconds()).slice(-2) + ' UTC';
  }

  // ── Tiempo de Misión Transcurrido (MET) ────────────────────────────────
  var metEl      = document.getElementById('met-counter');
  var launchDate = new Date('2024-03-01T00:00:00Z');
  function updateMET() {
    if (!metEl) return;
    var diff = Math.floor((new Date() - launchDate) / 1000);
    var d = Math.floor(diff / 86400), r = diff % 86400;
    var h = Math.floor(r / 3600);   r %= 3600;
    var m = Math.floor(r / 60),     s = r % 60;
    metEl.textContent = d + 'd ' +
      ('0' + h).slice(-2) + ':' +
      ('0' + m).slice(-2) + ':' +
      ('0' + s).slice(-2);
  }

  updateUTCClock(); updateMET();
  setInterval(updateUTCClock, 1000);
  setInterval(updateMET,      1000);

  // ── Elementos KPI del Ribbon ────────────────────────────────────────────
  var quickBattery  = document.getElementById('quick-battery-val');
  var quickAltitude = document.getElementById('quick-altitude-val');
  var quickSpeed    = document.getElementById('quick-speed-val');
  var quickCurrent  = document.getElementById('quick-current-val');
  var quickPnet     = document.getElementById('quick-pnet-val');
  var quickMode     = document.getElementById('quick-mode-val');

  // ── Elementos AOS/LOS ──────────────────────────────────────────────────
  var aosIndicator = document.getElementById('aos-indicator');
  var aosText      = document.getElementById('aos-text');
  var statusBadge  = document.getElementById('status-badge');
  var statusText   = document.getElementById('status-text');

  // ── Bucle Principal ─────────────────────────────────────────────────────
  // Se ejecuta cada 1 segundo real → avanza SIM_SPEED segundos de simulación
  function mainLoop() {
    telemetry.update(SIM_SPEED);
    var data = telemetry.getData();

    charts.update(data);
    var aosResult = orbit.update(data);

    // ── AOS / LOS ────────────────────────────────────────────────────────
    if (aosResult && aosIndicator && aosText) {
      if (aosResult.inRange) {
        aosIndicator.className = 'aos-indicator in-range';
        aosText.textContent    = 'AOS — ' + aosResult.distance.toFixed(0) + ' km';
      } else {
        aosIndicator.className = 'aos-indicator out-of-range';
        aosText.textContent    = 'LOS — ' + aosResult.distance.toFixed(0) + ' km';
      }
    }

    if (aosResult) {
      var isOnline = aosResult.inRange;
      if (statusBadge) statusBadge.className = 'status-badge ' + (isOnline ? 'online' : 'offline');
      if (statusText)  statusText.textContent = isOnline ? 'ENLACE ACTIVO' : 'SIN ENLACE';
    }

    // ── KPIs del Ribbon ──────────────────────────────────────────────────
    if (quickBattery)  quickBattery.textContent  = data.eps.batteryCharge.toFixed(1) + '%';
    if (quickAltitude) quickAltitude.textContent = data.orbit.altitude.toFixed(1) + ' km';
    if (quickSpeed)    quickSpeed.textContent    = data.orbit.velocity.toFixed(2) + ' km/s';
    if (quickCurrent)  quickCurrent.textContent  = data.eps.currentDraw.toFixed(0) + ' mA';

    // P_NET con color semántico: positivo = cargando (verde/ámbar), negativo = descargando (rojo)
    if (quickPnet && data.eps.netCurrent !== undefined) {
      var net = data.eps.netCurrent;
      quickPnet.textContent = (net >= 0 ? '+' : '') + net.toFixed(0) + ' mA';
      quickPnet.style.color = net > 15 ? 'var(--accent-green)' :
                              net < -15 ? 'var(--accent-red)' : 'var(--accent-amber)';
    }

    // ESTADO orbital (Sol / Sombra) con color reactivo
    if (quickMode) {
      var inEcl = data.orbit.inEclipse;
      quickMode.textContent = inEcl ? 'SOMBRA' : 'EN SOL';
      quickMode.style.color = inEcl ? 'var(--accent-secondary)' : 'var(--accent-amber)';
    }
  }

  mainLoop();
  setInterval(mainLoop, 1000);

  // ── Modal de Información ────────────────────────────────────────────────
  var btnInfo      = document.getElementById('btn-info');
  var modalOverlay = document.getElementById('modal-overlay');
  var btnCloseModal = document.getElementById('btn-close-modal');

  if (btnInfo && modalOverlay) {
    btnInfo.addEventListener('click', function() {
      modalOverlay.classList.add('active');
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }
  if (btnCloseModal && modalOverlay) {
    btnCloseModal.addEventListener('click', function() {
      modalOverlay.classList.remove('active');
    });
  }

  // ── Integración SatNOGS Network API ────────────────────────────────────
  var satnogsRenderer       = new SatNOGSRenderer();
  var satnogsStationMarkers = [];

  var satnogsClient = new SatNOGSClient({
    onUpdate: function(observations, stats) {
      satnogsRenderer.renderObservations(observations);
      satnogsRenderer.renderStats(stats);

      // Dibujar estaciones en el mapa orbital
      if (orbit && orbit.map) {
        satnogsStationMarkers.forEach(function(m) { orbit.map.removeLayer(m); });
        satnogsStationMarkers = [];
        var markers = satnogsRenderer.renderStationsOnMap(observations, orbit.map);
        if (markers) {
          markers.forEach(function(m) { m.addTo(orbit.map); });
          satnogsStationMarkers = markers;
        }
      }
    },
    onError: function(err) {
      // Silencioso: la UI no muestra error rojo — simplemente carga datos locales
      console.warn('[SatNOGS] API no disponible, cargando datos locales.', err.message);
      _loadLocalObservations();
    },
    onStatusChange: function(status) {
      satnogsRenderer.renderStatus(status);
    }
  });

  // Carga transparente de datos locales (fallback sin error visible)
  function _loadLocalObservations() {
    fetch('data/observations.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        satnogsClient._observations = data;
        satnogsClient._computeStats();
        satnogsClient._setStatus('ready');
        satnogsRenderer.renderObservations(data);
        satnogsRenderer.renderStats(satnogsClient.getStats());

        if (orbit && orbit.map) {
          satnogsStationMarkers.forEach(function(m) { orbit.map.removeLayer(m); });
          satnogsStationMarkers = [];
          var markers = satnogsRenderer.renderStationsOnMap(data, orbit.map);
          if (markers) {
            markers.forEach(function(m) { m.addTo(orbit.map); });
            satnogsStationMarkers = markers;
          }
        }
      })
      .catch(function(err) {
        console.error('[SatNOGS] No se pudo cargar data/observations.json:', err);
      });
  }

  // Botón manual de actualización desde la API
  var btnSatnogsRefresh = document.getElementById('btn-satnogs-refresh');
  if (btnSatnogsRefresh) {
    btnSatnogsRefresh.addEventListener('click', function() {
      btnSatnogsRefresh.disabled = true;
      btnSatnogsRefresh.textContent = 'Conectando…';
      satnogsClient.refresh().then(function() {
        btnSatnogsRefresh.textContent = 'Actualizar datos';
        btnSatnogsRefresh.disabled = false;
      }).catch(function() {
        btnSatnogsRefresh.textContent = 'Actualizar datos';
        btnSatnogsRefresh.disabled = false;
      });
    });
  }

  // Botón de datos locales
  var btnSatnogsLocal = document.getElementById('btn-satnogs-local');
  if (btnSatnogsLocal) {
    btnSatnogsLocal.addEventListener('click', function() {
      btnSatnogsLocal.disabled = true;
      btnSatnogsLocal.textContent = 'Cargando…';
      _loadLocalObservations();
      setTimeout(function() {
        btnSatnogsLocal.textContent = 'Datos locales';
        btnSatnogsLocal.disabled = false;
      }, 800);
    });
  }

  // Auto-inicio: intenta API primero; si falla → datos locales automáticamente
  satnogsClient.start().catch(function() {
    _loadLocalObservations();
  });

  // ── Consola de Bienvenida ───────────────────────────────────────────────
  console.log('%cSUCHAI 4 — Ground Station Dashboard', 'color:#E26D5C;font-size:14px;font-weight:bold;');
  console.log('%cSimulación física coherente activa. Velocidad: ' + SIM_SPEED + '× tiempo real.', 'color:#8A7F82;');
  console.log('%cSatNOGS Network API integrada con fallback automático a datos locales.', 'color:#E5C07B;');
});
