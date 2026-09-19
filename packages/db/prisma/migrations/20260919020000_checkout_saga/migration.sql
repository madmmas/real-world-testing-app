-- CreateEnum
CREATE TYPE "CheckoutSagaStatus" AS ENUM ('running', 'awaiting_payment', 'completed', 'compensating', 'compensated', 'failed');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "sagaId" TEXT;

-- CreateTable
CREATE TABLE "CheckoutSaga" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "cartId" TEXT,
    "status" "CheckoutSagaStatus" NOT NULL DEFAULT 'running',
    "currentStep" TEXT NOT NULL DEFAULT 'validate',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSagaStep" (
    "id" TEXT NOT NULL,
    "sagaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSagaStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckoutSaga_buyerId_idx" ON "CheckoutSaga"("buyerId");

-- CreateIndex
CREATE INDEX "CheckoutSaga_status_idx" ON "CheckoutSaga"("status");

-- CreateIndex
CREATE INDEX "CheckoutSagaStep_sagaId_idx" ON "CheckoutSagaStep"("sagaId");

-- CreateIndex
CREATE INDEX "Order_sagaId_idx" ON "Order"("sagaId");

-- AddForeignKey
ALTER TABLE "CheckoutSaga" ADD CONSTRAINT "CheckoutSaga_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSagaStep" ADD CONSTRAINT "CheckoutSagaStep_sagaId_fkey" FOREIGN KEY ("sagaId") REFERENCES "CheckoutSaga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sagaId_fkey" FOREIGN KEY ("sagaId") REFERENCES "CheckoutSaga"("id") ON DELETE SET NULL ON UPDATE CASCADE;
