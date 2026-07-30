# Verification tools

Serve the built app first:

    python3 build_dist.py
    (cd dist && python3 -m http.server 8765)

Then:

| Command | What it proves |
|---|---|
| `node tools/unit_table_test.js` | Every conversion in `UNIT_CONVERSIONS` — 21 quantities × 2 systems — matches a published reference value and round-trips exactly. Reads the table straight out of `app.js`, so it cannot drift from the code it checks. |
| `node tools/unit_input_audit.js` | Every unit-tagged input in the application converts by the right factor when the system is switched, and no engine's internal SI value moves. |
| `node tools/unit_engine_audit.js` | Every numeric value the engines hold internally, across all modules, is unchanged by a unit switch. |
| `node tools/pump_selftest.js` | Pump hydraulics end to end: hand calculation from first principles, nozzle selection against duty, the standards checks, unit invariance, schematic layout, and the report. |

A unit system changes what is written on the screen and nothing else. These
tests exist so that stays true.
