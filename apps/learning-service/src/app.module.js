import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { contentGrpcOptions } from '@appenglish/content-contracts/grpc';
import { HealthController } from './health/health.controller.js';
import { createLearningDataSource } from './database/database.config.js';
import {
  CONTENT_CLIENT,
  CONTENT_GRPC_CLIENT,
  LEARNING_DATA_SOURCE,
  PLACEMENT_REPOSITORY,
} from './database/database.tokens.js';
import { ContentClient } from './placement/content.client.js';
import { PlacementGrpcController } from './placement/placement.grpc.controller.js';
import { PlacementRepository } from './placement/placement.repository.js';
import { PlacementService } from './placement/placement.service.js';

export class AppModule {}
Module({
  imports: [
    ClientsModule.register([
      { name: CONTENT_GRPC_CLIENT, transport: Transport.GRPC, options: contentGrpcOptions() },
    ]),
  ],
  controllers: [HealthController, PlacementGrpcController],
  providers: [
    { provide: LEARNING_DATA_SOURCE, useFactory: createLearningDataSource },
    {
      provide: PLACEMENT_REPOSITORY,
      useFactory: (dataSource) => new PlacementRepository(dataSource),
      inject: [LEARNING_DATA_SOURCE],
    },
    {
      provide: CONTENT_CLIENT,
      useFactory: (grpcClient) => new ContentClient(grpcClient),
      inject: [CONTENT_GRPC_CLIENT],
    },
    {
      provide: PlacementService,
      useFactory: (repository, contentClient) => new PlacementService(repository, contentClient),
      inject: [PLACEMENT_REPOSITORY, CONTENT_CLIENT],
    },
  ],
})(AppModule);
