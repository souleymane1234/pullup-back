-- CreateTable
CREATE TABLE `feature_flags` (
    `key` VARCHAR(191) NOT NULL,
    `value` BOOLEAN NOT NULL,
    `updated_by` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_preferences` (
    `user_id` VARCHAR(191) NOT NULL,
    `onboarded` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `recipient_key` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `link` VARCHAR(191) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_recipient_key_created_at_idx`(`recipient_key`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feature_flags` ADD CONSTRAINT `feature_flags_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
