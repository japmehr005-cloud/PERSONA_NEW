/*
  Warnings:

  - You are about to drop the column `autoSessionTimeout` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `transactionAlerts` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorEnabled` on the `UserProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "autoSessionTimeout",
DROP COLUMN "transactionAlerts",
DROP COLUMN "twoFactorEnabled",
ADD COLUMN     "alertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardFreeze" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "largeTransactionConfirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newDeviceAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionTimeout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFaEnabled" BOOLEAN NOT NULL DEFAULT false;
