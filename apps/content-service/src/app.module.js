import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { ContentGrpcController } from './content/content.grpc.controller.js';
import { ContentRepository } from './content/content.repository.js';
import { ContentService } from './content/content.service.js';
import { createContentDataSource } from './database/database.config.js';
import {
  CONTENT_DATA_SOURCE,
  CONTENT_REPOSITORY,
} from './database/database.tokens.js';
import { createMediaStorage } from './media/media-storage.factory.js';
import { MEDIA_STORAGE } from './media/media-storage.js';
import {
  PRONUNCIATION_SOURCE,
  createPronunciationSource,
} from './pronunciation/dictionary-pronunciation.source.js';

export class AppModule {}
Module({
  controllers: [HealthController, ContentGrpcController],
  providers: [
    { provide: MEDIA_STORAGE, useFactory: () => createMediaStorage() },
    { provide: PRONUNCIATION_SOURCE, useFactory: () => createPronunciationSource() },
    { provide: CONTENT_DATA_SOURCE, useFactory: createContentDataSource },
    {
      provide: CONTENT_REPOSITORY,
      useFactory: (dataSource) => new ContentRepository(dataSource),
      inject: [CONTENT_DATA_SOURCE],
    },
    {
      provide: ContentService,
      useFactory: (repository, mediaStorage, pronunciationSource) =>
        new ContentService(repository, mediaStorage, pronunciationSource),
      inject: [CONTENT_REPOSITORY, MEDIA_STORAGE, PRONUNCIATION_SOURCE],
    },
  ],
  exports: [MEDIA_STORAGE],
})(AppModule);
