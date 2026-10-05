import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import adminRoutes from "./routes/admin.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import prisma from "./lib/prisma.js";

import { sweepExpiredBookings } from "./routes/bookings.js";

const app = express();

app.use(cors());
app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api", tripRoutes);          // /api/routes and /api/trips
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
const server = app.listen(PORT, () => console.log(`🚀 BusGo API running on http://localhost:${PORT}`));

// Keep Neon connection warm — ping on startup + every 3 minutes
const ping = () => prisma.$queryRaw`SELECT 1`.catch((err) => {
  console.error("Database keepalive failed:", err.message);
});
ping();
const pingTimer = setInterval(ping, 3 * 60 * 1000);
pingTimer.unref?.();

// Periodically release expired pending seat holds
sweepExpiredBookings();
const sweepTimer = setInterval(sweepExpiredBookings, 60 * 1000);
sweepTimer.unref?.();

// Graceful shutdown
function shutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("Database disconnected. Process exited cleanly.");
      process.exit(0);
    } catch (e) {
      console.error("Error during database disconnect:", e);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

