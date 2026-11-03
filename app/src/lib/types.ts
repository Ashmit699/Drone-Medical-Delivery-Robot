// Mirrors the backend shapes (server/src). Keep in sync when the API changes.

export type Role = 'customer' | 'operator';
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export type Priority = 'standard' | 'express' | 'emergency';
export type OrderStatus = 'placed' | 'approved' | 'rejected' | 'cancelled' | 'in_flight' | 'delivered' | 'failed';

export type MissionPhase =
  | 'idle'
  | 'preflight'
  | 'takeoff'
  | 'cruise'
  | 'approach'
  | 'aligning'
  | 'awaiting_clearance'
  | 'lowering'
  | 'releasing'
  | 'retracting'
  | 'returning'
  | 'landing'
  | 'completed'
  | 'aborted';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface AppConfig {
  hub: LatLon & { name: string };
  serviceRadiusKm: number;
  demoArea: { south: number; west: number; north: number; east: number; areaKm2: number };
  maxPayloadG: number;
  fees: Record<Priority, number>;
  perKmFee: number;
  includedKm: number;
  flight: { cruiseAltM: number; dropAltM: number; cruiseSpeedMs: number };
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  weight_g: number;
  stock: number;
  rx_required: number;
  icon: string;
  tags: string;
}

export interface Address extends LatLon {
  id: number;
  label: string;
  line: string;
}

export interface Quote {
  lines: { productId: number; name: string; price: number; qty: number; weightG: number; rxRequired: boolean; icon: string }[];
  itemsTotal: number;
  weightG: number;
  baseFee: number;
  distanceFee: number;
  deliveryFee: number;
  batteryUsePct: number | null;
  total: number;
  distanceM: number | null;
  etaS: number | null;
  rxRequired: boolean;
  problems: string[];
}

export interface OrderEvent {
  id: number;
  type: string;
  message: string;
  created_at: string;
}

export interface OrderSummary {
  id: number;
  code: string;
  status: OrderStatus;
  priority: Priority;
  total: number;
  weight_g: number;
  address_label: string;
  created_at: string;
  delivered_at: string | null;
  drone_id: string | null;
  rating: number | null;
  payment_method: string;
  distance_m: number;
  has_rx: number;
  customer_name: string;
  mission_phase: MissionPhase | null;
  summary: string;
  item_count: number;
}

export interface OrderDetail {
  id: number;
  code: string;
  user_id: number;
  status: OrderStatus;
  priority: Priority;
  items_total: number;
  delivery_fee: number;
  total: number;
  weight_g: number;
  payment_method: 'upi' | 'wallet' | 'account';
  payment_status: string;
  address_label: string;
  address_line: string;
  lat: number;
  lon: number;
  ground_alt_m: number | null;
  distance_m: number;
  eta_s: number;
  notes: string | null;
  reject_reason: string | null;
  drone_id: string | null;
  drone_name: string | null;
  mission_id: number | null;
  mission_phase: MissionPhase | null;
  rating: number | null;
  feedback: string | null;
  created_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  customer_name: string;
  customer_phone: string | null;
  has_rx: boolean;
  items: { product_id: number; name: string; price: number; qty: number; weight_g: number }[];
  events: OrderEvent[];
  telemetry?: Telemetry | null;
}

export interface Telemetry {
  droneId: string;
  connected: boolean;
  armed: boolean;
  mode: string;
  phase: MissionPhase;
  missionId: number | null;
  position: LatLon;
  altM: number;
  groundSpeedMs: number;
  headingDeg: number;
  batteryPct: number;
  batteryV: number;
  gpsSats: number;
  markerErrorCm: number | null;
  distanceToTargetM: number | null;
  etaToDropS: number | null;
  paused: boolean;
  payload: { gripper: 'closed' | 'open'; winch: 'homed' | 'lowering' | 'holding' | 'retracting' | 'fault'; ropeM: number; loaded: boolean };
  updatedAt: number;
}

export interface Drone {
  id: string;
  name: string;
  model: string;
  adapter: 'sim' | 'bridge';
  status: 'idle' | 'in_flight' | 'charging' | 'maintenance';
  max_payload_g: number;
  missions: number;
  active_order: string | null;
  telemetry: Telemetry | null;
}

export interface Stats {
  ordersToday: number;
  deliveredToday: number;
  inFlight: number;
  pendingApproval: number;
  readyToDispatch: number;
  totalDelivered: number;
  revenueToday: number;
  avgDeliveryMin: number | null;
  avgRating: number | null;
  successRate: number | null;
  fleet: Record<string, number>;
  ordersByDay: { day: string; orders: number; delivered: number }[];
  byCategory: { category: string; qty: number }[];
  byPriority: { priority: Priority; n: number }[];
  lowStock: { id: number; name: string; stock: number }[];
}
