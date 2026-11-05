import L from 'leaflet';
import { Crosshair } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLon, Telemetry } from '../lib/types';

// Free satellite imagery (no key), darkened in index.css for the mission-control look.
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';

const hubIcon = L.divIcon({
  className: 'map-pin',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html: `<div style="width:38px;height:38px;border-radius:12px;background:#0d2c4a;color:#00c2c7;display:grid;place-items:center;border:2px solid #00c2c7">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></div>`,
});

const dropIcon = L.divIcon({
  className: 'map-pin',
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  html: `<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43s15-14.6 15-26A15 15 0 0 0 2 17c0 11.4 15 26 15 26z" fill="#82a8c4" stroke="#f5f9fc" stroke-width="2"/>
    <rect x="10" y="10" width="14" height="14" fill="#fff" rx="1"/><rect x="12" y="12" width="4" height="4" fill="#09243e"/><rect x="18" y="12" width="4" height="4" fill="#09243e"/><rect x="12" y="18" width="4" height="4" fill="#09243e"/><rect x="18.5" y="18.5" width="3" height="3" fill="#09243e"/></svg>`,
});

function droneIcon(heading: number, active: boolean) {
  const color = active ? '#00c2c7' : '#6b8399';
  return L.divIcon({
    className: 'map-pin',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="width:44px;height:44px;display:grid;place-items:center;transform:rotate(${heading}deg)">
      <svg width="44" height="44" viewBox="0 0 44 44">
        ${active ? `<circle cx="22" cy="22" r="20" fill="${color}" opacity=".15"><animate attributeName="r" values="14;21;14" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
        <g stroke="${color}" stroke-width="2.5" stroke-linecap="round"><path d="M13 13l18 18M31 13L13 31"/></g>
        ${[13, 31].flatMap((x) => [13, 31].map((y) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#0d2c4a" stroke="${color}" stroke-width="2"/>`)).join('')}
        <rect x="17" y="17" width="10" height="10" rx="3" fill="${color}"/>
        <path d="M22 9l3 4h-6z" fill="${color}"/>
      </svg></div>`,
  });
}

function FitBounds({ points }: { points: LatLon[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lon], 15);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

// ---------- Location picker (checkout) ----------

function ClickToPick({ onPick }: { onPick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

function FlyTo({ to }: { to: LatLon | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo([to.lat, to.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [to, map]);
  return null;
}

export function MapPicker({
  hub,
  radiusKm,
  value,
  onChange,
}: {
  hub: LatLon;
  radiusKm: number;
  value: LatLon | null;
  onChange: (p: LatLon) => void;
}) {
  const [flyTarget, setFlyTarget] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        onChange(p);
        setFlyTarget(p);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line">
      <MapContainer center={[hub.lat, hub.lon]} zoom={13} className="h-72 w-full sm:h-80" scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxNativeZoom={18} maxZoom={20} />
        <Circle center={[hub.lat, hub.lon]} radius={radiusKm * 1000} pathOptions={{ color: '#00c2c7', weight: 1.5, fillOpacity: 0.06, dashArray: '6 6' }} />
        <Marker position={[hub.lat, hub.lon]} icon={hubIcon}>
          <Tooltip direction="top" offset={[0, -18]}>
            Aerolift hub
          </Tooltip>
        </Marker>
        {value && (
          <Marker
            position={[value.lat, value.lon]}
            icon={dropIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onChange({ lat: ll.lat, lon: ll.lng });
              },
            }}
          />
        )}
        <ClickToPick onPick={onChange} />
        <FlyTo to={flyTarget} />
      </MapContainer>
      <button type="button" onClick={useMyLocation} className="btn-secondary absolute right-3 top-3 z-[400] py-2 shadow">
        <Crosshair className={locating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Use my location
      </button>
      {!value && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[400] mx-auto w-fit rounded-full bg-ink/85 px-4 py-1.5 text-xs font-medium text-white">
          Tap the map to place your drop marker
        </div>
      )}
    </div>
  );
}

// ---------- Live map (tracking + ops monitor) ----------

export function LiveMap({
  hub,
  targets = [],
  drones,
  activeDroneId,
  onSelectDrone,
  className,
}: {
  hub: LatLon;
  targets?: LatLon[];
  drones: Telemetry[];
  activeDroneId?: string | null;
  onSelectDrone?: (id: string) => void;
  className?: string;
}) {
  // Keep a short trail per drone, reset whenever it starts a new mission.
  const trails = useRef(new Map<string, { missionId: number | null; points: [number, number][] }>());
  for (const t of drones) {
    let trail = trails.current.get(t.droneId);
    if (!trail || trail.missionId !== t.missionId) {
      trail = { missionId: t.missionId, points: [] };
      trails.current.set(t.droneId, trail);
    }
    const last = trail.points.at(-1);
    const p: [number, number] = [t.position.lat, t.position.lon];
    if (t.armed && (!last || Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) > 0.00002)) {
      trail.points.push(p);
      if (trail.points.length > 600) trail.points.shift();
    }
  }

  const fitPoints = useMemo(() => [hub, ...targets], [hub, targets]);

  return (
    <MapContainer center={[hub.lat, hub.lon]} zoom={14} className={className ?? 'h-80 w-full'} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxNativeZoom={18} maxZoom={20} />
      <FitBounds points={fitPoints} />
      <Marker position={[hub.lat, hub.lon]} icon={hubIcon}>
        <Tooltip direction="top" offset={[0, -18]}>
          Aerolift hub
        </Tooltip>
      </Marker>
      {targets.map((t, i) => (
        <span key={i}>
          <Polyline positions={[[hub.lat, hub.lon], [t.lat, t.lon]]} pathOptions={{ color: '#b9f0ec', weight: 2, dashArray: '4 8', opacity: 0.8 }} />
          <Marker position={[t.lat, t.lon]} icon={dropIcon} />
        </span>
      ))}
      {drones.map((t) => {
        const trail = trails.current.get(t.droneId)?.points ?? [];
        const active = t.armed || t.droneId === activeDroneId;
        return (
          <span key={t.droneId}>
            {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#00c2c7', weight: 3, opacity: 0.8 }} />}
            <Marker
              position={[t.position.lat, t.position.lon]}
              icon={droneIcon(Math.round(t.headingDeg / 5) * 5, active)}
              zIndexOffset={1000}
              eventHandlers={onSelectDrone ? { click: () => onSelectDrone(t.droneId) } : undefined}
            >
              <Tooltip direction="right" offset={[18, 0]} permanent={t.armed}>
                <span className="font-semibold">{t.droneId}</span> · {Math.round(t.altM)} m
              </Tooltip>
            </Marker>
          </span>
        );
      })}
    </MapContainer>
  );
}
