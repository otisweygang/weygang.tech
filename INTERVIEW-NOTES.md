Questions
- How is the argon plasma kept stable
- Does the plasma over time damage the housing or shield
- What materialis the shield made of and is it a consumable, are most parts consumables and what is the maintenance cost of a machine like this



# PVD process — interview cold-recite version

**One-liner:** Pump the chamber to vacuum, bleed in a little argon, strike plasma to ionise that argon, open the shutter so the plasma sputters atoms off the target onto the wafer, then power down and vent to unload.

## The 5 stages

1. **Pump down** — evacuate the chamber (turbo + backing pump, `V-GATE` open). Nothing else happens until this is near base pressure.
2. **Gas stabilise** — bleed a small precise trickle of argon in via the MFC (`V-GAS` open). Pressure settles at a working point, balancing gas-in against pump-out.
3. **Plasma strike** — electrically charge the argon: a jolt of power rips electrons off some argon atoms, turning gas into plasma (ions + free electrons). That's what the **STRIKE PLASMA** button does. Only works in a narrow pressure window. Nothing is coated yet — this just gets the plasma lit and stable.
4. **Deposit** — open the shutter. Argon ions in the plasma slam into the target the whole time it's lit, knocking target atoms loose (sputtering). With the shutter open, some of that scattered spray reaches the wafer and builds a film. QCM tracks thickness live; stop at target.
   *(MiniLab 125 only: a 6th step — "pre-sputter" — sits between 3 and 4: plasma on, shutter still closed, ~60 s. Cleans the target and lets the spray settle before opening the door. The 026's simpler recipe skips it.)*
5. **Shutdown & vent** — plasma off, power down, gas off, then vent to atmosphere so the chamber can be opened and the wafer unloaded.

## Key clarification

The plasma never touches the chip — only the **target**. Argon ions are the demolition crew; the knocked-loose target atoms are the actual paint, scattering in random directions when struck (nothing aims at the chip). The wafer just sits in the spray zone and rotates to average the coating out evenly.

## Why the two builds differ

- **MiniLab 125** — 5 sources, sputter + thermal + e-beam + HiPIMS, load lock (swap wafers without breaking vacuum), 1500 W supply, 6-step recipe (has pre-sputter).
- **MiniLab 026** — 2 sources, sputter + thermal only, no load lock (every wafer swap = full vent/pump cycle), 600 W supply, clam-shell chamber, glovebox-retrofittable, 5-step recipe. Simpler = fewer failure modes to reason about live.
