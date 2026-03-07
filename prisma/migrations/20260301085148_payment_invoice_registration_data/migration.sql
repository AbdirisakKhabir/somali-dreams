-- AlterTable: Add registration columns, make memberId optional
-- For existing rows: populate from member if linked, else use placeholders
ALTER TABLE `payment_invoices` ADD COLUMN `registrationName` VARCHAR(191) NULL,
    ADD COLUMN `registrationPhone` VARCHAR(191) NULL,
    ADD COLUMN `registrationReferralCode` VARCHAR(191) NULL,
    ADD COLUMN `registrationWhatsapp` VARCHAR(191) NULL,
    MODIFY `memberId` INTEGER NULL;

-- Populate registration data from linked member for existing rows
UPDATE `payment_invoices` pi
LEFT JOIN `members` m ON pi.memberId = m.id
SET
  pi.registrationName = COALESCE(m.name, 'Unknown'),
  pi.registrationPhone = COALESCE(m.phone, '');

-- Make columns NOT NULL
ALTER TABLE `payment_invoices` MODIFY `registrationName` VARCHAR(191) NOT NULL,
    MODIFY `registrationPhone` VARCHAR(191) NOT NULL;
