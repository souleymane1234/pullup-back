-- CreateTable
CREATE TABLE `catalog_items` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('category', 'city', 'objective', 'contact_type') NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `meta` JSON NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `catalog_items_kind_key_key`(`kind`, `key`),
    INDEX `catalog_items_kind_active_sort_order_idx`(`kind`, `active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
