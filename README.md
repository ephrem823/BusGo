# BusGo — Bus Ticket Booking Platform

## Project Structure
```
busgo/
├── backend/   Node.js + Express + Prisma + PostgreSQL
└── web/       React + Vite + Tailwind CSS
```

---

## Phase 1 — Backend Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local, Supabase, or Neon free tier)

### Steps

```bash
cd backend
npm install

# 1. Copy env file and fill in your DATABASE_URL and JWT_SECRET
cp .env.example .env

# 2. Run Prisma migration (creates all tables)
npx prisma migrate dev --name init

# 3. Seed the database with sample buses, routes, trips, and seats
node prisma/seed.js

# 4. Start the dev server
npm run dev
```

Test it's working:
```bash
curl http://localhost:3001/health
# → {"status":"ok"}

curl "http://localhost:3001/api/routes?from=Addis&to=Hawassa"
# → [{id, origin, destination, ...}]
```

---

## Phase 2 — Frontend Setup

```bash
cd web
npm install

# Copy env and add your Stripe publishable key (pk_test_...)
cp .env.example .env

npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:3001` automatically.

---

## Phase 3 — Auth
Register at `/register`, login at `/login`. JWT is stored in localStorage and
sent automatically with every API request via the `api/index.js` wrapper.

---

## Phase 4 — Stripe Payments (Test Mode)

1. Create a free account at https://stripe.com
2. Copy your **test** secret key (`sk_test_...`) → `backend/.env` → `STRIPE_SECRET_KEY`
3. Copy your **test** publishable key (`pk_test_...`) → `web/.env` → `VITE_STRIPE_PUBLISHABLE_KEY`
4. For webhooks locally, install the Stripe CLI and run:
   ```bash
   stripe listen --forward-to localhost:3001/api/payments/webhook
   ```
   Copy the `whsec_...` secret it prints → `backend/.env` → `STRIPE_WEBHOOK_SECRET`
5. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | — | Create account |
| POST | /api/auth/login | — | Login, get JWT |
| GET | /api/routes?from=&to= | — | Search routes |
| GET | /api/trips?routeId=&date= | — | List trips |
| GET | /api/trips/:id/seats | — | Get seat map |
| POST | /api/bookings | JWT | Create booking + lock seats |
| GET | /api/bookings/me | JWT | My bookings |
| GET | /api/bookings/:id | JWT | Single booking |
| POST | /api/payments/create-intent | JWT | Stripe payment intent |
| POST | /api/payments/webhook | Stripe | Payment confirmation |
| POST | /api/admin/buses | Admin JWT | Create bus |
| POST | /api/admin/routes | Admin JWT | Create route |
| POST | /api/admin/trips | Admin JWT | Create trip |
| GET | /api/admin/bookings | Admin JWT | All bookings |

---

## Security Notes
- Passwords hashed with bcrypt (cost factor 12) — never stored in plaintext
- Card data never touches your server — Stripe handles it entirely
- Seats are locked in a DB transaction before payment starts
- Held seats auto-release after 10 minutes if payment isn't completed
- Seat availability is re-validated server-side before every booking confirmation
- All secrets live in `.env` — never committed to git
