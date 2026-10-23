import unittest

from speech_service.broker import redelivery_action, result_message


class RedeliveryTest(unittest.TestCase):
    def test_a_first_delivery_is_processed(self):
        self.assertEqual(redelivery_action(False, None), ("process", 0))

    def test_a_job_that_stopped_the_worker_is_retried_once_then_dead(self):
        self.assertEqual(redelivery_action(True, {}), ("retry", 1))
        self.assertEqual(redelivery_action(True, {"x-attempt": 1}), ("dead", 2))

    def test_answers_carry_the_request_id(self):
        self.assertEqual(result_message({"jobId": "j", "status": "DONE"}, "req-1"), {"jobId": "j", "status": "DONE", "requestId": "req-1"})
        self.assertEqual(result_message({"jobId": "j"}, None), {"jobId": "j"})


if __name__ == "__main__":
    unittest.main()
