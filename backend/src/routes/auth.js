import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const phoneSchema = z.string().trim().min(9).max(20);

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("251")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+251${digits.slice(1)}`
      : `+251${digits}`;

  if (!/^\+251[97]\d{8}$/.test(normalized)) {
    throw Object.assign(new Error("Enter a valid Ethiopian mobile number"), { status: 400 });
  }
  return normalized;
}

function hashOtp(phone, otp) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(`${phone}:${otp}`).digest("hex");
}

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

async function sendOtp(phone, otp) {
  const { AT_API_KEY, AT_USERNAME, AT_SENDER_ID } = process.env;
  if (!AT_API_KEY || !AT_USERNAME) {
    throw Object.assign(new Error("SMS verification is not configured"), { status: 503 });
  }

  const africastalking = (await import("africastalking")).default({
    apiKey: AT_API_KEY,
    username: AT_USERNAME,
  });
  await africastalking.SMS.send({
    to: [phone],
    message: `Your BusGo verification code is ${otp}. It expires in 5 minutes.`,
    ...(AT_SENDER_ID ? { from: AT_SENDER_ID } : {}),
  });
}

// POST /api/auth/otp/request
router.post("/otp/request", async (req, res, next) => {
  try {
    const { phone: rawPhone, name } = z.object({
      phone: phoneSchema,
      name: z.string().trim().min(2).max(100).optional(),
    }).parse(req.body);
    const phone = normalizePhone(rawPhone);
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing?.otpSentAt && Date.now() - existing.otpSentAt.getTime() < OTP_RESEND_MS) {
      return res.status(429).json({ error: "Please wait before requesting another code" });
    }
    if (!existing && !name) {
      return res.status(400).json({ error: "Full Name is required for new accounts" });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const user = await prisma.user.upsert({
      where: { phone },
      update: {
        otpCode: hashOtp(phone, otp),
        otpExpiry: new Date(Date.now() + OTP_TTL_MS),
        otpSentAt: new Date(),
        otpAttempts: 0,
      },
      create: {
        phone,
        name: name || "Passenger",
        otpCode: hashOtp(phone, otp),
        otpExpiry: new Date(Date.now() + OTP_TTL_MS),
        otpSentAt: new Date(),
      },
    });

    try {
      await sendOtp(phone, otp);
    } catch (err) {
      console.error("SMS verification delivery failed:", err);
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null, otpSentAt: null, otpAttempts: 0 },
      });
      throw Object.assign(new Error("Could not send verification code"), { status: 502 });
    }

    res.status(202).json({ message: "Verification code sent" });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/otp/verify
router.post("/otp/verify", async (req, res, next) => {
  try {
    const { phone: rawPhone, code } = z.object({
      phone: phoneSchema,
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body);
    const phone = normalizePhone(rawPhone);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user?.otpCode || !user.otpExpiry || user.otpExpiry <= new Date()) {
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many attempts; request a new code" });
    }

    const suppliedHash = hashOtp(phone, code);
    const bufA = Buffer.from(user.otpCode, "hex");
    const bufB = Buffer.from(suppliedHash, "hex");
    const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    if (!valid) {
      await prisma.user.updateMany({
        where: { id: user.id, otpAttempts: { lt: OTP_MAX_ATTEMPTS } },
        data: { otpAttempts: { increment: 1 } },
      });
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }

    const consumed = await prisma.user.updateMany({
      where: {
        id: user.id,
        otpCode: user.otpCode,
        otpExpiry: { gt: new Date() },
        otpAttempts: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { otpCode: null, otpExpiry: null, otpSentAt: null, otpAttempts: 0 },
    });
    if (consumed.count !== 1) {
      return res.status(400).json({ error: "Verification code is invalid or expired" });
    }

    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "Account not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { name } = z.object({
      name: z.string().trim().min(2).max(100),
    }).strict().parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    const bookingCount = await prisma.booking.count({ where: { userId: req.user.id } });
    if (bookingCount) {
      return res.status(409).json({
        error: "Accounts with booking history cannot be deleted; contact support to request data removal",
      });
    }
    await prisma.user.delete({ where: { id: req.user.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
