import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(requireAdmin);

// POST /api/admin/buses
router.post("/buses", async (req, res, next) => {
  try {
    const data = z.object({
      plateNumber: z.string(),
      operatorName: z.string(),
      totalSeats: z.number().int().min(1).max(100),
    }).parse(req.body);
    const bus = await prisma.bus.create({ data });
    res.status(201).json(bus);
  } catch (err) { next(err); }
});

// POST /api/admin/routes
router.post("/routes", async (req, res, next) => {
  try {
    const data = z.object({
      origin: z.string(),
      destination: z.string(),
      distanceKm: z.number().int().positive(),
    }).parse(req.body);
    const route = await prisma.route.create({ data });
    res.status(201).json(route);
  } catch (err) { next(err); }
});

// POST /api/admin/trips
router.post("/trips", async (req, res, next) => {
  try {
    const data = z.object({
      routeId: z.number().int(),
      busId: z.number().int(),
      departureTime: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      price: z.number().positive(),
    }).parse(req.body);

    const bus = await prisma.bus.findUnique({ where: { id: data.busId } });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    const trip = await prisma.$transaction(async (tx) => {
      const t = await tx.trip.create({ data });
      await tx.seat.createMany({
        data: Array.from({ length: bus.totalSeats }, (_, i) => ({
          tripId: t.id,
          seatNumber: i + 1,
        })),
      });
      return t;
    });
    res.status(201).json(trip);
  } catch (err) { next(err); }
});

// GET /api/admin/buses
router.get("/buses", async (req, res, next) => {
  try {
    const buses = await prisma.bus.findMany({ orderBy: { id: "asc" } });
    res.json(buses);
  } catch (err) { next(err); }
});

// GET /api/admin/routes
router.get("/routes", async (req, res, next) => {
  try {
    const routes = await prisma.route.findMany({ orderBy: { id: "asc" } });
    res.json(routes);
  } catch (err) { next(err); }
});

// GET /api/admin/bookings
router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { name: true, email: true } },
        trip: { include: { route: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) { next(err); }
});

export default router;
