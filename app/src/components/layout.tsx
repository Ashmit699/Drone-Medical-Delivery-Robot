import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Package,
  Plane,
  ShoppingCart,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cx } from '../lib/format';
import { useAuth } from '../store/auth';
import { cartTotals, useCart } from '../store/cart';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 shadow-sm shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </span>
      <span className={cx('text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
        Medi<span className="text-brand-500">Drop</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: '/shop', label: 'Shop' },
  { to: '/features', label: 'Features' },
  { to: '/technology', label: 'How it works' },
  { to: '/orders', label: 'My orders', auth: true },
];

function Navbar() {
  const { user, logout } = useAuth();
  const count = useCart((s) => cartTotals(s.lines).count);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const links = NAV.filter((n) => !n.auth || user);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-ink');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {user?.role === 'operator' && (
            <NavLink to="/ops" className={linkClass}>
              Operator console
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link to="/profile" className="btn-ghost px-3">
                <UserIcon className="h-4 w-4" /> {user.name.split(' ')[0]}
              </Link>
              <button
                className="btn-ghost px-3"
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
            <Link to="/login" className="btn-primary hidden md:inline-flex">
              Log in
            </Link>
          )}
          <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => cx(linkClass({ isActive }), 'block')}>
              {l.label}
            </NavLink>
          ))}
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
              <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn-primary mt-2 w-full">
              Log in
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 bg-ink text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-slate-400">
            A school robotics project: an autonomous quadcopter that delivers medicines and lowers them on a winch to the exact spot, plus the app that runs it.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-white">Shop medicines</Link></li>
            <li><Link to="/features" className="hover:text-white">Features</Link></li>
            <li><Link to="/technology" className="hover:text-white">How the drone works</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Safety</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Human “area clear” gate before every drop</li>
            <li>Geofence + auto return-to-base</li>
            <li>Safety pilot on every flight</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        MediDrop exhibition prototype · drone flights are simulated in this demo
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
  { to: '/ops/monitor', label: 'Live monitor', icon: MapIcon },
  { to: '/ops/fleet', label: 'Fleet', icon: Plane },
  { to: '/ops/inventory', label: 'Inventory', icon: Boxes },
];

export function OpsLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white');

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink p-4 lg:flex">
        <div className="px-2 py-2">
          <Logo light />
          <div className="mt-1 pl-11 text-[11px] font-semibold uppercase tracking-widest text-brand-400">Operator console</div>
        </div>
        <nav className="mt-8 space-y-1">
          {OPS_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              <n.icon className="h-4.5 w-4.5" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-white">
            <ShoppingCart className="h-4.5 w-4.5" /> Customer site
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
      {/* Mobile top nav */}
      <div className="sticky top-0 z-40 flex items-center gap-1 overflow-x-auto bg-ink px-3 py-2 lg:hidden">
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
