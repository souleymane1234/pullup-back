-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `purpose` ENUM('campaign', 'plan', 'boost') NOT NULL,
    `target_id` VARCHAR(191) NOT NULL,
    `payer_user_id` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `from_balance_fcfa` INTEGER NOT NULL DEFAULT 0,
    `provider` VARCHAR(191) NOT NULL,
    `provider_ref` VARCHAR(191) NULL,
    `status` ENUM('pending', 'succeeded', 'failed', 'expired') NOT NULL DEFAULT 'pending',
    `raw_payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_provider_ref_key`(`provider_ref`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    INDEX `payments_payer_user_id_idx`(`payer_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payouts` (
    `id` VARCHAR(191) NOT NULL,
    `purpose` ENUM('withdrawal') NOT NULL DEFAULT 'withdrawal',
    `target_id` VARCHAR(191) NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `provider_ref` VARCHAR(191) NULL,
    `status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    `raw_payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payouts_provider_ref_key`(`provider_ref`),
    INDEX `payouts_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `tx_id` VARCHAR(191) NOT NULL,
    `account_type` ENUM('brand_balance', 'escrow', 'influencer_wallet', 'platform_revenue', 'external_psp') NOT NULL,
    `account_id` VARCHAR(191) NULL,
    `campaign_id` VARCHAR(191) NULL,
    `direction` ENUM('debit', 'credit') NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ledger_entries_tx_id_idx`(`tx_id`),
    INDEX `ledger_entries_account_type_account_id_idx`(`account_type`, `account_id`),
    INDEX `ledger_entries_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `influencer_id` VARCHAR(191) NOT NULL,
    `available_fcfa` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`influencer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `escrow_holds` (
    `campaign_id` VARCHAR(191) NOT NULL,
    `brand_id` VARCHAR(191) NOT NULL,
    `influencer_id` VARCHAR(191) NOT NULL,
    `amount_fcfa` INTEGER NOT NULL,
    `fee_fcfa` INTEGER NOT NULL,
    `payout_fcfa` INTEGER NOT NULL,
    `state` ENUM('open', 'released', 'refunded') NOT NULL DEFAULT 'open',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `escrow_holds_influencer_id_state_idx`(`influencer_id`, `state`),
    PRIMARY KEY (`campaign_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `webhook_events_event_id_key`(`event_id`),
    INDEX `webhook_events_processed_at_idx`(`processed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_payer_user_id_fkey` FOREIGN KEY (`payer_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_influencer_id_fkey` FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Ledger immuable
CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON `ledger_entries`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Les écritures du grand livre sont immuables.';

CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON `ledger_entries`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Les écritures du grand livre sont immuables.';
