CREATE TABLE `YoutubeWorkerLock` (
  `id` VARCHAR(64) NOT NULL,
  `ownerToken` VARCHAR(64) NULL,
  `lockedUntil` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `YoutubeWorkerLock` (`id`, `ownerToken`, `lockedUntil`, `updatedAt`)
VALUES ('youtube-channel-sync', NULL, DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND), CURRENT_TIMESTAMP(3));
