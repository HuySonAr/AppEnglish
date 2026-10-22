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

from .config import PRONOUNCE_QUEUE, REQUESTS_QUEUE, RESULTS_QUEUE, Settings
from .pronounce import process_pronounce
from .worker import process

log = logging.getLogger("speech-service")
RETRY_SECONDS = 10


def _serve_pronounce(settings: Settings, pronounce) -> None:
    """Pronunciation requests (D123) are answered at once on the reply queue
    the request names (reply_to, correlation_id): content-service waits for
    the answer. Runs on its own connection, in its own thread, so a long
    auto-time job never delays a word."""
    import pika

    connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
    channel = connection.channel()
    channel.queue_declare(queue=PRONOUNCE_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    log.info("Waiting for pronunciation requests on %s", PRONOUNCE_QUEUE)
    for method, properties, body in channel.consume(PRONOUNCE_QUEUE, inactivity_timeout=1):
        if method is None:
            continue
        try:
            request = json.loads(body)
        except ValueError:
            request = {}
        answer = process_pronounce(request, pronounce)
        if properties.reply_to:
            channel.basic_publish(
                exchange="",
                routing_key=properties.reply_to,
                body=json.dumps(answer).encode(),
                properties=pika.BasicProperties(content_type="application/json", correlation_id=properties.correlation_id),
            )
        channel.basic_ack(method.delivery_tag)
        log.info("Pronounced %r: %s", request.get("word"), answer.get("status"))


def _explain(error: Exception, settings: Settings) -> str:
    """A connection failure in words: RabbitMQ closing the socket during the
    handshake almost always means it is still starting."""
    name = type(error).__name__
    url = getattr(settings, "rabbitmq_url", "RabbitMQ")
    if name in ("IncompatibleProtocolError", "StreamLostError", "AMQPConnectionError", "AMQPConnectionWorkflowFailed"):
        return f"cannot connect to {url} (still starting, or not running: docker compose up -d rabbitmq)"
    return f"{name}: {error}"


def _keep_serving_pronounce(settings: Settings, pronounce) -> None:
    while True:
        try:
            _serve_pronounce(settings, pronounce)
        except Exception as error:  # noqa: BLE001 - keep serving
            log.warning("RabbitMQ (pronunciation): %s; retrying in %d s", _explain(error, settings), RETRY_SECONDS)
            time.sleep(RETRY_SECONDS)


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


def run(settings: Settings, transcribe, cache=None, pronounce=None) -> None:
    """Serves forever, reconnecting when RabbitMQ goes away. With pronounce
    (D123) a second thread answers pronunciation requests."""
    if pronounce is not None:
        threading.Thread(target=_keep_serving_pronounce, args=(settings, pronounce), daemon=True).start()
    while True:
        try:
            _serve(settings, transcribe, cache)
        except KeyboardInterrupt:
            return
        except Exception as error:  # noqa: BLE001 - keep serving
            log.warning("RabbitMQ (auto-time): %s; retrying in %d s", _explain(error, settings), RETRY_SECONDS)
            time.sleep(RETRY_SECONDS)
