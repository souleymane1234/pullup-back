-- AlterTable
ALTER TABLE `influencers` ADD COLUMN `kyc_status` ENUM('none', 'pending', 'verified') NOT NULL DEFAULT 'none',
    ADD COLUMN `featured_until` DATETIME(3) NULL,
    ADD COLUMN `analytics_until` DATETIME(3) NULL,
    ADD COLUMN `trusted_phones` JSON NULL;
UPDATE `influencers` SET `trusted_phones` = JSON_ARRAY() WHERE `trusted_phones` IS NULL;
ALTER TABLE `influencers` MODIFY `trusted_phones` JSON NOT NULL;

-- CreateTable
CREATE TABLE `withdrawals` (
    `id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `operator` ENUM('om', 'mtn', 'moov', 'wave') NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `payout_id` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `withdrawals_payout_id_key`(`payout_id`),
    INDEX `withdrawals_influencer_id_created_at_idx`(`influencer_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `brand_id` VARCHAR(191) NOT NULL,
    `plan` ENUM('pro', 'business') NOT NULL,
    `status` ENUM('pending', 'active', 'past_due', 'cancelled') NOT NULL DEFAULT 'pending',
    `current_period_start` DATETIME(3) NOT NULL,
    `current_period_end` DATETIME(3) NOT NULL,
    `payment_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscriptions_brand_id_status_idx`(`brand_id`, `status`),
    INDEX `subscriptions_current_period_end_idx`(`current_period_end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boost_purchases` (
    `id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `boost_key` ENUM('pro', 'certified', 'analytics') NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `payment_id` VARCHAR(191) NULL,
    `status` ENUM('pending', 'active', 'expired') NOT NULL DEFAULT 'pending',
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `boost_purchases_influencer_id_status_idx`(`influencer_id`, `status`),
    INDEX `boost_purchases_ends_at_idx`(`ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_payout_id_fkey` FOREIGN KEY (`payout_id`) REFERENCES `payouts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boost_purchases` ADD CONSTRAINT `boost_purchases_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
