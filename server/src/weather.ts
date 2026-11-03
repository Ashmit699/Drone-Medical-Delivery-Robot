// Live flight conditions at the hub from Open-Meteo (free, no API key). Cached for 10 minutes.
import { config } from './config';

export type FlightCall = 'GO' | 'CAUTION' | 'NO-GO';
export interface Conditions {
  available: boolean;
  call: FlightCall | null;
  reasons: string[];
  temperatureC?: number;
  windKmh?: number;
  gustKmh?: number;
  precipitationMm?: number;
  cloudPct?: number;
  observedAt?: string;
}

// Limits for a ~1.7 kg quad carrying a swinging rope payload.
const LIMITS = { wind: 25, windCaution: 18, gust: 35, gustCaution: 28, rain: 0.5 };
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; value: Conditions } | null = null;

export async function getConditions(): Promise<Conditions> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${config.hub.lat}&longitude=${config.hub.lon}` +
      '&current=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const c = (await res.json()).current;
    const value: Conditions = {
      available: true,
      temperatureC: c.temperature_2m,
      windKmh: c.wind_speed_10m,
      gustKmh: c.wind_gusts_10m,
      precipitationMm: c.precipitation,
      cloudPct: c.cloud_cover,
      observedAt: c.time,
      ...judge(c.wind_speed_10m, c.wind_gusts_10m, c.precipitation),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn('Weather unavailable:', (err as Error).message);
    // Keep serving the last good reading if we have one.
    return cache?.value ?? { available: false, call: null, reasons: ['Live weather unavailable. Check conditions manually'] };
  }
}

function judge(wind: number, gust: number, rain: number): { call: FlightCall; reasons: string[] } {
  const reasons: string[] = [];
  let call: FlightCall = 'GO';
  if (wind > LIMITS.wind) (call = 'NO-GO'), reasons.push(`Wind ${wind} km/h is above the ${LIMITS.wind} km/h limit`);
  if (gust > LIMITS.gust) (call = 'NO-GO'), reasons.push(`Gusts ${gust} km/h are above the ${LIMITS.gust} km/h limit`);
  if (rain > LIMITS.rain) (call = 'NO-GO'), reasons.push(`Rain (${rain} mm). Electronics are not waterproof`);
  if (call === 'GO') {
    if (wind > LIMITS.windCaution) (call = 'CAUTION'), reasons.push(`Breezy (${wind} km/h): expect rope swing`);
    if (gust > LIMITS.gustCaution) (call = 'CAUTION'), reasons.push(`Gusty (${gust} km/h)`);
  }
  if (!reasons.length) reasons.push('Calm enough for a winch drop');
  return { call, reasons };
}
