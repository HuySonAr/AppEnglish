import { Controller, Get, HttpException, Inject, Req } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { PROGRESS_GRPC_SERVICE } from '@appenglish/progress-contracts/grpc';
import { AUTH_GRPC_CLIENT, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
import { callService } from '../grpc/grpc-call.js';

export const PROGRESS_GRPC_CLIENT = 'PROGRESS_GRPC_CLIENT';

// Public /progress routes (F06): authenticates the session and relays the
// call to progress-service over gRPC.
export class ProgressGatewayController {
  constructor(authClient, progressClient) {
    this.authClient = authClient;
    this.progressClient = progressClient;
  }

  onModuleInit() {
    this.auth = this.authClient.getService(AUTH_GRPC_SERVICE);
    this.progress = this.progressClient.getService(PROGRESS_GRPC_SERVICE);
  }

  async forward(rpc, request, { id = '', body } = {}) {
    const session = await callAuth(this.auth, 'Me', {
      accessToken: sessionTokens(request).accessToken,
    });
    if (session.status >= 400) throw new HttpException(session.payload, session.status);
    const { id: accountId, role, email } = session.payload.data.account;
    const { status, payload } = await callService(
      this.progress,
      rpc,
      {
        actor: { id: accountId, role, email: email || '' },
        id,
        payloadJson: body === undefined ? '' : JSON.stringify(body),
      },
      'Progress',
    );
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }

  getProgress(request) {
    return this.forward('GetProgress', request);
  }
  getXp(request) {
    return this.forward('GetXp', request);
  }
  getLeaderboard(request) {
    return this.forward('GetLeaderboard', request);
  }
}

Controller('progress')(ProgressGatewayController);
Inject(AUTH_GRPC_CLIENT)(ProgressGatewayController, undefined, 0);
Inject(PROGRESS_GRPC_CLIENT)(ProgressGatewayController, undefined, 1);
const routes = [
  [Get, '', 'getProgress', [Req()]],
  [Get, 'xp', 'getXp', [Req()]],
  [Get, 'leaderboard', 'getLeaderboard', [Req()]],
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(ProgressGatewayController.prototype, method);
  verb(path)(ProgressGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(ProgressGatewayController.prototype, method, index));
}
