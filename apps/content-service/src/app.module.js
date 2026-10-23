import { Module } from '@nestjs/common';
import { MetricsController } from './metrics/metrics.controller.js';
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
import { ContentEvents } from './speech/content-events.js';
import { PracticeGrpcController } from './practice/practice.grpc.controller.js';
import { PracticeRepository } from './practice/practice.repository.js';
import { PracticeService } from './practice/practice.service.js';
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
  controllers: [MetricsController, HealthController, ContentGrpcController, ListeningGrpcController, CourseGrpcController, VersionGrpcController, PracticeGrpcController],
  providers: [
    { provide: MEDIA_STORAGE, useFactory: () => createMediaStorage() },
    { provide: SpeechBroker, useFactory: () => new SpeechBroker(process.env.RABBITMQ_URL || 'amqp://localhost:5672') },
    {
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
      useFactory: (dataSource, contentService, broker) => {
        const repository = new ListeningRepository(dataSource);
        const relay = new ContentEvents(repository, broker);
        const service = new ListeningService(repository, contentService, { broker, relay });
        broker.start((answer, meta) => service.onAutoTimeResult(answer, meta));
        broker.onConnected = () => relay.flush();
        relay.start();
        return service;
      },
      inject: [CONTENT_DATA_SOURCE, ContentService, SpeechBroker],
    },
    {
      provide: PracticeService,
      useFactory: (dataSource, contentService) => new PracticeService(new PracticeRepository(dataSource), contentService),
      inject: [CONTENT_DATA_SOURCE, ContentService],
    },
    {
      provide: CourseService,
      useFactory: (dataSource, contentService, listeningService) =>
        new CourseService(new CourseRepository(dataSource), contentService, listeningService),
      inject: [CONTENT_DATA_SOURCE, ContentService, ListeningService],
    },
    {
      provide: ContentVersionService,
      useFactory: (repository, contentService, listeningService, courseService) =>
        new ContentVersionService(repository, contentService, listeningService, courseService),
      inject: [CONTENT_REPOSITORY, ContentService, ListeningService, CourseService],
    },
  ],
  exports: [MEDIA_STORAGE],
})(AppModule);
