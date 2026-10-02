import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

// Stripe webhook needs raw body — must come before express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, _res, next) => {
  req.rawBody = req.body;
  next();
});

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api", tripRoutes);          // /api/routes and /api/trips
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(` BusGo API running on http://localhost:${PORT}`));

// Keep Neon connection warm — ping on startup + every 3 minutes
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ping = () => prisma.$queryRaw`SELECT 1`.catch(() => {});
ping(); // wake immediately on server start
setInterval(ping, 3 * 60 * 1000);
