-- AddForeignKey
ALTER TABLE `referral_commissions` ADD CONSTRAINT `referral_commissions_referredMemberId_fkey` FOREIGN KEY (`referredMemberId`) REFERENCES `members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
