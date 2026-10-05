import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

router.use(requireAdmin);

// POST /api/admin/buses
router.post("/buses", async (req, res, next) => {
  try {
    const data = z.object({
      plateNumber: z.string().trim().min(2).max(50),
      operatorName: z.string().trim().min(2).max(100),
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
      origin: z.string().trim().min(2).max(100),
      destination: z.string().trim().min(2).max(100),
      distanceKm: z.number().int().positive(),
    }).refine((d) => d.origin.toLowerCase() !== d.destination.toLowerCase(), {
      message: "Origin and destination cannot be identical",
    }).parse(req.body);
    const route = await prisma.route.create({ data });
    res.status(201).json(route);
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
        user: { select: { id: true, name: true, phone: true, email: true } },
        trip: { include: { route: true, bus: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) { next(err); }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { role } = z.object({ role: z.enum(["USER", "ADMIN"]) }).strict().parse(req.body);
    if (id === req.user.id && role !== "ADMIN") {
      return res.status(409).json({ error: "You cannot remove your own admin role" });
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, phone: true, role: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
