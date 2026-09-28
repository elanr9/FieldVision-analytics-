# Inkbound analytics, iOS app icon

Cream tile (#FFF8F0) with the navy Inkbound runner mark (#203A52) centered at 62%. Generated from public/inkbound-mark.png.



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
