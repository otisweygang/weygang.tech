/* Per-machine config for the MiniLab HMI. Everything that differs between
   the 026 and 125 builds lives here — the engine, physics and rendering
   code in minilab-core.js is identical for both. Add a new machine by
   adding a new entry; nothing else in the codebase needs to change. */

window.MINILAB_MACHINES = {

  "026": {
    label: "MiniLab 026", unitTag: "PVD‑02 · touchscreen",
    chamberLabel: "CHAMBER MIMIC · clam‑shell",
    srcCaption: "SRC1–2 · baseplate (3 max)",
    srcPositions: [340, 390],          // px, mimic SVG source blocks + fx particle origin
    sources: [
      { label: "SRC1 — Al sputter", mat: "Al · 4N (sputter)" },
      { label: "SRC2 — Cr thermal", mat: "Cr · 3N5 (thermal boat)" }
    ],
    defaultSrcIndex: 0,

    flowMax: 50, flowSP: 15,
    powerMax: 600, powerSP: 200,
    powerRampUp: 25, powerRampDown: 50,
    pumpConductance: 200,
    depositionPowerRef: 200, depositionYield: 0.3,
    tempSP: 22,
    target: 80,

    basePressure: 5e-7,

    recipeLabel: "RECIPE · Al 80 nm",
    recipeMaterial: "Al 80 nm on Si",
    steps: [
      { name: "Pumpdown", cond: "≤ 5e−5 mbar", pumpTarget: 5e-5,
        does: "Opens V-GATE, V-GAS/V-VENT shut, turbo+backing evacuate.",
        why: "Fewer gas molecules ⇒ lower pressure. A looser target than the 125's — good enough for a basic sputter run.",
        fail: "V-GATE closed or turbo not spun ⇒ stalls, never completes." },
      { name: "Gas stabilise", cond: "15 sccm · 20 s", dwell: 20, flowSP: 15, flowTol: 1.5,
        does: "Opens V-GAS, MFC → 15 sccm, waits for flow + pressure to settle.",
        why: "Gas in vs pump out reaches equilibrium at working pressure.",
        fail: "V-GAS still shut ⇒ MFC reads 15, delivers 0, next step blocked." },
      { name: "Plasma strike", cond: "P in window", strikePowerMin: 40,
        does: "Commands strike; interlock checks pressure window + V-GATE + flow.",
        why: "Field ionises Ar; Ar⁺ ions sputter the target. Power ramps 25 W/s to a 600 W ceiling.",
        fail: "Outside 1–20e-3 mbar ⇒ PLASMA-NOSTRIKE, no discharge." },
      { name: "Deposit", cond: "QCM → 80 nm",
        does: "Opens shutter immediately after strike; sequencer watches QCM1 and closes it at target.",
        why: "Sputtered Al lands on the wafer; QCM tracks mass gain live. No automated pre-sputter step here — good practice is to presputter manually first.",
        fail: "Striking straight into an unstable plasma without presputtering can put dirty target material into the film." },
      { name: "Shutdown & vent", cond: "P<5 W · vent",
        does: "Plasma off, power/gas → 0, then V-GATE closed + V-VENT opened.",
        why: "De-energise first, then break vacuum. With no load lock, every unload goes through this full cycle.",
        fail: "Early vent attempt while power live ⇒ VENT-INHIBIT, refused." }
    ],

    glossaryExtra: [
      ["Thermal evaporation", "The 026's second technique: resistively heat a boat/basket until the charge boils off and condenses on the wafer. No plasma involved — simpler than sputtering, but less control over film density."],
      ["Clam-shell chamber", "The 026's chamber body hinges open for loading instead of a separate door — quicker access, simpler mechanically than a load-locked system."],
      ["Load lock (why 026 has none)", "A small airlock chamber that lets you swap wafers without breaking vacuum in the main chamber. The 125 offers one; the 026 doesn't — every wafer change means a full vent/pump cycle, which is the main day-to-day trade-off of the smaller machine."],
      ["Glovebox retrofit", "The 026 is the only MiniLab that can be bolted onto an existing glovebox, so air-sensitive samples never see atmosphere between glovebox and chamber."]
    ],
    spec: [
      ["System type", "Compact MiniLab modular PVD"],
      ["Base pressure (HV)", "<5×10⁻⁷ mbar"],
      ["Sputtering", "Available by configuration"],
      ["Thermal / LTE evaporation", "TE1 + LTE sources available"],
      ["E-beam evaporation", "Not available as standard"],
      ["HiPIMS / pulsed DC", "HiPSTER 1 + Pinnacle 1.5 kW option"],
      ["Max substrate size", "6″ (150 mm)"],
      ["Substrate heating", "Up to 800 °C (SSIC heater)"],
      ["Substrate bias", "RF + DC bias"],
      ["Load lock", "Not available as standard"],
      ["Glovebox compatible", "Yes; retrofit to existing glovebox"],
      ["Control software", "PC + IntelliDep"],
      ["Rate / thickness", "Up to 3 × QCM; SQC-310 option"],
      ["Chamber material", "Stainless steel; CF flanges"]
    ],
    specNote: "Built from the MiniLab 026 datasheet (Moorfield Nanotechnology, a Judges Scientific company). Not affiliated with Moorfield — an independent HMI/PLC demo, figures indicative."
  },

  "125": {
    label: "MiniLab 125", unitTag: "PVD‑01",
    chamberLabel: "CHAMBER MIMIC",
    srcCaption: "SRC1–5 · confocal array",
    srcPositions: [322, 346, 370, 394],
    sources: [
      { label: "SRC1 — Ti", mat: "Ti · 3N5" },
      { label: "SRC2 — Al", mat: "Al · 4N" },
      { label: "SRC3 — Cr", mat: "Cr · 3N5" },
      { label: "SRC4 — SiO₂ (RF)", mat: "SiO₂ (RF)" }
    ],
    defaultSrcIndex: 1,

    flowMax: 60, flowSP: 20,
    powerMax: 1500, powerSP: 300,
    powerRampUp: 25, powerRampDown: 60,
    pumpConductance: 240,
    depositionPowerRef: 300, depositionYield: 0.42,
    tempSP: 200,
    target: 120,

    basePressure: 5e-7,

    recipeLabel: "RECIPE · Al 120 nm",
    recipeMaterial: "Al 120 nm on Si",
    steps: [
      { name: "Pumpdown", cond: "≤ 9e−6 mbar", pumpTarget: 9e-6,
        does: "Opens V-GATE, V-GAS/V-VENT shut, turbo+backing evacuate.",
        why: "Fewer gas molecules ⇒ lower pressure; last decade is slowest (outgassing).",
        fail: "V-GATE closed or turbo not spun ⇒ stalls, never completes." },
      { name: "Gas stabilise", cond: "20 sccm · 30 s", dwell: 30, flowSP: 20, flowTol: 1.5,
        does: "Opens V-GAS, MFC → 20 sccm, waits for flow + pressure to settle.",
        why: "Gas in vs pump out reaches equilibrium at working pressure (~3e-3 mbar).",
        fail: "V-GAS still shut ⇒ MFC reads 20, delivers 0, next step blocked." },
      { name: "Plasma strike", cond: "P in window", strikePowerMin: 50,
        does: "Commands strike; interlock checks pressure window + V-GATE + flow.",
        why: "Field ionises Ar; Ar⁺ ions sputter the target. Power ramps 25 W/s.",
        fail: "Outside 1–20e-3 mbar ⇒ PLASMA-NOSTRIKE, no discharge." },
      { name: "Pre-sputter", cond: "shutter closed · 60 s", dwell: 60,
        does: "Holds plasma with shutter CLOSED.",
        why: "Cleans oxide off the target, lets rate/power/pressure settle before real growth.",
        fail: "Skip it ⇒ first few nm of film are dirty target material." },
      { name: "Deposit", cond: "QCM → 120 nm",
        does: "Opens shutter; sequencer watches QCM1, closes it at target.",
        why: "Sputtered Al lands on the rotating wafer; QCM tracks mass gain live.",
        fail: "Unstable rate ⇒ mistimed shutter close ⇒ wrong thickness." },
      { name: "Shutdown & vent", cond: "P<5 W · vent",
        does: "Plasma off, power/gas → 0, then V-GATE closed + V-VENT opened.",
        why: "De-energise first, then break vacuum — protects the turbo and the target.",
        fail: "Early vent attempt while power live ⇒ VENT-INHIBIT, refused." }
    ],

    glossaryExtra: [
      ["Magnetron", "Magnets behind the target that trap electrons in a racetrack, concentrating the plasma for faster, lower-pressure sputtering."],
      ["Shutter / presputter", "Shutter blocks flux from reaching the wafer. Presputter = run plasma with it closed to clean the target before real deposition."],
      ["HiPIMS", "High-Power Impulse Magnetron Sputtering — short intense power pulses instead of steady DC; denser, more ionised film."],
      ["RF vs DC bias", "DC drives conductive targets (metals). RF is needed for insulators (e.g. SiO₂) so charge doesn't build up and choke the plasma."]
    ],
    spec: [
      ["System type", "High-capability MiniLab PVD"],
      ["Base pressure (HV)", "<5×10⁻⁷ mbar"],
      ["Max sputter sources", "Up to 5; 6 special build"],
      ["E-beam evaporation", "Ferrotec 3–6 kW"],
      ["Thermal / LTE evaporation", "TE1 + LTE sources"],
      ["HiPIMS / pulsed DC", "HiPSTER 1 + Pinnacle 1.5 kW"],
      ["Other techniques", "NPS, RGA, ion beam, IAD"],
      ["Max substrate size", "12″ (300 mm)"],
      ["Substrate heating", "Up to 800 °C (SSIC heater)"],
      ["Substrate bias", "RF + DC bias"],
      ["Load lock", "Optional (up to 8″)"],
      ["Control software", "PC + IntelliDep"],
      ["Rate / thickness", "Up to 4 × QCM; SQC-310 option"]
    ],
    specNote: "Built from the MiniLab 125 datasheet (Moorfield Nanotechnology, a Judges Scientific company). Not affiliated with Moorfield — an independent HMI/PLC demo, figures indicative."
  }
};
