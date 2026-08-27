/**
 * SUCHAI 4 — Telemetry Simulator
 * Generates realistic simulated telemetry data for the CubeSat dashboard.
 * Simulates EPS, OBC, ADCS, Comms, and Orbital subsystems.
 */
(function(window) {
  'use strict';

  class TelemetrySimulator {
    constructor() {
      this.mode = 'nominal';
      this.uptime = 0;
      this.orbitTime = Math.random() * 5700; // Start at random orbit position
      this.orbitPeriod = 5700; // ~95 minutes
      this.orbitNumber = 1042; // Start at a realistic orbit count

      // Internal smoothed state
      this._state = {
        batteryCharge: 78.0,
        cpuTemp: 25.0,
        boardTemp: 20.0,
        payloadTemp: 17.0,
        cpuUsage: 22.0,
        memoryUsed: 185,
        packetsSent: 48230,
        packetsLost: 127,
        solarX: 3.5,
        solarY: 3.2,
        solarZ: 2.8,
        solarCurrent: 320,
        currentDraw: 200,
        rssi: -82,
        snr: 14
      };

      this.currentData = null;
    }

    /** Add Gaussian-ish noise to a base value */
    _noise(base, amplitude) {
      return base + (Math.random() - 0.5) * 2 * amplitude;
    }

    /** Smooth linear interpolation */
    _lerp(current, target, speed) {
      return current + (target - current) * Math.min(speed, 1.0);
    }

    /** Clamp value between min and max */
    _clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    /** Set simulation mode */
    setMode(mode) {
      if (['nominal', 'eclipse', 'payload-download'].includes(mode)) {
        this.mode = mode;
      }
    }

    /** Get current mode */
    getMode() {
      return this.mode;
    }

    /** Advance simulation by dt seconds */
    update(dt) {
      this.uptime += dt;
      this.orbitTime += dt;

      // Orbit counter
      if (this.orbitTime >= this.orbitPeriod) {
        this.orbitTime -= this.orbitPeriod;
        this.orbitNumber += 1;
      }

      const s = this._state;
      const orbitPhase = this.orbitTime / this.orbitPeriod; // 0.0 - 1.0
      const orbitAngle = orbitPhase * Math.PI * 2;

      // ─── ORBITAL MECHANICS ─────────────────────────────────
      // Ground track: sinusoidal latitude, progressing longitude
      const inclination = 97.5;
      const maxLat = 180 - inclination; // 82.5°
      const latitude = maxLat * Math.sin(orbitAngle);

      // Longitude progresses ~360° per orbit minus Earth rotation
      const earthRotationPerOrbit = (this.orbitPeriod / 86400) * 360;
      const lonProgressPerOrbit = 360 - earthRotationPerOrbit;
      let longitude = -70.67 + (orbitPhase * lonProgressPerOrbit)
                      + (this.orbitNumber * -24); // Westward shift per orbit
      // Normalize to -180..180
      longitude = ((longitude % 360) + 540) % 360 - 180;

      const altPhase = Math.sin(orbitAngle);
      const altitude = 510 + altPhase * 10; // 500-520 km
      const velocity = 7.61 - altPhase * 0.05; // 7.56-7.66 km/s

      // ─── ECLIPSE DETECTION ─────────────────────────────────
      // Eclipse roughly 35% of orbit (shadow on ~0.65-1.0 phase region)
      let inEclipse = orbitPhase > 0.65 && orbitPhase < 1.0;
      if (this.mode === 'eclipse') {
        inEclipse = true;
      }

      // ─── EPS (POWER SYSTEM) ────────────────────────────────
      const targetSolarV = inEclipse ? 0.05 : 3.8;
      const targetSolarCurrent = inEclipse ? 2 : 340;
      let targetCurrentDraw = 200; // nominal

      if (this.mode === 'payload-download') {
        targetCurrentDraw = 400;
      }

      // Smooth solar panels
      s.solarX = this._lerp(s.solarX, targetSolarV * 1.0, 0.15 * dt);
      s.solarY = this._lerp(s.solarY, targetSolarV * 0.92, 0.15 * dt);
      s.solarZ = this._lerp(s.solarZ, targetSolarV * 0.83, 0.15 * dt);
      s.solarCurrent = this._lerp(s.solarCurrent, targetSolarCurrent, 0.12 * dt);
      s.currentDraw = this._lerp(s.currentDraw, targetCurrentDraw, 0.1 * dt);

      // Battery
      if (inEclipse) {
        s.batteryCharge -= 0.015 * dt;
      } else {
        s.batteryCharge += 0.02 * dt;
      }
      if (this.mode === 'payload-download') {
        s.batteryCharge -= 0.008 * dt; // Extra drain
      }
      s.batteryCharge = this._clamp(s.batteryCharge, 5, 100);

      const batteryVoltage = 3.3 + (s.batteryCharge / 100) * 0.9;
      let batteryStatus = 'CHARGING';
      if (s.batteryCharge >= 99.5) batteryStatus = 'FULL';
      else if (inEclipse || this.mode === 'payload-download') batteryStatus = 'DISCHARGING';

      // ─── OBC (ONBOARD COMPUTER) ────────────────────────────
      let targetCpuTemp = inEclipse ? 16 : 28;
      let targetCpuUsage = 25;

      if (this.mode === 'payload-download') {
        targetCpuTemp = 42;
        targetCpuUsage = 85;
        s.memoryUsed += 3 * dt;
        if (s.memoryUsed > 500) s.memoryUsed = 500;
      } else {
        targetCpuUsage = inEclipse ? 12 : 25;
        if (s.memoryUsed > 185) {
          s.memoryUsed -= 8 * dt;
          if (s.memoryUsed < 185) s.memoryUsed = 185;
        }
      }

      s.cpuTemp = this._lerp(s.cpuTemp, targetCpuTemp, 0.04 * dt);
      s.boardTemp = this._lerp(s.boardTemp, s.cpuTemp - 5, 0.03 * dt);
      s.payloadTemp = this._lerp(s.payloadTemp, s.cpuTemp - 8, 0.03 * dt);
      s.cpuUsage = this._lerp(s.cpuUsage, targetCpuUsage, 0.08 * dt);

      // ─── ADCS ──────────────────────────────────────────────
      let attitude = 'STABLE';
      if (!inEclipse && this.mode !== 'payload-download') attitude = 'SUN-POINTING';
      if (this.mode === 'payload-download') attitude = 'STABLE';

      const gyroAmplitude = 0.5;
      const magX = 35 + Math.sin(orbitAngle) * 10;
      const magY = Math.cos(orbitAngle) * 15;
      const magZ = 37.5 + Math.cos(orbitAngle * 1.3) * 17.5;

      // ─── COMMS ─────────────────────────────────────────────
      // Better signal when closer to Santiago ground station
      const distToSantiago = Math.sqrt(
        Math.pow(latitude - (-33.45), 2) + Math.pow(longitude - (-70.67), 2)
      );
      let targetRssi = -92;
      if (distToSantiago < 50) {
        targetRssi = -68 - (distToSantiago / 50) * 12;
      } else if (distToSantiago < 100) {
        targetRssi = -80 - (distToSantiago / 100) * 8;
      }

      s.rssi = this._lerp(s.rssi, targetRssi, 0.1 * dt);
      s.snr = this._lerp(s.snr, (s.rssi + 100) / 2.2, 0.1 * dt);

      // Packet counting
      const packetsThisTick = Math.max(0, Math.floor(this._noise(2, 1)));
      s.packetsSent += packetsThisTick;
      if (Math.random() < 0.025) {
        s.packetsLost += 1;
      }

      const packetLossRate = s.packetsSent > 0
        ? (s.packetsLost / s.packetsSent) * 100 : 0;
      const dataRate = this.mode === 'payload-download' ? 19200
        : (s.rssi > -85 ? 9600 : 1200);

      if (distToSantiago < 50) {
        s.lastContact = new Date();
      }

      // ─── BUILD OUTPUT OBJECT ───────────────────────────────
      this.currentData = {
        timestamp: new Date(),
        mode: this.mode,
        eps: {
          solarPanelX: Math.max(0, this._noise(s.solarX, 0.08)),
          solarPanelY: Math.max(0, this._noise(s.solarY, 0.08)),
          solarPanelZ: Math.max(0, this._noise(s.solarZ, 0.06)),
          solarCurrent: Math.max(0, this._noise(s.solarCurrent, 8)),
          batteryVoltage: this._clamp(this._noise(batteryVoltage, 0.02), 3.3, 4.2),
          batteryCharge: s.batteryCharge,
          batteryStatus: batteryStatus,
          currentDraw: Math.max(0, this._noise(s.currentDraw, 10))
        },
        obc: {
          cpuTemp: this._noise(s.cpuTemp, 0.3),
          boardTemp: this._noise(s.boardTemp, 0.25),
          payloadTemp: this._noise(s.payloadTemp, 0.2),
          cpuUsage: this._clamp(this._noise(s.cpuUsage, 3), 2, 98),
          memoryUsed: Math.floor(s.memoryUsed),
          uptime: this.uptime
        },
        adcs: {
          gyroX: this._noise(0, gyroAmplitude),
          gyroY: this._noise(0, gyroAmplitude),
          gyroZ: this._noise(0, gyroAmplitude),
          magX: this._noise(magX, 0.8),
          magY: this._noise(magY, 0.8),
          magZ: this._noise(magZ, 0.8),
          attitude: attitude
        },
        comms: {
          rssi: this._noise(s.rssi, 1.5),
          snr: Math.max(0, this._noise(s.snr, 0.8)),
          packetsSent: s.packetsSent,
          packetsLost: s.packetsLost,
          packetLossRate: packetLossRate,
          dataRate: dataRate,
          frequency: 437.225,
          lastContact: s.lastContact || new Date()
        },
        orbit: {
          latitude: latitude,
          longitude: longitude,
          altitude: altitude,
          velocity: velocity,
          inclination: 97.5,
          period: this.orbitPeriod,
          inEclipse: inEclipse,
          orbitNumber: this.orbitNumber
        }
      };
    }

    /** Get current telemetry snapshot */
    getData() {
      if (!this.currentData) {
        this.update(0);
      }
      return this.currentData;
    }
  }

  window.TelemetrySimulator = TelemetrySimulator;
})(window);
