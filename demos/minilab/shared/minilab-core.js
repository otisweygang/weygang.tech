/* MiniLab Control HMI — shared engine for the 026 and 125 builds.
   A ~20 Hz simulation loop advances a plausible vacuum / plasma / QCM
   model; the DOM is a thin view over it. Interlocks reject unsafe
   operator actions and raise alarms instead of acting. Indicative only.

   Everything specific to a machine (power/flow ranges, recipe steps,
   glossary entries, datasheet) lives in machines.js — this file is the
   same for every machine and switches machines at runtime via
   loadMachine(), no page reload required. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DT = 0.1;                      // s per tick
  var $ = function (id) { return document.getElementById(id); };

  var MACHINES = window.MINILAB_MACHINES;
  var cfg = null;                    // active machine config
  var m = null;                      // active model

  function freshModel() {
    return {
      t: 0,
      mode: "standby",                 // standby | pumping | process | vent | fault
      faultUntil: 0,                   // model time at which an ABORT fault may auto-clear

      pressure: 1000,                  // mbar
      base: cfg.basePressure,
      turboSpin: 0,                    // 0..1 spool fraction

      flowSP: cfg.flowSP, flowPV: 0,   // sccm
      powerSP: cfg.powerSP, powerPV: 0,// W
      plasmaOn: false,

      tempSP: cfg.tempSP, tempPV: 22,  // degC
      shutterOpen: false,

      thick: 0, rate: 0, target: cfg.target,  // nm, nm/s, nm
      srcIndex: cfg.defaultSrcIndex,

      vGas: false, vGate: false, vVent: false,

      seq: { running: false, hold: false, step: -1, stepT: 0, done: false }
    };
  }

  // ---------------------------------------------------------------- alarms
  var alarms = [];
  var alarmSeen = {};
  var alarmSeq = 0;
  function raise(tag, sev, msg, oneShot) {
    if (oneShot && alarmSeen[tag] && (m.t - alarmSeen[tag]) < 3) return;
    alarmSeen[tag] = m.t;
    alarms.unshift({ time: fmtClock(m.t), tag: tag, sev: sev, msg: msg, state: "unack", id: ++alarmSeq });
    if (alarms.length > 40) alarms.pop();
    if (sev === "alm") setComms("warn");
    renderAlarms();
  }
  function ackAll() {
    alarms.forEach(function (a) { if (a.state === "unack") a.state = "ack"; });
    setComms("ok");
    renderAlarms();
  }

  // ---------------------------------------------------------------- helpers
  function fmtClock(s) {
    s = Math.max(0, Math.floor(s));
    var h = (s / 3600) | 0, mn = ((s % 3600) / 60) | 0, se = s % 60;
    return [h, mn, se].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
  }
  function eng(x) {
    if (x === 0) return "0.0e+0";
    var e = Math.floor(Math.log10(Math.abs(x)));
    var mant = x / Math.pow(10, e);
    return mant.toFixed(1) + "e" + (e >= 0 ? "+" : "−") + Math.abs(e);
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function matName() { return cfg.sources[m.srcIndex].mat; }

  // ---------------------------------------------------------------- physics step
  function stepModel() {
    m.t += DT;

    var turboWant = (m.vGate && m.mode !== "vent") ? 1 : 0;
    m.turboSpin += (turboWant - m.turboSpin) * DT / 8;

    var pumpSpeed = m.turboSpin * (m.vGate ? 1 : 0);
    var gasIn = m.vGas ? m.flowPV : 0;
    var ventIn = m.vVent ? 4000 : 0;

    if (m.vGate || m.vVent) {
      var Qin = gasIn * 0.017 + ventIn * 0.02 + 2e-6;
      var Sp = pumpSpeed * cfg.pumpConductance + 0.02;
      var Peq = Qin / Sp;
      if (m.vVent) Peq = Math.max(Peq, 1013);
      var tau = m.pressure > 1 ? 3.5 : (m.pressure > 1e-2 ? 6 : 14);
      m.pressure += (Peq - m.pressure) * DT / tau;
      m.pressure = Math.max(m.pressure, m.base * (1 + 0.4 * Math.sin(m.t)));
      m.pressure = Math.min(m.pressure, 1200);
    }

    var flowWant = m.vGas ? m.flowSP : 0;
    m.flowPV += (flowWant - m.flowPV) * DT / 1.2;
    if (m.flowPV < 0.05) m.flowPV = 0;

    var pWant = m.plasmaOn ? m.powerSP : 0;
    var dP = clamp(pWant - m.powerPV, -cfg.powerRampDown * DT, cfg.powerRampUp * DT);
    m.powerPV = clamp(m.powerPV + dP, 0, cfg.powerMax);
    if (!m.plasmaOn && m.powerPV < 1) m.powerPV = 0;

    if (m.plasmaOn) {
      var p_mbar = m.pressure;
      if (p_mbar < 5e-4 || p_mbar > 5e-2) {
        m.plasmaOn = false;
        raise("PLASMA-TRIP", "alm", "Plasma extinguished — pressure " + eng(p_mbar) + " mbar out of sustain window", true);
      }
    }

    var tau_t = 90;
    m.tempPV += ((m.tempSP - m.tempPV) * DT / tau_t) - ((m.tempPV - 22) * DT / 1400);

    var depositing = m.plasmaOn && m.shutterOpen && m.powerPV > 20;
    if (depositing) {
      var pFac = clamp(m.pressure / 3e-3, 0.2, 1.6);
      var base = (m.powerPV / cfg.depositionPowerRef) * cfg.depositionYield * pFac;
      m.rate = Math.max(0, base * (0.9 + 0.2 * Math.random()));
    } else {
      m.rate += (0 - m.rate) * DT / 0.4;
      if (m.rate < 0.005) m.rate = 0;
    }
    m.thick += m.rate * DT;

    if (m.mode === "fault") {
      if (m.t >= m.faultUntil && !m.plasmaOn && m.powerPV < 5) m.mode = "standby";
    } else {
      if (m.vVent && m.pressure > 1) m.mode = "vent";
      else if (m.plasmaOn || m.powerPV > 5) m.mode = "process";
      else if (m.turboSpin > 0.2 && m.pressure > m.base * 3) m.mode = "pumping";
      else m.mode = "standby";
    }

    if (m.seq.running && !m.seq.hold) stepSequencer();
  }

  // ---------------------------------------------------------------- sequencer
  function startSequence() {
    if (m.mode === "fault") { raise("SEQ-BLOCK", "wrn", "Clear fault before starting a recipe", true); return; }
    m.seq = { running: true, hold: false, step: 0, stepT: 0, done: false };
    cfg.steps[0].enter();
    logEvent("SEQ", "Recipe started — " + cfg.recipeMaterial);
    syncSeqUI();
  }
  function stepSequencer() {
    var s = cfg.steps[m.seq.step];
    if (!s) return;
    m.seq.stepT += DT;
    if (s.done(m.seq.stepT)) {
      logEvent("SEQ", "Step " + (m.seq.step + 1) + " complete — " + s.name);
      m.seq.step++;
      m.seq.stepT = 0;
      if (m.seq.step >= cfg.steps.length) {
        m.seq.running = false;
        m.seq.done = true;
        logEvent("SEQ", "Recipe complete — " + m.thick.toFixed(1) + " nm deposited");
      } else {
        cfg.steps[m.seq.step].enter();
      }
      syncSeqUI();
    }
  }
  function holdSequence() {
    if (!m.seq.running) return;
    m.seq.hold = !m.seq.hold;
    logEvent("SEQ", m.seq.hold ? "Recipe HELD by operator" : "Recipe RESUMED");
    syncSeqUI();
  }
  function skipStep() {
    if (!m.seq.running) return;
    var s = cfg.steps[m.seq.step];
    if (s.force) s.force();
    logEvent("SEQ", "Step " + (m.seq.step + 1) + " skipped by operator — completed to target");
    m.seq.step++;
    m.seq.stepT = 0;
    if (m.seq.step >= cfg.steps.length) { m.seq.running = false; m.seq.done = true; }
    else cfg.steps[m.seq.step].enter();
    syncSeqUI();
  }

  // ---------------------------------------------------------------- actions + interlocks
  function setValve(id, open) {
    var key = id === "v-gas" ? "vGas" : id === "v-gate" ? "vGate" : "vVent";
    if (id === "v-vent" && open && (m.plasmaOn || m.powerPV > 5)) {
      raise("VENT-INHIBIT", "alm", "V-VENT open refused — plasma live / power " + Math.round(m.powerPV) + " W", true);
      return;
    }
    m[key] = open;
    $(id).dataset.open = open ? "true" : "false";
    logEvent("VLV", id.toUpperCase().replace("-", "‑") + (open ? " OPEN" : " CLOSED"));
  }
  function toggleValve(id) {
    var key = id === "v-gas" ? "vGas" : id === "v-gate" ? "vGate" : "vVent";
    setValve(id, !m[key]);
  }

  function tryStrike(fromSeq) {
    if (m.plasmaOn) { setPlasma(false); return; }
    if (!m.vGate) { raise("PLASMA-NOSTRIKE", "alm", "Strike blocked — V-GATE closed (no active pumping)", true); return; }
    if (m.pressure < 1e-3 || m.pressure > 2e-2) {
      raise("PLASMA-NOSTRIKE", "alm", "Strike blocked — chamber " + eng(m.pressure) + " mbar, need 1–20×10⁻³", true);
      return;
    }
    if (m.flowPV < 2) { raise("PLASMA-NOSTRIKE", "wrn", "Strike blocked — no process gas flowing", true); return; }
    setPlasma(true);
    if (!fromSeq) logEvent("PWR", "Plasma struck — " + matName() + " @ SP " + m.powerSP + " W");
  }
  function setPlasma(on) {
    m.plasmaOn = on;
    $("btn-plasma").dataset.on = on ? "true" : "false";
    $("btn-plasma").textContent = on ? "PLASMA ON — STOP" : "STRIKE PLASMA";
    if (!on) logEvent("PWR", "Plasma off");
  }
  function setShutter(open) {
    m.shutterOpen = open;
    $("shutter").dataset.open = open ? "true" : "false";
    var b = $("btn-shutter");
    b.dataset.open = open ? "true" : "false";
    b.textContent = open ? "OPEN" : "CLOSED";
    logEvent("SHU", "Shutter " + (open ? "OPEN" : "CLOSED"));
  }
  function setFlowSP(v) { m.flowSP = clamp(v, 0, cfg.flowMax); $("sp-flow").value = m.flowSP; }

  function abort() {
    setPlasma(false);
    setShutter(false);
    setFlowSP(0);
    m.vGas = false; $("v-gas").dataset.open = "false";
    m.vVent = false; $("v-vent").dataset.open = "false";
    m.vGate = true; $("v-gate").dataset.open = "true";
    m.seq.running = false; m.seq.hold = false;
    m.mode = "fault";
    m.faultUntil = m.t + 4;
    raise("ABORT", "alm", "Operator ABORT — power down, shutter closed, gas off, chamber held under vacuum", false);
    syncSeqUI();
  }

  function logEvent(tag, msg) {
    alarms.unshift({ time: fmtClock(m.t), tag: tag, sev: "evt", msg: msg, state: "rtn", id: ++alarmSeq });
    if (alarms.length > 40) alarms.pop();
    renderAlarms();
  }

  // ---------------------------------------------------------------- rendering
  var mimicFx = $("mimic-fx"), fxc = mimicFx.getContext("2d");
  var trend = $("trend"), tc = trend.getContext("2d");
  var hist = [];

  function fitCanvas() {
    var r = $("mimic").getBoundingClientRect();
    if (!r.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    mimicFx.width = r.width * dpr; mimicFx.height = r.height * dpr;
    fxc.setTransform(dpr * r.width / 640, 0, 0, dpr * r.height / 400, 0, 0);
    var tr = trend.getBoundingClientRect();
    trend.width = tr.width * dpr; trend.height = tr.height * dpr;
    tc.setTransform(dpr, 0, 0, dpr, 0, 0);
    trend._w = tr.width; trend._h = tr.height;
  }

  function renderView() {
    var sm = $("sys-mode");
    sm.textContent = m.mode.toUpperCase();
    sm.dataset.mode = m.mode;
    $("proc-clock").textContent = fmtClock(m.t);

    $("pv-power").textContent = Math.round(m.powerPV);
    $("pv-flow").textContent = m.flowPV.toFixed(1);
    $("pv-temp").textContent = Math.round(m.tempPV);
    setBar("bar-power", m.powerPV / cfg.powerMax);
    setBar("bar-flow", m.flowPV / cfg.flowMax);
    setBar("bar-temp", (m.tempPV - 20) / 780);
    document.querySelector('.fp-sp[data-tag="power"]').classList.toggle("is-hot", m.plasmaOn);

    $("ro-p-chamber").textContent = eng(m.pressure) + " mbar";
    $("ro-pump").textContent = m.turboSpin > 0.9 ? "at speed" : m.turboSpin > 0.1 ? Math.round(m.turboSpin * 100) + "%" : "idle";

    $("qcm-thick").textContent = m.thick.toFixed(1);
    $("qcm-rate").textContent = m.rate.toFixed(2) + " nm/s";
    $("qcm-target").textContent = m.target.toFixed(1) + " nm";

    setPipe("pipe-gas", m.vGas && m.flowPV > 0.5, "flow-gas", m.vGas && m.flowPV > 0.5);
    setPipe("pipe-vac", m.vGate && m.turboSpin > 0.1, "flow-vac", m.vGate && m.turboSpin > 0.1);
    setPipe("pipe-vent", m.vVent, "flow-vent", m.vVent);
    $("mfc").classList.toggle("is-flowing", m.vGas && m.flowPV > 0.5);
    $("mfc-read").textContent = Math.round(m.flowPV);
    $("pump-turbo").classList.toggle("is-spinning", m.turboSpin > 0.15 && !reduce);
    $("pi-chamber").textContent = eng(m.pressure).replace("−", "-");
    $("qcm-crystal").classList.toggle("is-active", m.rate > 0.01);

    document.querySelectorAll(".msrc").forEach(function (n) {
      var i = +n.dataset.src;
      n.classList.toggle("is-selected", i === m.srcIndex);
      n.classList.toggle("is-active", i === m.srcIndex && m.plasmaOn);
    });

    var st = $("seq-state");
    st.textContent = m.seq.done ? "COMPLETE" : m.seq.running ? (m.seq.hold ? "HELD" : "RUNNING") : "STOPPED";
    st.dataset.state = m.seq.done ? "done" : m.seq.running ? (m.seq.hold ? "hold" : "running") : "stopped";

    if (currentView === "hmi") { drawMimicFx(); drawTrend(); }
    else if (currentView === "data") {
      if (!renderView._lt || m.t - renderView._lt >= 0.4) { updateTagLive(); renderView._lt = m.t; }
    }
  }

  function setBar(id, frac) { $(id).style.width = clamp(frac * 100, 0, 100).toFixed(1) + "%"; }
  function setPipe(pipeId, live, flowId, flowing) {
    $(pipeId).classList.toggle("is-live", live);
    $(flowId).classList.toggle("is-flowing", flowing && !reduce);
  }

  var fxParticles = [];
  function drawMimicFx() {
    fxc.clearRect(0, 0, 640, 400);
    if (!m.plasmaOn) { fxParticles.length = 0; return; }

    var cx = 365, cy = 230;
    var g = fxc.createRadialGradient(cx, cy, 8, cx, cy, 62);
    var a = 0.28 + 0.12 * Math.sin(m.t * 4);
    g.addColorStop(0, "rgba(90,150,210," + a + ")");
    g.addColorStop(1, "rgba(90,150,210,0)");
    fxc.fillStyle = g;
    fxc.fillRect(300, 160, 130, 150);

    if (!reduce) {
      var src = cfg.srcPositions[m.srcIndex];
      for (var k = 0; k < 3; k++) {
        fxParticles.push({
          x: src + (Math.random() - 0.5) * 14, y: 290,
          vx: (365 - src) * 0.006 + (Math.random() - 0.5) * 0.4,
          vy: -1.4 - Math.random() * 1.2, life: 1
        });
      }
    }
    fxc.fillStyle = "rgba(120,175,225,0.9)";
    for (var i = fxParticles.length - 1; i >= 0; i--) {
      var p = fxParticles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      var ceil = m.shutterOpen ? 160 : 190;
      if (p.life <= 0 || p.y < ceil || p.x < 305 || p.x > 425) { fxParticles.splice(i, 1); continue; }
      fxc.globalAlpha = Math.max(0, p.life) * 0.8;
      fxc.fillRect(p.x, p.y, 1.6, 1.6);
    }
    fxc.globalAlpha = 1;

    if (m.thick > 0 && m.shutterOpen) {
      fxc.fillStyle = "rgba(120,175,225,0.9)";
      fxc.fillRect(332, 157, 66, Math.min(m.thick / 20, 4));
    }
  }

  function drawTrend() {
    var w = trend._w, h = trend._h;
    if (!w) return;
    tc.clearRect(0, 0, w, h);
    var pad = { l: 4, r: 4, t: 6, b: 6 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;

    tc.strokeStyle = "rgba(255,255,255,0.06)";
    tc.lineWidth = 1;
    for (var gx = 0; gx <= 6; gx++) {
      var xx = x0 + (x1 - x0) * gx / 6;
      tc.beginPath(); tc.moveTo(xx, y0); tc.lineTo(xx, y1); tc.stroke();
    }
    for (var gy = 0; gy <= 3; gy++) {
      var yy = y0 + (y1 - y0) * gy / 3;
      tc.beginPath(); tc.moveTo(x0, yy); tc.lineTo(x1, yy); tc.stroke();
    }

    if (hist.length < 2) {
      tc.fillStyle = "rgba(255,255,255,0.25)";
      tc.font = "10px 'IBM Plex Mono', monospace";
      tc.fillText("awaiting process data…", x0 + 10, (y0 + y1) / 2);
      return;
    }
    var span = 180;
    var tNow = m.t;
    function px(t) { return x0 + (x1 - x0) * (1 - (tNow - t) / span); }
    function pyLog(p) {
      var e = clamp(Math.log10(clamp(p, 1e-7, 1e3)), -7, 3);
      return y1 - (y1 - y0) * (e + 7) / 10;
    }
    plot(function (d) { return pyLog(d.p); }, "#6fe0a0");
    plot(function (d) { return y1 - (y1 - y0) * clamp(d.w / cfg.powerMax, 0, 1); }, "#f0b44a");
    plot(function (d) { return y1 - (y1 - y0) * clamp((d.temp - 20) / 780, 0, 1); }, "#e8877a");
    plot(function (d) { return y1 - (y1 - y0) * clamp(d.d / (m.target * 1.2), 0, 1); }, "#7fb8e8");

    function plot(fy, col) {
      tc.strokeStyle = col; tc.lineWidth = 1.4; tc.beginPath();
      var started = false;
      for (var i = 0; i < hist.length; i++) {
        var d = hist[i];
        if (tNow - d.t > span) continue;
        var X = px(d.t), Y = fy(d);
        if (!started) { tc.moveTo(X, Y); started = true; } else tc.lineTo(X, Y);
      }
      tc.stroke();
    }
  }

  function renderAlarms() {
    var tb = $("alarm-rows");
    if (!alarms.length) {
      tb.innerHTML = '<tr class="alarm-empty"><td colspan="5">No active alarms.</td></tr>';
      return;
    }
    tb.innerHTML = alarms.slice(0, 10).map(function (a) {
      var sev = a.sev === "alm" ? '<span class="sev sev-alm">ALM</span>' :
                a.sev === "wrn" ? '<span class="sev sev-wrn">WRN</span>' :
                '<span class="sev sev-evt">EVT</span>';
      var stateCls = a.state === "unack" ? "st-unack" : a.state === "ack" ? "st-ack" : "st-rtn";
      var stateTxt = a.state === "unack" ? "UNACK" : a.state === "ack" ? "ACK" : "—";
      return '<tr class="alarm-row ' + (a.state === "unack" ? "is-unack" : "") + '">' +
        "<td>" + a.time + "</td><td>" + sev + "</td><td>" + a.tag + "</td>" +
        "<td>" + a.msg + '</td><td class="' + stateCls + '">' + stateTxt + "</td></tr>";
    }).join("");
  }

  function syncSeqUI() {
    document.querySelectorAll(".seq-list li").forEach(function (li) {
      var s = +li.dataset.step;
      li.classList.toggle("is-active", m.seq.running && s === m.seq.step);
      li.classList.toggle("is-done", m.seq.done || s < m.seq.step);
      var tm = li.querySelector(".seq-timer");
      if (m.seq.running && s === m.seq.step) tm.textContent = "t+" + m.seq.stepT.toFixed(0) + "s";
      else if (s < m.seq.step || m.seq.done) tm.textContent = "done";
      else tm.textContent = "—";
    });
    $("btn-seq-start").disabled = m.seq.running;
    $("btn-seq-start").textContent = m.seq.done ? "RESET & START" : "START";
    $("btn-seq-hold").disabled = !m.seq.running;
    $("btn-seq-hold").textContent = m.seq.hold ? "RESUME" : "HOLD";
    $("btn-seq-skip").disabled = !m.seq.running;
  }

  // ---------------------------------------------------------------- static layout (machine switch)
  function buildMimicSources() {
    var g = $("mimic-sources");
    g.innerHTML = cfg.srcPositions.map(function (x, i) {
      return '<g class="msrc" data-src="' + i + '" transform="translate(' + x + ',292)">' +
        '<rect x="-11" y="0" width="22" height="22" rx="2" />' +
        '<rect class="msrc-face" x="-12" y="-4" width="24" height="5" rx="1" /></g>';
    }).join("");
    $("mimic-src-caption").textContent = cfg.srcCaption;
    $("mimic-chamber-label").textContent = cfg.chamberLabel;
  }

  function buildSourcePicker() {
    var sel = $("src-pick");
    sel.innerHTML = cfg.sources.map(function (s, i) {
      return '<option value="' + i + '" data-mat="' + s.mat + '"' + (i === cfg.defaultSrcIndex ? " selected" : "") + '>' + s.label + '</option>';
    }).join("");
    $("src-mat").textContent = cfg.sources[cfg.defaultSrcIndex].mat;
  }

  function buildRecipePanel() {
    $("recipe-label").textContent = cfg.recipeLabel;
    $("seq-list").innerHTML = cfg.steps.map(function (s, i) {
      return '<li data-step="' + i + '"><span class="seq-n">' + (i + 1) + '</span>' +
        '<span class="seq-t">' + s.name + '</span><span class="seq-cond">' + s.cond + '</span>' +
        '<span class="seq-timer">—</span></li>';
    }).join("");
  }

  function buildSetpointLimits() {
    $("sp-power").max = cfg.powerMax; $("sp-power").value = cfg.powerSP;
    $("sp-flow").max = cfg.flowMax; $("sp-flow").value = cfg.flowSP;
    $("sp-temp").value = cfg.tempSP;
    $("qcm-target").textContent = cfg.target.toFixed(1) + " nm";
  }

  function bindSteps() {
    cfg.steps.forEach(function (s) {
      switch (s.name) {
        case "Pumpdown":
          s.enter = function () { setValve("v-gate", true); setValve("v-gas", false); setValve("v-vent", false); };
          s.done = function () { return m.pressure <= s.pumpTarget; };
          s.force = function () { m.pressure = s.pumpTarget; m.turboSpin = 1; };
          break;
        case "Gas stabilise":
          s.enter = function () { setValve("v-gas", true); setFlowSP(s.flowSP); };
          s.done = function (dt) { return dt >= s.dwell && Math.abs(m.flowPV - s.flowSP) < s.flowTol; };
          s.force = function () { m.flowPV = s.flowSP; m.pressure = 3e-3; };
          break;
        case "Plasma strike":
          s.enter = function () { tryStrike(true); };
          s.done = function () { return m.plasmaOn && m.powerPV > s.strikePowerMin; };
          s.force = function () {
            if (m.pressure < 1e-3 || m.pressure > 2e-2) m.pressure = 3e-3;
            setPlasma(true);
            m.powerPV = Math.max(s.strikePowerMin + 1, m.powerSP);
          };
          break;
        case "Pre-sputter":
          s.enter = function () { setShutter(false); };
          s.done = function (dt) { return dt >= s.dwell; };
          s.force = function () { m.seq.stepT = s.dwell; };
          break;
        case "Deposit":
          s.enter = function () { setShutter(true); };
          s.done = function () { return m.thick >= m.target; };
          s.force = function () { m.thick = m.target; };
          break;
        case "Shutdown & vent":
          s.enter = function () { setPlasma(false); setFlowSP(0); };
          s.done = function () {
            if (m.powerPV <= 5 && !m.vVent && m.pressure < 1e-4) { setValve("v-gas", false); setValve("v-gate", false); setValve("v-vent", true); }
            return m.pressure > 900;
          };
          s.force = function () {
            m.plasmaOn = false; m.powerPV = 0; m.flowPV = 0;
            setValve("v-gas", false); setValve("v-gate", false); setValve("v-vent", true);
            m.pressure = 900;
          };
          break;
      }
    });
  }

  function loadMachine(id) {
    cfg = MACHINES[id];
    bindSteps();
    m = freshModel();
    hist = [];
    fxParticles.length = 0;
    alarms.length = 0;
    alarmSeen = {};

    document.title = cfg.label + " Control HMI";
    $("machine-name").textContent = cfg.label;
    $("machine-unit").textContent = cfg.unitTag;

    buildMimicSources();
    buildSourcePicker();
    buildRecipePanel();
    buildSetpointLimits();
    learnBuilt = false; dataBuilt = false;
    if (currentView === "learn") buildLearn();
    if (currentView === "data") buildData();

    syncSeqUI();
    renderAlarms();
    logEvent("SYS", "HMI online — chamber at atmosphere, pumps idle");
    fitCanvas();
  }

  // ================================================================ LEARN + DATA
  function buildTags() {
    return [
      { tag: "SYS.MODE", kind: "derived", desc: "Overall machine state inferred from equipment: STANDBY, PUMPING, PROCESS, VENT, FAULT.", unit: "enum", range: "STANDBY idle", where: "Status bar", live: function () { return m.mode.toUpperCase(); } },
      { tag: "PI-01", kind: "reading", desc: "Chamber pressure. Lower = better vacuum. Exponent form: 5e-7 = 5×10⁻⁷.", unit: "mbar", range: "5e−7 … 1013", where: "Mimic gauge · GAS & VACUUM", live: function () { return eng(m.pressure) + " mbar"; } },
      { tag: "MFC-Ar", kind: "setpoint", desc: "Mass Flow Controller for argon — meters a precise gas flow regardless of pressure.", unit: "sccm", range: "0–" + cfg.flowMax, where: "Mimic · GAS & VACUUM", live: function () { return m.flowPV.toFixed(1) + " / SP " + m.flowSP; } },
      { tag: "V-GAS", kind: "equipment", desc: "Argon isolation valve. MFC only delivers gas when this is open.", unit: "open/closed", range: "closed by default", where: "Mimic — clickable", live: function () { return m.vGas ? "OPEN" : "CLOSED"; } },
      { tag: "V-GATE", kind: "equipment", desc: "Gate valve between chamber and turbo pump. Must be open to pump down or run plasma.", unit: "open/closed", range: "open in pumping/process", where: "Mimic — clickable", live: function () { return m.vGate ? "OPEN" : "CLOSED"; } },
      { tag: "V-VENT", kind: "equipment", desc: "Vent valve — lets N₂/air back in. Interlocked shut while power is live.", unit: "open/closed", range: "closed except venting", where: "Mimic — clickable", live: function () { return m.vVent ? "OPEN" : "CLOSED"; } },
      { tag: "TURBO", kind: "equipment", desc: "Turbomolecular pump. High-vacuum stage; needs rough vacuum + backing pump behind it.", unit: "% speed", range: "at speed when pumping", where: "Mimic, bottom left", live: function () { return m.turboSpin > 0.9 ? "at speed" : Math.round(m.turboSpin * 100) + "%"; } },
      { tag: "PWR-CATH", kind: "setpoint", desc: "Cathode power into the source. Ramps at " + cfg.powerRampUp + " W/s.", unit: "W", range: "0–" + cfg.powerMax, where: "SOURCE & POWER", live: function () { return Math.round(m.powerPV) + " / SP " + m.powerSP; } },
      { tag: "PLASMA", kind: "reading", desc: "Whether a discharge is lit. Needs the pressure window + gas flow to strike.", unit: "on/off", range: "on during process", where: "SOURCE & POWER · mimic glow", live: function () { return m.plasmaOn ? "ON" : "OFF"; } },
      { tag: "SRC-SEL", kind: "setpoint", desc: "Which fitted source is active.", unit: "index", range: "SRC1–" + cfg.sources.length, where: "SOURCE & POWER dropdown", live: function () { return "SRC" + (m.srcIndex + 1) + " — " + matName(); } },
      { tag: "TE-PLATEN", kind: "setpoint", desc: "Substrate heater. SSIC heater spec — up to 800 °C.", unit: "°C", range: "20–800", where: "SUBSTRATE", live: function () { return Math.round(m.tempPV) + " / SP " + m.tempSP; } },
      { tag: "SHU", kind: "equipment", desc: "Shutter between source and wafer — times deposition precisely.", unit: "open/closed", range: "open only in Deposit", where: "SUBSTRATE · mimic blade", live: function () { return m.shutterOpen ? "OPEN" : "CLOSED"; } },
      { tag: "QCM1", kind: "reading", desc: "Quartz crystal microbalance — converts resonant-frequency shift into live film thickness.", unit: "nm", range: "0 → " + cfg.target + " target", where: "QCM1 faceplate · mimic crystal", live: function () { return m.thick.toFixed(1) + " nm"; } },
      { tag: "QCM1.RATE", kind: "reading", desc: "Live deposition rate from the QCM. Zero unless plasma is on and shutter open.", unit: "nm/s", range: "0…~1", where: "QCM1 faceplate", live: function () { return m.rate.toFixed(3); } },
      { tag: "SEQ.STEP", kind: "derived", desc: "Which recipe step the sequencer is executing, or STOPPED.", unit: "step", range: "1–" + cfg.steps.length, where: "RECIPE faceplate", live: function () { return m.seq.running ? (m.seq.step + 1) + "/" + cfg.steps.length : (m.seq.done ? "DONE" : "STOPPED"); } }
    ];
  }

  var GLOSSARY_BASE = [
    ["PVD", "Turning a source material into vapour in vacuum and letting it condense as a film. No chemistry involved — sputtering and evaporation are both PVD."],
    ["Base pressure", "The best vacuum an empty chamber reaches — a cleanliness spec. Lower = fewer stray molecules to contaminate the film."],
    ["mbar / sccm", "mbar = pressure unit (atm ≈ 1013 mbar). sccm = gas flow rate (std cm³/min). More sccm into a fixed pump ⇒ higher chamber pressure."],
    ["Sputtering", "Bombarding a solid target with Ar⁺ ions to knock atoms loose; they fly across the chamber and build up as a film on the wafer."],
    ["Plasma / strike / trip", "A glowing partly-ionised gas. 'Strike' = light it; 'trip' = it goes out because conditions left the sustain window."],
    ["Target / substrate", "Target = source material being sputtered away. Substrate = the wafer being coated, on the platen."],
    ["QCM", "Quartz Crystal Microbalance — resonant frequency shifts as mass lands on it; converted live into thickness (nm) and rate (nm/s)."],
    ["Turbo + backing pump", "Turbo does high vacuum but can only exhaust into a rough vacuum, so a backing pump runs behind it the whole time."],
    ["MFC", "Mass Flow Controller — self-regulating valve that delivers an exact commanded gas flow regardless of upstream pressure."],
    ["Interlock", "A control-system rule that blocks an action while unsafe/pointless and posts an alarm instead of acting."],
    ["SP vs PV", "SP = setpoint, the target you command. PV = process value, the live measured actual. Control loops drag PV → SP."]
  ];

  var WALK_BASE = [
    ["1 Pump down", null, "Opens V-GATE, V-GAS/V-VENT shut, turbo+backing evacuate.", "Fewer gas molecules ⇒ lower pressure.", "V-GATE closed or turbo not spun ⇒ stalls, never completes."],
    ["2 Gas stabilise", null, "Opens V-GAS, MFC → SP, waits for flow + pressure to settle.", "Gas in vs pump out reaches equilibrium at working pressure.", "V-GAS still shut ⇒ MFC reads SP, delivers 0, next step blocked."],
    ["3 Plasma strike", null, "Commands strike; interlock checks pressure window + V-GATE + flow.", "Field ionises Ar; Ar⁺ ions sputter the target.", "Outside 1–20e-3 mbar ⇒ PLASMA-NOSTRIKE, no discharge."]
  ];

  var MATRIX = [
    ["PI-01 outside 1e-3 … 2e-2 mbar", "Strike plasma", "PLASMA-NOSTRIKE", "Too little gas ⇒ no stable discharge; too much ⇒ arcing.", "Trim Ar flow until PI-01 sits mid-window, then strike."],
    ["V-GATE closed", "Strike / pump down", "PLASMA-NOSTRIKE", "No active pumping ⇒ pressure uncontrolled.", "Open V-GATE, let turbo reach speed."],
    ["No Ar flow (V-GAS shut)", "Strike plasma", "PLASMA-NOSTRIKE", "Nothing to ionise.", "Open V-GAS, set MFC to working flow."],
    ["Plasma on / power > 5 W", "Open V-VENT", "VENT-INHIBIT", "Air + live discharge risks arcing and an oxidised hot target.", "Kill plasma, wait power → 0, then vent."],
    ["Turbo not at speed", "High-vac pumping", "(soft — stalls)", "Below full speed it barely pumps.", "Wait a few seconds for spin-up."],
    ["Operator hits ABORT", "forces safe state", "ABORT", "Can't know why you hit it — assumes the worst.", "Power→0, shutter closed, gas off, V-GATE held open."]
  ];

  var tagSort = { k: null, dir: 1 };
  function renderTagTable() {
    var TAGS = buildTags();
    var q = ($("tag-filter").value || "").toLowerCase().trim();
    var rows = TAGS.slice();
    if (tagSort.k) {
      rows.sort(function (a, b) {
        var av = String(a[tagSort.k] || "").toLowerCase();
        var bv = String(b[tagSort.k] || "").toLowerCase();
        return av < bv ? -tagSort.dir : av > bv ? tagSort.dir : 0;
      });
    }
    var shown = 0;
    $("tag-rows").innerHTML = rows.map(function (t) {
      var hay = (t.tag + " " + t.kind + " " + t.desc + " " + t.where + " " + t.unit).toLowerCase();
      var hide = q && hay.indexOf(q) === -1;
      if (!hide) shown++;
      return '<tr class="' + (hide ? "tag-hidden" : "") + '" data-tag="' + t.tag + '">' +
        "<td>" + t.tag + "</td>" +
        '<td><span class="tag-kind k-' + t.kind + '">' + t.kind + "</span></td>" +
        "<td>" + t.desc + "</td>" +
        '<td class="tl-unit">' + t.unit + "</td>" +
        '<td class="tl-range">' + t.range + "</td>" +
        '<td class="tl-where">' + t.where + "</td>" +
        '<td class="tl-live" data-live="' + t.tag + '">' + t.live() + "</td>" +
        "</tr>";
    }).join("");
    $("tag-count").textContent = q ? shown + " / " + TAGS.length : TAGS.length + " tags";
  }
  function updateTagLive() {
    if ($("view-data").hidden) return;
    buildTags().forEach(function (t) {
      var cell = document.querySelector('.tl-live[data-live="' + CSS.escape(t.tag) + '"]');
      if (cell) cell.textContent = t.live();
    });
  }

  function renderGlossary() {
    var entries = GLOSSARY_BASE.concat(cfg.glossaryExtra || []);
    $("glossary").innerHTML = entries.map(function (g) {
      return "<div><dt>" + g[0] + "</dt><dd>" + g[1] + "</dd></div>";
    }).join("");
  }

  function renderWalk() {
    $("walk-title").textContent = "RECIPE WALKTHROUGH — " + cfg.recipeMaterial + ", " + cfg.steps.length + " steps";
    $("walk-rows").innerHTML = cfg.steps.map(function (s, i) {
      return "<tr><td>" + (i + 1) + " " + s.name + "</td><td>" + s.cond + "</td><td>" +
        s.does + "</td><td>" + s.why + "</td><td>" + s.fail + "</td></tr>";
    }).join("");
  }

  function renderMatrix() {
    $("matrix-rows").innerHTML = MATRIX.map(function (r) {
      return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  function renderSpec() {
    $("spec-rows").innerHTML = cfg.spec.map(function (r) {
      return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>";
    }).join("");
    $("spec-note").textContent = cfg.specNote;
  }

  var learnBuilt = false, dataBuilt = false;
  function buildLearn() { renderGlossary(); renderWalk(); renderMatrix(); learnBuilt = true; }
  function buildData() { renderTagTable(); renderSpec(); dataBuilt = true; }

  var currentView = "hmi";
  function setView(v) {
    currentView = v;
    $("view-hmi").hidden = v !== "hmi";
    $("view-learn").hidden = v !== "learn";
    $("view-data").hidden = v !== "data";
    ["hmi", "learn", "data"].forEach(function (name) {
      var tab = $("vtab-" + name);
      tab.classList.toggle("is-active", name === v);
      tab.setAttribute("aria-selected", String(name === v));
    });
    if (v === "learn") { if (!learnBuilt) buildLearn(); }
    else if (v === "data") { if (!dataBuilt) buildData(); updateTagLive(); }
    else fitCanvas();
  }

  function wireLearn() {
    $("vtab-hmi").addEventListener("click", function () { setView("hmi"); });
    $("vtab-learn").addEventListener("click", function () { setView("learn"); });
    $("vtab-data").addEventListener("click", function () { setView("data"); });

    document.querySelectorAll(".ln-link").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".ln-link").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        document.querySelectorAll(".learn-panel").forEach(function (p) { p.hidden = p.id !== b.dataset.sec; });
      });
    });

    $("tag-filter").addEventListener("input", renderTagTable);
    document.querySelectorAll("#tagtable th[data-k]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        tagSort.dir = (tagSort.k === k) ? -tagSort.dir : 1;
        tagSort.k = k;
        document.querySelectorAll("#tagtable th[data-k]").forEach(function (x) { x.classList.remove("sort-asc", "sort-desc"); });
        th.classList.add(tagSort.dir === 1 ? "sort-asc" : "sort-desc");
        renderTagTable();
        updateTagLive();
      });
    });
  }

  // ---------------------------------------------------------------- wiring
  function wire() {
    wireLearn();

    ["v-gas", "v-gate", "v-vent"].forEach(function (id) {
      $(id).addEventListener("click", function () { toggleValve(id); });
    });

    $("sp-power").addEventListener("change", function () { m.powerSP = clamp(+this.value || 0, 0, cfg.powerMax); this.value = m.powerSP; });
    $("sp-flow").addEventListener("change", function () { m.flowSP = clamp(+this.value || 0, 0, cfg.flowMax); this.value = m.flowSP; });
    $("sp-temp").addEventListener("change", function () { m.tempSP = clamp(+this.value || 20, 20, 800); this.value = m.tempSP; });

    $("src-pick").addEventListener("change", function () {
      m.srcIndex = +this.value;
      $("src-mat").textContent = this.options[this.selectedIndex].dataset.mat;
      logEvent("SRC", "Active source → " + this.options[this.selectedIndex].text.trim());
    });

    $("btn-plasma").addEventListener("click", function () { tryStrike(false); });
    $("btn-shutter").addEventListener("click", function () { setShutter(!m.shutterOpen); });

    $("btn-abort").addEventListener("click", abort);
    $("btn-ack").addEventListener("click", ackAll);

    $("btn-seq-start").addEventListener("click", function () {
      if (m.seq.done) { m.thick = 0; m.seq.done = false; }
      startSequence();
    });
    $("btn-seq-hold").addEventListener("click", holdSequence);
    $("btn-seq-skip").addEventListener("click", skipStep);

    $("machine-pick").addEventListener("change", function () { loadMachine(this.value); });

    window.addEventListener("resize", function () { clearTimeout(wire._r); wire._r = setTimeout(fitCanvas, 120); });
  }
  function setComms(state) {
    var led = $("comms-led");
    led.className = "led " + (state === "warn" ? "led-warn led-blink" : state === "bad" ? "led-bad led-blink" : "led-ok");
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    wire();
    loadMachine($("machine-pick").value);

    var acc = 0, last = performance.now();
    function loop(now) {
      acc += Math.min(now - last, 250);
      last = now;
      while (acc >= DT * 1000) { stepModel(); acc -= DT * 1000; }
      if (!hist.length || m.t - hist[hist.length - 1].t >= 0.5) {
        hist.push({ t: m.t, p: m.pressure, w: m.powerPV, temp: m.tempPV, d: m.thick });
        while (hist.length && m.t - hist[0].t > 200) hist.shift();
      }
      renderView();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
