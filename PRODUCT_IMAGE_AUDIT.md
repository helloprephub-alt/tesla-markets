# Tesla Markets product image audit — 2026-11-28

## Summary

- Catalog entries audited: 261
- Products with a primary image field: 116
- Products missing a primary image field: 145
- Missing-primary entries that still have a gallery field: 0
- Missing-primary entries with a sourceUrl field: 5
- Product IDs are unique URL-safe slugs: yes

**Scope:** Source-catalog field audit only. Two additional apparel images were added after verification against official Tesla Shop product listings and their Tesla-hosted image assets. This does not claim that every assigned image has been visually checked or loads in a browser. The three Kids Tees shown in the user screenshot have primary image URLs; their image proxy endpoint returned `200 image/jpeg` in both the current production deployment and the latest preview. On the latest preview, proxy responses for those three products plus Kids CyberMonsterTruck Tee and Men's Tesla Optimus Essential Tee all returned `200 image/jpeg`. A disallowed external image host returned `403`, confirming the proxy allowlist rejection path.

**Image sourcing rule:** Do not assign unrelated stock or category images as if they were the exact product. Fill missing entries only with a verified matching product image, preferably from the official product listing or an authorized supplier.

## Products missing a primary image

### Apparel (11)

- `winter-holiday-sweater` — Winter Holiday Sweater (sourceUrl field present)
- `winter-holiday-scarf` — Winter Holiday Scarf (sourceUrl field present)
- `winter-holiday-beanie` — Winter Holiday Beanie
- `winter-holiday-tee` — Winter Holiday Tee (sourceUrl field present)

- `model-3-performance-hoodie` — Model 3 Performance Hoodie
- `model-sx-plaid-snapback` — Model S/X Plaid Snapback Hat
- `cyberbeast-trucker` — Cyberbeast Trucker Hat
- `relaxed-t-logo-hat` — Relaxed T Logo Hat

- `dog-mode-onesie` — Dog Mode Onesie
- `holiday-cat-mode-box` — Holiday Cat Mode Baby Box Set
- `holiday-dog-mode-box` — Holiday Dog Mode Baby Box Set

### Lifestyle (25)

- `cybercab-backpack` — Tesla Cybercab Backpack
- `tesla-essential-backpack` — Tesla Essential Backpack
- `tesla-mini-essential-backpack` — Tesla Mini Essential Backpack
- `glass-chilling-stone` — Tesla Glass and Chilling Stone Set
- `cybertruck-rc-racer` — Tesla Cybertruck RC Racer
- `tesla-action-figure` — Tesla Action Figure 2.5 | Factory Edition
- `cybercab-pullback-racer` — Cybercab Pullback Racer
- `cybertruck-pullback-racer` — Cybertruck Pullback Racer
- `cybertruck-holiday-diecast-143` — 1:43 Scale Cybertruck Diecast | Holiday Edition
- `cybercab-diecast-143` — 1:43 Scale Cybercab Diecast
- `model-3-diecast-143` — 1:43 Scale Model 3 Diecast
- `model-y-diecast-143` — 1:43 Scale Model Y Diecast
- `cybertruck-diecast-143` — 1:43 Scale Cybertruck Diecast
- `cybercab-wooden-toy` — Tesla Cybercab Wooden Toy
- `dog-mode-plushie` — Tesla Dog Mode Plushie
- `semi-cybertruck-playset` — Tesla Semi + Cybertruck Wooden Playset
- `winter-holiday-dog-sweater` — Winter Holiday Dog Sweater
- `winter-holiday-blanket` — Winter Holiday Blanket
- `tesla-performance-umbrella` — Tesla Performance Umbrella
- `dog-mode-bandana` — Dog Mode Bandana
- `dog-mode-chew-toy` — Dog Mode Chew Toy
- `on-road-chair` — On the Road Chair
- `caraokemic` — CaraokeMic
- `cybertruck-cyberquad` — Cybertruck Cyberquad
- `tesla-ornament` — Tesla Ornament

### Vehicle Accessories (104)

- `model-3-air-mattress` — Model 3/Y Air Mattress
- `model-3-door-liners` — Model 3 Door Pocket + Cupholder Liners
- `model-3-sunshade` — Model 3 Sunshade Bundle
- `model-3-car-cover` — Model 3 Car Cover
- `model-3-carbon-spoiler` — Model 3 Carbon Fiber Spoiler
- `model-3-tow-package` — Model 3 Tow Package
- `air-compressor-repair-kit` — Air Compressor + Tire Repair Kit 3.0
- `tire-repair-sealant` — Tire Repair Sealant 3.0
- `detailing-kit` — Model SX3Y Detailing Kit
- `roadside-safety-kit` — Roadside Safety Kit
- `model-3-wiper` — Model 3 Wiper Blade
- `model-s-liner-bundle` — Model S All-Weather Liner Bundle
- `model-s-mud-flaps` — Model S Mud Flaps
- `model-s-car-cover` — Model S Car Cover
- `model-s-key-fob` — Model S Key Fob
- `model-x-liner-bundle` — Model X All-Weather Liner Bundle (sourceUrl field present)
- `model-x-interior-liners` — Model X All-Weather Interior Liners (sourceUrl field present)
- `model-x-front-trunk-liner` — Model X All-Weather Front Trunk Liner
- `model-x-pet-liner` — Model X Pet Liner
- `model-x-cargo-net` — Model X Cargo Net
- `model-x-hitch-rack-platform` — Model X/Y Platform Hitch Rack
- `model-x-hanging-hitch-rack` — Model X/Y Hanging Hitch Rack
- `model-x-car-cover` — Model X Car Cover
- `model-x-mud-flaps` — Model X Mud Flaps
- `model-x-key-fob` — Model X Key Fob
- `model-y-cargo-liner` — 2020–2024 Model Y All-Weather Rear Cargo Liner Set
- `model-y-front-trunk-liner` — Model Y All-Weather Front Trunk Liner
- `cybertruck-carpet-interior-mats` — Cybertruck Carpet Interior Mats
- `cybertruck-cooler` — Cybertruck Cooler
- `cybertruck-j1772-adapter-door-dock` — Cybertruck J1772 Adapter Door Dock
- `cybertruck-off-road-light-bar` — Cybertruck Off-Road Light Bar
- `cybertruck-cybertent` — Cybertruck CyberTent
- `cybertruck-roof-applique-crossbars` — Cybertruck Roof Applique for Crossbars
- `cybertruck-tailgate-ramp` — Cybertruck Tailgate Ramp
- `cybertruck-mud-flaps` — Cybertruck Mud Flaps
- `cybertruck-car-cover` — Cybertruck Car Cover
- `cybertruck-bumper-protectors` — Cybertruck Bumper Protectors
- `cybertruck-omfg-decal` — Cybertruck OMFG Decal
- `cybertruck-tailgate-utility-track` — Cybertruck Tailgate Utility Track
- `cybertruck-air-mattress` — Cybertruck Air Mattress
- `cybertruck-tailgate-shield` — Cybertruck Tailgate Shield
- `cybertruck-jumpseat` — Cybertruck Jumpseat
- `cybertruck-bed-cargo-divider` — Cybertruck Bed Cargo Divider
- `cybertruck-spare-tire-tool-kit` — Cybertruck Spare Tire + Tool Kit
- `cybertruck-tire-repair-sealant` — Cybertruck Tire Repair Sealant
- `cybertruck-tpms` — Cybertruck Tire Pressure Monitoring System
- `cybertruck-detailing-kit` — Cybertruck Detailing Kit
- `cybertruck-wiper-blade` — Cybertruck Wiper Blade
- `cybertruck-hepa-filter` — Cybertruck HEPA Filter
- `model-y-expandable-trunk-organizer` — Model Y Expandable Trunk Organizer
- `model-y-dual-zone-fridge` — Model Y Dual Zone Fridge
- `model-y-underseat-storage-tray` — Model Y Underseat Storage Tray
- `model-y-2020-interior-liners` — 2020–2024 Model Y All-Weather Interior Liners
- `model-y-rugged-textile-rear-mat` — 2020–2024 Model Y Rugged Textile Rear Trunk Mat
- `model-y-carpet-mats` — 2020–2024 Model Y Carpet Interior Mats
- `model-y-third-row-carpet-mats` — 2020–2024 Model Y Carpet Interior Third Row Mats
- `model-y-front-trunk-carpet-mat` — 2020–2024 Model Y Carpet Front Trunk Mat
- `model-y-sub-trunk-organizer` — Model Y Sub-Trunk Organizer
- `model-3-y-headrest-lumbar-pillow` — Model 3/Y Headrest Pillow and Lumbar Pillow
- `model-y-cooler` — Model Y Cooler
- `model-y-performance-console-trays` — Model Y Premium and Performance Center Console Trays
- `model-y-center-console-tray` — Model Y Center Console Tray
- `model-y-center-console-liner` — Model Y Center Console Liner
- `model-y-door-pocket-cupholder-liners` — Model Y Door Pocket + Cup Holder Liners
- `model-y-j1772-adapter-dock` — Model Y J1772 Adapter Door Dock
- `model-y-sunshades` — Model Y Sunshades
- `model-3-y-dashboard-decor-wing` — Model 3/Y Dashboard Décor Wing
- `model-y-front-trunk-cargo-dividers` — Model Y Front Trunk Cargo Dividers
- `model-y-trunk-storage-bins` — Model Y Trunk Storage Bins
- `model-y-parcel-shelf` — Model Y Parcel Shelf
- `model-y-illuminated-door-sills` — Model Y Illuminated Door Sills
- `model-y-projection-lights` — Model Y Projection Lights
- `model-3-y-automatic-garage-opener` — Model 3/Y Automatic Garage Opener
- `model-y-front-trunk-lighting-2020` — 2020–2024 Model Y Front Trunk Lighting
- `model-y-trunk-storage-bins-2020` — 2020–2024 Model Y Trunk Storage Bins
- `model-y-j1772-dock-2020` — 2020–2024 Model Y J1772 Adapter Door Dock
- `model-y-hepa-upgrade-2020` — 2020–2024 Model Y HEPA Air Filtration Upgrade
- `model-y-canopy` — Model Y Canopy
- `model-y-tow-package` — Model Y Tow Package
- `model-y-paint-protection-film` — Model Y Paint Protection Film
- `model-y-license-plate-frame` — Model Y License Plate Frame
- `model-y-aperture-wheel-cover` — Model Y 18-inch Aperture Wheel Cover
- `model-y-crossflow-wheel-cover` — Model Y 19-inch Crossflow Wheel Cover
- `model-y-crossflow-wheel-cap` — Model Y 19-inch Crossflow Wheel Cap
- `model-y-gemini-wheel-cover` — 2020–2024 Model Y Gemini Wheel Cover
- `model-y-gemini-wheel-cap-kit` — 2020–2024 Model Y Gemini Wheel Cap Kit
- `model-y-wiper-blade` — Model Y Wiper Blade
- `model-y-hepa-carbon-filter` — Model Y HEPA + Carbon Filter Kit
- `model-y-key-band` — Model Y Key Band
- `model-3-performance-projection-lights` — Model 3 Performance Projection Lights
- `model-3-projection-lights` — Model 3 Projection Lights
- `model-3-illuminated-door-sills` — 2017–2023 Model 3 Illuminated Door Sills
- `model-3-powered-trunk-retrofit` — 2017–2023 Model 3 Powered Trunk Retrofit
- `model-3-phone-charging-cable` — 2017–2023 Model 3 Phone Charging Cable
- `model-3-turn-signal-stalk-retrofit` — Model 3 Turn Signal Stalk Retrofit
- `model-3-paint-protection-film` — Model 3 Paint Protection Film
- `model-3-powered-sun-license-frame` — Powered By the Sun License Plate Frame
- `model-3-prismata-wheel-winter-package` — Model 3 18-inch Prismata Wheel and Nokian Winter Tire Package
- `model-3-photon-wheel-winter-package` — Model 3 18-inch Photon Wheel and Nokian Winter Tire Package
- `model-3-nova-wheel-winter-package` — Model 3 19-inch Nova Wheel and Pirelli Winter Tire Package
- `model-3-performance-wheel-winter-package` — Model 3 19-inch Performance Wheel and Pirelli Winter Tire Package
- `model-3-snow-chains` — Model 3 18/19-inch Snow Chains
- `model-3-wheel-lock-set` — 2017–2023 Model 3 Wheel Lock Set
- `model-3-key-band` — Model 3 Key Band

### Solar & Energy (2)

- `commercial-solar-panel` — Commercial Solar Panel System
- `solar-mounting-kit` — Solar Mounting Rail & Bracket Kit

### Batteries & Inverters (3)

- `rack-mount-battery` — 48V Rack-Mount Lithium Battery
- `hybrid-inverter` — Hybrid Solar Inverter
- `offgrid-inverter` — Off-Grid Inverter

