export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial bearing from a to b, degrees 0-360 (0 = north). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Move from `from` towards `to` by at most `stepM` metres. Flat-earth approximation: fine for a few km. */
export function stepTowards(from: LatLon, to: LatLon, stepM: number): LatLon {
  const d = distanceM(from, to);
  if (d <= stepM || d === 0) return { ...to };
  const f = stepM / d;
  return { lat: from.lat + (to.lat - from.lat) * f, lon: from.lon + (to.lon - from.lon) * f };
}

/** Offset a point by metres north/east. */
export function offsetM(p: LatLon, northM: number, eastM: number): LatLon {
  return {
    lat: p.lat + deg(northM / R),
    lon: p.lon + deg(eastM / (R * Math.cos(rad(p.lat)))),
  };
}
