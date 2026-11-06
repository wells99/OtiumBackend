CREATE TABLE `YoutubeChannel` (
  `id` VARCHAR(24) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `url` TEXT NOT NULL,
  `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastCheckedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserYoutubeChannel` (
  `userId` VARCHAR(191) NOT NULL,
  `channelId` VARCHAR(24) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `channelId`),
  INDEX `UserYoutubeChannel_channelId_status_idx` (`channelId`, `status`),
  CONSTRAINT `UserYoutubeChannel_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserYoutubeChannel_channelId_fkey`
    FOREIGN KEY (`channelId`) REFERENCES `YoutubeChannel` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `YoutubeVideo` (
  `id` VARCHAR(20) NOT NULL,
  `channelId` VARCHAR(24) NOT NULL,
  `title` TEXT NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'discovered',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  `queuedAt` DATETIME(3) NULL,
  `downloadedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `YoutubeVideo_channelId_publishedAt_idx` (`channelId`, `publishedAt`),
  INDEX `YoutubeVideo_status_createdAt_idx` (`status`, `createdAt`),
  CONSTRAINT `YoutubeVideo_channelId_fkey`
    FOREIGN KEY (`channelId`) REFERENCES `YoutubeChannel` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
