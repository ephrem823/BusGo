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
Sign in at `/login` with an Ethiopian phone number. The backend sends a
single-use verification code through Africa's Talking; the code expires after
five minutes and is limited to five attempts. JWT is stored in localStorage and
sent automatically with every API request via the `api/index.js` wrapper.
Set `AT_API_KEY`, `AT_USERNAME`, and (if required by the account) `AT_SENDER_ID`
in `backend/.env`.

For the first administrator, create an account through OTP verification, then
set that account's `role` to `ADMIN` directly in the database. Once an admin
exists, roles can be managed using the admin API. Do not use a shared JWT
secret as an administrator-promotion credential.

---

## Phase 4 — Payments

Stripe payments use a PaymentIntent and signed webhook confirmation. Configure
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CURRENCY` in
`backend/.env`. The default currency is ETB and must be enabled for your Stripe
account. To receive webhooks locally, install the Stripe CLI and run:
   ```bash
   stripe listen --forward-to localhost:3001/api/payments/webhook
   ```
Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET`. Refunds are
currently automated only for Stripe payments.

TeleBirr callbacks must be delivered through a trusted webhook proxy that sets
the `x-webhook-secret` header to the configured `TELEBIRR_WEBHOOK_SECRET`.
TeleBirr's provider integration does not supply a documented signature contract
in this project; do not expose the callback directly without that verification.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/otp/request | — | Send phone verification code |
| POST | /api/auth/otp/verify | — | Verify code and get JWT |
| GET/PATCH/DELETE | /api/auth/me | JWT | Read, update name, or delete own account |
| GET | /api/routes?from=&to= | — | Search routes |
| GET | /api/trips?routeId=&date= | — | List trips |
| GET | /api/trips/:id | — | Get trip details |
| GET | /api/trips/:id/seats | — | Get seat map |
| POST | /api/bookings | JWT | Create booking + atomically hold seats |
| GET | /api/bookings/me | JWT | My bookings |
| GET | /api/bookings/:id | JWT | Single booking |
| PATCH | /api/bookings/:id | JWT | Change seats on a pending booking |
| DELETE | /api/bookings/:id | JWT | Cancel a pending booking |
| POST | /api/payments/stripe/initiate | JWT | Create/retrieve a Stripe PaymentIntent |
| POST | /api/payments/telebirr/initiate | JWT | Start a TeleBirr payment |
| GET | /api/payments/bookings/:id/status | JWT | Read own payment status |
| POST | /api/payments/webhook | Stripe signature | Confirm/fail Stripe payments |
| POST | /api/payments/telebirr/notify | Webhook secret | Process verified TeleBirr notifications |
| POST | /api/payments/bookings/:id/refund | Admin JWT | Refund a paid Stripe booking |
| GET/POST/PATCH/DELETE | /api/admin/trips[/:id] | Admin JWT | Manage trips |
| POST | /api/admin/buses | Admin JWT | Create bus |
| POST | /api/admin/routes | Admin JWT | Create route |
| GET | /api/admin/bookings | Admin JWT | All bookings |

---

## Security Notes
- Card data never touches your server — Stripe handles it entirely
- OTPs are HMAC-hashed, single-use, time-limited, and attempt-limited
- Seats are claimed with conditional updates inside a DB transaction
- Held seats auto-release after 10 minutes if payment isn't completed
- Paid bookings are confirmed only after an authenticated provider callback
- Bookings with history and trips with bookings cannot be physically deleted
- All secrets live in `.env` — never committed to git
