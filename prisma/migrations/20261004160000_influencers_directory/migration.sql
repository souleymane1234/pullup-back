-- AlterTable
ALTER TABLE `influencers`
  MODIFY `status` ENUM('pending', 'active', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
  ADD COLUMN `qr_scans` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `contacts_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `total_followers` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `avg_engagement` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `min_price` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `badge_key` VARCHAR(191) NOT NULL DEFAULT 'normal',
  ADD COLUMN `pullup_score` DOUBLE NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `influencers_status_verified_idx` ON `influencers`(`status`, `verified`);

-- CreateIndex
CREATE INDEX `influencers_pullup_score_idx` ON `influencers`(`pullup_score`);

-- CreateTable
CREATE TABLE `favorites` (
    `brand_id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorites_influencer_id_idx`(`influencer_id`),
    PRIMARY KEY (`brand_id`, `influencer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_views_daily` (
    `influencer_id` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`influencer_id`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_requests` (
    `id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `from_name` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `sender_user_id` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contact_requests_influencer_id_created_at_idx`(`influencer_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `brand_name` VARCHAR(191) NOT NULL,
    `stars` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reviews_campaign_id_key`(`campaign_id`),
    INDEX `reviews_influencer_id_created_at_idx`(`influencer_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views_daily` ADD CONSTRAINT `profile_views_daily_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_requests` ADD CONSTRAINT `contact_requests_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_requests` ADD CONSTRAINT `contact_requests_sender_user_id_fkey` FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
