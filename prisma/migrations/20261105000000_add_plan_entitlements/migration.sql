CREATE TABLE `Plan` (
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `maxYoutubeChannels` INTEGER NOT NULL DEFAULT 2,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Plan` (`code`, `name`, `maxYoutubeChannels`, `active`, `updatedAt`)
VALUES ('standard', 'OtiumFlix', 2, true, CURRENT_TIMESTAMP(3));

ALTER TABLE `User`
  ADD COLUMN `planCode` VARCHAR(64) NOT NULL DEFAULT 'standard';

ALTER TABLE `Payment`
  ADD COLUMN `planCode` VARCHAR(64) NULL;

ALTER TABLE `User`
  ADD CONSTRAINT `User_planCode_fkey`
  FOREIGN KEY (`planCode`) REFERENCES `Plan` (`code`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_planCode_fkey`
  FOREIGN KEY (`planCode`) REFERENCES `Plan` (`code`)
  ON DELETE SET NULL ON UPDATE CASCADE;
