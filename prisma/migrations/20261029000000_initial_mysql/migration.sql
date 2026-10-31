CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `jellyfinUserId` VARCHAR(191) NULL,
  `username` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'trial_ativo',
  `trialEndsAt` DATETIME(3) NOT NULL,
  `subscriptionEndsAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_jellyfinUserId_key` (`jellyfinUserId`),
  UNIQUE INDEX `User_username_key` (`username`),
  UNIQUE INDEX `User_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'BRL',
  `provider` VARCHAR(191) NOT NULL,
  `externalPaymentId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `rawWebhook` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Payment_externalPaymentId_key` (`externalPaymentId`),
  CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
