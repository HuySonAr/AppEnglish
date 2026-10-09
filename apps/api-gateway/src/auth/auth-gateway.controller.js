import { Body, Controller, Get, HttpException, Post, Req, Res } from '@nestjs/common';

export class AuthGatewayController {
  async register(body, request, response) {
    return this.forward('/auth/register', body, request, response);
  }

  async login(body, request, response) {
    return this.forward('/auth/login', body, request, response);
  }

  async refresh(request, response) {
    return this.forward('/auth/refresh', undefined, request, response);
  }

  async logout(request, response) {
    return this.forward('/auth/logout', undefined, request, response);
  }

  async me(request, response) {
    return this.forward('/auth/me', undefined, request, response);
  }

  async forward(path, body, request, response) {
    let upstream;
    try {
      upstream = await fetch(`http://localhost:${process.env.AUTH_SERVICE_PORT || 3001}${path}`, {
        method: 'POST',
        headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(request.headers.cookie ? { cookie: request.headers.cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new HttpException({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Authentication service is unavailable' }, 503);
    }
    const setCookies = response && (upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []));
    if (setCookies.length) response.setHeader('Set-Cookie', setCookies);
    const text = await upstream.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : { code: 'EMPTY_AUTH_RESPONSE', message: 'Authentication service returned an empty response' };
    } catch {
      payload = { code: 'INVALID_AUTH_RESPONSE', message: 'Authentication service returned an invalid response' };
    }
    if (!upstream.ok) throw new HttpException(payload, upstream.status);
    return payload;
  }
}

Controller('auth')(AuthGatewayController);
Post('register')(AuthGatewayController.prototype, 'register', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'register'));
Body()(AuthGatewayController.prototype, 'register', 0);
Req()(AuthGatewayController.prototype, 'register', 1);
Res({ passthrough: true })(AuthGatewayController.prototype, 'register', 2);
Post('login')(AuthGatewayController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'login'));
Body()(AuthGatewayController.prototype, 'login', 0);
Req()(AuthGatewayController.prototype, 'login', 1);
Res({ passthrough: true })(AuthGatewayController.prototype, 'login', 2);
Post('refresh')(AuthGatewayController.prototype, 'refresh', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'refresh'));
Req()(AuthGatewayController.prototype, 'refresh', 0);
Res({ passthrough: true })(AuthGatewayController.prototype, 'refresh', 1);
Post('logout')(AuthGatewayController.prototype, 'logout', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'logout'));
Req()(AuthGatewayController.prototype, 'logout', 0);
Res({ passthrough: true })(AuthGatewayController.prototype, 'logout', 1);
Get('me')(AuthGatewayController.prototype, 'me', Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'me'));
Req()(AuthGatewayController.prototype, 'me', 0);
Res({ passthrough: true })(AuthGatewayController.prototype, 'me', 1);
