-- AlterTable
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `campaign_messages` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `from_role` ENUM('brand', 'influencer', 'admin') NOT NULL,
    `author_user_id` VARCHAR(191) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_messages_campaign_id_created_at_idx`(`campaign_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utm_clicks` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `ip_hash` VARCHAR(191) NOT NULL,
    `user_agent` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `utm_clicks_campaign_id_ip_hash_created_at_idx`(`campaign_id`, `ip_hash`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utm_clicks` ADD CONSTRAINT `utm_clicks_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
