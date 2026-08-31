/**
 * SUCHAI 4 — Telemetry Simulator (Modelo Físico Coherente v2.0)
 *
 * Modelo físico-matemático riguroso para CubeSat 1U en órbita LEO ~500 km:
 *
 *   EPS  — Balance de potencia estricto (P_gen vs P_cons).
 *          En Eclipse: Solar = 0.00 V / 0 mA, Batería SÓLO DESCARGA.
 *          En Sol:     Solar = 3.8–4.1 V / ~350 mA, Batería SÓLO CARGA.
 *
 *   OBC  — Inercia térmica real (Al 6061-T6, ~1.3 kg).
 *          Temperatura varía suavemente: +10 °C (umbra) → +30 °C (sol).
 *
 *   COMMS — RSSI/SNR por distancia euclidiana a Santiago (FSPL a 437.225 MHz).
 *
 *   ORBIT — Mecánica Kepleriana simplificada SSO 97.5° / 95 min.
 *           Eclipse = 35 % de la órbita (penumbra suave de entrada/salida).
 *
 * Feria TP Programación 2026 — Universidad de Chile / LEEP
 */
(function(window) {
  'use strict';

  // ── Constantes físicas de la misión ──────────────────────────────────────
  var PHY = {
    ORBIT_PERIOD:      5700,    // s  — Período orbital LEO 500 km (~95 min)
    ORBIT_NUMBER_INIT: 1042,    // —  — Contador de órbita realista
    INCLINATION_DEG:   97.5,    // °  — Inclinación SSO
    ALTITUDE_MEAN:     512,     // km — Altitud media
    VELOCITY_MEAN:     7.61,    // km/s
    GS_LAT:           -33.45,   // ° — Estación Santiago
    GS_LON:           -70.67,   // °
    // Eclipse: ~35 % de la órbita (fase 0.62 a 0.97)
    ECLIPSE_START:     0.62,
    ECLIPSE_END:       0.97,
    PENUMBRA_FRAC:     0.025,   // 2.5 % de fase de transición suave
    // EPS — Paneles GaAs CubeSat 1U
    SOLAR_V_MAX_X:     4.10,    // V
    SOLAR_V_MAX_Y:     3.82,    // V
    SOLAR_V_MAX_Z:     2.40,    // V
    SOLAR_I_MAX:       355,     // mA (suma de 3 caras)
    // EPS — Batería Li-Ion 1S 3.7 V / 2600 mAh
    BAT_V_EMPTY:       3.30,    // V
    BAT_V_FULL:        4.15,    // V
    // OBC — Consumo base y en transmisión
    CURRENT_BASE:      190,     // mA
    CURRENT_TX:        375,     // mA (durante paso por GS)
    AOS_DIST_DEG:      28,      // ° grado equivalente de distancia (~3100 km)
    // OBC — Temperaturas objetivo
    TEMP_CPU_SUN:      30.0,    // °C
    TEMP_CPU_ECLIPSE:  10.5,    // °C
    TEMP_CPU_TX:        6.0,    // °C adicionales por transmisión
    THERMAL_TAU:       0.012    // Factor de inercia térmica (bajo = más inercial)
  };

  class TelemetrySimulator {
    constructor() {
      this.uptime    = 0;
      this.orbitTime = PHY.ORBIT_PERIOD * 0.18; // Inicio en zona solar (~18 %)
      this.orbitNumber = PHY.ORBIT_NUMBER_INIT;

      // Estado interno continuo (suavizado)
      this._s = {
        batteryCharge:  82.4,   // % (5 a 100)
        batteryVoltage:  3.98,  // V
        cpuTemp:        26.8,   // °C
        boardTemp:      22.3,   // °C
        payloadTemp:    18.6,   // °C
        cpuUsage:       22.0,   // %
        memoryUsed:     185,    // KB
        packetsSent:    48230,
        packetsLost:    127,
        solarX:          3.84, // V
        solarY:          3.60, // V
        solarZ:          2.15, // V
        solarCurrent:   342,   // mA
        currentDraw:    193,   // mA
        rssi:           -96,   // dBm
        snr:              6.2, // dB
        lastContact:    new Date()
      };

      this.currentData = null;
    }

    // ── Utilidades matemáticas ─────────────────────────────────────────────
    _noise(base, amp) { return base + (Math.random() - 0.5) * 2 * amp; }
    _lerp(v, target, k) { return v + (target - v) * Math.min(k, 1); }
    _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // ── Avance de la simulación ────────────────────────────────────────────
    update(dt) {
      if (dt <= 0) dt = 1;
      this.uptime    += dt;
      this.orbitTime += dt;

      if (this.orbitTime >= PHY.ORBIT_PERIOD) {
        this.orbitTime -= PHY.ORBIT_PERIOD;
        this.orbitNumber++;
      }

      var s           = this._s;
      var phase       = this.orbitTime / PHY.ORBIT_PERIOD; // 0..1
      var angle       = phase * Math.PI * 2;
      var inclRad     = PHY.INCLINATION_DEG * Math.PI / 180;

      // ── A. MECÁNICA ORBITAL (SSO 97.5° / LEO 500 km) ───────────────────
      var maxLat = (180 - PHY.INCLINATION_DEG);           // 82.5°
      var lat    = maxLat * Math.sin(angle);

      var earthRot  = (PHY.ORBIT_PERIOD / 86400) * 360;  // ~23.9°/órbita
      var lonStep   = 360 - earthRot;                     // ~336.1°
      var lon       = -70.67
                      + phase * lonStep
                      + this.orbitNumber * -(earthRot + 0.1);
      lon = ((lon % 360) + 540) % 360 - 180;             // Normalizar −180..180

      var altOscil = Math.sin(angle) * 8.5;
      var altitude = PHY.ALTITUDE_MEAN + altOscil;        // 503–521 km
      var velocity = PHY.VELOCITY_MEAN - altOscil * 0.004; // 7.57–7.65 km/s

      // ── B. DETECCIÓN DE ECLIPSE CON PENUMBRA SUAVE ─────────────────────
      // sunFactor: 1.0 = Sol pleno, 0.0 = Umbra total
      var sunFactor = 1.0;
      var es = PHY.ECLIPSE_START, ee = PHY.ECLIPSE_END, pf = PHY.PENUMBRA_FRAC;

      if (phase >= es && phase <= ee) {
        if (phase < es + pf) {
          sunFactor = 1.0 - (phase - es) / pf;          // Entrada penumbra
        } else if (phase > ee - pf) {
          sunFactor = (phase - (ee - pf)) / pf;          // Salida penumbra
        } else {
          sunFactor = 0.0;                               // Umbra total
        }
      }
      sunFactor    = this._clamp(sunFactor, 0, 1);
      var inEclipse = sunFactor < 0.05;

      // ── C. SUBSISTEMA DE ENERGÍA (EPS) — BALANCE DE POTENCIA ESTRICTO ──

      // Generación de paneles (proporcional a sunFactor + variación por actitud orbital)
      var facX = 0.70 + 0.30 * Math.abs(Math.sin(angle * 1.5));
      var facY = 0.65 + 0.35 * Math.abs(Math.cos(angle * 1.2 + 0.4));
      var facZ = 0.55 + 0.45 * Math.abs(Math.sin(angle * 0.9 + 1.1));

      var tgtSX = sunFactor * PHY.SOLAR_V_MAX_X * facX;
      var tgtSY = sunFactor * PHY.SOLAR_V_MAX_Y * facY;
      var tgtSZ = sunFactor * PHY.SOLAR_V_MAX_Z * facZ;
      var tgtSI = sunFactor * PHY.SOLAR_I_MAX   * facX;

      var smoothK = 0.22 * dt;
      s.solarX = this._lerp(s.solarX, tgtSX, smoothK);
      s.solarY = this._lerp(s.solarY, tgtSY, smoothK);
      s.solarZ = this._lerp(s.solarZ, tgtSZ, smoothK);
      s.solarCurrent = this._lerp(s.solarCurrent, tgtSI, smoothK);

      // Forzar cero riguroso en umbra total (sin ruido de sensor que genere falsos positivos)
      if (sunFactor < 0.04) {
        s.solarX = Math.max(0.0, s.solarX * 0.45);
        s.solarY = Math.max(0.0, s.solarY * 0.45);
        s.solarZ = Math.max(0.0, s.solarZ * 0.45);
        s.solarCurrent = Math.max(0.0, s.solarCurrent * 0.45);
      }

      // Distancia angular a la estación terrena (Santiago)
      var dLat = lat - PHY.GS_LAT;
      var dLon = lon - PHY.GS_LON;
      var distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
      var inAOS   = distDeg < PHY.AOS_DIST_DEG;

      // Consumo del satélite: base + pico de transmisión durante AOS
      var tgtDraw = inAOS ? PHY.CURRENT_TX : PHY.CURRENT_BASE;
      s.currentDraw = this._lerp(s.currentDraw, tgtDraw, 0.18 * dt);

      // BALANCE DE POTENCIA — COHERENCIA ABSOLUTA
      var netI = s.solarCurrent - s.currentDraw; // mA netos

      // La batería Li-Ion 2600 mAh: 1 mA·h = 0.00003846 %
      // 0.028 = factor escalado para la velocidad de demostración
      var batDelta = (netI / 2600) * 0.028 * dt;

      var batteryStatus;
      if (netI > 15) {
        batteryStatus = 'CARGANDO';
        s.batteryCharge += batDelta; // SÓLO SUBE
      } else if (netI < -15) {
        batteryStatus = 'DESCARGANDO';
        s.batteryCharge += batDelta; // SÓLO BAJA (batDelta negativo)
      } else {
        batteryStatus = 'EQUILIBRIO';
        // No cambia
      }

      s.batteryCharge = this._clamp(s.batteryCharge, 8.0, 100.0);
      if (s.batteryCharge >= 99.5) {
        batteryStatus = 'CARGA COMPLETA';
        s.batteryCharge = 100.0;
      }

      // Curva de descarga realista de Li-Ion 1S
      var socLinear = s.batteryCharge / 100;
      s.batteryVoltage = PHY.BAT_V_EMPTY + socLinear * (PHY.BAT_V_FULL - PHY.BAT_V_EMPTY)
                         + (netI > 0 ? 0.04 : -0.025); // Drop resistivo
      s.batteryVoltage = this._clamp(s.batteryVoltage, PHY.BAT_V_EMPTY, PHY.BAT_V_FULL);

      // ── D. TERMODINÁMICA (Inercia Térmica Al 6061-T6, ~1.3 kg) ─────────
      var tgtCPU  = sunFactor > 0.45
        ? PHY.TEMP_CPU_SUN    + (inAOS ? PHY.TEMP_CPU_TX    : 0)
        : PHY.TEMP_CPU_ECLIPSE + (inAOS ? PHY.TEMP_CPU_TX*0.6: 0);
      var tgtBrd  = tgtCPU - 4.2;
      var tgtPld  = tgtCPU - 7.5;

      var tau = PHY.THERMAL_TAU * dt;
      s.cpuTemp     = this._lerp(s.cpuTemp,     tgtCPU, tau);
      s.boardTemp   = this._lerp(s.boardTemp,   tgtBrd, tau * 0.9);
      s.payloadTemp = this._lerp(s.payloadTemp, tgtPld, tau * 0.8);

      // CPU Usage: Bajo en sol nominal, alto en transmisión
      var tgtCPUuse = inAOS ? 65 + Math.sin(this.uptime * 0.3) * 8 : 18 + Math.sin(this.uptime * 0.1) * 4;
      s.cpuUsage = this._lerp(s.cpuUsage, tgtCPUuse, 0.12 * dt);

      if (inAOS) {
        s.memoryUsed = Math.min(430, s.memoryUsed + 3.5 * dt);
      } else {
        s.memoryUsed = Math.max(185, s.memoryUsed - 1.8 * dt);
      }

      // ── E. COMUNICACIONES RF (FSPL @ 437.225 MHz) ──────────────────────
      // Free-Space Path Loss: FSPL(dB) = 20·log10(4π·d·f/c)
      // Convertido a RSSI aproximado usando distancia en km
      var distKm    = distDeg * 111.2; // grados → km aprox (válido en latitud media)
      var freqHz    = 437.225e6;
      var lightSpeed = 3e8;
      var tgtRssi, tgtSnr;

      if (distDeg < PHY.AOS_DIST_DEG) {
        var fspl = 20 * Math.log10((4 * Math.PI * Math.max(distKm, 1) * 1000 * freqHz) / lightSpeed);
        // EIRP estimado del satélite: +27 dBm; Ganancia antena GS: +8 dBi; Ruido sistema: −114 dBm
        tgtRssi = 27 + 8 - fspl;
        tgtSnr  = Math.max(0, tgtRssi + 114 - 8);
      } else {
        tgtRssi = -112 - Math.random() * 3;
        tgtSnr  = 0;
      }

      var commsK = 0.25 * dt;
      s.rssi = this._lerp(s.rssi, tgtRssi, commsK);
      s.snr  = this._lerp(s.snr,  tgtSnr,  commsK);

      if (inAOS) {
        s.packetsSent += Math.max(0, Math.floor(1 + Math.random() * 2));
        if (Math.random() < 0.008) s.packetsLost++;
        s.lastContact = new Date();
      }

      var lossRate = s.packetsSent > 0 ? (s.packetsLost / s.packetsSent) * 100 : 0;
      var dataRate  = distDeg < 20 ? 9600 : 1200;

      // ── F. OBJETO DE TELEMETRÍA FINAL ───────────────────────────────────
      this.currentData = {
        timestamp: new Date(),
        mode: inEclipse ? 'eclipse' : 'nominal',
        inAOS: inAOS,
        eps: {
          solarPanelX:    Math.max(0, this._noise(s.solarX, 0.025)),
          solarPanelY:    Math.max(0, this._noise(s.solarY, 0.025)),
          solarPanelZ:    Math.max(0, this._noise(s.solarZ, 0.018)),
          solarCurrent:   Math.max(0, this._noise(s.solarCurrent, 1.8)),
          batteryVoltage: this._clamp(this._noise(s.batteryVoltage, 0.008), PHY.BAT_V_EMPTY, PHY.BAT_V_FULL),
          batteryCharge:  s.batteryCharge,
          batteryStatus:  batteryStatus,
          currentDraw:    Math.max(0, this._noise(s.currentDraw, 2.5)),
          netCurrent:     netI
        },
        obc: {
          cpuTemp:      this._noise(s.cpuTemp, 0.12),
          boardTemp:    this._noise(s.boardTemp, 0.10),
          payloadTemp:  this._noise(s.payloadTemp, 0.08),
          cpuUsage:     this._clamp(this._noise(s.cpuUsage, 1.2), 5, 98),
          memoryUsed:   Math.floor(s.memoryUsed),
          uptime:       this.uptime
        },
        comms: {
          rssi:           this._noise(s.rssi, 0.6),
          snr:            Math.max(0, this._noise(s.snr, 0.3)),
          packetsSent:    s.packetsSent,
          packetsLost:    s.packetsLost,
          packetLossRate: lossRate,
          dataRate:       dataRate,
          frequency:      437.225,
          lastContact:    s.lastContact
        },
        orbit: {
          latitude:    lat,
          longitude:   lon,
          altitude:    altitude,
          velocity:    velocity,
          inclination: PHY.INCLINATION_DEG,
          period:      PHY.ORBIT_PERIOD,
          inEclipse:   inEclipse,
          sunFactor:   sunFactor,
          orbitNumber: this.orbitNumber
        }
      };
    }

    getData() {
      if (!this.currentData) this.update(1);
      return this.currentData;
    }
  }

  window.TelemetrySimulator = TelemetrySimulator;
})(window);
