import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { ContentGrpcController } from './content/content.grpc.controller.js';
import { ContentRepository } from './content/content.repository.js';
import { ContentService } from './content/content.service.js';
import { createContentDataSource } from './database/database.config.js';
import { CourseGrpcController } from './course/course.grpc.controller.js';
import { CourseRepository } from './course/course.repository.js';
import { CourseService } from './course/course.service.js';
import { ListeningGrpcController } from './listening/listening.grpc.controller.js';
import { ListeningRepository } from './listening/listening.repository.js';
import { ListeningService } from './listening/listening.service.js';
import { SpeechBroker } from './speech/speech.broker.js';
import { VersionGrpcController } from './versions/version.grpc.controller.js';
import { ContentVersionService } from './versions/version.service.js';
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
import { SpeechPronunciationSource } from './pronunciation/speech-pronunciation.source.js';

export class AppModule {}
Module({
  controllers: [HealthController, ContentGrpcController, ListeningGrpcController, CourseGrpcController, VersionGrpcController],
  providers: [
    { provide: MEDIA_STORAGE, useFactory: () => createMediaStorage() },
    // One RabbitMQ link to speech-service: auto-time answers (D97) and
    // pronunciation requests (D123).
    { provide: SpeechBroker, useFactory: () => new SpeechBroker(process.env.RABBITMQ_URL || 'amqp://localhost:5672') },
    {
      // Pronunciation from speech-service (D123); the dictionary of D47 stays
      // available with PRONUNCIATION_SOURCE=dictionary.
      provide: PRONUNCIATION_SOURCE,
      useFactory: (broker) =>
        process.env.PRONUNCIATION_SOURCE === 'dictionary'
          ? createPronunciationSource()
          : new SpeechPronunciationSource(broker, { ipaAccent: process.env.PRONUNCIATION_IPA_ACCENT === 'us' ? 'us' : 'uk' }),
      inject: [SpeechBroker],
    },
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
    {
      provide: ListeningService,
      // Auto-time answers from speech-service arrive over RabbitMQ (D97).
      useFactory: (dataSource, contentService, broker) => {
        const service = new ListeningService(new ListeningRepository(dataSource), contentService, { broker });
        broker.start((answer) => service.onAutoTimeResult(answer));
        return service;
      },
      inject: [CONTENT_DATA_SOURCE, ContentService, SpeechBroker],
    },
    {
      provide: CourseService,
      useFactory: (dataSource, contentService, listeningService) =>
        new CourseService(new CourseRepository(dataSource), contentService, listeningService),
      inject: [CONTENT_DATA_SOURCE, ContentService, ListeningService],
    },
    {
      // Version history of every versioned content (D122).
      provide: ContentVersionService,
      useFactory: (repository, contentService, listeningService, courseService) =>
        new ContentVersionService(repository, contentService, listeningService, courseService),
      inject: [CONTENT_REPOSITORY, ContentService, ListeningService, CourseService],
    },
  ],
  exports: [MEDIA_STORAGE],
})(AppModule);
