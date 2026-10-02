import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("2519") || digits.startsWith("2517")) return `+${digits}`;
  if (digits.startsWith("09") || digits.startsWith("07")) return `+251${digits.slice(1)}`;
  if (digits.startsWith("9") || digits.startsWith("7")) return `+251${digits}`;
  return `+${digits}`;
}

// POST /api/auth/login — name + phone, returns JWT immediately (one-time, no OTP)
router.post("/login", async (req, res, next) => {
  try {
    const { phone, name } = z.object({
      phone: z.string().min(9),
      name:  z.string().min(2),
    }).parse(req.body);

    const normalized = normalizePhone(phone);

    const user = await prisma.user.upsert({
      where:  { phone: normalized },
      update: { name },
      create: { phone: normalized, name },
    });

    res.json({
      token: signToken(user),
      user:  { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/promote
router.post("/promote", async (req, res, next) => {
  try {
    const { phone, secret } = req.body;
    if (secret !== process.env.JWT_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const normalized = normalizePhone(phone);
    const user = await prisma.user.update({
      where: { phone: normalized },
      data:  { role: "ADMIN" },
    });
    res.json({ message: `${user.phone} is now ADMIN` });
  } catch (err) {
    next(err);
  }
});

export default router;
