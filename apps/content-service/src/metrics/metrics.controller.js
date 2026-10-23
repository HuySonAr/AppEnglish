import { Controller, Get, Header } from '@nestjs/common';
import { metrics } from '@appenglish/backend-common/metrics';

export class MetricsController {
  render() {
    return metrics.render();
  }
}
Controller('metrics')(MetricsController);
Get()(MetricsController.prototype, 'render', Object.getOwnPropertyDescriptor(MetricsController.prototype, 'render'));
Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')(MetricsController.prototype, 'render', Object.getOwnPropertyDescriptor(MetricsController.prototype, 'render'));
