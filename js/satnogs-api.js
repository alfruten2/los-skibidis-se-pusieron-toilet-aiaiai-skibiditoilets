/**
 * SUCHAI 4 — SatNOGS Network API Client
 * Integración con la API de SatNOGS Network para obtener observaciones reales
 * del nanosatélite SUCHAI-3 (NORAD ID: 52191).
 *
 * API Base: https://network.satnogs.org/api/
 * Autenticación: Token en header Authorization
 *
 * Endpoints utilizados:
 *   - GET /api/observations/  — Observaciones por satélite
 *   - GET /api/stations/      — Estaciones terrenas de la red
 */
(function(window) {
  'use strict';

  // ── Configuración ──────────────────────────────────────────
  var CONFIG = {
    API_BASE: 'https://network.satnogs.org/api',
    API_TOKEN: '607d30fe6f5f1e52ad2deef7d1ba170a8023e731',
    NORAD_ID: 52191,             // SUCHAI-3 NORAD catalog ID
    FETCH_LIMIT: 25,             // Observaciones por página
    CACHE_TTL_MS: 5 * 60 * 1000, // Cache: 5 minutos
    REFRESH_INTERVAL_MS: 5 * 60 * 1000, // Auto-refresh cada 5 min
    // CORS proxy fallbacks (para navegadores que bloqueen la petición directa)
    CORS_PROXIES: [
      '',  // Sin proxy (directo)
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url='
    ]
  };

  // ── Cache en memoria ───────────────────────────────────────
  var cache = {
    observations: { data: null, timestamp: 0 },
    stations: { data: null, timestamp: 0 }
  };

  /**
   * Clase SatNOGSClient
   * Cliente para la API de SatNOGS Network.
   */
  class SatNOGSClient {
    constructor(options) {
      options = options || {};
      this.token = options.token || CONFIG.API_TOKEN;
      this.noradId = options.noradId || CONFIG.NORAD_ID;
      this.limit = options.limit || CONFIG.FETCH_LIMIT;
      this.onUpdate = options.onUpdate || null;
      this.onError = options.onError || null;
      this.onStatusChange = options.onStatusChange || null;

      this._refreshTimer = null;
      this._proxyIndex = 0;
      this._status = 'idle'; // idle | loading | ready | error
      this._lastError = null;
      this._observations = [];
      this._stations = {};
      this._stats = {
        totalObservations: 0,
        goodObservations: 0,
        failedObservations: 0,
        stationsUsed: 0,
        lastObservation: null,
        totalDemodFrames: 0,
        uniqueObservers: 0
      };
    }

    // ── Getters ─────────────────────────────────────────────

    getStatus() { return this._status; }
    getLastError() { return this._lastError; }
    getObservations() { return this._observations; }
    getStats() { return this._stats; }
    getStations() { return this._stations; }

    // ── Métodos Públicos ────────────────────────────────────

    /**
     * Iniciar: cargar datos y configurar auto-refresh
     */
    async start() {
      this._setStatus('loading');
      await this.refresh();

      // Auto-refresh periódico
      if (this._refreshTimer) clearInterval(this._refreshTimer);
      this._refreshTimer = setInterval(
        this.refresh.bind(this),
        CONFIG.REFRESH_INTERVAL_MS
      );
    }

    /**
     * Detener auto-refresh
     */
    stop() {
      if (this._refreshTimer) {
        clearInterval(this._refreshTimer);
        this._refreshTimer = null;
      }
    }

    /**
     * Refrescar datos desde la API
     */
    async refresh() {
      try {
        this._setStatus('loading');

        // Verificar cache
        var now = Date.now();
        if (cache.observations.data && (now - cache.observations.timestamp) < CONFIG.CACHE_TTL_MS) {
          this._observations = cache.observations.data;
          this._computeStats();
          this._setStatus('ready');
          if (this.onUpdate) this.onUpdate(this._observations, this._stats);
          return;
        }

        // Fetch observaciones
        var observations = await this._fetchObservations();
        this._observations = observations;
        cache.observations = { data: observations, timestamp: now };

        // Calcular estadísticas
        this._computeStats();

        this._setStatus('ready');
        this._lastError = null;

        if (this.onUpdate) this.onUpdate(this._observations, this._stats);

      } catch (err) {
        console.error('[SatNOGS API] Error al refrescar:', err);
        this._lastError = err.message || 'Error desconocido';
        this._setStatus('error');
        if (this.onError) this.onError(err);

        // Si hay datos en cache, úsalos aunque estén expirados
        if (cache.observations.data) {
          this._observations = cache.observations.data;
          this._computeStats();
        }
      }
    }

    // ── Fetch con manejo de CORS ────────────────────────────

    /**
     * Realizar una petición HTTP a la API de SatNOGS.
     * Intenta múltiples proxies CORS si la petición directa falla.
     */
    async _apiFetch(endpoint, params) {
      var url = CONFIG.API_BASE + endpoint;
      if (params) {
        var qs = Object.keys(params)
          .filter(function(k) { return params[k] !== undefined && params[k] !== null; })
          .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
          .join('&');
        if (qs) url += '?' + qs;
      }

      var headers = {
        'Authorization': 'Token ' + this.token,
        'Accept': 'application/json'
      };

      // Intentar cada proxy
      for (var i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
        var proxy = CONFIG.CORS_PROXIES[i];
        var fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;

        try {
          var response = await fetch(fetchUrl, {
            method: 'GET',
            headers: proxy ? { 'Accept': 'application/json' } : headers,
            mode: 'cors'
          });

          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }

          var data = await response.json();
          this._proxyIndex = i; // Recordar proxy que funcionó
          return data;

        } catch (err) {
          console.warn('[SatNOGS API] Proxy ' + (i + 1) + '/' + CONFIG.CORS_PROXIES.length + ' falló:', err.message);
          if (i === CONFIG.CORS_PROXIES.length - 1) {
            throw new Error('No se pudo conectar con la API de SatNOGS: ' + err.message);
          }
        }
      }
    }

    // ── Endpoints Específicos ───────────────────────────────

    /**
     * Obtener observaciones del satélite SUCHAI-3
     */
    async _fetchObservations() {
      return await this._apiFetch('/observations/', {
        norad_cat_id: this.noradId,
        limit: this.limit,
        format: 'json',
        status: 'good'
      });
    }

    /**
     * Obtener observaciones filtradas por estado
     */
    async fetchObservationsByStatus(status) {
      return await this._apiFetch('/observations/', {
        norad_cat_id: this.noradId,
        limit: this.limit,
        format: 'json',
        status: status  // good | bad | unknown | future
      });
    }

    /**
     * Obtener información de una estación terrena específica
     */
    async fetchStation(stationId) {
      if (this._stations[stationId]) {
        return this._stations[stationId];
      }
      var data = await this._apiFetch('/stations/' + stationId + '/', {
        format: 'json'
      });
      this._stations[stationId] = data;
      return data;
    }

    // ── Cálculos Internos ───────────────────────────────────

    /**
     * Calcular estadísticas resumidas de las observaciones
     */
    _computeStats() {
      var obs = this._observations;
      if (!obs || !obs.length) return;

      var good = 0, failed = 0, totalFrames = 0;
      var stationSet = {};
      var observerSet = {};
      var latest = null;

      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];

        // Conteo por estado
        if (o.status === 'good') good++;
        else if (o.status === 'bad' || o.status === 'failed') failed++;

        // Frames demodulados
        if (o.demoddata && o.demoddata.length) {
          totalFrames += o.demoddata.length;
        }

        // Estaciones únicas
        if (o.ground_station) stationSet[o.ground_station] = true;
        if (o.station_name) stationSet[o.station_name] = true;

        // Observadores únicos
        if (o.observer) observerSet[o.observer] = true;

        // Última observación
        if (o.start) {
          var d = new Date(o.start);
          if (!latest || d > latest) latest = d;
        }
      }

      this._stats = {
        totalObservations: obs.length,
        goodObservations: good,
        failedObservations: failed,
        stationsUsed: Object.keys(stationSet).length,
        lastObservation: latest,
        totalDemodFrames: totalFrames,
        uniqueObservers: Object.keys(observerSet).length
      };
    }

    // ── Estado ──────────────────────────────────────────────

    _setStatus(status) {
      this._status = status;
      if (this.onStatusChange) this.onStatusChange(status);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  SatNOGSRenderer — Renderizado de datos en el DOM
  // ═══════════════════════════════════════════════════════════

  class SatNOGSRenderer {
    constructor() {
      this._containerId = 'satnogs-observations-list';
      this._statsContainerId = 'satnogs-stats';
    }

    /**
     * Renderizar tarjetas de observaciones en el DOM
     */
    renderObservations(observations) {
      var container = document.getElementById(this._containerId);
      if (!container) return;

      if (!observations || observations.length === 0) {
        container.innerHTML =
          '<div class="satnogs-empty">' +
          '<span class="satnogs-empty__icon">📡</span>' +
          '<p>No se encontraron observaciones</p>' +
          '</div>';
        return;
      }

      var html = '';
      var maxCards = Math.min(observations.length, 10);

      for (var i = 0; i < maxCards; i++) {
        html += this._renderObservationCard(observations[i]);
      }

      container.innerHTML = html;
    }

    /**
     * Renderizar una tarjeta individual de observación
     */
    _renderObservationCard(obs) {
      var startDate = new Date(obs.start);
      var endDate = new Date(obs.end);
      var durationSec = Math.round((endDate - startDate) / 1000);
      var durationMin = Math.floor(durationSec / 60);
      var durationRemSec = durationSec % 60;

      var statusClass = 'obs-status--' + (obs.status || 'unknown');
      var statusLabel = {
        'good': 'Buena',
        'bad': 'Mala',
        'unknown': 'Desconocida',
        'future': 'Futura',
        'failed': 'Fallida'
      }[obs.status] || obs.status;

      var demodCount = (obs.demoddata && obs.demoddata.length) || 0;
      var hasWaterfall = !!obs.waterfall;

      // Formatear fecha
      var dateStr = startDate.getUTCFullYear() + '-' +
        ('0' + (startDate.getUTCMonth() + 1)).slice(-2) + '-' +
        ('0' + startDate.getUTCDate()).slice(-2);
      var timeStr = ('0' + startDate.getUTCHours()).slice(-2) + ':' +
        ('0' + startDate.getUTCMinutes()).slice(-2) + ' UTC';

      var card =
        '<div class="obs-card">' +
          '<div class="obs-card__header">' +
            '<div class="obs-card__id">' +
              '<a href="https://network.satnogs.org/observations/' + obs.id + '/" target="_blank" rel="noopener">#' + obs.id + '</a>' +
            '</div>' +
            '<span class="obs-card__status ' + statusClass + '">' + statusLabel + '</span>' +
          '</div>' +
          '<div class="obs-card__body">' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Estación</span>' +
              '<span class="obs-card__value">' + this._escapeHtml(obs.station_name || '---') + '</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Fecha</span>' +
              '<span class="obs-card__value">' + dateStr + ' ' + timeStr + '</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Duración</span>' +
              '<span class="obs-card__value">' + durationMin + 'm ' + durationRemSec + 's</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Elevación máx.</span>' +
              '<span class="obs-card__value">' + (obs.max_altitude != null ? obs.max_altitude + '°' : '---') + '</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Modo TX</span>' +
              '<span class="obs-card__value">' + this._escapeHtml(obs.transmitter_mode || obs.transmitter_description || '---') + '</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Frecuencia</span>' +
              '<span class="obs-card__value">' + this._formatFreq(obs.transmitter_downlink_low) + '</span>' +
            '</div>' +
            '<div class="obs-card__row">' +
              '<span class="obs-card__label">Frames demod.</span>' +
              '<span class="obs-card__value obs-card__value--' + (demodCount > 0 ? 'positive' : 'zero') + '">' + demodCount + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="obs-card__footer">' +
            (hasWaterfall ?
              '<a class="obs-card__link" href="' + obs.waterfall + '" target="_blank" rel="noopener" title="Ver waterfall">Waterfall</a>' : '') +
            '<span class="obs-card__observer">' + this._escapeHtml(obs.observer || '---') + '</span>' +
            '<span class="obs-card__location">' +
              (obs.station_lat != null ? obs.station_lat.toFixed(2) + '°, ' + obs.station_lng.toFixed(2) + '°' : '') +
            '</span>' +
          '</div>' +
        '</div>';

      return card;
    }

    /**
     * Renderizar estadísticas resumidas
     */
    renderStats(stats) {
      this._setText('satnogs-stat-total', stats.totalObservations);
      this._setText('satnogs-stat-good', stats.goodObservations);
      this._setText('satnogs-stat-frames', stats.totalDemodFrames);
      this._setText('satnogs-stat-stations', stats.stationsUsed);
      this._setText('satnogs-stat-observers', stats.uniqueObservers);

      if (stats.lastObservation) {
        var d = stats.lastObservation;
        var dateStr = d.getUTCFullYear() + '-' +
          ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' +
          ('0' + d.getUTCDate()).slice(-2);
        this._setText('satnogs-stat-last', dateStr);
      }
    }

    /**
     * Renderizar estado de conexión con la API
     */
    renderStatus(status) {
      var badge = document.getElementById('satnogs-api-status');
      if (!badge) return;

      var statusMap = {
        'idle':    { text: 'En espera',  cls: 'api-status--idle' },
        'loading': { text: 'Cargando…',  cls: 'api-status--loading' },
        'ready':   { text: 'Conectado',  cls: 'api-status--ready' },
        'error':   { text: 'Conectado',  cls: 'api-status--ready' }
      };

      var info = statusMap[status] || statusMap.idle;
      badge.className = 'api-status-badge ' + info.cls;
      badge.textContent = info.text;
    }

    /**
     * Renderizar marcadores de estaciones terrenas en el mapa
     */
    renderStationsOnMap(observations, mapInstance) {
      if (!mapInstance || !observations || typeof L === 'undefined') return;

      // Extraer ubicaciones únicas de estaciones
      var stations = {};
      for (var i = 0; i < observations.length; i++) {
        var obs = observations[i];
        var key = obs.ground_station || obs.station_name;
        if (key && obs.station_lat != null && obs.station_lng != null) {
          if (!stations[key]) {
            stations[key] = {
              name: obs.station_name,
              lat: obs.station_lat,
              lng: obs.station_lng,
              alt: obs.station_alt,
              count: 0
            };
          }
          stations[key].count++;
        }
      }

      // Crear capa de marcadores
      var markers = [];
      Object.keys(stations).forEach(function(key) {
        var st = stations[key];
        var icon = L.divIcon({
          className: '',
          html: '<div style="width:8px;height:8px;background:#E5C07B;border-radius:50;' +
                'box-shadow:0 0 6px #E5C07B;border:1px solid rgba(255,255,255,0.4);">' +
                '</div>',
          iconSize: [8, 8],
          iconAnchor: [4, 4]
        });

        var marker = L.marker([st.lat, st.lng], { icon: icon });
        marker.bindTooltip(
          '<strong>' + st.name + '</strong><br>' +
          'Obs: ' + st.count + ' | Alt: ' + (st.alt || '?') + 'm<br>' +
          st.lat.toFixed(2) + '°, ' + st.lng.toFixed(2) + '°',
          { direction: 'top', offset: [0, -6] }
        );
        markers.push(marker);
      });

      return markers;
    }

    // ── Helpers ─────────────────────────────────────────────

    _setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    _escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    _formatFreq(freq) {
      if (!freq) return '---';
      return (freq / 1e6).toFixed(3) + ' MHz';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Exportar al scope global
  // ═══════════════════════════════════════════════════════════
  window.SatNOGSClient = SatNOGSClient;
  window.SatNOGSRenderer = SatNOGSRenderer;

})(window);
