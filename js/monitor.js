
// ==========================================
// monitor.js - Firebase dan status alat
// ==========================================

import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

import { db, DB_PATH } from "./firebase.js";

import {
  updateDecisionUI,
  updateSensorIndicator
} from "./sni.js";

import { addRealtimeData } from "./chart.js";

// ==========================================
// Konfigurasi
// ==========================================

const DEVICE_TIMEOUT = 5000;
const CHECK_INTERVAL = 1000;
const FUTURE_TOLERANCE = 2000;

// ==========================================
// State
// ==========================================

let latestRealtime = null;
let latestAverage = null;
let latestQoS = null;

let firebaseOnline = false;
let serverTimeOffset = 0;
let toolIsActive = false;

let statusTimer = null;
let lastChartKey = null;
let getSelectedRoom = null;

// ==========================================
// Helper
// ==========================================

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function validNumber(value) {
  return typeof value === "number" &&
    Number.isFinite(value);
}

function displayValue(value, suffix = "") {
  return validNumber(value)
    ? `${value}${suffix}`
    : "--";
}

// ==========================================
// Status koneksi Firebase
// ==========================================

function updateConnectionStatus() {

  const status = document.getElementById(
    "connectionStatus"
  );

  status.classList.remove("online", "offline");

  status.classList.add(
    firebaseOnline ? "online" : "offline"
  );

  setText(
    "connectionText",
    firebaseOnline
      ? "Firebase Online"
      : "Firebase Offline"
  );
}

// ==========================================
// Validasi status alat
// ==========================================

function isDeviceActive() {

  if (!firebaseOnline ||
      latestRealtime?.status !== true) {
    return false;
  }

  const timestamp = latestRealtime.timestamp;

  if (!validNumber(timestamp) || timestamp <= 0) {
    return false;
  }

  const age =
    Date.now() + serverTimeOffset - timestamp;

  return (
    age >= -FUTURE_TOLERANCE &&
    age <= DEVICE_TIMEOUT
  );
}

// ==========================================
// Status alat dan waktu update
// ==========================================

function updateToolStatus() {

  const badge = document.getElementById("toolStatus");

  badge.className = "badge";

  badge.classList.add(
    toolIsActive
      ? "badge-active"
      : "badge-offline"
  );

  badge.textContent = !firebaseOnline
    ? "● TIDAK DIKETAHUI"
    : toolIsActive
      ? "● AKTIF"
      : "● OFFLINE";

  const timestamp = latestRealtime?.timestamp;

  if (
    validNumber(timestamp) &&
    timestamp > 0 &&
    Number.isFinite(new Date(timestamp).getTime())
  ) {

    const waktu = new Date(timestamp);

    const tanggal = waktu.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta"
      }
    );

    const jam = waktu.toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta"
      }
    );

    setText(
      "lastUpdate",
      `Update terakhir : ${tanggal} • ${jam}`
    );

  } else {

    setText(
      "lastUpdate",
      "Update terakhir : -"
    );
  }
}

// ==========================================
// Tampilan rata-rata
// ==========================================

function renderAverage() {

  const session = latestRealtime?.session;

  const show =
    toolIsActive &&
    !!session &&
    latestAverage?.session === session;

  setText(
    "avgLux",
    show
      ? displayValue(latestAverage.cahaya, " Lux")
      : "--"
  );

  setText(
    "avgDb",
    show
      ? displayValue(latestAverage.kebisingan, " dB")
      : "--"
  );
}

// ==========================================
// Format uptime
// ==========================================

function formatUptime(second) {

  if (!validNumber(second) || second < 0) {
    return "--";
  }

  const hour = Math.floor(second / 3600);

  const minute = Math.floor(
    (second % 3600) / 60
  );

  return hour > 0
    ? `${hour}j ${minute}m`
    : `${minute}m`;
}

// ==========================================
// Tampilan QoS
// ==========================================

function renderQoS() {

  const data = toolIsActive
    ? latestQoS
    : null;

  setText(
    "delay",
    displayValue(data?.delay, " ms")
  );

  setText(
    "packet",
    displayValue(data?.packet, "%")
  );

  setText(
    "uptime",
    formatUptime(data?.uptime)
  );
}

// ==========================================
// Reset indikator dan keputusan SNI
// ==========================================

function clearEvaluation() {

  const ids = [
    "luxIndicator",
    "dbIndicator",
    "sniStatus"
  ];

  for (const id of ids) {

    const element = document.getElementById(id);

    element.classList.remove(
      "badge-success",
      "badge-fail",
      "badge-active",
      "badge-offline",
      "badge-loading"
    );

    element.classList.add("badge-loading");

    element.textContent = "--";
  }
}

// ==========================================
// Evaluasi SNI
// ==========================================

export function refreshRoomEvaluation() {

  const lux = latestRealtime?.cahaya;
  const noise = latestRealtime?.kebisingan;

  if (
    !isDeviceActive() ||
    !validNumber(lux) ||
    !validNumber(noise) ||
    !getSelectedRoom
  ) {

    clearEvaluation();

    return;
  }

  const room = getSelectedRoom();

  updateSensorIndicator(room, lux, noise);

  updateDecisionUI(room, lux, noise);
}

// ==========================================
// Tampilan realtime
// ==========================================

function renderRealtime() {

  toolIsActive = isDeviceActive();

  updateToolStatus();

  const lux = latestRealtime?.cahaya;

  const noise = latestRealtime?.kebisingan;

  // Nilai cahaya

  setText(
    "luxValue",
    toolIsActive
      ? displayValue(lux)
      : "--"
  );

  // Nilai kebisingan

  setText(
    "dbValue",
    toolIsActive
      ? displayValue(noise)
      : "--"
  );

  // Perbarui indikator dan keputusan SNI

  refreshRoomEvaluation();

  // Perbarui rata-rata

  renderAverage();

  // Perbarui QoS

  renderQoS();

  // Grafik hanya menerima data baru
  // ketika alat aktif

  if (
    toolIsActive &&
    validNumber(lux) &&
    validNumber(noise)
  ) {

    const key = JSON.stringify([
      latestRealtime.session,
      latestRealtime.timestamp
    ]);

    // Mencegah data grafik duplikat

    if (key !== lastChartKey) {

      addRealtimeData(lux, noise);

      lastChartKey = key;
    }
  }
}

// ==========================================
// Listener realtime
// ==========================================

export function listenRealtime(getRoom) {

  getSelectedRoom = getRoom;

  updateConnectionStatus();

  renderRealtime();

  // ========================================
  // Koneksi browser dengan Firebase
  // ========================================

  onValue(
    ref(db, ".info/connected"),
    snapshot => {

      firebaseOnline = snapshot.val() === true;

      updateConnectionStatus();

      renderRealtime();
    }
  );

  // ========================================
  // Sinkronisasi waktu server Firebase
  // ========================================

  onValue(
    ref(db, ".info/serverTimeOffset"),
    snapshot => {

      const offset = snapshot.val();

      if (validNumber(offset)) {

        serverTimeOffset = offset;
      }

      renderRealtime();
    }
  );

  // ========================================
  // Listener data realtime
  // ========================================

  onValue(
    ref(db, DB_PATH.realtime),
    snapshot => {

      latestRealtime = snapshot.val();

      renderRealtime();

    },
    error => {

      console.error(
        "Gagal membaca realtime:",
        error
      );

      latestRealtime = null;

      renderRealtime();
    }
  );

  // ========================================
  // Pengecekan status alat secara berkala
  // ========================================

  clearInterval(statusTimer);

  statusTimer = setInterval(() => {

    // Tetap diperiksa meskipun tidak ada
    // data baru dari Firebase.

    if (isDeviceActive() !== toolIsActive) {

      renderRealtime();
    }

  }, CHECK_INTERVAL);
}

// ==========================================
// Listener average
// ==========================================

export function listenAverage() {

  onValue(
    ref(db, DB_PATH.average),
    snapshot => {

      latestAverage = snapshot.val();

      renderAverage();

    },
    error => {

      console.error(
        "Gagal membaca average:",
        error
      );

      latestAverage = null;

      renderAverage();
    }
  );
}

// ==========================================
// Listener QoS
// ==========================================

export function listenQoS() {

  onValue(
    ref(db, DB_PATH.qos),
    snapshot => {

      latestQoS = snapshot.val();

      renderQoS();

    },
    error => {

      console.error(
        "Gagal membaca QoS:",
        error
      );

      latestQoS = null;

      renderQoS();
    }
  );
}
