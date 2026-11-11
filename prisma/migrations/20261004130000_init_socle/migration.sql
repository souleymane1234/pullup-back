-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_actor_user_id_idx`(`actor_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_sequences` (
    `name` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
