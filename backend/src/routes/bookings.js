import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

const HOLD_MINUTES = 10;

const bookingSchema = z.object({
  tripId: z.number().int().positive(),
  seatIds: z.array(z.number().int().positive()).min(1).max(6),
});

// POST /api/bookings — lock seats and create a pending booking
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { tripId, seatIds } = bookingSchema.parse(req.body);

    const booking = await prisma.$transaction(async (tx) => {
      // Re-check availability inside the transaction (server-side guard)
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds }, tripId },
      });

      if (seats.length !== seatIds.length) {
        throw Object.assign(new Error("One or more seats not found for this trip"), { status: 400 });
      }

      const unavailable = seats.filter((s) => s.status !== "AVAILABLE");
      if (unavailable.length > 0) {
        throw Object.assign(
          new Error(`Seats already taken: ${unavailable.map((s) => s.seatNumber).join(", ")}`),
          { status: 409 }
        );
      }

      // Hold the seats
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "HELD" },
      });

      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      const totalPrice = Number(trip.price) * seatIds.length;

      const newBooking = await tx.booking.create({
        data: {
          userId: req.user.id,
          tripId,
          seatIds,
          totalPrice,
          paymentStatus: "PENDING",
        },
        include: { trip: { include: { route: true } } },
      });

      return newBooking;
    }, { timeout: 15000 });

    // Auto-release held seats after HOLD_MINUTES if payment not completed
    setTimeout(async () => {
      const b = await prisma.booking.findUnique({ where: { id: booking.id } });
      if (b?.paymentStatus === "PENDING") {
        await prisma.seat.updateMany({
          where: { id: { in: booking.seatIds } },
          data: { status: "AVAILABLE" },
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: "FAILED" },
        });
      }
    }, HOLD_MINUTES * 60 * 1000);

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: { trip: { include: { route: true, bus: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(req.params.id) },
      include: { trip: { include: { route: true, bus: true } } },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    // Users can only see their own bookings; admins can see all
    if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

export default router;
