import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../store/auth';
import type { AppConfig } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) useAuth.getState().logout();
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** Fetch on mount / when `path` changes. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}

// ---------- App config (hub, fees, payload limit), fetched once ----------

let configPromise: Promise<AppConfig> | null = null;
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    configPromise ??= api<AppConfig>('/config');
    configPromise.then(setConfig).catch(() => (configPromise = null));
  }, []);
  return config;
}

// ---------- Realtime socket (re-created when the logged-in user changes) ----------

let socket: Socket | null = null;
let socketToken: string | null | undefined;

export function getSocket(): Socket {
  const token = useAuth.getState().token;
  if (!socket || socketToken !== token) {
    socket?.disconnect();
    socket = io({ auth: { token } });
    socketToken = token;
  }
  return socket;
}
