import { HttpException } from '@nestjs/common';

// Gateway-originated failures use the shared { code, msg, data } envelope with
// SYSTEM_ERROR (32).
export function gatewayFailure(message) {
  return { code: 32, msg: 'fail', data: { message } };
}

// gRPC status codes that mean the service could not be reached in time.
const UNAVAILABLE_GRPC_CODES = [4, 14];

// Calls one RPC whose reply is { httpStatus, code, msg, dataJson, setCookies }
// and returns { status, payload, setCookies }. Transport failures become a
// gateway envelope with 503/500; label names the service in that message.
export async function callService(service, rpc, message, label) {
  let reply;
  try {
    reply = await new Promise((resolve, reject) => {
      service[rpc](message).subscribe({ next: resolve, error: reject });
    });
  } catch (error) {
    if (UNAVAILABLE_GRPC_CODES.includes(error?.code))
      throw new HttpException(gatewayFailure(`${label} service is unavailable`), 503);
    throw new HttpException(gatewayFailure(`${label} service failed`), 500);
  }
  let data;
  try {
    data = JSON.parse(reply.dataJson || '{}');
  } catch {
    throw new HttpException(gatewayFailure(`${label} service returned an invalid response`), 500);
  }
  return {
    status: reply.httpStatus,
    payload: { code: reply.code, msg: reply.msg, data },
    setCookies: reply.setCookies || [],
  };
}
