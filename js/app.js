
// ==========================================
// app.js - Inisialisasi Dashboard
// ==========================================

import { initTheme } from "./theme.js";

import { initCharts } from "./chart.js";

import {
  updateStandardUI
} from "./sni.js";

import {
  listenRealtime,
  listenAverage,
  listenQoS,
  refreshRoomEvaluation
} from "./monitor.js";

// ==========================================
// Inisialisasi
// ==========================================

initTheme();

initCharts();

const roomSelect = document.getElementById(
  "roomSelect"
);

// ==========================================
// Tampilkan standar awal
// ==========================================

updateStandardUI(roomSelect.value);

// ==========================================
// Listener Firebase
// ==========================================

listenRealtime(() => roomSelect.value);

listenAverage();

listenQoS();

// ==========================================
// Perubahan pilihan ruangan
// ==========================================

roomSelect.addEventListener("change", () => {

  updateStandardUI(roomSelect.value);

  // Evaluasi hanya jika alat aktif
  // dan data sensor masih valid.

  refreshRoomEvaluation();

});
