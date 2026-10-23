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
import { USAGE_REPOSITORY, UsageGrpcController, UsageRepository } from './usage/usage.grpc.controller.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
    ]),
  ],
  controllers: [MetricsController, HealthController, PlacementGrpcController, LessonGrpcController, MockGrpcController, ListeningGrpcController, CourseGrpcController, UsageGrpcController],
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
      provide: MockService,
      useFactory: (repository, placementRepository, contentClient, events) =>
        new MockService(repository, placementRepository, contentClient, { events }),
      inject: [MOCK_REPOSITORY, PLACEMENT_REPOSITORY, CONTENT_CLIENT, LearningEvents],
    },
  ],
})(AppModule);
