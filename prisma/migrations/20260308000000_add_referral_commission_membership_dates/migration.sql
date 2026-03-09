-- AlterTable
ALTER TABLE `members` ADD COLUMN `membershipStartDate` DATETIME(3) NULL,
    ADD COLUMN `membershipEndDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `payment_invoices` ADD COLUMN `plan` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `referral_commissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `referrerId` INTEGER NOT NULL,
    `referredMemberId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0.5,
    `membershipPaymentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `referral_commissions` ADD CONSTRAINT `referral_commissions_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
