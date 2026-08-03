# FieldVision analytics — iOS app icon (direction 1c)

Cream tile (#FFF8F0), FV wordmark (F #4A94E4 / V #1B2A4A), four bars below the
baseline with the tallest in accent blue (#3B82F6).

## Drop into Xcode
1. In `Assets.xcassets`, delete the existing `AppIcon` set.
2. Copy this folder in as `AppIcon.appiconset` (it already has `Contents.json`).
3. Or: drag the individual PNGs onto the matching slots in the AppIcon inspector.
4. Single-size projects (Xcode 14+): use `AppIcon-1024.png` alone.

All PNGs are square, full-bleed, opaque (no alpha, no pre-rounded corners) —
iOS applies the mask. Extra sizes beyond the appiconset (`152`, `167`, etc.) are
included for iPad and legacy slots.

## Files
- `AppIcon-1024.png` — App Store / marketing master
- `AppIcon-<n>.png` — rasterized at n×n
- `Contents.json` — iPhone + marketing slots
- `_master.png` — 1168px capture the set was scaled from
