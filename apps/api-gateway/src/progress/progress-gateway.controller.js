import { Body, Controller, Get, HttpException, Inject, Param, Post, Req } from '@nestjs/common';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { PROGRESS_GRPC_SERVICE } from '@appenglish/progress-contracts/grpc';
import { AUTH_GRPC_CLIENT, attachProfiles, callAuth, sessionTokens } from '../auth/auth-gateway.controller.js';
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
  getStreak(request) {
    return this.forward('GetStreak', request);
  }
  // Admin: a learner's progress and XP, read-only (D114).
  listNotifications(request) {
    return this.forward('ListNotifications', request);
  }
  markNotificationsRead(body, request) {
    return this.forward('MarkNotificationsRead', request, { body: body || {} });
  }
  getLearnerSummary(id, request) {
    return this.forward('GetLearnerSummary', request, { id });
  }
  // Ranked learners are shown by display name and avatar (D113).
  async getLeaderboard(request) {
    const payload = await this.forward('GetLeaderboard', request);
    await attachProfiles(this.auth, [...(payload.data.entries || []), payload.data.you]);
    return payload;
  }
}

Controller('progress')(ProgressGatewayController);
Inject(AUTH_GRPC_CLIENT)(ProgressGatewayController, undefined, 0);
Inject(PROGRESS_GRPC_CLIENT)(ProgressGatewayController, undefined, 1);
const routes = [
  [Get, '', 'getProgress', [Req()]],
  [Get, 'xp', 'getXp', [Req()]],
  [Get, 'streak', 'getStreak', [Req()]],
  [Get, 'leaderboard', 'getLeaderboard', [Req()]],
  [Get, 'notifications', 'listNotifications', [Req()]],
  [Post, 'notifications/read', 'markNotificationsRead', [Body(), Req()]],
  [Get, 'admin/learners/:id', 'getLearnerSummary', [Param('id'), Req()]],
];
for (const [verb, path, method, params] of routes) {
  const descriptor = Object.getOwnPropertyDescriptor(ProgressGatewayController.prototype, method);
  verb(path)(ProgressGatewayController.prototype, method, descriptor);
  params.forEach((decorator, index) => decorator(ProgressGatewayController.prototype, method, index));
}
