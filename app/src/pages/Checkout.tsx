import { AlertTriangle, Building2, Camera, Check, FileCheck2, MapPin, Siren, Smartphone, Timer, Wallet, Zap } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MapPicker } from '../components/maps';
import type { RouteInfo } from '../components/Map3D';
import { ProductIcon } from '../components/ProductIcon';
import { ErrorNote, PageLoader, PayloadMeter, Spinner } from '../components/ui';
import { api, useApi, useAppConfig } from '../lib/api';
import { cx, duration, km, rupees } from '../lib/format';
import { PRIORITY_META } from '../lib/phases';
import type { Address, LatLon, OrderDetail, Priority, Quote } from '../lib/types';
import { cartTotals, useCart } from '../store/cart';

// Cesium is large, so it only downloads when the 3D view is shown.
const Map3D = lazy(() => import('../components/Map3D'));

const SAFETY = [
  'Open sky above the spot: no trees, wires or roofs within 3 m',
  'Printed MediDrop marker placed flat on the ground (or a clear open patch)',
  'I will keep people and animals 5 m away while the package is lowered',
];

const PAYMENTS = [
  { id: 'upi', label: 'UPI', sub: 'GPay, PhonePe, Paytm (demo, no real charge)', icon: Smartphone },
  { id: 'wallet', label: 'MediDrop wallet', sub: 'Prepaid health wallet (demo)', icon: Wallet },
  { id: 'account', label: 'Hospital / scheme account', sub: 'Billed to PHC or a health scheme', icon: Building2 },
] as const;

const PRIORITY_ICONS: Record<Priority, ReactNode> = {
  standard: <Timer className="h-5 w-5" />,
  express: <Zap className="h-5 w-5" />,
  emergency: <Siren className="h-5 w-5" />,
};

function Section({ n, title, children, done }: { n: number; title: string; children: ReactNode; done?: boolean }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold">
        <span className={cx('grid h-7 w-7 place-items-center rounded-full text-sm', done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Shrink a photo to keep uploads small (prescriptions only need to be readable). */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Checkout() {
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const config = useAppConfig();
  const { data: addresses } = useApi<Address[]>('/addresses');
  const navigate = useNavigate();

  const [pin, setPin] = useState<LatLon | null>(null);
  const [groundAltM, setGroundAltM] = useState<number | null>(null);
  const [view3d, setView3d] = useState(() => window.innerWidth >= 768);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [label, setLabel] = useState('');
  const [line, setLine] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>('standard');
  const [checks, setChecks] = useState<boolean[]>(SAFETY.map(() => false));
  const [rxImage, setRxImage] = useState<string | null>(null);
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]['id']>('upi');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = cartTotals(lines);

  // Live server-side quote (price, distance, ETA, problems).
  useEffect(() => {
    if (lines.length === 0) return;
    const t = setTimeout(() => {
      api<Quote>('/orders/quote', {
        body: { items: lines.map((l) => ({ productId: l.productId, qty: l.qty })), lat: pin?.lat, lon: pin?.lon, priority },
      })
        .then(setQuote)
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [lines, pin, priority]);

  if (lines.length === 0 && !placing) return <Navigate to="/cart" replace />;
  if (!config) return <PageLoader />;

  const pickAddress = (a: Address) => {
    setSelectedAddress(a.id);
    setPin({ lat: a.lat, lon: a.lon });
    setGroundAltM(null);
    setLabel(a.label);
    setLine(a.line);
    setSaveAddress(false);
  };

  const locationDone = !!pin && label.trim().length > 0 && line.trim().length >= 3;
  const safetyDone = checks.every(Boolean);
  const rxDone = !totals.rxRequired || !!rxImage;
  const problems = quote?.problems ?? [];
  const canPlace = locationDone && safetyDone && rxDone && problems.length === 0 && !!quote && !placing;

  const missing = [
    !pin && 'drop location on the map',
    pin && (!label.trim() || line.trim().length < 3) && 'address name + landmark',
    !safetyDone && 'drop-zone safety checks',
    !rxDone && 'prescription photo',
  ].filter(Boolean) as string[];

  const placeOrder = async () => {
    setPlacing(true);
    setError(null);
    try {
      const order = await api<OrderDetail>('/orders', {
        body: {
          items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          priority,
          lat: pin!.lat,
          lon: pin!.lon,
          addressLabel: label.trim(),
          addressLine: line.trim(),
          paymentMethod: payment,
          notes: notes.trim() || undefined,
          rxImage: rxImage ?? undefined,
          saveAddress,
          groundAltM: groundAltM ?? undefined,
        },
      });
      clearCart();
      navigate(`/orders/${order.id}?new=1`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section n={1} title="Where should we drop it?" done={locationDone}>
            {addresses && addresses.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pickAddress(a)}
                    className={cx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                      selectedAddress === a.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <MapPin className="h-4 w-4 text-brand-600" />
                    <span>
                      <span className="block font-semibold">{a.label}</span>
                      <span className="block text-xs text-slate-500">{a.line}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mb-2 inline-flex rounded-xl bg-slate-100 p-1 text-sm">
              {[true, false].map((is3d) => (
                <button
                  key={String(is3d)}
                  type="button"
                  onClick={() => setView3d(is3d)}
                  className={cx('rounded-lg px-3 py-1.5 font-semibold', view3d === is3d ? 'bg-white shadow-sm' : 'text-slate-500')}
                >
                  {is3d ? '3D view' : '2D map'}
                </button>
              ))}
            </div>
            {view3d ? (
              <Suspense fallback={<div className="grid h-80 place-items-center rounded-2xl border border-slate-200"><Spinner /></div>}>
                <Map3D
                  config={config}
                  target={pin && { ...pin, groundAltM }}
                  onPick={(p) => {
                    setPin({ lat: p.lat, lon: p.lon });
                    setGroundAltM(p.groundAltM);
                    setSelectedAddress(null);
                  }}
                  onRoute={setRoute}
                  className="h-80 rounded-2xl border border-slate-200 sm:h-[420px]"
                />
              </Suspense>
            ) : (
              <MapPicker
                hub={config.hub}
                radiusKm={config.serviceRadiusKm}
                value={pin}
                onChange={(p) => {
                  setPin(p);
                  setGroundAltM(null);
                  setSelectedAddress(null);
                }}
              />
            )}
            {view3d && route?.clearanceM != null && route.clearanceM < 10 && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Something about {Math.round(route.maxObstacleM ?? 0)} m tall is under the route. The operator will raise the cruise altitude or pick a detour before launch.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <div>
                <label className="label" htmlFor="addr-label">Name</label>
                <input id="addr-label" className="input" placeholder="Home, PHC, School…" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="addr-line">Address / landmark</label>
                <input id="addr-line" className="input" placeholder="e.g. Behind the water tank, open field" value={line} onChange={(e) => setLine(e.target.value)} />
              </div>
            </div>
            {selectedAddress == null && (
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                Save this address for next time
              </label>
            )}
          </Section>

          <Section n={2} title="How urgent is it?" done>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['standard', 'express', 'emergency'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cx(
                    'rounded-2xl border p-4 text-left transition',
                    priority === p
                      ? p === 'emergency'
                        ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20'
                        : 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <div className={cx('flex items-center justify-between', p === 'emergency' ? 'text-red-600' : 'text-brand-700')}>
                    {PRIORITY_ICONS[p]}
                    <span className="text-sm font-bold">{config.fees[p] === 0 ? 'Free' : rupees(config.fees[p])}</span>
                  </div>
                  <div className="mt-3 font-semibold">{PRIORITY_META[p].label}</div>
                  <div className="text-xs text-slate-500">{PRIORITY_META[p].blurb}</div>
                </button>
              ))}
            </div>
            {priority === 'emergency' && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                For life-threatening emergencies, also call 108 / 112. The drone brings supplies, not a doctor.
              </p>
            )}
          </Section>

          <Section n={3} title="Is the drop zone safe?" done={safetyDone}>
            <p className="mb-3 text-sm text-slate-500">The drone hovers about {config.flight.dropAltM} m up and lowers the package on a rope.</p>
            <div className="space-y-2">
              {SAFETY.map((s, i) => (
                <label key={s} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition', checks[i] ? 'border-brand-300 bg-brand-50' : 'border-slate-200')}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    checked={checks[i]}
                    onChange={(e) => setChecks(checks.map((c, j) => (j === i ? e.target.checked : c)))}
                  />
                  {s}
                </label>
              ))}
            </div>
          </Section>

          {totals.rxRequired && (
            <Section n={4} title="Prescription" done={rxDone}>
              <p className="mb-3 text-sm text-slate-500">A pharmacist checks this before your order is approved.</p>
              {rxImage ? (
                <div className="flex items-center gap-4">
                  <img src={rxImage} alt="Prescription preview" className="h-24 w-24 rounded-xl border object-cover" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <FileCheck2 className="h-4 w-4" /> Prescription attached
                    </div>
                    <button className="mt-1 text-sm text-slate-500 underline" onClick={() => setRxImage(null)}>
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-brand-400 hover:bg-brand-50/50">
                  <Camera className="h-8 w-8 text-slate-400" />
                  <span className="mt-2 text-sm font-semibold">Take or upload a photo</span>
                  <span className="text-xs text-slate-500">JPG or PNG</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setRxImage(await readImage(f));
                    }}
                  />
                </label>
              )}
            </Section>
          )}

          <Section n={totals.rxRequired ? 5 : 4} title="Payment" done>
            <div className="grid gap-3 sm:grid-cols-3">
              {PAYMENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPayment(p.id)}
                  className={cx('rounded-2xl border p-4 text-left transition', payment === p.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
                >
                  <p.icon className="h-5 w-5 text-brand-700" />
                  <div className="mt-3 text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.sub}</div>
                </button>
              ))}
            </div>
            <label className="label mt-5" htmlFor="notes">Note for the pharmacist (optional)</label>
            <textarea id="notes" className="input min-h-20" maxLength={300} placeholder="Allergies, dosage questions, landmark details…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Section>
        </div>

        {/* Summary */}
        <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-24">
          <h2 className="font-bold">Order summary</h2>
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 text-sm">
                <ProductIcon icon={l.icon} category={l.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">
                    {l.qty} × {rupees(l.price)}
                  </div>
                </div>
                <div className="font-semibold">{rupees(l.qty * l.price)}</div>
              </li>
            ))}
          </ul>
          <PayloadMeter weightG={quote?.weightG ?? totals.weightG} maxG={config.maxPayloadG} compact />
          <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Items</dt>
              <dd>{rupees(quote?.itemsTotal ?? totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Drone delivery ({PRIORITY_META[priority].label})</dt>
              <dd>{config.fees[priority] === 0 ? <span className="font-semibold text-emerald-600">Free</span> : rupees(config.fees[priority])}</dd>
            </div>
            {!!quote?.distanceFee && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Distance ({rupees(config.perKmFee)}/km after {config.includedKm} km)</dt>
                <dd>{rupees(quote.distanceFee)}</dd>
              </div>
            )}
            {quote?.distanceM != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Flight</dt>
                <dd>
                  {km(quote.distanceM)} · ~{duration(quote.etaS ?? 0)}
                </dd>
              </div>
            )}
            {quote?.batteryUsePct != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Battery for round trip</dt>
                <dd>~{quote.batteryUsePct}%</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{rupees(quote?.total ?? totals.subtotal + config.fees[priority])}</dd>
            </div>
          </dl>

          {problems.length > 0 && (
            <ErrorNote>
              <ul className="list-disc space-y-1 pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </ErrorNote>
          )}
          <ErrorNote>{error}</ErrorNote>

          <button className={cx('w-full py-3', priority === 'emergency' ? 'btn-danger' : 'btn-primary')} disabled={!canPlace} onClick={placeOrder}>
            {placing ? <Spinner className="h-4 w-4 text-white" /> : null}
            {placing ? 'Placing order…' : `Place order · ${rupees(quote?.total ?? 0)}`}
          </button>
          {missing.length > 0 && <p className="text-center text-xs text-slate-500">Still needed: {missing.join(', ')}</p>}
        </aside>
      </div>
    </div>
  );
}
