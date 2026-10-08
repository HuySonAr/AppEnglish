import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { createMediaStorage } from './media/media-storage.factory.js';
import { MEDIA_STORAGE } from './media/media-storage.js';
export class AppModule {}
Module({
  controllers: [HealthController],
  providers: [{ provide: MEDIA_STORAGE, useFactory: () => createMediaStorage() }],
  exports: [MEDIA_STORAGE]
})(AppModule);
