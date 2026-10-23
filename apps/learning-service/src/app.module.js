import { Module } from '@nestjs/common';
import { MetricsController } from './metrics/metrics.controller.js';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { createLearningDataSource } from './database/database.config.js';
import {
  CONTENT_CLIENT,
  CONTENT_GRPC_CLIENT,
  COURSE_REPOSITORY,
  EVENT_REPOSITORY,
  LEARNING_DATA_SOURCE,
  LESSON_REPOSITORY,
  LISTENING_REPOSITORY,
  MOCK_REPOSITORY,
  PLACEMENT_REPOSITORY,
  SPEAKING_REPOSITORY,
  AI_KEY_REPOSITORY,
  REVIEW_REPOSITORY,
} from './database/database.tokens.js';
import { CourseGrpcController } from './course/course.grpc.controller.js';
import { CourseRepository } from './course/course.repository.js';
import { CourseLessonService } from './course/course.service.js';
import { EventRepository } from './events/events.repository.js';
import { LearningEvents } from './events/learning-events.js';
import { LessonGrpcController } from './lesson/lesson.grpc.controller.js';
import { LessonRepository } from './lesson/lesson.repository.js';
import { LessonService } from './lesson/lesson.service.js';
import { ListeningGrpcController } from './listening/listening.grpc.controller.js';
import { ListeningRepository } from './listening/listening.repository.js';
import { ListeningPracticeService } from './listening/listening.service.js';
import { MockGrpcController } from './mock/mock.grpc.controller.js';
import { MockRepository } from './mock/mock.repository.js';
import { MockService } from './mock/mock.service.js';
import { ContentClient } from './placement/content.client.js';
import { PlacementGrpcController } from './placement/placement.grpc.controller.js';
import { PlacementRepository } from './placement/placement.repository.js';
import { PlacementService } from './placement/placement.service.js';
import { SpeakingGrpcController } from './speaking/speaking.grpc.controller.js';
import { SpeakingRepository } from './speaking/speaking.repository.js';
import { PracticeResults } from './speaking/practice-results.js';
import { LearningQueue } from '@appenglish/learning-contracts';
import { AiKeyChecker } from './writing/ai-key.checker.js';
import { AiKeyRepository } from './writing/ai-key.repository.js';
import { WritingGrpcController } from './writing/writing.grpc.controller.js';
import { WritingService } from './writing/writing.service.js';
import { ReviewGrpcController } from './review/review.grpc.controller.js';
import { ReviewRepository } from './review/review.repository.js';
import { ReviewService } from './review/review.service.js';
import { CefrGrpcController } from './cefr/cefr.grpc.controller.js';
import { CefrService } from './cefr/cefr.service.js';

const EXPIRE_EVERY_MS = 5 * 60 * 1000;
import { SpeakingService } from './speaking/speaking.service.js';
import { USAGE_REPOSITORY, UsageGrpcController, UsageRepository } from './usage/usage.grpc.controller.js';

const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
    ]),
  ],
  controllers: [MetricsController, HealthController, PlacementGrpcController, LessonGrpcController, MockGrpcController, ListeningGrpcController, CourseGrpcController, UsageGrpcController, SpeakingGrpcController, WritingGrpcController, ReviewGrpcController, CefrGrpcController],
  providers: [
    { provide: LEARNING_DATA_SOURCE, useFactory: createLearningDataSource },
    {
      provide: PLACEMENT_REPOSITORY,
      useFactory: (dataSource) => new PlacementRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: LESSON_REPOSITORY,
      useFactory: (dataSource) => new LessonRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: MOCK_REPOSITORY,
      useFactory: (dataSource) => new MockRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: USAGE_REPOSITORY,
      useFactory: (dataSource) => new UsageRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: CONTENT_CLIENT,
      useFactory: (grpcClient) => new ContentClient(grpcClient),
      inject: [CONTENT_GRPC_CLIENT],
    },
    {
      provide: EVENT_REPOSITORY,
      useFactory: (dataSource) => new EventRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: LearningEvents,
      useFactory: (repository) => {
        const events = new LearningEvents(repository, { url: process.env.RABBITMQ_URL || 'amqp://localhost:5672' });
        events.start();
        return events;
      },
      inject: [EVENT_REPOSITORY],
    },
    {
      provide: PlacementService,
      useFactory: (repository, contentClient) => new PlacementService(repository, contentClient),
      inject: [PLACEMENT_REPOSITORY, CONTENT_CLIENT],
    },
    {
      provide: LessonService,
      useFactory: (repository, placementRepository, contentClient, events) =>
        new LessonService(repository, placementRepository, contentClient, { events }),
      inject: [LESSON_REPOSITORY, PLACEMENT_REPOSITORY, CONTENT_CLIENT, LearningEvents],
    },
    {
      provide: LISTENING_REPOSITORY,
      useFactory: (dataSource) => new ListeningRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: ListeningPracticeService,
      useFactory: (repository, contentClient, events) => new ListeningPracticeService(repository, contentClient, { events }),
      inject: [LISTENING_REPOSITORY, CONTENT_CLIENT, LearningEvents],
    },
    {
      provide: COURSE_REPOSITORY,
      useFactory: (dataSource) => new CourseRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: CourseLessonService,
      useFactory: (repository, contentClient, events) => new CourseLessonService(repository, contentClient, { events }),
      inject: [COURSE_REPOSITORY, CONTENT_CLIENT, LearningEvents],
    },
    {
      provide: CefrService,
      useFactory: (mockRepository, submissions) => new CefrService(mockRepository, submissions),
      inject: [MOCK_REPOSITORY, SPEAKING_REPOSITORY],
    },
    {
      provide: REVIEW_REPOSITORY,
      useFactory: (dataSource) => new ReviewRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: ReviewService,
      useFactory: (repository, events) => {
        const service = new ReviewService(repository, { events });
        const expire = () => service.expireDue().catch(() => {});
        setTimeout(expire, 30_000).unref?.();
        setInterval(expire, EXPIRE_EVERY_MS).unref?.();
        return service;
      },
      inject: [REVIEW_REPOSITORY, LearningEvents],
    },
    {
      provide: SPEAKING_REPOSITORY,
      useFactory: (dataSource) => new SpeakingRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: SpeakingService,
      useFactory: (repository, contentClient, events, keys, reviews) => {
        const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        const service = new SpeakingService(repository, contentClient, { events, keys, reviews });
        new PracticeResults(url, (answer) => service.applyResult(answer)).start();
        new PracticeResults(url, (answer) => service.applyGrading(answer), { queue: LearningQueue.OPEN_SPEAKING_RESULTS, requests: LearningQueue.WRITING_REQUESTS }).start();
        const purge = () => service.purgeRecordings().catch(() => {});
        setTimeout(purge, 60_000).unref?.();
        setInterval(purge, PURGE_EVERY_MS).unref?.();
        return service;
      },
      inject: [SPEAKING_REPOSITORY, CONTENT_CLIENT, LearningEvents, AI_KEY_REPOSITORY, ReviewService],
    },
    {
      provide: AI_KEY_REPOSITORY,
      useFactory: (dataSource) => new AiKeyRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: WritingService,
      useFactory: (repository, keys, contentClient, events, reviews) => {
        const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        const checker = new AiKeyChecker(url);
        checker.start();
        const service = new WritingService(repository, keys, contentClient, { checker, secret: process.env.GEMINI_KEY_SECRET || '', events, reviews });
        new PracticeResults(url, (answer) => service.applyResult(answer), { queue: LearningQueue.WRITING_RESULTS, requests: LearningQueue.WRITING_REQUESTS }).start();
        return service;
      },
      inject: [SPEAKING_REPOSITORY, AI_KEY_REPOSITORY, CONTENT_CLIENT, LearningEvents, ReviewService],
    },
    {
      provide: MockService,
      useFactory: (repository, placementRepository, contentClient, events) =>
        new MockService(repository, placementRepository, contentClient, { events }),
      inject: [MOCK_REPOSITORY, PLACEMENT_REPOSITORY, CONTENT_CLIENT, LearningEvents],
    },
  ],
})(AppModule);
