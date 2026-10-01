import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import AfricasTalking from "africastalking";

const router = Router();
const prisma = new PrismaClient();

const at = AfricasTalking({
  apiKey:   process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});
const sms = at.SMS;

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

// Normalize Ethiopian phone → +2519xxxxxxxx
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("2519") || digits.startsWith("2517")) return `+${digits}`;
  if (digits.startsWith("09") || digits.startsWith("07")) return `+251${digits.slice(1)}`;
  if (digits.startsWith("9") || digits.startsWith("7")) return `+251${digits}`;
  return `+${digits}`;
}

// POST /api/auth/send-otp
// Body: { phone, name? }  — name only needed for first-time registration
router.post("/send-otp", async (req, res, next) => {
  try {
    const { phone, name } = z.object({
      phone: z.string().min(9),
      name:  z.string().min(2).optional(),
    }).parse(req.body);

    const normalized = normalizePhone(phone);
    const otp = generateOtp();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Upsert user — create if new, update OTP if existing
    const user = await prisma.user.upsert({
      where:  { phone: normalized },
      update: { otpCode: otp, otpExpiry: expiry },
      create: {
        phone:     normalized,
        name:      name ?? "User",
        otpCode:   otp,
        otpExpiry: expiry,
      },
    });

    // Send SMS — sandbox logs to console, production sends real SMS
    if (process.env.AT_USERNAME === "sandbox") {
      console.log(`\n📱 OTP for ${normalized}: ${otp}\n`);
    } else {
      await sms.send({
        to:      [normalized],
        message: `Your BusGo verification code is: ${otp}. Valid for 5 minutes.`,
        from:    process.env.AT_SENDER_ID || undefined,
      });
    }

    res.json({ message: "OTP sent", isNew: !user.name || user.name === "User" });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-otp
// Body: { phone, otp, name? }
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { phone, otp, name } = z.object({
      phone: z.string().min(9),
      otp:   z.string().length(6),
      name:  z.string().min(2).optional(),
    }).parse(req.body);

    const normalized = normalizePhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: normalized } });

    if (!user || user.otpCode !== otp) {
      return res.status(401).json({ error: "Invalid OTP" });
    }
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(401).json({ error: "OTP expired. Request a new one." });
    }

    // Clear OTP, optionally update name
    const updated = await prisma.user.update({
      where: { phone: normalized },
      data: {
        otpCode:   null,
        otpExpiry: null,
        ...(name ? { name } : {}),
      },
    });

    res.json({
      token: signToken(updated),
      user:  { id: updated.id, name: updated.name, phone: updated.phone, role: updated.role },
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
