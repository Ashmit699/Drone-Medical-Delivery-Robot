// 3D view of the demo zone (CesiumJS). Used to pick the drop spot at checkout and to watch the
// drone in tracking. Data source is chosen by env vars (see app/.env.example).
import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Cesium3DTileset,
  Color,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  Credit,
  EllipsoidTerrainProvider,
  type Entity,
  ImageryLayer,
  Ion,
  Math as CMath,
  PolylineDashMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useEffect, useRef, useState } from 'react';
import { distanceM } from '../lib/geo';
import type { AppConfig, LatLon, Telemetry } from '../lib/types';

type Source = 'custom' | 'google' | 'ion' | 'basic';
const SOURCE_LABEL: Record<Source, string> = {
  custom: 'Custom 3D model',
  google: 'Google photorealistic 3D',
  ion: 'Cesium terrain + OSM buildings',
  basic: 'Satellite (flat). Add a 3D key for buildings',
};

const env = import.meta.env;
const TEAL = Color.fromCssColorString('#13a7a1');

export interface Pick3D extends LatLon {
  groundAltM: number | null;
}
export interface RouteInfo {
  maxObstacleM: number | null; // tallest thing under the straight route, relative to the hub's ground
  clearanceM: number | null; // cruise altitude minus that
}

async function loadSource(viewer: Viewer): Promise<Source> {
  const esri = () =>
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
        credit: new Credit('Imagery © Esri, Maxar, Earthstar Geographics'),
      }),
    );
  try {
    if (env.VITE_CUSTOM_3DTILES_URL) {
      esri();
      viewer.scene.primitives.add(await Cesium3DTileset.fromUrl(env.VITE_CUSTOM_3DTILES_URL));
      return 'custom';
    }
    if (env.VITE_GOOGLE_MAPS_API_KEY) {
      viewer.scene.globe.show = false;
      viewer.scene.primitives.add(await createGooglePhotorealistic3DTileset({ key: env.VITE_GOOGLE_MAPS_API_KEY }));
      return 'google';
    }
    if (env.VITE_CESIUM_ION_TOKEN) {
      Ion.defaultAccessToken = env.VITE_CESIUM_ION_TOKEN;
      viewer.imageryLayers.add(ImageryLayer.fromWorldImagery({}));
      viewer.terrainProvider = await createWorldTerrainAsync();
      viewer.scene.primitives.add(await createOsmBuildingsAsync());
      return 'ion';
    }
  } catch (err) {
    console.warn('3D source failed, using flat satellite', err);
    viewer.scene.globe.show = true;
  }
  if (viewer.imageryLayers.length === 0) esri();
  return 'basic';
}

/** Ground (or roof) height at each point, in the scene's height datum. null where unknown. */
async function sampleHeights(viewer: Viewer, source: Source, points: LatLon[]): Promise<(number | null)[]> {
  if (source === 'basic') return points.map(() => 0);
  const carts = points.map((p) => Cartographic.fromDegrees(p.lon, p.lat));
  const ours = viewer.entities.values;
  const sampled = viewer.scene.sampleHeightSupported ? await viewer.scene.sampleHeightMostDetailed(carts, ours) : carts.map(() => undefined);
  return sampled.map((c) => (c?.height != null && Number.isFinite(c.height) ? c.height : null));
}

// Drawn on a canvas: Chromium can't decode SVG data URLs through createImageBitmap, which Cesium uses.
function droneIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.strokeStyle = g.fillStyle = '#4f46e5';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(14, 14);
  g.lineTo(34, 34);
  g.moveTo(34, 14);
  g.lineTo(14, 34);
  g.stroke();
  for (const [x, y] of [[14, 14], [34, 14], [14, 34], [34, 34]]) {
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.stroke();
  }
  g.fillStyle = '#4f46e5';
  g.fillRect(19, 19, 10, 10);
  return c;
}

export default function Map3D({
  config,
  target,
  onPick,
  onRoute,
  drone,
  className,
}: {
  config: AppConfig;
  target: (LatLon & { groundAltM?: number | null }) | null;
  onPick?: (p: Pick3D) => void;
  onRoute?: (r: RouteInfo) => void;
  drone?: Telemetry | null;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [hubGround, setHubGround] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const routeEntities = useRef<Entity[]>([]);
  const droneState = useRef<{ t: Telemetry | null; trail: Cartesian3[] }>({ t: null, trail: [] });
  const callbacks = useRef({ onPick, onRoute });
  callbacks.current = { onPick, onRoute };
  const sourceRef = useRef<Source | null>(null);
  // The drone's altitude is relative to the hub's ground.
  const droneGround = useRef(0);
  droneGround.current = hubGround;

  const { hub, flight, serviceRadiusKm, demoArea } = config;

  // Create the viewer once.
  useEffect(() => {
    const viewer = new Viewer(container.current!, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
    });
    viewerRef.current = viewer;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(hub.lon, hub.lat - 0.016, 1500),
      orientation: { heading: 0, pitch: CMath.toRadians(-42), roll: 0 },
    });

    // Demo zone outline + service circle, draped on the ground.
    const { south, west, north, east } = demoArea;
    viewer.entities.add({
      polyline: {
        positions: Cartesian3.fromDegreesArray([west, south, east, south, east, north, west, north, west, south]),
        clampToGround: true,
        width: 3,
        material: new PolylineDashMaterialProperty({ color: Color.WHITE.withAlpha(0.9), dashLength: 24 }),
      },
    });
    viewer.entities.add({
      position: Cartesian3.fromDegrees(hub.lon, hub.lat),
      ellipse: { semiMajorAxis: serviceRadiusKm * 1000, semiMinorAxis: serviceRadiusKm * 1000, material: TEAL.withAlpha(0.12) },
    });

    // Live drone (positions read from a ref every frame, so telemetry updates are cheap).
    const dronePos = () => {
      const t = droneState.current.t;
      return t ? Cartesian3.fromDegrees(t.position.lon, t.position.lat, droneGround.current + t.altM) : undefined;
    };
    viewer.entities.add({
      position: new CallbackPositionProperty(dronePos, false),
      billboard: { image: droneIcon(), scale: 0.9, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: {
        text: new CallbackProperty(() => (droneState.current.t ? `${droneState.current.t.droneId} · ${droneState.current.t.altM.toFixed(0)} m` : ''), false),
        font: '600 13px Inter, sans-serif',
        pixelOffset: new Cartesian2(0, -34),
        showBackground: true,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(() => {
          const t = droneState.current.t;
          const top = dronePos();
          if (!t || !top || t.payload.ropeM < 0.05) return [];
          return [top, Cartesian3.fromDegrees(t.position.lon, t.position.lat, droneGround.current + t.altM - t.payload.ropeM)];
        }, false),
        width: 2,
        material: Color.fromCssColorString('#334155'),
      },
    });
    viewer.entities.add({
      polyline: { positions: new CallbackProperty(() => droneState.current.trail, false), width: 3, material: Color.fromCssColorString('#4f46e5').withAlpha(0.7) },
    });

    loadSource(viewer).then(async (s) => {
      if (viewer.isDestroyed()) return;
      sourceRef.current = s;
      setSource(s);
      const [h] = await sampleHeights(viewer, s, [hub]);
      if (!viewer.isDestroyed()) setHubGround(h ?? 0);
    });

    // Click to pick the drop spot (our own route lines are hidden so the click hits the ground).
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((e: ScreenSpaceEventHandler.PositionedEvent) => {
      if (!callbacks.current.onPick) return;
      routeEntities.current.forEach((en) => (en.show = false));
      viewer.scene.render();
      let pos = viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(e.position) : undefined;
      if (!pos) {
        const ray = viewer.camera.getPickRay(e.position);
        pos = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
      }
      routeEntities.current.forEach((en) => (en.show = true));
      if (!pos) return;
      const c = Cartographic.fromCartesian(pos);
      const p = { lat: CMath.toDegrees(c.latitude), lon: CMath.toDegrees(c.longitude) };
      if (distanceM(hub, p) > serviceRadiusKm * 1000) {
        setNote(`That spot is outside the ${serviceRadiusKm} km demo zone`);
        return;
      }
      setNote(null);
      callbacks.current.onPick({ ...p, groundAltM: sourceRef.current === 'basic' ? null : c.height });
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route: climb at the hub, cruise, descend to the hover height, rope to the ground.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !source) return;
    routeEntities.current.forEach((en) => viewer.entities.remove(en));
    routeEntities.current = [];
    if (!target) return;

    let cancelled = false;
    const N = 32;
    const line = Array.from({ length: N + 1 }, (_, i) => ({ lat: hub.lat + ((target.lat - hub.lat) * i) / N, lon: hub.lon + ((target.lon - hub.lon) * i) / N }));
    sampleHeights(viewer, source, line).then((heights) => {
      if (cancelled || viewer.isDestroyed()) return;
      const ground = (h: number | null) => h ?? hubGround;
      const tgtGround = target.groundAltM ?? ground(heights[N]);
      const cruise = hubGround + flight.cruiseAltM;
      const hover = tgtGround + flight.dropAltM;
      const at = (p: LatLon, h: number) => Cartesian3.fromDegrees(p.lon, p.lat, h);

      const middle = heights.slice(2, N - 1).filter((h): h is number => h != null);
      const maxObstacle = middle.length && source !== 'basic' ? Math.max(...middle) - hubGround : null;
      callbacks.current.onRoute?.({ maxObstacleM: maxObstacle, clearanceM: maxObstacle != null ? flight.cruiseAltM - maxObstacle : null });

      routeEntities.current = [
        viewer.entities.add({ polyline: { positions: [at(hub, hubGround + 1), at(hub, cruise), at(target, cruise), at(target, hover)], width: 4, material: TEAL } }),
        viewer.entities.add({
          polyline: { positions: [at(target, hover), at(target, tgtGround)], width: 2, material: new PolylineDashMaterialProperty({ color: Color.fromCssColorString('#f59e0b') }) },
        }),
        viewer.entities.add({
          wall: { positions: [at(hub, cruise), at(target, cruise)], minimumHeights: [hubGround, tgtGround], material: TEAL.withAlpha(0.15) },
        }),
        viewer.entities.add({
          position: at(target, tgtGround + 0.5),
          point: { pixelSize: 12, color: Color.fromCssColorString('#0b8f8a'), outlineColor: Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: {
            text: 'Drop here',
            font: '700 13px Inter, sans-serif',
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -14),
            showBackground: true,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }),
      ];
    });
    return () => {
      cancelled = true;
    };
  }, [target?.lat, target?.lon, target?.groundAltM, source, hubGround]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live drone telemetry + trail.
  useEffect(() => {
    const st = droneState.current;
    if (drone?.missionId !== st.t?.missionId) st.trail = [];
    st.t = drone ?? null;
    if (drone?.armed) {
      const p = Cartesian3.fromDegrees(drone.position.lon, drone.position.lat, hubGround + drone.altM);
      const last = st.trail.at(-1);
      if (!last || Cartesian3.distance(last, p) > 1) st.trail = [...st.trail.slice(-400), p];
    }
  }, [drone, hubGround]);

  const view = (top: boolean) => {
    const v = viewerRef.current;
    const c = target ?? hub;
    v?.camera.flyTo({
      destination: Cartesian3.fromDegrees(c.lon, c.lat - (top ? 0 : 0.006), hubGround + (top ? 1200 : 450)),
      orientation: { heading: 0, pitch: CMath.toRadians(top ? -90 : -35), roll: 0 },
      duration: 1,
    });
  };

  return (
    <div className={`relative overflow-hidden ${className ?? 'h-96'}`}>
      <div ref={container} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        <span className="w-fit rounded-full bg-ink/85 px-3 py-1 text-xs font-semibold text-white">{source ? SOURCE_LABEL[source] : 'Loading 3D…'}</span>
        <span className="w-fit rounded-full bg-white/90 px-3 py-1 text-[11px] text-slate-700">Demo zone ≈ {config.demoArea.areaKm2} km²</span>
      </div>
      <div className="absolute right-3 top-3 flex gap-1.5">
        <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => view(false)}>
          3D view
        </button>
        <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => view(true)}>
          Top view
        </button>
      </div>
      {(note || (onPick && !target)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 mx-auto w-fit rounded-full bg-ink/85 px-4 py-1.5 text-xs font-medium text-white">
          {note ?? 'Click the ground inside the circle to place your drop marker'}
        </div>
      )}
    </div>
  );
}
