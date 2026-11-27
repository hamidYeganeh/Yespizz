import { All, Controller, Req, Res } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { CustomerAuthService } from './customer-auth.service.js';
import { RestaurantService } from './restaurant.service.js';
import { StaffAuthService } from './staff-auth.service.js';

@Controller()
export class AuthController {
  constructor(
    private readonly customerAuth: CustomerAuthService,
    private readonly staffAuth: StaffAuthService,
    private readonly restaurants: RestaurantService,
  ) {}

  @All([
    'api/v1/auth/:action',
    'api/v1/admin/auth/:action',
    'api/v1/business/auth/:action',
    'api/v1/admin/restaurants',
    'api/v1/business/restaurant-profile',
    'api/v1/business/team',
    'api/auth/{*path}',
    'api/v1/business/legacy-auth/{*path}',
  ])
  async handle(@Req() source: ExpressRequest, @Res() output: ExpressResponse) {
    if (source.method !== 'GET' && source.method !== 'POST') {
      output.sendStatus(405);
      return;
    }
    const path = source.path;
    const business = path.startsWith('/api/v1/business/');
    const admin = path.startsWith('/api/v1/admin/');
    const appOrigin = new URL(
      admin
        ? process.env.ADMIN_AUTH_URL || 'http://localhost:7032'
        : business
          ? process.env.BUSINESS_AUTH_URL || 'http://localhost:7033'
          : process.env.BETTER_AUTH_URL || 'http://localhost:7031',
    ).origin;
    const origin = source.get('origin');
    if (
      origin &&
      origin !== appOrigin &&
      !(
        path === '/api/auth/callback/apple' &&
        origin === 'https://appleid.apple.com'
      )
    ) {
      output.sendStatus(403);
      return;
    }

    const legacy =
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/v1/business/legacy-auth/');
    const requestPath = source.originalUrl.replace(
      /^\/api\/v1\/business\/legacy-auth\//,
      '/api/auth/',
    );
    const headers = new Headers();
    for (const name of [
      'accept',
      'content-type',
      'cookie',
      'origin',
      'user-agent',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
    ]) {
      const value = source.get(name);
      if (value) headers.set(name, value);
    }
    if (source.method === 'POST' && !legacy && !source.is('application/json')) {
      output.sendStatus(415);
      return;
    }
    const body =
      source.method === 'POST'
        ? source.is('application/x-www-form-urlencoded')
          ? new URLSearchParams(source.body).toString()
          : JSON.stringify(source.body ?? {})
        : undefined;
    const request = new Request(appOrigin + requestPath, {
      method: source.method,
      headers,
      body,
    });
    const action = path.split('/').at(-1)!;
    const response =
      path === '/api/v1/admin/restaurants'
        ? source.method === 'POST'
          ? await this.staffAuth.createRestaurant(request)
          : new Response(null, { status: 405 })
        : path === '/api/v1/business/team'
          ? await this.restaurants.team(request)
          : path === '/api/v1/business/restaurant-profile'
          ? await this.restaurants.profile(request)
          : legacy
            ? business
              ? await this.staffAuth.businessSignOut(request)
              : await this.customerAuth.legacy(request)
            : admin || business
              ? await this.staffAuth.run(
                  admin ? 'admin' : 'business',
                  action,
                  request,
                )
              : await this.customerAuth.run(action, request);

    output.status(response.status).set('Cache-Control', 'no-store');
    for (const name of ['location', 'content-type', 'retry-after']) {
      const value = response.headers.get(name);
      if (value) output.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie())
      output.append('Set-Cookie', cookie);
    output.send(Buffer.from(await response.arrayBuffer()));
  }
}
