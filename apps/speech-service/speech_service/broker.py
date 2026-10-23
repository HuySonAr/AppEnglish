
from __future__ import annotations

import json
import logging
import threading
import time
import uuid

from .config import PRONOUNCE_QUEUE, REQUESTS_QUEUE, RESULTS_QUEUE, SPEAKING_REQUESTS_QUEUE, SPEAKING_RESULTS_QUEUE, Settings
from .pronounce import process_pronounce
from .speaking import process_speaking
from .worker import process

log = logging.getLogger("speech-service")
RETRY_SECONDS = 10
MAX_CRASH_ATTEMPTS = 2
ATTEMPT_HEADER = "x-attempt"
REQUEST_ID_HEADER = "x-request-id"
DEAD_REQUESTS_QUEUE = f"{REQUESTS_QUEUE}.dead"
DEAD_SPEAKING_QUEUE = f"{SPEAKING_REQUESTS_QUEUE}.dead"


def redelivery_action(redelivered: bool, headers: dict | None) -> tuple[str, int]:
    attempt = int((headers or {}).get(ATTEMPT_HEADER) or 0)
    if not redelivered:
        return "process", attempt
    if attempt + 1 >= MAX_CRASH_ATTEMPTS:
        return "dead", attempt + 1
    return "retry", attempt + 1


def result_message(answer: dict, request_id: str | None) -> dict:
    return {**answer, **({"requestId": request_id} if request_id else {})}


def _serve_pronounce(settings: Settings, pronounce) -> None:
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


def _publish(channel, message: dict, queue: str = RESULTS_QUEUE) -> None:
    import pika

    headers = {REQUEST_ID_HEADER: message["requestId"]} if message.get("requestId") else None
    channel.basic_publish(
        exchange="",
        routing_key=queue,
        body=json.dumps(message).encode(),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2, message_id=str(uuid.uuid4()), headers=headers),
    )


def _serve(settings: Settings, transcribe, cache) -> None:
    import pika

    connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
    channel = connection.channel()
    channel.queue_declare(queue=REQUESTS_QUEUE, durable=True)
    channel.queue_declare(queue=RESULTS_QUEUE, durable=True)
    channel.queue_declare(queue=DEAD_REQUESTS_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    log.info("Waiting for auto-time requests on %s", REQUESTS_QUEUE)
    for method, properties, body in channel.consume(REQUESTS_QUEUE, inactivity_timeout=1):
        if method is None:
            continue
        try:
            request = json.loads(body)
        except ValueError:
            log.warning("Dropped a request that is not JSON")
            channel.basic_ack(method.delivery_tag)
            continue
        request_id = request.get("requestId") or (properties.headers or {}).get(REQUEST_ID_HEADER)
        action, attempt = redelivery_action(bool(method.redelivered), properties.headers)
        if action != "process":
            target = DEAD_REQUESTS_QUEUE if action == "dead" else REQUESTS_QUEUE
            channel.basic_publish(
                exchange="",
                routing_key=target,
                body=body,
                properties=pika.BasicProperties(
                    content_type="application/json", delivery_mode=2, message_id=properties.message_id, headers={**(properties.headers or {}), ATTEMPT_HEADER: attempt}
                ),
            )
            if action == "dead":
                _publish(channel, result_message({"jobId": request.get("jobId"), "status": "FAILED", "error": "The speech worker stopped twice on this recording."}, request_id))
            channel.basic_ack(method.delivery_tag)
            log.warning("Auto-time job %s [%s]: redelivered after a stop, %s (attempt %d)", request.get("jobId"), request_id, action, attempt)
            continue
        log.info("Auto-time job %s [%s]: %d lines", request.get("jobId"), request_id, len(request.get("lines") or []))
        _publish(channel, result_message({"jobId": request.get("jobId"), "status": "RUNNING"}, request_id))
        outcome: dict = {}
        worker = threading.Thread(target=lambda: outcome.update(process(request, transcribe, cache=cache)), daemon=True)
        worker.start()
        while worker.is_alive():
            connection.sleep(1)
        _publish(channel, result_message(outcome, request_id))
        channel.basic_ack(method.delivery_tag)
        log.info("Auto-time job %s [%s]: %s", request.get("jobId"), request_id, outcome.get("status"))


def _serve_speaking(settings: Settings, transcribe) -> None:
    import pika

    connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
    channel = connection.channel()
    channel.queue_declare(queue=SPEAKING_REQUESTS_QUEUE, durable=True)
    channel.queue_declare(queue=SPEAKING_RESULTS_QUEUE, durable=True)
    channel.queue_declare(queue=DEAD_SPEAKING_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    log.info("Waiting for speaking submissions on %s", SPEAKING_REQUESTS_QUEUE)
    for method, properties, body in channel.consume(SPEAKING_REQUESTS_QUEUE, inactivity_timeout=1):
        if method is None:
            continue
        try:
            message = json.loads(body)
        except ValueError:
            log.warning("Dropped a speaking submission that is not JSON")
            channel.basic_ack(method.delivery_tag)
            continue
        payload = message.get("payload") if isinstance(message.get("payload"), dict) else message
        request_id = message.get("requestId") or (properties.headers or {}).get(REQUEST_ID_HEADER)
        action, attempt = redelivery_action(bool(method.redelivered), properties.headers)
        if action != "process":
            target = DEAD_SPEAKING_QUEUE if action == "dead" else SPEAKING_REQUESTS_QUEUE
            channel.basic_publish(
                exchange="",
                routing_key=target,
                body=body,
                properties=pika.BasicProperties(
                    content_type="application/json", delivery_mode=2, message_id=properties.message_id, headers={**(properties.headers or {}), ATTEMPT_HEADER: attempt}
                ),
            )
            if action == "dead":
                _publish(channel, result_message({"submissionId": payload.get("submissionId"), "status": "FAILED", "error": "The speech worker stopped twice on this recording."}, request_id), SPEAKING_RESULTS_QUEUE)
            channel.basic_ack(method.delivery_tag)
            continue
        outcome: dict = {}
        worker = threading.Thread(target=lambda: outcome.update(process_speaking(message, transcribe)), daemon=True)
        worker.start()
        while worker.is_alive():
            connection.sleep(1)
        _publish(channel, result_message(outcome, request_id), SPEAKING_RESULTS_QUEUE)
        channel.basic_ack(method.delivery_tag)
        log.info("Speaking submission %s [%s]: %s", payload.get("submissionId"), request_id, outcome.get("status"))


def _keep_serving_speaking(settings: Settings, transcribe) -> None:
    while True:
        try:
            _serve_speaking(settings, transcribe)
        except Exception as error:  # noqa: BLE001 - keep serving
            log.warning("RabbitMQ (speaking): %s; retrying in %d s", _explain(error, settings), RETRY_SECONDS)
            time.sleep(RETRY_SECONDS)


def run(settings: Settings, transcribe, cache=None, pronounce=None, speaking=True) -> None:
    if pronounce is not None:
        threading.Thread(target=_keep_serving_pronounce, args=(settings, pronounce), daemon=True).start()
    if speaking:
        threading.Thread(target=_keep_serving_speaking, args=(settings, transcribe), daemon=True).start()
    while True:
        try:
            _serve(settings, transcribe, cache)
        except KeyboardInterrupt:
            return
        except Exception as error:  # noqa: BLE001 - keep serving
            log.warning("RabbitMQ (auto-time): %s; retrying in %d s", _explain(error, settings), RETRY_SECONDS)
            time.sleep(RETRY_SECONDS)
