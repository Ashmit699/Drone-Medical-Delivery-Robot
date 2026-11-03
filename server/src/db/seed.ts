// Demo data: catalogue, demo accounts, drone fleet, and a week of past orders so the
// dashboard charts look alive. Runs automatically on first start; `npm run seed` resets.
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { offsetM } from '../lib/geo';
import { db, run, tx } from './index';

// Demo accounts (also shown as one-click buttons on the login page).
export const DEMO_USERS = [
  { name: 'Riya Sen', email: 'customer@medidrop.app', phone: '+91 98000 00001', password: 'demo1234', role: 'customer' },
  { name: 'Base Operator', email: 'ops@medidrop.app', phone: '+91 98000 00002', password: 'demo1234', role: 'operator' },
] as const;

type P = [slug: string, name: string, category: string, description: string, price: number, weightG: number, stock: number, rx: boolean, icon: string, tags: string];

const PRODUCTS: P[] = [
  // Emergency
  ['emergency-trauma-kit', 'Emergency Trauma Kit', 'Emergency', 'Compact kit for bleeding control: compression bandage, gauze, gloves, tourniquet strap.', 549, 240, 25, false, 'briefcase-medical', 'bleeding wound accident'],
  ['epinephrine-auto-injector', 'Epinephrine Auto-Injector', 'Emergency', 'Single-dose auto-injector for severe allergic reactions (anaphylaxis).', 2899, 60, 8, true, 'syringe', 'allergy anaphylaxis'],
  ['snakebite-first-response', 'Snakebite First-Response Pack', 'Emergency', 'Pressure bandage, splint and instruction card for safe transport to hospital.', 399, 180, 15, false, 'shield-plus', 'snake bite rural'],
  ['aspirin-chewable-325', 'Aspirin 325 mg Chewable (10)', 'Emergency', 'For suspected heart attack while waiting for medical help, as advised by a doctor.', 45, 15, 40, false, 'heart-pulse', 'heart cardiac'],
  ['glucose-gel', 'Glucose Gel (3 tubes)', 'Emergency', 'Fast-acting glucose for low blood sugar (hypoglycaemia).', 180, 90, 30, false, 'droplet', 'diabetes sugar'],
  // First Aid
  ['first-aid-kit-basic', 'First-Aid Kit (Basic)', 'First Aid', 'Plasters, antiseptic wipes, gauze, tape, scissors. Everything for small cuts and scrapes.', 299, 250, 30, false, 'briefcase-medical', 'cuts wounds'],
  ['crepe-bandage-10cm', 'Crepe Bandage 10 cm', 'First Aid', 'Elastic support bandage for sprains and strains.', 85, 45, 60, false, 'bandage', 'sprain'],
  ['antiseptic-liquid-100', 'Antiseptic Liquid 100 ml', 'First Aid', 'For cleaning cuts, wounds and skin before dressing.', 95, 130, 50, false, 'droplet', 'wound clean'],
  ['burn-gel-dressing', 'Burn Gel Dressing', 'First Aid', 'Cooling hydrogel dressing for minor burns.', 220, 40, 25, false, 'bandage', 'burn'],
  ['sterile-gauze-pack', 'Sterile Gauze Pads (10)', 'First Aid', 'Individually wrapped 10×10 cm sterile pads.', 120, 35, 70, false, 'bandage', 'dressing'],
  // Medicines
  ['paracetamol-500', 'Paracetamol 500 mg (15)', 'Medicines', 'For fever and mild to moderate pain.', 30, 15, 120, false, 'pill', 'fever pain'],
  ['ors-sachets-5', 'ORS Sachets (5)', 'Medicines', 'WHO-formula oral rehydration salts for dehydration and diarrhoea.', 100, 110, 80, false, 'droplet', 'dehydration diarrhoea heat'],
  ['cetirizine-10', 'Cetirizine 10 mg (10)', 'Medicines', 'Antihistamine for allergies, sneezing and itching.', 35, 10, 90, false, 'pill', 'allergy'],
  ['amoxicillin-500', 'Amoxicillin 500 mg (10)', 'Medicines', 'Antibiotic. Only with a valid prescription.', 120, 20, 40, true, 'pill', 'antibiotic infection'],
  ['salbutamol-inhaler', 'Salbutamol Inhaler', 'Medicines', 'Reliever inhaler for asthma attacks and breathlessness.', 160, 45, 20, true, 'wind', 'asthma breathing'],
  ['zinc-tablets', 'Zinc 20 mg Dispersible (14)', 'Medicines', 'Given with ORS for children with diarrhoea.', 40, 12, 60, false, 'pill', 'child diarrhoea'],
  // Diagnostics
  ['digital-thermometer', 'Digital Thermometer', 'Diagnostics', 'Fast 10-second reading with fever alert.', 199, 30, 35, false, 'thermometer', 'fever'],
  ['pulse-oximeter', 'Fingertip Pulse Oximeter', 'Diagnostics', 'Measures SpO₂ and pulse rate.', 899, 60, 18, false, 'activity', 'oxygen covid'],
  ['glucose-test-strips', 'Glucose Test Strips (25)', 'Diagnostics', 'Compatible with common glucometers.', 650, 40, 30, false, 'test-tube', 'diabetes sugar'],
  ['malaria-rapid-test', 'Malaria Rapid Test Kit', 'Diagnostics', 'Rapid antigen test, result in 15 minutes.', 140, 25, 45, false, 'test-tube', 'malaria fever'],
  // Cold Chain
  ['insulin-pen-cold', 'Insulin Pen (cold-chain pouch)', 'Cold Chain', 'Shipped in an insulated gel pouch to stay at 2–8 °C during flight.', 950, 120, 12, true, 'snowflake', 'diabetes insulin'],
  ['anti-venom-vial', 'Anti-Snake Venom Vial (cold-chain)', 'Cold Chain', 'For hospital/PHC use only. Insulated pouch. Prescription required.', 680, 140, 6, true, 'snowflake', 'snake bite'],
  // Mother & Baby
  ['baby-fever-drops', 'Paediatric Paracetamol Drops', 'Mother & Baby', 'Fever drops for infants, with a dosing dropper.', 65, 40, 40, false, 'baby', 'child fever'],
  ['iron-folic-tablets', 'Iron + Folic Acid (30)', 'Mother & Baby', 'Supplement for pregnant women, as advised by an ASHA/doctor.', 55, 25, 70, false, 'heart-pulse', 'pregnancy anaemia'],
  ['newborn-care-kit', 'Newborn Care Kit', 'Mother & Baby', 'Sterile cord clamp, blade, gauze, gloves and a baby wrap.', 340, 210, 15, false, 'baby', 'delivery newborn'],
];

const DRONES = [
  // MDR-01 is our real prototype. Switch its adapter to 'bridge' in Ops → Fleet once drone-bridge runs.
  { id: 'MDR-01', name: 'Aarogya', model: 'S500 · CrossFlight · winch-drop (prototype)', adapter: 'sim', status: 'idle', max: 300 },
  { id: 'MDR-02', name: 'Sanjeevani', model: 'S500 · CrossFlight · winch-drop', adapter: 'sim', status: 'idle', max: 300 },
  { id: 'MDR-03', name: 'Dhanvantari', model: 'S500 · CrossFlight · winch-drop', adapter: 'sim', status: 'maintenance', max: 300 },
];

const PLACES: [label: string, line: string, north: number, east: number][] = [
  // All inside the 1.3 km demo zone around the hub.
  ['Home', '14 Lake View Road', 700, 450],
  ['Primary Health Centre', 'PHC Sector 9, Main Gate', -800, 650],
  ['Village School', 'Govt. School playground', 950, -500],
  ['Community Hall', 'Ward 4 Community Hall', -400, -1000],
];

export function seed() {
  tx(() => {
    for (const t of ['events', 'missions', 'order_items', 'orders', 'addresses', 'drones', 'products', 'users']) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec(`DELETE FROM sqlite_sequence`);

    const userIds = DEMO_USERS.map(
      (u) => run('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)', u.name, u.email, u.phone, bcrypt.hashSync(u.password, 10), u.role).id,
    );
    const customerId = userIds[0];

    for (const [slug, name, category, description, price, weight, stock, rx, icon, tags] of PRODUCTS) {
      run('INSERT INTO products (slug, name, category, description, price, weight_g, stock, rx_required, icon, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', slug, name, category, description, price, weight, stock, rx, icon, tags);
    }

    for (const d of DRONES) {
      run('INSERT INTO drones (id, name, model, adapter, status, max_payload_g) VALUES (?, ?, ?, ?, ?, ?)', d.id, d.name, d.model, d.adapter, d.status, d.max);
    }

    const places = PLACES.map(([label, line, n, e]) => ({ label, line, ...offsetM(config.hub, n, e) }));
    for (const p of places.slice(0, 2)) {
      run('INSERT INTO addresses (user_id, label, line, lat, lon) VALUES (?, ?, ?, ?, ?)', customerId, p.label, p.line, p.lat, p.lon);
    }

    // A week of history: delivered orders, plus a couple waiting for the operator today.
    const products = db.prepare('SELECT id, name, price, weight_g FROM products WHERE rx_required = 0 AND weight_g <= 120').all() as {
      id: number; name: string; price: number; weight_g: number;
    }[];
    const priorities = ['standard', 'standard', 'express', 'emergency'] as const;
    let n = 0;
    const makeOrder = (daysAgo: number, status: 'delivered' | 'placed' | 'approved' | 'failed', minuteOfDay: number) => {
      n++;
      const items = [products[(n * 7) % products.length], products[(n * 3 + 1) % products.length]].filter((p, i, a) => a.indexOf(p) === i);
      const qty = items.map(() => 1 + (n % 2));
      const itemsTotal = items.reduce((s, p, i) => s + p.price * qty[i], 0);
      const weight = items.reduce((s, p, i) => s + p.weight_g * qty[i], 0);
      const priority = priorities[n % priorities.length];
      const fee = config.fees[priority];
      const place = places[n % places.length];
      const created = `datetime('now', 'start of day', '-${daysAgo} days', '+${minuteOfDay} minutes')`;
      const done = status === 'delivered' || status === 'failed';
      const { id } = run(
        `INSERT INTO orders (user_id, status, priority, items_total, delivery_fee, total, weight_g, payment_method, payment_status,
           address_label, address_line, lat, lon, distance_m, eta_s, drone_id, rating, created_at, updated_at, dispatched_at, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'upi', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ${created}, ${created},
           ${done ? `datetime(${created}, '+4 minutes')` : 'NULL'}, ${status === 'delivered' ? `datetime(${created}, '+${9 + (n % 6)} minutes')` : 'NULL'})`,
        customerId, status, priority, itemsTotal, fee, itemsTotal + fee, weight, place.label, place.line, place.lat, place.lon,
        600 + (n % 5) * 120, 140, done ? (n % 2 ? 'MDR-01' : 'MDR-02') : null, status === 'delivered' && n % 3 !== 0 ? 4 + (n % 2) : null,
      );
      run('UPDATE orders SET code = ? WHERE id = ?', `MD-${1000 + id}`, id);
      items.forEach((p, i) =>
        run('INSERT INTO order_items (order_id, product_id, name, price, qty, weight_g) VALUES (?, ?, ?, ?, ?, ?)', id, p.id, p.name, p.price, qty[i], p.weight_g),
      );
      run(`INSERT INTO events (order_id, type, message, created_at) VALUES (?, 'placed', ?, ${created})`, id, `Order placed (${priority} priority)`);
      if (status === 'delivered') {
        run(`INSERT INTO events (order_id, type, message, created_at) VALUES (?, 'phase:releasing', 'Package is on the ground. Hooks open', datetime(${created}, '+10 minutes'))`, id);
      }
      if (status === 'failed') {
        run(`INSERT INTO events (order_id, type, message, created_at) VALUES (?, 'failed', 'Strong wind at drop zone. Package returned to base', datetime(${created}, '+12 minutes'))`, id);
      }
    };

    const perDay = [3, 5, 4, 6, 4, 7, 2];
    perDay.forEach((count, i) => {
      const daysAgo = 6 - i;
      for (let k = 0; k < count; k++) makeOrder(daysAgo, daysAgo === 3 && k === 0 ? 'failed' : 'delivered', 480 + k * 85);
    });
    makeOrder(0, 'approved', 30);
    makeOrder(0, 'placed', 45);
  });
  console.log('Seeded demo data.');
}

if (process.argv.includes('--reset')) seed();
