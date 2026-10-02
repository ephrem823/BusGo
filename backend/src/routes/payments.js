import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import https from "https";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();
const telebirrAgent = new https.Agent({ rejectUnauthorized: false });

// ── helpers ───────────────────────────────────────────────────────────────────

async function confirmBookingPaid(bookingId) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.update({
      where: { id: bookingId },
      data:  { paymentStatus: "PAID" },
    });
    await tx.seat.updateMany({
      where: { id: { in: booking.seatIds } },
      data:  { status: "TAKEN" },
    });
  }, { timeout: 15000 });
}

async function failBooking(bookingId) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data:  { paymentStatus: "FAILED" },
  });
  await prisma.seat.updateMany({
    where: { id: { in: booking.seatIds } },
    data:  { status: "AVAILABLE" },
  });
}

function getBooking(bookingId, userId) {
  return prisma.booking.findUnique({ where: { id: Number(bookingId) } }).then((b) => {
    if (!b) throw Object.assign(new Error("Booking not found"), { status: 404 });
    if (b.userId !== userId) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (b.paymentStatus !== "PENDING")
      throw Object.assign(new Error("Booking is not in a payable state"), { status: 400 });
    return b;
  });
}

// ── Mock confirm (test mode) ──────────────────────────────────────────────────

router.post("/mock-confirm/:bookingId", requireAuth, async (req, res, next) => {
  if (process.env.TELEBIRR_TEST_MODE !== "true") return res.status(404).end();
  try {
    await confirmBookingPaid(Number(req.params.bookingId));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── TeleBirr ──────────────────────────────────────────────────────────────────

router.post("/telebirr/initiate", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.body.bookingId, req.user.id);
    const txRef   = `TB-${booking.id}-${Date.now()}`;
    const amount  = Number(booking.totalPrice).toFixed(2);

    // TEST MODE — skip real API call
    if (process.env.TELEBIRR_TEST_MODE === "true") {
      await prisma.booking.update({
        where: { id: booking.id },
        data:  { paymentMethod: "TELEBIRR", localTxRef: txRef },
      });
      return res.json({
        payUrl: `${process.env.APP_BASE_URL}/confirmation/${booking.id}?mock=1`,
        txRef,
      });
    }

    const nonce     = crypto.randomBytes(8).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const rawStr = [
      `appId=${process.env.TELEBIRR_APP_ID}`,
      `appKey=${process.env.TELEBIRR_APP_KEY}`,
      `nonce=${nonce}`,
      `notifyUrl=${process.env.TELEBIRR_NOTIFY_URL}`,
      `outTradeNo=${txRef}`,
      `returnUrl=${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
      `shortCode=${process.env.TELEBIRR_SHORT_CODE}`,
      `subject=Biftu Bus Ticket`,
      `timeoutExpress=10`,
      `timestamp=${timestamp}`,
      `totalAmount=${amount}`,
    ].join("&");

    const sign = crypto.createHash("sha256").update(rawStr).digest("hex").toUpperCase();

    const { data } = await axios.post(
      `${process.env.TELEBIRR_BASE_URL}/payment/v1/merchant/preOrder`,
      {
        appId: process.env.TELEBIRR_APP_ID,
        sign, nonce, timestamp,
        outTradeNo:     txRef,
        subject:        "Biftu Bus Ticket",
        totalAmount:    amount,
        shortCode:      process.env.TELEBIRR_SHORT_CODE,
        notifyUrl:      process.env.TELEBIRR_NOTIFY_URL,
        returnUrl:      `${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
        timeoutExpress: "10",
      },
      { headers: { "Content-Type": "application/json" }, httpsAgent: telebirrAgent }
    );

    if (data.code !== "0") throw new Error(`TeleBirr error: ${data.msg}`);

    await prisma.booking.update({
      where: { id: booking.id },
      data:  { paymentMethod: "TELEBIRR", localTxRef: txRef },
    });

    res.json({ payUrl: data.data.toPayUrl, txRef });
  } catch (err) {
    next(err);
  }
});

// TeleBirr server-to-server notify
router.post("/telebirr/notify", async (req, res) => {
  try {
    const { outTradeNo, tradeStatus } = req.body;
    const booking = await prisma.booking.findFirst({ where: { localTxRef: outTradeNo } });
    if (!booking) return res.status(404).end();

    if (tradeStatus === "SUCCESS") await confirmBookingPaid(booking.id);
    else await failBooking(booking.id);

    res.json({ code: "0", msg: "success" });
  } catch {
    res.status(500).end();
  }
});

export default router;
