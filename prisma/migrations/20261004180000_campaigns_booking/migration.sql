-- CreateTable
CREATE TABLE `campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `brand_id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `offer_rate_id` VARCHAR(191) NOT NULL,
    `offer_net` VARCHAR(191) NOT NULL,
    `offer_format` VARCHAR(191) NOT NULL,
    `offer_price` INTEGER NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `fee_fcfa` INTEGER NOT NULL,
    `payout_fcfa` INTEGER NOT NULL,
    `from_balance_fcfa` INTEGER NOT NULL DEFAULT 0,
    `pay_method` VARCHAR(191) NOT NULL,
    `status` ENUM('awaiting_payment', 'paid', 'accepted', 'published', 'completed', 'dispute', 'declined', 'cancelled', 'refunded') NOT NULL DEFAULT 'awaiting_payment',
    `cancel_reason` VARCHAR(191) NULL,
    `brief_title` VARCHAR(191) NOT NULL,
    `brief_objective` VARCHAR(191) NOT NULL,
    `brief_theme` VARCHAR(191) NOT NULL,
    `brief_text` TEXT NOT NULL,
    `brief_link` VARCHAR(191) NOT NULL,
    `brief_date` DATETIME(3) NULL,
    `brief_file_url` TEXT NULL,
    `utm_url` TEXT NOT NULL,
    `proof_url` TEXT NULL,
    `proof_note` TEXT NULL,
    `proof_at` DATETIME(3) NULL,
    `perf_views` INTEGER NULL,
    `perf_likes` INTEGER NULL,
    `perf_comments` INTEGER NULL,
    `perf_shares` INTEGER NULL,
    `perf_clicks` INTEGER NULL,
    `dispute_reason` TEXT NULL,
    `accepted_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `campaigns_ref_key`(`ref`),
    INDEX `campaigns_brand_id_created_at_idx`(`brand_id`, `created_at` DESC),
    INDEX `campaigns_influencer_id_status_idx`(`influencer_id`, `status`),
    INDEX `campaigns_status_published_at_idx`(`status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_events` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `note` TEXT NOT NULL,
    `actor_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_events_campaign_id_created_at_idx`(`campaign_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploads` (
    `id` VARCHAR(191) NOT NULL,
    `owner_user_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `purpose` ENUM('brief') NOT NULL,
    `file_url` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploads_owner_user_id_purpose_idx`(`owner_user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_events` ADD CONSTRAINT `campaign_events_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_events` ADD CONSTRAINT `campaign_events_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
