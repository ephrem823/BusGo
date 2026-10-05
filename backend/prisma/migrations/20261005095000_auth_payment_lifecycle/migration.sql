ALTER TABLE "users"
ADD COLUMN "otp_sent_at" TIMESTAMP(3),
ADD COLUMN "otp_attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "bookings"
ADD COLUMN "refund_reason" TEXT,
ADD COLUMN "refund_provider_id" TEXT;
