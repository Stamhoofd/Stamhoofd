ALTER TABLE `registrations` ADD FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
