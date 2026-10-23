import { Controller, Get, Header, NotFoundException, Req } from '@nestjs/common';
import { metrics } from '@appenglish/backend-common/metrics';

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export class MetricsController {
  render(request) {
    if (!LOCAL.has(request.socket?.remoteAddress)) throw new NotFoundException();
    return metrics.render();
  }
}
Controller('metrics')(MetricsController);
Get()(MetricsController.prototype, 'render', Object.getOwnPropertyDescriptor(MetricsController.prototype, 'render'));
Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')(MetricsController.prototype, 'render', Object.getOwnPropertyDescriptor(MetricsController.prototype, 'render'));
Req()(MetricsController.prototype, 'render', 0);
