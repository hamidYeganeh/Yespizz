import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

@Controller('api/v1')
export class AuthController {
  @Get(['auth/me', 'admin/auth/me', 'business/auth/me'])
  current(@Req() request: Request, @Res() response: Response) {
    return this.forward(request, response);
  }

  @Post([
    'auth/:action',
    'admin/auth/:action',
    'business/auth/:action',
    'admin/restaurants',
  ])
  async forward(@Req() request: Request, @Res() response: Response) {
    const path = request.path;
    const role = path.startsWith('/api/v1/admin/')
      ? 'admin'
      : path.startsWith('/api/v1/business/')
        ? 'business'
        : 'application';
    const origins = {
      admin: process.env.ADMIN_AUTH_URL || 'http://localhost:7032',
      business: process.env.BUSINESS_AUTH_URL || 'http://localhost:7033',
      application: process.env.BETTER_AUTH_URL || 'http://localhost:7031',
    };
    const origin = request.get('origin');
    if (
      origin &&
      origin !==
        (process.env.API_PUBLIC_ORIGIN ||
          request.protocol + '://' + request.get('host'))
    ) {
      response.sendStatus(403);
      return;
    }
    if (request.method === 'POST' && !request.is('application/json')) {
      response.sendStatus(415);
      return;
    }
    try {
      const upstream = await fetch(new URL(path, origins[role]), {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          cookie: request.get('cookie') || '',
        },
        body:
          request.method === 'POST' ? JSON.stringify(request.body) : undefined,
        redirect: 'manual',
      });
      response.status(upstream.status).set('Cache-Control', 'no-store');
      for (const cookie of upstream.headers.getSetCookie())
        response.append('Set-Cookie', cookie);
      response
        .type(upstream.headers.get('content-type') || 'application/json')
        .send(await upstream.text());
    } catch {
      response
        .status(502)
        .json({ message: 'Authentication service unavailable.' });
    }
  }
}
