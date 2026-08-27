/**
 * SUCHAI 4 — Terminal Log
 * Simulates receiving and decoding AX.25 telemetry frames.
 */
(function(window) {
  'use strict';

  class TerminalLog {
    constructor(containerId) {
      this.containerId = containerId;
      this.container = null;
      this.sequenceNumber = 1;
      this.maxEntries = 50;
      this.entryCount = 0;
    }

    /** Initialize after DOM is ready */
    init() {
      this.container = document.getElementById(this.containerId);
    }

    /** Generate random hex dump string */
    _generateHexDump(length) {
      var hex = [];
      for (var i = 0; i < length; i++) {
        hex.push(('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2).toUpperCase());
      }
      return hex.join(' ');
    }

    /** Format UTC timestamp */
    _formatUTC(date) {
      var h = ('0' + date.getUTCHours()).slice(-2);
      var m = ('0' + date.getUTCMinutes()).slice(-2);
      var s = ('0' + date.getUTCSeconds()).slice(-2);
      var ms = ('00' + date.getUTCMilliseconds()).slice(-3);
      return h + ':' + m + ':' + s + '.' + ms;
    }

    /** Add a decoded telemetry frame to the terminal */
    addFrame(data) {
      if (!this.container) return;

      var now = new Date();
      var seq = this.sequenceNumber++;
      var hexLength = 20 + Math.floor(Math.random() * 20); // 20-40 bytes

      // Build the frame block
      var block = document.createElement('div');
      block.className = 'frame-block';

      // 1. Separator
      var sep = document.createElement('span');
      sep.className = 'line separator';
      sep.textContent = '──────────────────────────────────────────────────────';
      block.appendChild(sep);

      // 2. Timestamp + header line
      var headerLine = document.createElement('span');
      headerLine.className = 'line';
      headerLine.innerHTML =
        '<span class="timestamp">[' + this._formatUTC(now) + ' UTC]</span> ' +
        '<span class="label-tag">[RX FRAME #' + seq + ']</span> ' +
        'Freq: <span class="hex">' + data.comms.frequency.toFixed(3) + ' MHz</span> | ' +
        'RSSI: <span class="hex">' + data.comms.rssi.toFixed(1) + ' dBm</span> | ' +
        'SNR: <span class="hex">' + data.comms.snr.toFixed(1) + ' dB</span>';
      block.appendChild(headerLine);

      // 3. Raw hex dump
      var hexLine = document.createElement('span');
      hexLine.className = 'line';
      hexLine.innerHTML =
        '<span class="label-tag">AX.25 >></span> ' +
        '<span class="hex">' + this._generateHexDump(hexLength) + '</span>';
      block.appendChild(hexLine);

      // 4. Decoded JSON
      var decoded = {
        src: 'SUCHAI4',
        dst: 'GND-SCL',
        type: 'TLM',
        seq: seq,
        eps: {
          vbat: parseFloat(data.eps.batteryVoltage.toFixed(2)),
          vsol: parseFloat(data.eps.solarPanelX.toFixed(2)),
          ibat: parseInt(data.eps.currentDraw.toFixed(0))
        },
        obc: {
          temp: parseFloat(data.obc.cpuTemp.toFixed(1)),
          cpu: parseInt(data.obc.cpuUsage.toFixed(0)),
          mem: data.obc.memoryUsed
        },
        sts: data.mode
      };

      var jsonStr = JSON.stringify(decoded, null, 2);
      var decodedLine = document.createElement('span');
      decodedLine.className = 'line';
      decodedLine.innerHTML =
        '<span class="label-tag">DECODED >></span>\n' +
        '<span class="decoded">' + jsonStr + '</span>';
      block.appendChild(decodedLine);

      this.container.appendChild(block);
      this.entryCount++;

      // Remove oldest entries if over limit
      while (this.entryCount > this.maxEntries) {
        var first = this.container.querySelector('.frame-block');
        if (first) {
          this.container.removeChild(first);
          this.entryCount--;
        } else {
          break;
        }
      }

      // Auto-scroll to bottom
      this.container.scrollTop = this.container.scrollHeight;
    }

    /** Clear all terminal content */
    clear() {
      if (this.container) {
        this.container.innerHTML = '<span class="line decoded">[ Terminal limpiado ]</span>';
        this.entryCount = 0;
      }
    }
  }

  window.TerminalLog = TerminalLog;
})(window);
