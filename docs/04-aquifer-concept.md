# AQUIFER — concept under evaluation

**Problem statement:** PS02 Smart Agriculture — smart irrigation (with crop monitoring as an input).

Origin: proposed by the originality judge ([judging/judge-1-originality.md](judging/judge-1-originality.md)), who estimated 7.5 on originality. This document fleshes it out so the other lenses can score it against GREENWAVE ([03-final-concept.md](03-final-concept.md)).

## One line

Every borewell in a village is a straw in the same glass. AQUIFER makes the ground transparent, shows the shared water table falling, and finds the crop and pumping plan that keeps every well alive.

## The idea

Smart-irrigation projects optimise one field. But groundwater is a commons: each farmer's pump lowers the water table under their neighbours, which drives a race to drill deeper until wells fail. The problem is invisible because it is underground.

AQUIFER has three parts:

1. **A groundwater simulator.** A 2D unconfined-aquifer flow model on a grid (finite-difference, runnable on GPU or CPU in the browser) with monsoon recharge, per-well pumping, and well depths. Cones of depression form around each pump and interfere with each other.
2. **AI core.**
   - A forecast of the water table from public observation-well records and rainfall, validated on held-out wells against a persistence baseline.
   - Crop water demand per plot from crop type and weather (optionally satellite-derived).
   - A cooperative optimizer that chooses a village crop mix and pumping calendar to maximise income subject to no well running dry, compared against the "everyone for themselves" outcome.
3. **A see-through 3D twin.** A cutaway block of a real village: fields and crops on top, glass earth beneath, the water table as a moving translucent surface, borewells as lit straws reaching down into it.

## What the judge sees

- **0–10 s, no clicks:** a cutaway village at dusk. Seasons cycle; the monsoon lifts the water table, pumping drags it down into visible cones. A year counter runs forward and wells start going dark as the table drops past them.
- **First interaction:** click a farm and drill deeper or switch to a thirstier crop. Your well survives; your neighbours' go dry. The judge has just caused the tragedy of the commons.
- **The switch:** turn on the cooperative plan. Crops change on the surface, pumping evens out, the water table stabilises, wells stay lit.
- **The numbers:** years until half the wells are dry, village income, water pumped — business as usual versus the plan.
- **Autoplay:** a guided tour through all of the above.

## The number

- Forecast: water-table error on held-out wells versus a persistence baseline.
- Plan: years of water gained and income retained versus business as usual, in simulation, for one real village's well and crop layout.

## Scope

**In:** one real village or micro-watershed in a groundwater-stressed Indian district; real well locations or a layout derived from public data; four or five crops with published water requirements; one aquifer layer.

**Out:** fractured hard-rock flow physics, multiple aquifer layers, live sensor feeds, any claim that the plan has been tested with farmers.

## Known risks going in

- Public well data (CGWB / India-WRIS) availability and resolution has not been checked.
- Much of peninsular India is hard-rock aquifer, where a smooth water-table model is a simplification.
- Groundwater-level forecasting papers are common, so the forecast alone is not novel; the commons framing and the see-through twin carry the originality.
- The farmer is not the direct user; the likely user is an NGO facilitator or gram panchayat running a village water-budgeting meeting. WOTR's CoDriVE-VI does this with physical 3D models.
- Rendering a convincing transparent subsurface is unproven on our side.
