-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('brand', 'influencer', 'admin') NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,

    INDEX `password_resets_token_hash_idx`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contact_name` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NOT NULL DEFAULT '',
    `plan` ENUM('free', 'pro', 'business') NOT NULL DEFAULT 'free',
    `plan_renews_at` DATETIME(3) NULL,
    `balance_fcfa` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `brands_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `influencers` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `handle` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `city` VARCHAR(191) NOT NULL,
    `bio` TEXT NOT NULL,
    `bio_draft` TEXT NULL,
    `hue` INTEGER NOT NULL,
    `photo_url` TEXT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `certified` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('pending', 'active', 'rejected') NOT NULL DEFAULT 'pending',
    `accepts_pub` BOOLEAN NOT NULL DEFAULT true,
    `accepts_partenariat` BOOLEAN NOT NULL DEFAULT true,
    `accepts_dedicace` BOOLEAN NOT NULL DEFAULT false,
    `score_auth` INTEGER NOT NULL DEFAULT 90,
    `score_creat` DOUBLE NOT NULL DEFAULT 4,
    `score_brief` INTEGER NOT NULL DEFAULT 90,
    `score_on_time` INTEGER NOT NULL DEFAULT 90,
    `score_rating` DOUBLE NOT NULL DEFAULT 5,
    `score_reviews` INTEGER NOT NULL DEFAULT 0,
    `score_done` INTEGER NOT NULL DEFAULT 0,
    `nets` JSON NOT NULL,
    `cats` JSON NOT NULL,
    `audience` JSON NOT NULL,
    `days` JSON NOT NULL,
    `rates` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `influencers_user_id_key`(`user_id`),
    UNIQUE INDEX `influencers_handle_key`(`handle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `brands` ADD CONSTRAINT `brands_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `influencers` ADD CONSTRAINT `influencers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
