/**
 * SUCHAI 4 — Orbital Tracker
 * Interactive 2D map showing satellite ground track, footprint,
 * and ground station using Leaflet.js.
 */
(function(window) {
  'use strict';

  class OrbitTracker {
    constructor(mapContainerId) {
      this.mapContainerId = mapContainerId;
      this.map = null;
      this.satMarker = null;
      this.footprint = null;
      this.groundStation = null;
      this.gsRange = null;
      this.groundTrack = null;
      this.connectionLine = null;
      this.trackUpdateCounter = 0;

      // Santiago, Chile ground station coordinates
      this.gsLat = -33.45;
      this.gsLon = -70.67;
    }

    /** Initialize map after DOM is ready */
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

      // Inject satellite pulse animation CSS
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

      // Create map
      this.map = L.map(this.mapContainerId, {
        center: [0, 0],
        zoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0,
        worldCopyJump: true,
        zoomAnimation: false
      });

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_2c4h_1_99ce1ce766e0e07dc470ffaf', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18
      }).addTo(this.map);

      // ── Satellite marker ──
      var satIcon = L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;background:#06b6d4;border-radius:50%;' +
              'box-shadow:0 0 12px #06b6d4,0 0 24px rgba(6,182,212,0.4);' +
              'animation:sat-pulse 2s ease-in-out infinite;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      this.satMarker = L.marker([0, 0], { icon: satIcon }).addTo(this.map);
      this.satMarker.bindTooltip('🛰️ SUCHAI 4', { permanent: false, direction: 'top', offset: [0, -10] });

      // ── Satellite footprint ──
      this.footprint = L.circle([0, 0], {
        radius: 2500000, // ~2500 km ground coverage at 500km altitude
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.06,
        opacity: 0.25,
        weight: 1
      }).addTo(this.map);

      // ── Ground station marker (Santiago) ──
      var gsIcon = L.divIcon({
        className: '',
        html: '<div style="width:10px;height:10px;background:#f59e0b;border-radius:50%;' +
              'box-shadow:0 0 8px #f59e0b;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      this.groundStation = L.marker([this.gsLat, this.gsLon], { icon: gsIcon }).addTo(this.map);
      this.groundStation.bindTooltip('📡 Estación Terrena — Santiago', { permanent: false, direction: 'top' });

      // ── Ground station reception range ──
      this.gsRange = L.circle([this.gsLat, this.gsLon], {
        radius: 2000000,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.04,
        opacity: 0.2,
        weight: 1
      }).addTo(this.map);

      // ── Ground track polyline ──
      this.groundTrack = L.polyline([], {
        color: '#06b6d4',
        opacity: 0.35,
        weight: 2,
        dashArray: '5 10'
      }).addTo(this.map);

      // ── Connection line (sat ↔ ground station when in range) ──
      this.connectionLine = L.polyline([], {
        color: '#22c55e',
        weight: 1.5,
        dashArray: '8 4',
        opacity: 0.6
      }).addTo(this.map);
    }

    /** Update map from telemetry data */
    update(data) {
      if (!this.map || !data || !data.orbit) return;

      var lat = data.orbit.latitude;
      var lon = data.orbit.longitude;
      var alt = data.orbit.altitude || 500;
      var vel = data.orbit.velocity || 7.6;
      var orbitNum = data.orbit.orbitNumber || 0;
      var inEclipse = data.orbit.inEclipse || false;
      var period = data.orbit.period || 5700;

      // Move satellite marker and footprint
      this.satMarker.setLatLng([lat, lon]);
      this.footprint.setLatLng([lat, lon]);

      // Update ground track every 5 ticks for performance
      this.trackUpdateCounter++;
      if (this.trackUpdateCounter % 5 === 0) {
        this._updateGroundTrack(lat, lon, period);
      }

      // Connection line: draw when satellite is in range of Santiago
      var dist = this.map.distance([lat, lon], [this.gsLat, this.gsLon]);
      if (dist < 2500000) {
        this.connectionLine.setLatLngs([[lat, lon], [this.gsLat, this.gsLon]]);
      } else {
        this.connectionLine.setLatLngs([]);
      }

      // ── Update orbit info DOM ──
      this._setText('lat-value',
        Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S'));
      this._setText('lon-value',
        Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W'));
      this._setText('alt-value', alt.toFixed(1) + ' km');
      this._setText('vel-value', vel.toFixed(2) + ' km/s');
      this._setText('orbit-number', 'Órbita #' + orbitNum);
      this._setText('eclipse-status', inEclipse ? 'EN SOMBRA 🌑' : 'EN SOL ☀️');
    }

    /** Calculate and draw sinusoidal ground track */
    _updateGroundTrack(currentLat, currentLon, period) {
      var points = [];
      var segments = []; // Handle anti-meridian crossings
      var currentSegment = [];
      var prevLon = null;

      for (var i = -100; i <= 100; i++) {
        var frac = i / 200;
        var angle = 2 * Math.PI * frac;

        // Latitude from orbital inclination
        var pLat = 82.5 * Math.sin(angle);

        // Longitude progression with Earth rotation correction
        var earthRotCorrection = (frac * 360 * period / 86400);
        var lonOffset = (frac * 360) - earthRotCorrection;
        var pLon = currentLon + lonOffset;

        // Normalize to -180..180
        pLon = ((pLon % 360) + 540) % 360 - 180;

        // Detect anti-meridian crossing → start new segment
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

      // Use multi-polyline to handle wrapping
      this.groundTrack.setLatLngs(segments);
    }

    /** Helper: set element text by ID */
    _setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    /** Cleanup */
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
