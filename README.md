# 🛰️ SUCHAI 4 — Ground Station Dashboard

Dashboard de estación terrena y telemetría en tiempo real para el nanosatélite **SUCHAI 4** (CubeSat 1U), desarrollado por el Laboratorio de Exploración Espacial y Planetología (**LEEP**) de la **Universidad de Chile** en colaboración con la Fuerza Aérea de Chile (**FACh**).

> 🎓 **Feria Técnico Profesional de Programación 2026**  
> Proyecto interactivo de demostración de arquitectura web, propagación orbital y telemetría de satélites en órbita baja (LEO).

---

## 📋 Ficha Técnica de la Misión

| Parámetro | Especificación |
| :--- | :--- |
| **Formato** | 1U CubeSat ($10 \times 10 \times 10\text{ cm}$) |
| **Masa** | $\sim 1.3\text{ kg}$ |
| **Órbita** | LEO $\sim 500\text{ km}$ SSO (Inclinación: $97.5^\circ$) |
| **Período Orbital** | $\sim 95\text{ minutos}$ ($5700\text{ s}$) |
| **Velocidad Orbital** | $\sim 7.61\text{ km/s}$ |
| **Frecuencia Downlink** | UHF $437.225\text{ MHz}$ |
| **Protocolo de Enlace** | Tramas AX.25 (Radioaficionados / Ground Station) |
| **Estación Terrena Principal** | Santiago, Chile ($-33.45^\circ\text{ S}, -70.67^\circ\text{ W}$) |
| **Computador de Vuelo (OBC)** | MSP430 + Linux Embedded OBC |
| **Cargas Útiles (Payloads)** | Sonda Langmuir, Magnetómetro Triaxial |

---

## 🚀 Características del Dashboard

* 🌍 **Rastreador Orbital 2D en Vivo:** Visualización cartográfica interactiva mediante [Leaflet.js](https://leafletjs.com/), con cálculo de traza sobre el terreno (ground track), huella de cobertura RF ($\sim 2500\text{ km}$) y marcador de estación terrena con indicador de enlace.
* ⚡ **Subsistema de Energía (EPS):** Monitorización de voltaje de paneles solares (ejes X, Y, Z), corriente generada y estado de carga de la batería Li-Ion.
* 🌡️ **Telemetría Térmica y Cómputo (OBC):** Gráficos en tiempo real de temperaturas de CPU, placa base y payload, además de uso de CPU y memoria.
* 📡 **Comunicaciones RF (COMMS):** Monitoreo de RSSI ($\text{dBm}$), relación señal-ruido (SNR en $\text{dB}$), tasa de datos y porcentaje de pérdida de paquetes.
* 💻 **Terminal Decodificador AX.25:** Simulación de recepción de tramas en hexadecimal crudo y deserialización en tiempo real a objetos JSON.
* 🎮 **Panel de Demostración:** Conmutación entre modos operativos (*Nominal*, *Eclipse*, *Descarga de Payload*) y control de aceleración temporal (*Time Warp*).

---

## 🛠️ Arquitectura y Tecnologías

El proyecto está diseñado bajo un enfoque **Vanilla Web ligero y modular**, sin dependencias de compilación pesadas:

```
SuchaiWebTpToilet/
├── index.html                  # Estructura semántica del Centro de Control
├── css/
│   └── style.css               # Estilos HUD / Sistema de temas (Claro y Oscuro)
├── js/
│   ├── telemetry-simulator.js  # Motor de física y simulación de subsistemas
│   ├── orbit-tracker.js        # Motor de propagación orbital y Leaflet
│   ├── charts.js               # Gestor reactivo de gráficas Chart.js
│   ├── terminal.js             # Decodificador y formateador de tramas AX.25
│   └── app.js                  # Controlador principal y bucle de eventos
├── GUI_ROADMAP.txt             # Hoja de ruta y plan de rediseño técnico
└── README.md                   # Documentación oficial del proyecto
```

* **Librerías externas:**
  * [Leaflet.js v1.9.4](https://leafletjs.com/) (Mapas y capas geográficas)
  * [Chart.js v4.4.4](https://www.chartjs.org/) (Gráficos de telemetría de alto rendimiento)
  * [CartoDB Basemaps](https://carto.com/basemaps/) (Tiles cartográficos)
  * Fuentes: *Inter* & *JetBrains Mono* (Google Fonts)

---

## 💻 Instrucciones de Ejecución

1. Clonar o descargar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/SuchaiWebTpToilet.git
   ```
2. Abrir directamente el archivo `index.html` en cualquier navegador moderno:
   * **Linux / Mac / Windows:** Doble clic en `index.html` o abrir con un servidor local ligero (ej: extensión *Live Server* de VS Code o `python3 -m http.server 8080`).

---

## 👥 Créditos y Referencias

* **Misión SUCHAI:** [Laboratorio de Exploración Espacial y Planetología (LEEP) - FCFM, Universidad de Chile](https://suchai.cl/).
* **Desarrollo del Dashboard:** Presentación para la Feria Técnico Profesional de Programación 2026.

