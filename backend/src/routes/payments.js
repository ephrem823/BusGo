import { Router } from "express";
import axios from "axios";
import crypto from "crypto";
import Stripe from "stripe";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const bookingIdSchema = z.coerce.number().int().positive();

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error("Stripe payments are not configured"), { status: 503 });
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function amountInMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

function verifyTelebirrWebhook(req) {
  const secret = process.env.TELEBIRR_WEBHOOK_SECRET;
  const supplied = req.get("x-webhook-secret");
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function getPayableBooking(bookingId, user) {
  const id = bookingIdSchema.parse(bookingId);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw Object.assign(new Error("Booking not found"), { status: 404 });
  if (booking.userId !== user.id && user.role !== "ADMIN") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  if (booking.paymentStatus !== "PENDING") {
    throw Object.assign(new Error("Booking is not in a payable state"), { status: 409 });
  }
  return booking;
}

async function confirmBookingPaid(bookingId) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.paymentStatus !== "PENDING") return false;
    const heldSeats = await tx.seat.count({
      where: {
        id: { in: booking.seatIds },
        tripId: booking.tripId,
        status: "HELD",
      },
    });
    if (heldSeats !== booking.seatIds.length) {
      await tx.booking.updateMany({
        where: { id: bookingId, paymentStatus: "PENDING" },
        data: { paymentStatus: "FAILED" },
      });
      await tx.seat.updateMany({
        where: {
          id: { in: booking.seatIds },
          tripId: booking.tripId,
          status: "HELD",
        },
        data: { status: "AVAILABLE" },
      });
      return false;
    }
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID" },
    });
    if (!updated.count) return false;
    await tx.seat.updateMany({
      where: {
        id: { in: booking.seatIds },
        tripId: booking.tripId,
        status: "HELD",
      },
      data: { status: "TAKEN" },
    });
    return true;
  }, { timeout: 15000 });
}

async function refundExpiredStripePayment(booking, intent) {
  const refund = await stripeClient().refunds.create(
    {
      payment_intent: intent.id,
      reason: "requested_by_customer",
      metadata: {
        bookingId: String(booking.id),
        reason: "Seat hold expired before payment confirmation",
      },
    },
    { idempotencyKey: `booking-${booking.id}-expired-payment-refund` }
  );
  if (refund.status !== "succeeded") {
    throw new Error(`Stripe did not complete the late-payment refund for booking ${booking.id}`);
  }
  await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: "FAILED" },
    data: {
      paymentStatus: "REFUNDED",
      refundReason: "Seat hold expired before payment confirmation",
      refundProviderId: refund.id,
    },
  });
}

async function failBooking(bookingId) {
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

router.post("/stripe/initiate", requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = z.object({ bookingId: bookingIdSchema }).strict().parse(req.body);
    const booking = await getPayableBooking(bookingId, req.user);
    const stripe = stripeClient();
    const currency = (process.env.STRIPE_CURRENCY || "etb").toLowerCase();
    const intent = booking.stripeIntentId
      ? await stripe.paymentIntents.retrieve(booking.stripeIntentId)
      : await stripe.paymentIntents.create(
        {
          amount: amountInMinorUnits(booking.totalPrice),
          currency,
          metadata: { bookingId: String(booking.id) },
          description: `BusGo booking ${booking.id}`,
        },
        { idempotencyKey: `booking-${booking.id}` }
      );

    if (!booking.stripeIntentId) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentMethod: "STRIPE", stripeIntentId: intent.id },
      });
    }
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    next(err);
  }
});

router.post("/telebirr/initiate", requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = z.object({ bookingId: bookingIdSchema }).strict().parse(req.body);
    const booking = await getPayableBooking(bookingId, req.user);
    const txRef = `TB-${booking.id}-${crypto.randomUUID()}`;
    const amount = Number(booking.totalPrice).toFixed(2);
    const baseUrl = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
    const returnUrl = `${baseUrl}/confirmation/${booking.id}`;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentMethod: "TELEBIRR", localTxRef: txRef },
    });

    if (process.env.TELEBIRR_TEST_MODE === "true") {
      return res.json({ payUrl: `${returnUrl}?mock=1`, txRef });
    }

    const {
      TELEBIRR_APP_ID,
      TELEBIRR_APP_KEY,
      TELEBIRR_SHORT_CODE,
      TELEBIRR_NOTIFY_URL,
      TELEBIRR_BASE_URL,
    } = process.env;
    if (!TELEBIRR_APP_ID || !TELEBIRR_APP_KEY || !TELEBIRR_SHORT_CODE ||
      !TELEBIRR_NOTIFY_URL || !TELEBIRR_BASE_URL) {
      throw Object.assign(new Error("TeleBirr payments are not configured"), { status: 503 });
    }

    const nonce = crypto.randomBytes(8).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawStr = [
      `appId=${TELEBIRR_APP_ID}`,
      `appKey=${TELEBIRR_APP_KEY}`,
      `nonce=${nonce}`,
      `notifyUrl=${TELEBIRR_NOTIFY_URL}`,
      `outTradeNo=${txRef}`,
      `returnUrl=${returnUrl}`,
      `shortCode=${TELEBIRR_SHORT_CODE}`,
      "subject=BusGo Bus Ticket",
      "timeoutExpress=10",
      `timestamp=${timestamp}`,
      `totalAmount=${amount}`,
    ].join("&");
    const sign = crypto.createHash("sha256").update(rawStr).digest("hex").toUpperCase();
    const { data } = await axios.post(
      `${TELEBIRR_BASE_URL}/payment/v1/merchant/preOrder`,
      {
        appId: TELEBIRR_APP_ID,
        sign,
        nonce,
        timestamp,
        outTradeNo: txRef,
        subject: "BusGo Bus Ticket",
        totalAmount: amount,
        shortCode: TELEBIRR_SHORT_CODE,
        notifyUrl: TELEBIRR_NOTIFY_URL,
        returnUrl,
        timeoutExpress: "10",
      },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    if (data.code !== "0" || !data.data?.toPayUrl) {
      throw new Error(`TeleBirr error: ${data.msg || "Payment initialization failed"}`);
    }
    res.json({ payUrl: data.data.toPayUrl, txRef });
  } catch (err) {
    next(err);
  }
});

router.post("/mock-confirm/:bookingId", requireAuth, async (req, res, next) => {
  if (process.env.TELEBIRR_TEST_MODE !== "true") return res.status(404).end();
  try {
    const id = bookingIdSchema.parse(req.params.bookingId);
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (booking.paymentStatus === "PAID") {
      return res.json({ ok: true, alreadyPaid: true });
    }
    if (booking.paymentStatus !== "PENDING") {
      return res.status(409).json({ error: "Booking is not in a payable state" });
    }
    const confirmed = await confirmBookingPaid(booking.id);
    if (!confirmed) return res.status(409).json({ error: "Booking is no longer pending" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/bookings/:bookingId/status", requireAuth, async (req, res, next) => {
  try {
    const id = bookingIdSchema.parse(req.params.bookingId);
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { userId: _userId, ...result } = booking;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/webhook", async (req, res) => {
  const signature = req.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Stripe webhook verification is not configured" });
  }
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      req.rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const booking = await prisma.booking.findFirst({
        where: { stripeIntentId: intent.id },
      });
      if (booking) {
        const expectedCurrency = (process.env.STRIPE_CURRENCY || "etb").toLowerCase();
        if (intent.currency !== expectedCurrency ||
          intent.amount_received !== amountInMinorUnits(booking.totalPrice)) {
          console.error(`Stripe amount/currency mismatch for booking ${booking.id}`);
          return res.status(400).json({ error: "Payment amount or currency mismatch" });
        }
        const confirmed = await confirmBookingPaid(booking.id);
        if (!confirmed) {
          const current = await prisma.booking.findUnique({
            where: { id: booking.id },
          });
          if (current?.paymentStatus === "FAILED") {
            await refundExpiredStripePayment(current, intent);
          }
        }
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const booking = await prisma.booking.findFirst({
        where: { stripeIntentId: intent.id },
      });
      if (booking) await failBooking(booking.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook processing failed:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.post("/telebirr/notify", async (req, res) => {
  if (!verifyTelebirrWebhook(req)) {
    return res.status(401).json({ error: "Invalid payment notification" });
  }
  try {
    const { outTradeNo, tradeStatus, totalAmount } = z.object({
      outTradeNo: z.string().min(1),
      tradeStatus: z.string().min(1),
      totalAmount: z.union([z.string(), z.number()]).optional(),
    }).parse(req.body);
    const booking = await prisma.booking.findFirst({ where: { localTxRef: outTradeNo } });
    if (!booking) return res.status(404).json({ error: "Payment reference not found" });
    if (totalAmount !== undefined &&
      Number(totalAmount).toFixed(2) !== Number(booking.totalPrice).toFixed(2)) {
      return res.status(400).json({ error: "Payment amount mismatch" });
    }
    if (tradeStatus === "SUCCESS") await confirmBookingPaid(booking.id);
    else await failBooking(booking.id);
    res.json({ code: "0", msg: "success" });
  } catch (err) {
    console.error("TeleBirr notification processing failed:", err);
    res.status(err.status ?? 400).json({ error: err.message });
  }
});

router.post("/bookings/:bookingId/refund", requireAdmin, async (req, res, next) => {
  try {
    const id = bookingIdSchema.parse(req.params.bookingId);
    const { reason } = z.object({
      reason: z.string().trim().min(3).max(500),
    }).strict().parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.paymentStatus !== "PAID") {
      return res.status(409).json({ error: "Only paid bookings can be refunded" });
    }
    if (booking.paymentMethod !== "STRIPE" || !booking.stripeIntentId) {
      return res.status(409).json({ error: "Automated refunds are only supported for Stripe payments" });
    }

    const stripe = stripeClient();
    const refund = await stripe.refunds.create(
      { payment_intent: booking.stripeIntentId, reason: "requested_by_customer" },
      { idempotencyKey: `booking-${booking.id}-refund` }
    );
    if (refund.status !== "succeeded") {
      return res.status(409).json({ error: "The payment provider has not completed the refund" });
    }
    const updated = await prisma.booking.updateMany({
      where: { id, paymentStatus: "PAID" },
      data: {
        paymentStatus: "REFUNDED",
        refundReason: reason,
        refundProviderId: refund.id,
      },
    });
    if (!updated.count) {
      return res.status(409).json({ error: "Booking status changed during the refund" });
    }
    res.json({ bookingId: id, paymentStatus: "REFUNDED", refundId: refund.id });
  } catch (err) {
    next(err);
  }
});

export default router;
