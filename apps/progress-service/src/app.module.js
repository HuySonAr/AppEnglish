import { Module } from '@nestjs/common';
import { MetricsController } from './metrics/metrics.controller.js';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { createProgressDataSource } from './database/database.config.js';
import { CONTENT_CLIENT, CONTENT_GRPC_CLIENT, PROGRESS_DATA_SOURCE, PROGRESS_REPOSITORY } from './database/database.tokens.js';
import { ResultsConsumer } from './events/results.consumer.js';
import { ContentClient } from './progress/content.client.js';
import { ProgressGrpcController } from './progress/progress.grpc.controller.js';
import { ProgressRepository } from './progress/progress.repository.js';
import { ProgressService } from './progress/progress.service.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
    ]),
  ],
  controllers: [MetricsController, HealthController, ProgressGrpcController],
  providers: [
    { provide: PROGRESS_DATA_SOURCE, useFactory: createProgressDataSource },
    {
      provide: PROGRESS_REPOSITORY,
      useFactory: (dataSource) => new ProgressRepository(dataSource),
      inject: [PROGRESS_DATA_SOURCE],
    },
    {
      provide: CONTENT_CLIENT,
      useFactory: (grpcClient) => new ContentClient(grpcClient),
      inject: [CONTENT_GRPC_CLIENT],
    },
    {
      provide: ProgressService,
      useFactory: (repository, contentClient) => {
        const service = new ProgressService(repository, contentClient);
        const consumer = new ResultsConsumer(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
        consumer.start((message) => service.applyResult(message));
        return service;
      },
      inject: [PROGRESS_REPOSITORY, CONTENT_CLIENT],
    },
  ],
})(AppModule);
