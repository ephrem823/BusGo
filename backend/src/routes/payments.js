import { Router } from "express";
import Stripe from "stripe";
import axios from "axios";
import crypto from "crypto";
import https from "https";
const telebirrAgent = new https.Agent({ rejectUnauthorized: false });
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────

async function confirmBookingPaid(bookingId) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: "PAID" },
    });
    await tx.seat.updateMany({
      where: { id: { in: booking.seatIds } },
      data: { status: "TAKEN" },
    });
  }, { timeout: 15000 });
}

async function failBooking(bookingId) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "FAILED" },
  });
  await prisma.seat.updateMany({
    where: { id: { in: booking.seatIds } },
    data: { status: "AVAILABLE" },
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

// Mock confirm — only available in test mode
router.post("/mock-confirm/:bookingId", requireAuth, async (req, res, next) => {
  if (process.env.CHAPA_TEST_MODE !== "true") return res.status(404).end();
  try {
    await confirmBookingPaid(Number(req.params.bookingId));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Stripe ────────────────────────────────────────────────────────────────────

router.post("/create-intent", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.body.bookingId, req.user.id);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(booking.totalPrice) * 100),
      currency: "etb",
      metadata: { bookingId: booking.id.toString() },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeIntentId: intent.id, paymentMethod: "STRIPE" },
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    next(err);
  }
});

router.post("/webhook", async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).send("Webhook signature verification failed");
  }

  const bookingId = Number(event.data.object.metadata.bookingId);
  if (event.type === "payment_intent.succeeded") await confirmBookingPaid(bookingId);
  if (event.type === "payment_intent.payment_failed") await failBooking(bookingId);

  res.json({ received: true });
});

// ── TeleBirr ──────────────────────────────────────────────────────────────────
// Docs: https://developer.ethiotelecom.et/docs/GetStarted
// Uses the "ussd push" / checkout API (appId + appKey + shortCode).

router.post("/telebirr/initiate", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.body.bookingId, req.user.id);
    const txRef = `TB-${booking.id}-${Date.now()}`;
    const amount = Number(booking.totalPrice).toFixed(2);
    const nonce = crypto.randomBytes(8).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build the raw string TeleBirr expects for signing
    const rawStr = [
      `appId=${process.env.TELEBIRR_APP_ID}`,
      `appKey=${process.env.TELEBIRR_APP_KEY}`,
      `nonce=${nonce}`,
      `notifyUrl=${process.env.TELEBIRR_NOTIFY_URL}`,
      `outTradeNo=${txRef}`,
      `returnUrl=${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
      `shortCode=${process.env.TELEBIRR_SHORT_CODE}`,
      `subject=BusGo Ticket`,
      `timeoutExpress=10`,
      `timestamp=${timestamp}`,
      `totalAmount=${amount}`,
    ].join("&");

    const sign = crypto.createHash("sha256").update(rawStr).digest("hex").toUpperCase();

    const payload = {
      appId: process.env.TELEBIRR_APP_ID,
      sign,
      nonce,
      timestamp,
      outTradeNo: txRef,
      subject: "BusGo Ticket",
      totalAmount: amount,
      shortCode: process.env.TELEBIRR_SHORT_CODE,
      notifyUrl: process.env.TELEBIRR_NOTIFY_URL,
      returnUrl: `${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
      timeoutExpress: "10",
    };

    const { data } = await axios.post(
      `${process.env.TELEBIRR_BASE_URL}/payment/v1/merchant/preOrder`,
      payload,
      { headers: { "Content-Type": "application/json" }, httpsAgent: telebirrAgent }
    );

    if (data.code !== "0") throw new Error(`TeleBirr error: ${data.msg}`);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentMethod: "TELEBIRR", localTxRef: txRef },
    });

    // data.data.toPayUrl — redirect user here to complete payment in TeleBirr
    res.json({ payUrl: data.data.toPayUrl, txRef });
  } catch (err) {
    next(err);
  }
});

// TeleBirr calls this after payment (server-to-server notify)
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

// ── CBE Birr ──────────────────────────────────────────────────────────────────
// CBE Birr merchant API (REST, Bearer token auth).
// Adjust endpoint paths to match the version of the API you are onboarded to.

router.post("/cbe/initiate", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.body.bookingId, req.user.id);
    const txRef = `CBE-${booking.id}-${Date.now()}`;
    const amount = Number(booking.totalPrice).toFixed(2);

    const { data } = await axios.post(
      `${process.env.CBE_BASE_URL}/api/v1/payment/initialize`,
      {
        merchantId: process.env.CBE_MERCHANT_ID,
        amount,
        currency: "ETB",
        transactionRef: txRef,
        callbackUrl: process.env.CBE_NOTIFY_URL,
        returnUrl: `${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
        description: "BusGo Ticket",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.CBE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!data.success) throw new Error(`CBE error: ${data.message}`);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentMethod: "CBE", localTxRef: txRef },
    });

    // data.paymentUrl — redirect user here
    res.json({ payUrl: data.paymentUrl, txRef });
  } catch (err) {
    next(err);
  }
});

// CBE calls this after payment
router.post("/cbe/notify", async (req, res) => {
  try {
    const { transactionRef, status } = req.body;
    const booking = await prisma.booking.findFirst({ where: { localTxRef: transactionRef } });
    if (!booking) return res.status(404).end();

    if (status === "SUCCESS") await confirmBookingPaid(booking.id);
    else await failBooking(booking.id);

    res.json({ success: true });
  } catch {
    res.status(500).end();
  }
});

// ── Chappa ───────────────────────────────────────────────────────────────────
// Docs: https://developer.chapa.co/docs
// Single endpoint covers TeleBirr, CBE Birr, Amole, cards, etc.

router.post("/chapa/initiate", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBooking(req.body.bookingId, req.user.id);
    const txRef = `CHAPA-${booking.id}-${Date.now()}`;

    // TEST MODE: skip real Chapa API call
    if (process.env.CHAPA_TEST_MODE === "true") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentMethod: "CHAPA", localTxRef: txRef },
      });
      return res.json({ payUrl: `${process.env.APP_BASE_URL}/confirmation/${booking.id}?mock=1`, txRef });
    }

    // Fetch user details for Chapa's required fields
    const user = await prisma.user.findUnique({ where: { id: booking.userId } });

    const { data: chapaRes } = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        first_name:   user.name.split(" ")[0],
        last_name:    user.name.split(" ").slice(1).join(" ") || "-",
        email:        user.email ?? `user${user.id}@busgo.et`,
        phone_number: user.phone?.replace(/^\+251/, "0") ?? "0900000000",
        amount:       Number(booking.totalPrice).toFixed(2),
        currency:     "ETB",
        tx_ref:       txRef,
        callback_url: process.env.CHAPA_NOTIFY_URL,
        return_url:   `${process.env.APP_BASE_URL}/confirmation/${booking.id}`,
        customization: { title: "BusGo Ticket", description: `Booking #${booking.id}` },
      },
      { headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` } }
    );

    if (chapaRes.status !== "success") throw new Error(`Chapa error: ${chapaRes.message}`);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentMethod: "CHAPA", localTxRef: txRef },
    });

    res.json({ payUrl: chapaRes.data.checkout_url, txRef });
  } catch (err) {
    next(err);
  }
});

// Chapa calls this after payment (webhook)
router.post("/chapa/webhook", async (req, res) => {
  try {
    // Verify Chapa webhook signature
    const hash = crypto
      .createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-chapa-signature"]) {
      return res.status(401).end();
    }

    const { tx_ref, status } = req.body;
    const booking = await prisma.booking.findFirst({ where: { localTxRef: tx_ref } });
    if (!booking) return res.status(404).end();

    if (status === "success") await confirmBookingPaid(booking.id);
    else await failBooking(booking.id);

    res.json({ received: true });
  } catch {
    res.status(500).end();
  }
});

export default router;
