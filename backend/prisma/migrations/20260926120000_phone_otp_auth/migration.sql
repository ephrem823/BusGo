-- Fill null phones with a placeholder before making required
UPDATE "users" SET "phone" = 'unknown-' || id::text WHERE "phone" IS NULL;

-- Make phone required and unique
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");

-- Make email and password optional
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Add OTP fields
ALTER TABLE "users" ADD COLUMN "otp_code" TEXT;
ALTER TABLE "users" ADD COLUMN "otp_expiry" TIMESTAMP(3);
