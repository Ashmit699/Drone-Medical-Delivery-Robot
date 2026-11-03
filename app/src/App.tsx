import { Compass } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { OpsLayout, PublicLayout, RequireAuth } from './components/layout';
import { Empty, PageLoader } from './components/ui';
import { Login, Register } from './pages/Auth';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Features from './pages/Features';
import Home from './pages/Home';
import Orders from './pages/Orders';
import ProductPage from './pages/ProductPage';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Technology from './pages/Technology';
import Track from './pages/Track';

// Operator console is loaded on demand so customers' phones download less.
const Dashboard = lazy(() => import('./pages/ops/Dashboard'));
const Fleet = lazy(() => import('./pages/ops/Fleet'));
const Inventory = lazy(() => import('./pages/ops/Inventory'));
const Monitor = lazy(() => import('./pages/ops/Monitor'));
const OpsOrders = lazy(() => import('./pages/ops/OpsOrders'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Empty icon={<Compass className="h-6 w-6" />} title="Page not found">
        <Link to="/" className="btn-primary mt-4">
          Go home
        </Link>
      </Empty>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="features" element={<Features />} />
          <Route path="technology" element={<Technology />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:slug" element={<ProductPage />} />
          <Route path="cart" element={<Cart />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="orders/:id" element={<RequireAuth><Track /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="ops" element={<RequireAuth role="operator"><OpsLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OpsOrders />} />
          <Route path="monitor" element={<Monitor />} />
          <Route path="fleet" element={<Fleet />} />
          <Route path="inventory" element={<Inventory />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
