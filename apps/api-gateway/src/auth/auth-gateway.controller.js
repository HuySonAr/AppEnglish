import { Body, Controller, HttpException, Post } from '@nestjs/common';

export class AuthGatewayController {
  async register(body) {
    return this.forward('/auth/register', body);
  }

  async login(body) {
    return this.forward('/auth/login', body);
  }

  async forward(path, body) {
    let response;
    try {
      response = await fetch(`http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {
      throw new HttpException({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Authentication service is unavailable' }, 503);
    }
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : { code: 'EMPTY_AUTH_RESPONSE', message: 'Authentication service returned an empty response' };
    } catch {
      payload = { code: 'INVALID_AUTH_RESPONSE', message: 'Authentication service returned an invalid response' };
    }
    if (!response.ok) throw new HttpException(payload, response.status);
    return payload;
  }
}

Controller('auth')(AuthGatewayController);
Post('register')(AuthGatewayController.prototype, 'register', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'register'));
Body()(AuthGatewayController.prototype, 'register', 0);
Post('login')(AuthGatewayController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'login'));
Body()(AuthGatewayController.prototype, 'login', 0);
