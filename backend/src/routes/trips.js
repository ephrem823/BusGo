import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const tripFields = {
  routeId: z.number().int().positive(),
  busId: z.number().int().positive(),
  departureTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date must be a valid calendar date"),
  price: z.number().positive(),
};

router.get("/routes", async (req, res, next) => {
  try {
    const query = z.object({
      from: z.string().trim().max(100).optional(),
      to: z.string().trim().max(100).optional(),
    }).parse(req.query);
    const where = {};
    if (query.from) where.origin = { contains: query.from, mode: "insensitive" };
    if (query.to) where.destination = { contains: query.to, mode: "insensitive" };
    res.json(await prisma.route.findMany({ where, orderBy: { id: "asc" } }));
  } catch (err) {
    next(err);
  }
});

router.get("/trips", async (req, res, next) => {
  try {
    const { routeId, date } = z.object({
      routeId: z.coerce.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(req.query);
    const trips = await prisma.trip.findMany({
      where: { routeId, date },
      include: {
        route: true,
        bus: { select: { operatorName: true, totalSeats: true } },
        seats: { select: { status: true } },
      },
      orderBy: { departureTime: "asc" },
    });
    res.json(trips.map((trip) => ({
      id: trip.id,
      date: trip.date,
      departureTime: trip.departureTime,
      price: trip.price,
      route: trip.route,
      operator: trip.bus.operatorName,
      totalSeats: trip.bus.totalSeats,
      availableSeats: trip.seats.filter((seat) => seat.status === "AVAILABLE").length,
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/trips/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        bus: { select: { operatorName: true, totalSeats: true } },
      },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

router.get("/trips/:id/seats", async (req, res, next) => {
  try {
    const tripId = z.coerce.number().int().positive().parse(req.params.id);
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const seats = await prisma.seat.findMany({
      where: { tripId },
      orderBy: { seatNumber: "asc" },
      select: { id: true, seatNumber: true, status: true },
    });
    res.json(seats);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/trips", requireAdmin, async (_req, res, next) => {
  try {
    const trips = await prisma.trip.findMany({
      include: { route: true, bus: true },
      orderBy: [{ date: "asc" }, { departureTime: "asc" }],
    });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/trips/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { route: true, bus: true, seats: true },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip);
  } catch (err) {
    next(err);
  }
});

router.post("/admin/trips", requireAdmin, async (req, res, next) => {
  try {
    const data = z.object(tripFields).strict().parse(req.body);
    const bus = await prisma.bus.findUnique({ where: { id: data.busId } });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({ data });
      await tx.seat.createMany({
        data: Array.from({ length: bus.totalSeats }, (_, index) => ({
          tripId: created.id,
          seatNumber: index + 1,
        })),
      });
      return created;
    });
    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

router.patch("/admin/trips/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = z.object(tripFields).partial().strict().refine(
      (value) => Object.keys(value).length > 0,
      "At least one trip field is required"
    ).parse(req.body);
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    if (data.busId && data.busId !== trip.busId) {
      const bus = await prisma.bus.findUnique({ where: { id: data.busId } });
      if (!bus) return res.status(404).json({ error: "Bus not found" });
      const occupiedSeat = await prisma.seat.findFirst({
        where: { tripId: id, seatNumber: { gt: bus.totalSeats }, status: { not: "AVAILABLE" } },
      });
      if (occupiedSeat) {
        return res.status(409).json({ error: "The new bus has fewer seats than this trip's occupied seats" });
      }
      await prisma.$transaction(async (tx) => {
        await tx.seat.deleteMany({
          where: { tripId: id, seatNumber: { gt: bus.totalSeats }, status: "AVAILABLE" },
        });
        const existingSeats = await tx.seat.findMany({
          where: { tripId: id },
          select: { seatNumber: true },
        });
        const present = new Set(existingSeats.map((seat) => seat.seatNumber));
        const missing = Array.from({ length: bus.totalSeats }, (_, index) => index + 1)
          .filter((seatNumber) => !present.has(seatNumber));
        if (missing.length) {
          await tx.seat.createMany({
            data: missing.map((seatNumber) => ({ tripId: id, seatNumber })),
          });
        }
        await tx.trip.update({ where: { id }, data });
      });
    } else {
      await prisma.trip.update({ where: { id }, data });
    }

    res.json(await prisma.trip.findUnique({ where: { id }, include: { route: true, bus: true } }));
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/trips/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const trip = await prisma.trip.findUnique({ where: { id }, select: { id: true } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const hasBookings = await prisma.booking.count({ where: { tripId: id } });
    if (hasBookings) {
      return res.status(409).json({ error: "Trips with booking history cannot be deleted" });
    }
    await prisma.$transaction(async (tx) => {
      await tx.seat.deleteMany({ where: { tripId: id } });
      await tx.trip.delete({ where: { id } });
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
