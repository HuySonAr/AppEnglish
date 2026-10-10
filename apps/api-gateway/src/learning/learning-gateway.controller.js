import { Body, Controller, Get, HttpException, Inject, Post, Put, Req } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { LEARNING_GRPC_SERVICE } from '@appenglish/learning-contracts/grpc';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const LEARNING_GRPC_CLIENT = 'LEARNING_GRPC_CLIENT';

// Public /placement/* routes (F03), relayed to learning-service over gRPC.
export class LearningGatewayController {
  constructor(authClient, learningClient) {
    this.authClient = authClient;
    this.learningClient = learningClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.learning = this.learningClient.getService(LEARNING_GRPC_SERVICE);
  }

  getPlacement(request) {
    return this.forward('GetPlacement', request);
  }
  startPlacement(request) {
    return this.forward('StartPlacement', request);
  }
  savePlacementAnswers(body, request) {
    return this.forward('SavePlacementAnswers', request, body);
  }
  submitPlacement(body, request) {
    return this.forward('SubmitPlacement', request, body);
  }
  skipPlacement(request) {
    return this.forward('SkipPlacement', request);
  }
  getPlacementSettings(request) {
    return this.forward('GetPlacementSettings', request);
  }
  updatePlacementSettings(body, request) {
    return this.forward('UpdatePlacementSettings', request, body);
  }

  // Every route needs a valid session: auth-service verifies the access
  // cookie and returns the account that learning-service authorizes.
  async forward(rpc, request, body) {
    const session = await callAuth(this.auth, 'Me', {
      accessToken: sessionTokens(request).accessToken,
    });
    if (session.status >= 400) throw new HttpException(session.payload, session.status);
    const { id, role } = session.payload.data.account;
    const { status, payload } = await callService(
      this.learning,
      rpc,
      { actor: { id, role }, payloadJson: body === undefined ? '' : JSON.stringify(body) },
      'Learning',
    );
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
}

Controller('placement')(LearningGatewayController);
Inject(AUTH_GRPC_CLIENT)(LearningGatewayController, undefined, 0);
Inject(LEARNING_GRPC_CLIENT)(LearningGatewayController, undefined, 1);
const routes = [
  [Get, '', 'getPlacement', [Req()]],
  [Post, 'start', 'startPlacement', [Req()]],
  [Put, 'answers', 'savePlacementAnswers', [Body(), Req()]],
  [Post, 'submit', 'submitPlacement', [Body(), Req()]],
  [Post, 'skip', 'skipPlacement', [Req()]],
  [Get, 'settings', 'getPlacementSettings', [Req()]],
  [Put, 'settings', 'updatePlacementSettings', [Body(), Req()]],
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(LearningGatewayController.prototype, method);
  verb(path)(LearningGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(LearningGatewayController.prototype, method, index));
}
