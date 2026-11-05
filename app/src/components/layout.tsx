import {
  ArrowRight,
  BadgePercent,
  Boxes,
  Crosshair,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Package,
  Phone,
  Plane,
  Radar,
  Search,
  ShoppingBag,
  Siren,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, getSocket, useApi, useAppConfig } from '../lib/api';
import { cx, rupees } from '../lib/format';
import type { Address, OrderDetail, OrderSummary, Product } from '../lib/types';
import { useAuth } from '../store/auth';
import { cartTotals, useCart } from '../store/cart';
import { toast, useUi } from '../store/ui';
import { QtyStepper } from './ProductCard';
import { ProductIcon } from './ProductIcon';
import { ErrorNote, Modal, PayloadMeter, Spinner } from './ui';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 shadow-[0_0_24px_-4px_rgba(34,229,211,0.8)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-950" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-white">
            Medi<span className="glow-text">Drop</span>
          </span>
          <span className="hud mt-0.5 block text-[9px] text-brand-400/80">Aero-medical network</span>
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: '/shop', label: 'Order medicines' },
  { to: '/plans', label: 'Care plans' },
  { to: '/technology', label: 'How it works' },
  { to: '/features', label: 'Features' },
  { to: '/welfare', label: 'Welfare' },
];

function SearchBox({ className, onDone }: { className?: string; onDone?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
    onDone?.();
  };
  return (
    <form onSubmit={submit} className={cx('relative', className)} role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input className="input h-10 rounded-full py-2 pl-9 text-sm" placeholder="Search fever, asthma, flood kit…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search supplies" />
    </form>
  );
}

function useActiveOrderCount() {
  const user = useAuth((s) => s.user);
  const { data, reload } = useApi<OrderSummary[]>(user?.role === 'customer' ? '/orders' : null);
  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    s.on('order:update', reload);
    return () => {
      s.off('order:update', reload);
    };
  }, [user, reload]);
  return data?.filter((o) => ['placed', 'approved', 'in_flight'].includes(o.status)).length ?? 0;
}

function Navbar() {
  const { user, logout } = useAuth();
  const count = useCart((s) => cartTotals(s.lines).count);
  const setCartOpen = useUi((s) => s.setCartOpen);
  const activeOrders = useActiveOrderCount();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white');

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
          {NAV.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.to === '/live' && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 align-middle" />}
              {l.label}
            </NavLink>
          ))}
        </nav>
        <SearchBox className="ml-auto hidden w-64 md:block" />
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {user?.role === 'operator' && (
            <Link to="/ops" className="btn-secondary hidden h-10 px-3 sm:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Console
            </Link>
          )}
          {user?.role === 'customer' && (
            <Link to="/orders" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="My orders">
              <Package className="h-5 w-5" />
              {activeOrders > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[11px] font-bold text-white">{activeOrders}</span>
              )}
            </Link>
          )}
          <button onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Open cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-400 px-1 text-[11px] font-bold text-slate-950">{count}</span>
            )}
          </button>
          {user ? (
            <div className="hidden items-center md:flex">
              <Link to="/profile" className="btn-ghost h-10 px-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-[11px] font-bold text-slate-950">{user.name[0]}</span>
                {user.name.split(' ')[0]}
              </Link>
              <button
                className="btn-ghost h-10 px-2.5"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary hidden h-10 md:inline-flex">
              Log in
            </Link>
          )}
          <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.06] lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/[0.06] bg-panel/95 px-4 py-3 lg:hidden">
          <SearchBox className="mb-3 md:hidden" onDone={() => setOpen(false)} />
          <div onClick={() => setOpen(false)}>
            {NAV.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cx(linkClass({ isActive }), 'block')}>
                {l.label}
              </NavLink>
            ))}
            {user && (
              <NavLink to="/orders" className={({ isActive }) => cx(linkClass({ isActive }), 'block')}>
                My orders
              </NavLink>
            )}
            {user?.role === 'operator' && (
              <NavLink to="/ops" className={({ isActive }) => cx(linkClass({ isActive }), 'block')}>
                Operator console
              </NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/profile" className={({ isActive }) => cx(linkClass({ isActive }), 'block')}>
                  Profile
                </NavLink>
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-400" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="btn-primary mt-2 w-full">
                Log in
              </NavLink>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function CartDrawer() {
  const { cartOpen, setCartOpen } = useUi();
  const { lines, setQty, remove } = useCart();
  const user = useAuth((s) => s.user);
  const config = useAppConfig();
  const navigate = useNavigate();
  const totals = cartTotals(lines);
  const maxG = config?.maxPayloadG ?? 300;
  const location = useLocation();

  useEffect(() => setCartOpen(false), [location.pathname, setCartOpen]);
  if (!cartOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={() => setCartOpen(false)}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Cart">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="hud text-brand-400">Payload bay</div>
            <h2 className="text-lg font-bold text-white">Your cart · {totals.count}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/[0.06]" onClick={() => setCartOpen(false)} aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {lines.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 font-semibold text-white">The payload bay is empty</p>
              <Link to="/shop" className="btn-primary mt-5">
                Browse supplies
              </Link>
            </div>
          ) : (
            lines.map((l) => (
              <div key={l.productId} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] p-3">
                <ProductIcon icon={l.icon} category={l.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-semibold text-white">{l.name}</div>
                  <div className="font-mono text-xs text-slate-500">
                    {rupees(l.price)} · {l.weightG * l.qty} g
                  </div>
                </div>
                <QtyStepper size="sm" qty={l.qty} max={Math.min(l.stock, 20)} onChange={(q) => (q <= 0 ? remove(l.productId) : setQty(l.productId, q))} />
              </div>
            ))
          )}
        </div>
        {lines.length > 0 && (
          <div className="space-y-4 border-t border-line bg-white/[0.02] p-5">
            <PayloadMeter weightG={totals.weightG} maxG={maxG} />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">Subtotal</span>
              <span className="font-mono text-xl font-bold text-white">{rupees(totals.subtotal)}</span>
            </div>
            <p className="text-xs text-slate-500">Members pay nothing per order: supplies and the emergency flight are covered by your MediDrop Care plan.</p>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/cart" className="btn-secondary">
                View cart
              </Link>
              <button className="btn-primary" disabled={totals.weightG > maxG} onClick={() => navigate(user ? '/checkout' : '/login?next=/checkout')}>
                Checkout <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------- SOS: one-tap emergency kit ----------

const SOS_KITS = ['emergency-trauma-kit', 'snakebite-first-response', 'glucose-gel', 'thermal-emergency-blanket'];

function SosModal() {
  const { sosOpen, setSosOpen } = useUi();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { data: products } = useApi<Product[]>(sosOpen ? '/products' : null);
  const { data: addresses } = useApi<Address[]>(sosOpen && user ? '/addresses' : null);
  const [kit, setKit] = useState(SOS_KITS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kits = SOS_KITS.map((slug) => products?.find((p) => p.slug === slug)).filter((p): p is Product => !!p);

  const send = async (label: string, line: string, lat: number, lon: number) => {
    const p = kits.find((k) => k.slug === kit);
    if (!p) return;
    setBusy(label);
    setError(null);
    try {
      const order = await api<OrderDetail>('/orders', {
        body: { items: [{ productId: p.id, qty: 1 }], lat, lon, addressLabel: `SOS · ${label}`, addressLine: line, notes: 'SOS request from the app' },
      });
      setSosOpen(false);
      toast({ tone: 'warning', title: `SOS ${order.code} sent`, body: 'Emergency kit is next in line for dispatch' });
      navigate(`/orders/${order.id}?new=1`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const here = () => {
    setError(null);
    setBusy('here');
    navigator.geolocation.getCurrentPosition(
      (pos) => send('My location', 'Live GPS location', pos.coords.latitude, pos.coords.longitude),
      () => {
        setBusy(null);
        setError('Could not get your location. Pick a saved place instead.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <Modal open={sosOpen} onClose={() => setSosOpen(false)} title="Emergency SOS dispatch" wide>
      {!user ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Log in so we know where to send the drone.</p>
          <Link to="/login" className="btn-primary" onClick={() => setSosOpen(false)}>
            Log in
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            <Siren className="mt-0.5 h-5 w-5 shrink-0" />
            Free, auto-approved and first in the queue. For life-threatening emergencies, also call <b>112</b>.
          </div>
          <div>
            <div className="label">Kit</div>
            {!products ? (
              <Spinner />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {kits.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => setKit(p.slug)}
                    className={cx('flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm', kit === p.slug ? 'border-rose-400/60 bg-rose-500/10' : 'border-line hover:border-white/20')}
                  >
                    <ProductIcon icon={p.icon} category={p.category} size="sm" />
                    <span className="font-semibold text-white">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="label">Send it to</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-danger justify-start py-3" disabled={!!busy || !kits.length} onClick={here}>
                {busy === 'here' ? <Spinner className="h-4 w-4 text-white" /> : <Crosshair className="h-4 w-4" />} My current location
              </button>
              {addresses?.map((a) => (
                <button key={a.id} className="btn-secondary justify-start py-3" disabled={!!busy || !kits.length} onClick={() => send(a.label, a.line, a.lat, a.lon)}>
                  {busy === a.label ? <Spinner className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />} {a.label}
                </button>
              ))}
            </div>
          </div>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Modal>
  );
}

function SosButton() {
  const setSosOpen = useUi((s) => s.setSosOpen);
  const user = useAuth((s) => s.user);
  if (user?.role === 'operator') return null;
  return (
    <button
      onClick={() => setSosOpen(true)}
      className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-red-600 px-4 py-3 text-sm font-bold text-white shadow-[0_0_30px_-4px_rgba(244,63,94,0.8)] transition hover:scale-105"
      aria-label="Emergency SOS"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      SOS
    </button>
  );
}

function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-ink/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-slate-400">
            A school robotics project: an autonomous quadcopter that flies medicines and relief supplies and lowers them on a winch to the exact spot, plus the app that runs it.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <Phone className="h-5 w-5 text-rose-300" />
            <div>
              <div className="hud text-rose-300/80">24×7 relief hotline</div>
              <div className="font-mono text-sm font-semibold text-white">1800-MEDI-DROP</div>
            </div>
          </div>
        </div>
        <div>
          <h4 className="hud mb-4 text-slate-400">Explore</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link to="/shop" className="hover:text-white">Supply catalogue</Link></li>
            <li><Link to="/live" className="hover:text-white">Live airspace</Link></li>
            <li><Link to="/mission-control" className="hover:text-white">Mission control screen</Link></li>
            <li><Link to="/plans" className="hover:text-white">MediDrop Care plans</Link></li>
            <li><Link to="/welfare" className="hover:text-white">Welfare discount</Link></li>
            <li><Link to="/technology" className="hover:text-white">How the drone works</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="hud mb-4 text-slate-400">Safety</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Human “area clear” gate before every drop</li>
            <li>Live weather go / no-go</li>
            <li>Geofence + auto return-to-base</li>
            <li>Safety pilot on every flight</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06] py-5 text-center font-mono text-[11px] text-slate-600">
        MEDIDROP // EXHIBITION PROTOTYPE // DRONE FLIGHTS ARE SIMULATED IN THIS DEMO
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <SosButton />
      <SosModal />
    </div>
  );
}

export function RequireAuth({ role, children }: { role?: 'operator'; children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const OPS_NAV = [
  { to: '/ops', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ops/orders', label: 'Orders', icon: Package },
  { to: '/ops/monitor', label: 'Live monitor', icon: Radar },
  { to: '/ops/fleet', label: 'Fleet', icon: Plane },
  { to: '/ops/welfare', label: 'Welfare', icon: BadgePercent },
  { to: '/ops/inventory', label: 'Inventory', icon: Boxes },
];

export function OpsLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
      isActive ? 'bg-gradient-to-r from-brand-400/15 to-transparent text-white shadow-[inset_2px_0_0_var(--color-brand-400)]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
    );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.06] bg-ink/80 p-4 backdrop-blur-xl lg:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>
        <div className="hud mt-6 px-3 text-brand-400/80">Mission control</div>
        <nav className="mt-3 space-y-1">
          {OPS_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              <n.icon className="h-4.5 w-4.5" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-4">
          <Link to="/mission-control" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-brand-300 hover:text-white">
            <Radar className="h-4.5 w-4.5" /> Mission control screen
          </Link>
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-white">
            <ShoppingBag className="h-4.5 w-4.5" /> Customer site
          </Link>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-white"
          >
            <LogOut className="h-4.5 w-4.5" /> Log out {user?.name.split(' ')[0]}
          </button>
        </div>
      </aside>
      <div className="sticky top-0 z-40 flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] bg-ink/90 px-3 py-2 backdrop-blur-xl lg:hidden">
        {OPS_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx(linkClass({ isActive }), 'shrink-0 py-2')}>
            <n.icon className="h-4 w-4" /> {n.label}
          </NavLink>
        ))}
      </div>
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
