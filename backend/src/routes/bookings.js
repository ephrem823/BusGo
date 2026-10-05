import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const HOLD_MINUTES = 10;
const bookingSchema = z.object({
  tripId: z.number().int().positive(),
  seatIds: z.array(z.number().int().positive()).min(1).max(6),
}).strict().refine((data) => new Set(data.seatIds).size === data.seatIds.length, {
  message: "Seat IDs must be unique",
});

async function releasePendingBooking(bookingId) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.paymentStatus !== "PENDING") return;
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, paymentStatus: "PENDING" },
      data: { paymentStatus: "FAILED" },
    });
    if (updated.count) {
      await tx.seat.updateMany({
        where: {
          id: { in: booking.seatIds },
          tripId: booking.tripId,
          status: "HELD",
        },
        data: { status: "AVAILABLE" },
      });
    }
  });
}

export async function sweepExpiredBookings() {
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
  try {
    const expired = await prisma.booking.findMany({
      where: { paymentStatus: "PENDING", createdAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const b of expired) {
      await releasePendingBooking(b.id);
    }
    if (expired.length > 0) {
      console.log(`[BusGo] Released ${expired.length} expired hold(s)`);
    }
  } catch (err) {
    console.error("[BusGo] Error sweeping expired bookings:", err.message);
  }
}


router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { tripId, seatIds } = bookingSchema.parse(req.body);
    const booking = await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds }, tripId },
      });
      if (seats.length !== seatIds.length) {
        throw Object.assign(new Error("One or more seats not found for this trip"), { status: 400 });
      }
      const claimed = await tx.seat.updateMany({
        where: { id: { in: seatIds }, tripId, status: "AVAILABLE" },
        data: { status: "HELD" },
      });
      if (claimed.count !== seatIds.length) {
        throw Object.assign(new Error("One or more seats are no longer available"), { status: 409 });
      }

      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw Object.assign(new Error("Trip not found"), { status: 404 });
      return tx.booking.create({
        data: {
          userId: req.user.id,
          tripId,
          seatIds,
          totalPrice: Number(trip.price) * seatIds.length,
        },
        include: { trip: { include: { route: true } } },
      });
    }, { timeout: 15000 });

    const holdTimer = setTimeout(() => {
      releasePendingBooking(booking.id).catch((err) => {
        console.error(`Failed to release expired booking ${booking.id}:`, err);
      });
    }, HOLD_MINUTES * 60 * 1000);
    holdTimer.unref?.();

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

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

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { trip: { include: { route: true, bus: true } } },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { seatIds } = z.object({
      seatIds: bookingSchema.shape.seatIds,
    }).strict().parse(req.body);
    if (new Set(seatIds).size !== seatIds.length) {
      return res.status(400).json({ error: "Seat IDs must be unique" });
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw Object.assign(new Error("Booking not found"), { status: 404 });
      if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }
      if (booking.paymentStatus !== "PENDING") {
        throw Object.assign(new Error("Only pending bookings can be changed"), { status: 409 });
      }
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds }, tripId: booking.tripId },
      });
      if (seats.length !== seatIds.length) {
        throw Object.assign(new Error("One or more seats not found for this trip"), { status: 400 });
      }
      await tx.seat.updateMany({
        where: {
          id: { in: booking.seatIds },
          tripId: booking.tripId,
          status: "HELD",
        },
        data: { status: "AVAILABLE" },
      });
      const claimed = await tx.seat.updateMany({
        where: { id: { in: seatIds }, tripId: booking.tripId, status: "AVAILABLE" },
        data: { status: "HELD" },
      });
      if (claimed.count !== seatIds.length) {
        throw Object.assign(new Error("One or more seats are no longer available"), { status: 409 });
      }
      const trip = await tx.trip.findUnique({ where: { id: booking.tripId } });
      return tx.booking.update({
        where: { id },
        data: { seatIds, totalPrice: Number(trip.price) * seatIds.length },
        include: { trip: { include: { route: true, bus: true } } },
      });
    }, { timeout: 15000 });
    res.json(updatedBooking);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw Object.assign(new Error("Booking not found"), { status: 404 });
      if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }
      if (booking.paymentStatus !== "PENDING") {
        throw Object.assign(new Error("Only pending bookings can be cancelled"), { status: 409 });
      }
      const updated = await tx.booking.updateMany({
        where: { id, paymentStatus: "PENDING" },
        data: { paymentStatus: "FAILED" },
      });
      if (!updated.count) {
        throw Object.assign(new Error("Booking is no longer pending"), { status: 409 });
      }
      await tx.seat.updateMany({
        where: {
          id: { in: booking.seatIds },
          tripId: booking.tripId,
          status: "HELD",
        },
        data: { status: "AVAILABLE" },
      });
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
