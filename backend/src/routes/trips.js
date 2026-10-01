import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/routes?from=&to=
router.get("/routes", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from) where.origin = { contains: from, mode: "insensitive" };
    if (to) where.destination = { contains: to, mode: "insensitive" };
    const routes = await prisma.route.findMany({ where });
    res.json(routes);
  } catch (err) {
    next(err);
  }
});

// GET /api/trips?routeId=&date=
router.get("/trips", async (req, res, next) => {
  try {
    const { routeId, date } = req.query;
    if (!routeId || !date) {
      return res.status(400).json({ error: "routeId and date are required" });
    }
    const trips = await prisma.trip.findMany({
      where: { routeId: Number(routeId), date },
      include: {
        route: true,
        bus: { select: { operatorName: true, totalSeats: true } },
        seats: { select: { status: true } },
      },
    });

    // Attach available seat count without exposing full seat list
    const result = trips.map((t) => ({
      id: t.id,
      date: t.date,
      departureTime: t.departureTime,
      price: t.price,
      route: t.route,
      operator: t.bus.operatorName,
      totalSeats: t.bus.totalSeats,
      availableSeats: t.seats.filter((s) => s.status === "AVAILABLE").length,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/trips/:id/seats
router.get("/trips/:id/seats", async (req, res, next) => {
  try {
    const seats = await prisma.seat.findMany({
      where: { tripId: Number(req.params.id) },
      orderBy: { seatNumber: "asc" },
      select: { id: true, seatNumber: true, status: true },
    });
    if (!seats.length) return res.status(404).json({ error: "Trip not found" });
    res.json(seats);
  } catch (err) {
    next(err);
  }
});

export default router;
