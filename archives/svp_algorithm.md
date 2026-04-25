# Session Volume Profile (SVP) Algorithm Design

## 1. Context & Anchoring
- **Session**: America/New_York (09:30 - 16:00).
- **Trigger**: `isNewNYSession = (hour === 9 && minute === 30)`.
- **Reset**: When `isNewNYSession` is true, clear `state.vp_bins`.

## 2. Binning Logic
- **binSize**: Derived from `minTick` (e.g., 1 tick or 4 ticks for ES/NQ).
- **Distribution**: 
  - For each bar, calculate `low` and `high`.
  - Distribute standard `volume` across all bins between `low` and `high`.
  - `state.vp_bins[price] += volume / num_bins`.

## 3. POC (Point of Control)
- Iterate through `state.vp_bins`.
- Find the price level with the highest total volume.

## 4. Value Area (VAH / VAL)
- Calculate total session volume.
- Start at POC and expand outwards (up and down) including the next highest volume bin until 70% of total volume is reached.

## 5. Visuals
- POC -> `plot(poc_level, { color: '#ff0000', title: 'POC' })`
- VAH -> `plot(vah_level, { color: '#787b86', title: 'VAH' })`
- VAL -> `plot(val_level, { color: '#787b86', title: 'VAL' })`
