export function brokerConfig(source = process.env) {
  return {
    redisUrl: source.REDIS_URL || 'redis://localhost:6379',
    rabbitmqUrl: source.RABBITMQ_URL || 'amqp://localhost:5672'
  };
}

export function grpcTarget(host, port) {
  return `${host || 'localhost'}:${port}`;
}
