import { HttpException } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { REQUEST_ID_HEADER, currentRequestId } from '@appenglish/backend-common/observability';

export function gatewayFailure(message) {
  return { code: 32, msg: 'fail', data: { message } };
}

const UNAVAILABLE_GRPC_CODES = [4, 14];

export async function callService(service, rpc, message, label) {
  let reply;
  const metadata = new Metadata();
  if (currentRequestId()) metadata.set(REQUEST_ID_HEADER, currentRequestId());
  try {
    reply = await new Promise((resolve, reject) => {
      service[rpc](message, metadata).subscribe({ next: resolve, error: reject });
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
