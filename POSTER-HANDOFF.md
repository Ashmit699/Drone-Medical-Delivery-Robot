# Aerolift: poster and template design handoff

Everything a designer (person or AI tool) needs to make the exhibition poster and matching templates
for **Aerolift**, a school exhibition project. All facts, numbers and prices below match the working
app in this repository. Do not invent other numbers.

---

## 1. The project in one paragraph

**Aerolift** flies emergency medicines to people by drone in about 4 minutes. Instead of paying per
order, families pay a small **monthly plan** (like insurance), and every emergency delivery is then
**free**, medicines included. A customer orders in the app, a drone takes off from the hub at the
school, flies at 60 m straight over traffic, hovers 4 m above the customer, and lowers the medicine
on a rope once they tap **Area clear**. It is a working prototype: a real app, a real drone with a
real autopilot (ArduPilot), and a storage box that opens and closes by itself at the drop point.

Made by a team of 3 students for a school exhibition, Indirapuram, Ghaziabad.

---

## 2. What to make

| Item | Size | Notes |
|---|---|---|
| **Main exhibition poster** | A2 portrait (420 × 594 mm), also works scaled to A3 | The hero piece. Readable from 2 m away |
| **Standee / roll-up** (optional) | 85 × 200 cm portrait | Same content as the poster, fewer words |
| **Table card** | A5 landscape | "How it works" in 4 steps + QR code |
| **Plans flyer** | A5 portrait | The three Care plans + welfare discount |
| **Social post** | 1080 × 1080 px and 1080 × 1350 px | Headline, drone image, "From ₹349/month. ₹0 in an emergency." |
| **Template** | A reusable layout (Canva / Figma / slides) | Header band, title, 2–3 content blocks, footer with logo, using the colours and fonts below |

Leave a **QR code placeholder** (about 35 × 35 mm on the poster) labelled "Scan to try the app".
The team will add the real QR code on the day.

---

## 3. Brand

### Name and logo
- Name: **Aerolift**. One word, capital A only. Never "AeroLift", "AERO LIFT" or "Aero-lift" in body text.
- Logo wordmark: "Aero" in Midnight Navy + "lift" in Pulse Teal, set in Space Grotesk Bold.
- Icon: a white medical cross on a rounded teal square (the app's favicon). The cross shape is in
  `app/public/favicon.svg`. On posters, use the brand teal `#00C2C7` for the square.
- Helpline line used in the app: **1800-AERO-LIFT**.

### Colours (use only these six)

| Name | Hex | Use |
|---|---|---|
| Midnight Navy | `#09243E` | Headings, main text, dark bands |
| Pulse Teal | `#00C2C7` | Highlights, buttons, key numbers, "lift" in the logo |
| Clinical White | `#F5F9FC` | Background (keep backgrounds white or this very light tint, not blue) |
| Emergency Coral | `#FF685F` | Emergency / SOS only, used sparingly (one or two accents) |
| Steel Blue | `#1E4059` | Secondary text, panels on dark bands |
| Sky Mint | `#B9F0EC` | Soft boxes behind numbers or callouts |

Contrast rules:
- Text **on teal** or **on coral** is Midnight Navy, never white.
- Small teal text on white is too faint. For teal-coloured text on white use the darker teal `#00797C`.

### Fonts (free on Google Fonts)
- **Space Grotesk** (600–700): headlines, big numbers, the logo.
- **Inter** (400–600): body text, labels.
- **JetBrains Mono** (optional): small technical labels like "ARDUPILOT · MAVLINK".

### Look and feel
Clean, clinical and premium, like a modern health-tech brand: lots of white space, a navy header or
footer band, teal highlights, rounded corners (12–24 px), soft shadows. Avoid neon glows, dark
"sci-fi" backgrounds, gradients everywhere, stock-photo clutter and emoji.

---

## 4. Words to use

### Headline (pick one)
- **Emergency medicines, at your door in minutes.** (main choice)
- Pay a little every month. Never pay in an emergency.
- Medicines from the sky.
- Straight over traffic, straight to you.

### Sub-headline
An emergency drone flies your medicine straight over traffic and lowers it to your hands. Members
never pay per order: it's all covered by one monthly plan.

### Big numbers (print these large)

| Number | Label |
|---|---|
| **~4 min** | by drone for 2 km, vs ~25 min by road in city traffic |
| **54 km/h** | top cruise speed; every flight is an emergency flight |
| **₹0** | per emergency order for members, medicines included |
| **₹349** | per month, cheapest plan |
| **60 m** | cruise height, above the area's 40–60 m towers |
| **1.3 km** | service radius around the hub at the school |
| **24×7** | SOS ordering, day and night |

### How it works (4 steps, with an icon each)
1. **Tell us what you need.** Pick the medicine or kit and drop a pin where you are.
2. **Auto-approved instantly.** Every order is an emergency: no queue, no payment screen.
3. **Full-speed flight.** The next drone takes off at top speed, straight over traffic.
4. **Lowered to your hands.** It hovers 4 m above you; tap Area clear, the box opens and the kit comes down on a rope.

### Care plans (prices per month)

| Plan | Price | People | Free emergency deliveries | Medicines covered per delivery | Extras |
|---|---|---|---|---|---|
| Personal | ₹349 | 1 | 4 / month | up to ₹1,000 | 24×7 SOS button, live drone tracking |
| **Family** (mark "Most popular") | ₹799 | up to 5 | 10 / month | up to ₹1,500 | Saved home, school and office drop points |
| Care+ | ₹1,499 | up to 5 | Unlimited | up to ₹3,000 | Cold-chain insulin and vaccines, priority pharmacist call-back |

Poster line: **"From ₹349/month. ₹0 in an emergency."**

Welfare discount, for families who need it most: **BPL 50% off · SC/ST 40% off · EWS 30% off** any plan
(Family plan becomes ₹400 / ₹479 / ₹559).

### Real-life moments (good for small cards or an "Emergencies we cover" strip)
- Insulin running low at midnight?
- Chest pain or an asthma attack?
- Baby has a fever tonight?
- A snakebite or a bad cut far from a pharmacy?

What we carry: 30 emergency products in 7 categories: Emergency, First Aid, Medicines, Diagnostics,
Cold Chain, Relief & Survival, Mother & Baby.

### Safety (a row of small icons + one line each)
- **Area clear:** nothing is lowered until someone below confirms the spot is empty.
- **Box locked in flight:** the storage box only opens while hovering over the drop point.
- **Flies high:** 60 m cruise, and it climbs back to 60 m before heading home.
- **Ground check before every flight:** the route is checked against the terrain first.
- **Auto return home** on low battery or a lost radio link.
- **Human override:** a pilot with a remote control can always take over.
- **Legal height:** stays under 120 m, India's green-zone limit.

### The drone (spec strip)
Aarogya (MDR-01) · S500 quadcopter · Radiolink CrossFlight flight controller running ArduPilot ·
TS100 GPS · SiK telemetry radio · servo-operated storage box · 300 g payload · ~10 min flight time.

### How it's built (optional "Technology" panel, for the curious)
App → Server → Bridge → Radio → Drone.
React app · Node.js server · Python bridge (MAVLink) · ArduPilot autopilot · tested in ArduPilot SITL,
the real autopilot software flying a virtual drone.

### Footer
Aerolift · Emergency medicine delivery by drone · School exhibition prototype, Indirapuram, Ghaziabad ·
1800-AERO-LIFT · [QR: Scan to try the app]

---

## 5. Suggested poster layout (A2 portrait, top to bottom)

1. **Header band** (navy, ~12% height): logo left, "School exhibition prototype" tag right.
2. **Hero** (~30%): headline + sub-headline on the left; on the right, the drone with the medicine box
   lowering on a rope, over a simple map line from the hub to a pin. Teal "~4 min" badge on the image.
3. **Big numbers row** (~12%): 4 tiles on Sky Mint: ~4 min · 54 km/h · ₹0 · 60 m.
4. **How it works** (~15%): 4 numbered steps in a row with line icons.
5. **Plans** (~15%): three plan cards, Family raised and marked "Most popular"; welfare line under them.
6. **Safety + Drone** (~10%): icon row on the left, spec strip on the right.
7. **Footer band** (navy, ~6%): footer text + QR placeholder.

Keep body text at least 24 pt on A2 (18 pt on A3) and headlines 90–120 pt.

---

## 6. Images and assets

- **App screen mockups** (5 phone screens: order tracking, Area clear, live map, orders list, order
  history), already designed in the Aerolift colours: the Aerolift App Mockups canvas on claude.ai
  (ask Ashmit for access; it can export PNGs).
- **Poster facts brief**: the Aerolift Poster Brief doc on claude.ai (same content as section 4).
- **Drone photo**: take a real photo of the team's drone on a plain white or light grey background,
  props on, box closed and box open. A real photo beats any illustration for this project.
- **Screenshots of the live app**: start the app (see `HANDOFF.md`) and capture the Home page, Plans
  page, Track page and Ops Live monitor at phone width (390 px) and laptop width.
- **Icons**: simple line icons (e.g. Lucide, the same set the app uses): drone, pin, shield, clock,
  box, pill, phone.

---

## 7. Keep it honest

This is a working prototype, not a launched company. On the poster:
- Say **"prototype"** or **"school exhibition project"** somewhere visible.
- Payments are a demo; no real money is charged. Prices show the planned business model.
- The live demo flies in **ArduPilot SITL** (the real autopilot on a virtual drone); the real
  drone's storage box opens and closes on the table at the same moment.
- Don't claim certifications, customer numbers, hospital partners or awards the project doesn't have.

---

## 8. Checklist before printing

- [ ] Only the six brand colours, white or very light background
- [ ] "Aerolift" spelled correctly everywhere; logo is navy "Aero" + teal "lift"
- [ ] Prices: ₹349 / ₹799 / ₹1,499, welfare 50 / 40 / 30%
- [ ] Numbers: ~4 min, 54 km/h, 60 m, 4 m hover, 1.3 km, 300 g
- [ ] Text on teal or coral is navy, never white
- [ ] QR placeholder left for the team
- [ ] "Prototype / school exhibition" mentioned
- [ ] Exported as print PDF at 300 dpi with 3 mm bleed
