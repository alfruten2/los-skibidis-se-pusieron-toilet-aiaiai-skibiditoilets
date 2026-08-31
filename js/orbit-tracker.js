/**
 * SUCHAI 4 — Orbital Tracker
 * Rastreador orbital 2D interactivo con Leaflet.js.
 * Soporta cambio dinámico de tema (claro/oscuro) con tiles y colores adaptativos.
 */
(function(window) {
  'use strict';

  /** Paletas de colores por tema */
  var THEME_COLORS = {
    light: {
      satellite: '#E26D5C',
      footprint: '#E26D5C',
      track: '#E26D5C',
      gsMarker: '#63519F',
      gsRange: '#63519F',
      connection: '#4A9F73',
      tiles: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2n73_1_de7c12ea6ff2bb23be8eb35e'
    },
    dark: {
      satellite: '#F07C6F',
      footprint: '#F07C6F',
      track: '#F07C6F',
      gsMarker: '#E5C07B',
      gsRange: '#E5C07B',
      connection: '#5BD48F',
      tiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2n73_1_de7c12ea6ff2bb23be8eb35e'
    }
  };

  class OrbitTracker {
    constructor(mapContainerId) {
      this.mapContainerId = mapContainerId;
      this.map = null;
      this.tileLayer = null;
      this.satMarker = null;
      this.footprint = null;
      this.groundStation = null;
      this.gsRange = null;
      this.groundTrack = null;
      this.connectionLine = null;
      this.trackUpdateCounter = 0;
      this.currentTheme = 'light';

      // Estación terrena Santiago, Chile
      this.gsLat = -33.45;
      this.gsLon = -70.67;
    }

    /** Inicializar mapa después de que el DOM esté listo */
    init() {
      var container = document.getElementById(this.mapContainerId);
      if (!container) {
        console.warn('OrbitTracker: container #' + this.mapContainerId + ' not found');
        return;
      }

      if (typeof L === 'undefined') {
        console.warn('OrbitTracker: Leaflet (L) is not loaded');
        return;
      }

      // Inyectar CSS de animación del pulso del satélite
      if (!document.getElementById('sat-pulse-style')) {
        var style = document.createElement('style');
        style.id = 'sat-pulse-style';
        style.textContent =
          '@keyframes sat-pulse {' +
          '  0%, 100% { transform: scale(1); }' +
          '  50% { transform: scale(1.3); }' +
          '}';
        document.head.appendChild(style);
      }

      var colors = THEME_COLORS[this.currentTheme];

      // Crear mapa con límites estrictos
      this.map = L.map(this.mapContainerId, {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 8,
        maxBounds: [[-85, -180], [85, 180]],
        maxBoundsViscosity: 1.0,
        zoomAnimation: false
      });

      // Capa de tiles
      this.tileLayer = L.tileLayer(colors.tiles, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18,
        noWrap: true
      }).addTo(this.map);

      // Marcador del satélite
      this.satMarker = L.marker([0, 0], {
        icon: this._createSatIcon(colors.satellite)
      }).addTo(this.map);
      this.satMarker.bindTooltip('SUCHAI 4', { permanent: false, direction: 'top', offset: [0, -10] });

      // Huella de cobertura del satélite (~2500 km)
      this.footprint = L.circle([0, 0], {
        radius: 2500000,
        color: colors.footprint,
        fillColor: colors.footprint,
        fillOpacity: 0.06,
        opacity: 0.25,
        weight: 1
      }).addTo(this.map);

      // Marcador de estación terrena (Santiago)
      this.groundStation = L.marker([this.gsLat, this.gsLon], {
        icon: this._createGSIcon(colors.gsMarker)
      }).addTo(this.map);
      this.groundStation.bindTooltip('Estación Terrena — Santiago', { permanent: false, direction: 'top' });

      // Rango de recepción de la estación terrena
      this.gsRange = L.circle([this.gsLat, this.gsLon], {
        radius: 2000000,
        color: colors.gsRange,
        fillColor: colors.gsRange,
        fillOpacity: 0.04,
        opacity: 0.2,
        weight: 1
      }).addTo(this.map);

      // Traza orbital (ground track)
      this.groundTrack = L.polyline([], {
        color: colors.track,
        opacity: 0.35,
        weight: 2,
        dashArray: '5 10'
      }).addTo(this.map);

      // Línea de conexión (satélite ↔ estación terrena)
      this.connectionLine = L.polyline([], {
        color: colors.connection,
        weight: 1.5,
        dashArray: '8 4',
        opacity: 0.6
      }).addTo(this.map);
    }

    /** Crear icono del satélite */
    _createSatIcon(color) {
      return L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;background:' + color + ';border-radius:50%;' +
              'box-shadow:0 0 12px ' + color + ',0 0 24px ' + color + '40;' +
              'animation:sat-pulse 2s ease-in-out infinite;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }

    /** Crear icono de la estación terrena */
    _createGSIcon(color) {
      return L.divIcon({
        className: '',
        html: '<div style="width:10px;height:10px;background:' + color + ';border-radius:50%;' +
              'box-shadow:0 0 8px ' + color + ';"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });
    }

    /**
     * Cambiar tema del mapa dinámicamente.
     * @param {string} theme - 'light' o 'dark'
     */
    setTheme(theme) {
      if (!this.map) return;
      if (theme !== 'light' && theme !== 'dark') return;

      this.currentTheme = theme;
      var colors = THEME_COLORS[theme];

      // Reemplazar capa de tiles
      if (this.tileLayer) {
        this.map.removeLayer(this.tileLayer);
      }
      this.tileLayer = L.tileLayer(colors.tiles, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18,
        noWrap: true
      }).addTo(this.map);

      // Actualizar marcador del satélite
      if (this.satMarker) {
        this.satMarker.setIcon(this._createSatIcon(colors.satellite));
      }

      // Actualizar huella de cobertura
      if (this.footprint) {
        this.footprint.setStyle({
          color: colors.footprint,
          fillColor: colors.footprint
        });
      }

      // Actualizar marcador de estación terrena
      if (this.groundStation) {
        this.groundStation.setIcon(this._createGSIcon(colors.gsMarker));
      }

      // Actualizar rango de recepción
      if (this.gsRange) {
        this.gsRange.setStyle({
          color: colors.gsRange,
          fillColor: colors.gsRange
        });
      }

      // Actualizar traza orbital
      if (this.groundTrack) {
        this.groundTrack.setStyle({ color: colors.track });
      }

      // Actualizar línea de conexión
      if (this.connectionLine) {
        this.connectionLine.setStyle({ color: colors.connection });
      }
    }

    /**
     * Actualizar mapa con datos de telemetría.
     * @param {Object} data - Datos de telemetría
     * @returns {{ inRange: boolean, distance: number } | null} Estado AOS/LOS
     */
    update(data) {
      if (!this.map || !data || !data.orbit) return null;

      var lat = data.orbit.latitude;
      var lon = data.orbit.longitude;
      var alt = data.orbit.altitude || 500;
      var vel = data.orbit.velocity || 7.6;
      var orbitNum = data.orbit.orbitNumber || 0;
      var inEclipse = data.orbit.inEclipse || false;
      var period = data.orbit.period || 5700;

      // Mover marcador del satélite y huella
      this.satMarker.setLatLng([lat, lon]);
      this.footprint.setLatLng([lat, lon]);

      // Actualizar traza orbital cada 5 ticks (rendimiento)
      this.trackUpdateCounter++;
      if (this.trackUpdateCounter % 5 === 0) {
        this._updateGroundTrack(lat, lon, period);
      }

      // Línea de conexión: dibujar cuando el satélite está en rango de Santiago
      var distMeters = this.map.distance([lat, lon], [this.gsLat, this.gsLon]);
      var distKm = distMeters / 1000;
      var inRange = distKm < 2500;

      if (inRange) {
        this.connectionLine.setLatLngs([[lat, lon], [this.gsLat, this.gsLon]]);
      } else {
        this.connectionLine.setLatLngs([]);
      }

      // Actualizar información orbital en el DOM
      this._setText('lat-value',
        Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S'));
      this._setText('lon-value',
        Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W'));
      this._setText('alt-value', alt.toFixed(1) + ' km');
      this._setText('vel-value', vel.toFixed(2) + ' km/s');
      this._setText('orbit-number', 'Órbita #' + orbitNum);
      this._setText('eclipse-status', inEclipse ? 'EN SOMBRA' : 'EN SOL');

      // Retornar estado AOS/LOS
      return {
        inRange: inRange,
        distance: distKm
      };
    }

    /** Calcular y dibujar traza orbital sinusoidal */
    _updateGroundTrack(currentLat, currentLon, period) {
      var segments = [];
      var currentSegment = [];
      var prevLon = null;

      for (var i = -100; i <= 100; i++) {
        var frac = i / 200;
        var angle = 2 * Math.PI * frac;

        // Latitud desde la inclinación orbital
        var pLat = 82.5 * Math.sin(angle);

        // Progresión de longitud con corrección de rotación terrestre
        var earthRotCorrection = (frac * 360 * period / 86400);
        var lonOffset = (frac * 360) - earthRotCorrection;
        var pLon = currentLon + lonOffset;

        // Normalizar a -180..180
        pLon = ((pLon % 360) + 540) % 360 - 180;

        // Detectar cruce del antimeridiano → nuevo segmento
        if (prevLon !== null && Math.abs(pLon - prevLon) > 180) {
          if (currentSegment.length > 1) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }

        currentSegment.push([pLat, pLon]);
        prevLon = pLon;
      }

      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }

      // Usar multi-polilínea para manejar el wrapping
      this.groundTrack.setLatLngs(segments);
    }

    /** Helper: establecer texto de elemento por ID */
    _setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    /** Limpieza */
    destroy() {
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
      var style = document.getElementById('sat-pulse-style');
      if (style) style.remove();
    }
  }

  window.OrbitTracker = OrbitTracker;
})(window);
