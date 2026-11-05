# 7. 3D Map: Drop-Location Picker, Route & Cost

> **Status: built (simple version).** `app/src/components/Map3D.tsx`, with a 2D/3D toggle at checkout and on the tracking page.
> Demo zone: 1.3 km radius (~5.3 km²) inside a 2.4 × 2.4 km square (~5.8 km²) around the hub.
> Done: 3D drop pick with ground height, route line + rope, height warning, distance fee + battery estimate, live drone in 3D.
> Not done: altitude-profile chart, no-fly zones. To get real 3D buildings, fill in `app/.env` from `app/.env.example`.

## 7.1 Reference: SkyFi "Vantor 3D Surface Model"

What we took from https://app.skyfi.com/3d/vantor-3dsm-bundle:

| Their idea | What it means for us |
|------------|----------------------|
| Photorealistic 3D model of the ground (Vantor 3DSM), delivered as **3D Tiles** and streamed | 3D Tiles is an open standard. CesiumJS can load it directly, so a purchased model can drop into our viewer later. |
| Priced **per km²** (from ~$40/km², about 72 h delivery) | We only need our **service area** (e.g. a 2–3 km radius around the hub). Buying it is optional; free sources work for the exhibition. |
| Map-first UI: search box + area tools on the left, big map in the middle, live **area → price** panel, "Add to cart" | Same pattern for us: pick the drop spot in 3D, and a side panel shows **distance, flight time, route and cost** live before checkout. |
| Draw tools (rectangle, polygon), layer switch, zoom | We need: *point* pick (drop spot), layer switch (3D / satellite / map), "fly to my location". Later, polygons for no-fly zones in the operator console. |

## 7.2 Decision

- **Now (free):** CesiumJS with free 3D sources:
  - **Google Photorealistic 3D Tiles** (needs a free Google Maps Platform API key, with a monthly free quota) gives the most realistic look where Google has coverage.
  - **Cesium World Terrain + OSM Buildings** (free Cesium ion account) works everywhere, with simpler grey buildings.
  - With no key, fall back to the existing 2D Leaflet picker (already built), so the demo never breaks.
- **Later (slot ready):** a `VITE_CUSTOM_3DTILES_URL` setting. If set, the viewer loads that tileset instead, e.g. a purchased **Vantor 3DSM** or **our own model** made by flying the drone/phone camera over the field and processing it in WebODM (free photogrammetry).

## 7.3 Features to build

1. **3D drop picker (checkout):** click the 3D ground to place the marker. Read the **ground height** at that point (Cesium `sampleHeightMostDetailed`). This feeds the real drop altitude to the mission plan, since the destination may not be at the same height as the hub.
2. **Route preview:** a 3D polyline hub → climb to 60 m → cruise → descend to the 4 m hover → rope to the ground. An **altitude profile** chart shows it from the side.
3. **Obstacle check:** sample building/terrain heights along the route. If anything is closer than 10 m below cruise altitude, warn the user and suggest a higher cruise altitude. (The server re-checks before dispatch.)
4. **Live cost panel** (like SkyFi's area → price): distance, flight time, battery use %, delivery fee. Proposed fee = priority base + ₹8/km beyond 1 km (emergency still free). This needs a small change in `server/src/orders.ts → quote()`.
5. **3D tracking:** the drone model moves along the route in the tracking page and the ops monitor, using the same live telemetry (with altitude now visible).
6. **Operator no-fly zones (stretch):** draw polygons. The quote rejects drop points inside them, and the route check avoids them.

## 7.4 How it fits the existing code

```
app/src/components/maps.tsx      2D Leaflet (keep as fallback + for low-end phones)
app/src/components/map3d/        NEW: Cesium viewer, DropPicker3D, Route3D, AltitudeProfile
app/src/pages/Checkout.tsx       toggle "2D map / 3D view", and the cost panel uses /orders/quote
server/src/orders.ts             quote(): distance-based fee + groundAltM + obstacle warnings
server/src/drone/types.ts        MissionPlan gets targetGroundAltM (bridge uses it for the real mission)
```

The 3D viewer is lazy-loaded (Cesium is several MB), so the shop stays fast on phones.
