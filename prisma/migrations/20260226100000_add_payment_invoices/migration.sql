-- CreateTable
CREATE TABLE `payment_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memberId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_invoices_invoiceId_key`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_invoices` ADD CONSTRAINT `payment_invoices_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
