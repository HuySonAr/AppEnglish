"""The RabbitMQ loop of speech-service (D97): reads auto-time requests one at
a time from speech.autotime.requests and answers on speech.autotime.results
(RUNNING when it starts, then DONE or FAILED). The work runs in a thread
while the connection keeps answering heartbeats; a request is acknowledged
only once its answer is sent, so a crash leaves it in the queue."""

from __future__ import annotations

import json
import logging
import threading
import time

from .config import REQUESTS_QUEUE, RESULTS_QUEUE, Settings
from .worker import process

log = logging.getLogger("speech-service")
RETRY_SECONDS = 10


def _publish(channel, message: dict) -> None:
    import pika

    channel.basic_publish(
        exchange="",
        routing_key=RESULTS_QUEUE,
        body=json.dumps(message).encode(),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )


def _serve(settings: Settings, transcribe, cache) -> None:
    import pika

    connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
    channel = connection.channel()
    channel.queue_declare(queue=REQUESTS_QUEUE, durable=True)
    channel.queue_declare(queue=RESULTS_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    log.info("Waiting for auto-time requests on %s", REQUESTS_QUEUE)
    for method, _properties, body in channel.consume(REQUESTS_QUEUE, inactivity_timeout=1):
        if method is None:
            continue
        try:
            request = json.loads(body)
        except ValueError:
            log.warning("Dropped a request that is not JSON")
            channel.basic_ack(method.delivery_tag)
            continue
        log.info("Auto-time job %s: %d lines", request.get("jobId"), len(request.get("lines") or []))
        _publish(channel, {"jobId": request.get("jobId"), "status": "RUNNING"})
        outcome: dict = {}
        worker = threading.Thread(target=lambda: outcome.update(process(request, transcribe, cache=cache)), daemon=True)
        worker.start()
        while worker.is_alive():
            connection.sleep(1)
        _publish(channel, outcome)
        channel.basic_ack(method.delivery_tag)
        log.info("Auto-time job %s: %s", request.get("jobId"), outcome.get("status"))


def run(settings: Settings, transcribe, cache=None) -> None:
    """Serves forever, reconnecting when RabbitMQ goes away."""
    while True:
        try:
            _serve(settings, transcribe, cache)
        except KeyboardInterrupt:
            return
        except Exception as error:  # noqa: BLE001 - keep serving
            log.warning("RabbitMQ: %s; retrying in %d s", error, RETRY_SECONDS)
            time.sleep(RETRY_SECONDS)
