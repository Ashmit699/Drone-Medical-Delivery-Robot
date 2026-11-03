import { LogOut, MapPin, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty, PageLoader } from '../components/ui';
import { api, useApi } from '../lib/api';
import { dateTime } from '../lib/format';
import type { Address } from '../lib/types';
import { useAuth } from '../store/auth';

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: me } = useApi<{ name: string; email: string; phone: string | null; role: string; created_at: string }>('/auth/me');
  const { data: addresses, setData: setAddresses, loading } = useApi<Address[]>('/addresses');

  const remove = async (id: number) => {
    await api(`/addresses/${id}`, { method: 'DELETE' });
    setAddresses((addresses ?? []).filter((a) => a.id !== id));
  };

  if (!me) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">{me.name[0]}</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{me.name}</h1>
          <p className="text-sm text-slate-400">
            {me.email}
            {me.phone && ` · ${me.phone}`}
          </p>
          <p className="text-xs text-slate-500">Member since {dateTime(me.created_at)}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>

      <h2 className="mt-10 text-lg font-bold">Saved drop locations</h2>
      <div className="mt-4 space-y-3">
        {loading && !addresses ? (
          <PageLoader />
        ) : addresses?.length === 0 ? (
          <Empty icon={<MapPin className="h-6 w-6" />} title="No saved locations">
            Tick “Save this address” at checkout to add one.
          </Empty>
        ) : (
          addresses?.map((a) => (
            <div key={a.id} className="card flex items-center gap-4 p-4">
              <MapPin className="h-5 w-5 text-brand-400" />
              <div className="flex-1">
                <div className="font-semibold">{a.label}</div>
                <div className="text-sm text-slate-400">{a.line}</div>
                <div className="text-xs text-slate-500">
                  {a.lat.toFixed(5)}, {a.lon.toFixed(5)}
                </div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => remove(a.id)} aria-label={`Delete ${a.label}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
      <Link to="/orders" className="btn-secondary mt-8">
        View my orders
      </Link>
    </div>
  );
}
