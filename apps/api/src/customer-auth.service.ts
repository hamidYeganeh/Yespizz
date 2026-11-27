import { Injectable } from '@nestjs/common';
import { getAuth } from './customer-auth.js';

const paths: Record<string, string> = {
  'sign-in': 'sign-in/email',
  'sign-up': 'email-otp/send-verification-otp',
  'verify-code': 'sign-in/email-otp',
  'forgot-password': 'email-otp/request-password-reset',
  'check-reset-code': 'email-otp/check-verification-otp',
  'reset-password': 'email-otp/reset-password',
  'sign-out': 'sign-out',
};

@Injectable()
export class CustomerAuthService {
  async legacy(request: Request) {
    return (await getAuth()).handler(request);
  }

  async run(action: string, request: Request) {
    const auth = await getAuth();
    if (request.method === 'GET') {
      if (action !== 'me' && action !== 'session')
        return new Response(null, { status: 404 });
      const session = await auth.api.getSession({ headers: request.headers });
      return Response.json(
        session
          ? action === 'session'
            ? { user: session.user }
            : session.user
          : null,
        { status: session ? 200 : 401 },
      );
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object')
      return new Response(null, { status: 400 });
    if (action === 'set-password') {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user.emailVerified)
        return new Response(null, { status: 401 });
      const { password } = body;
      if (
        typeof password !== 'string' ||
        password.length < 8 ||
        password.length > 128 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/\d/.test(password)
      ) {
        return Response.json(
          {
            message:
              'Use 8–128 characters with uppercase, lowercase and a number.',
          },
          { status: 400 },
        );
      }
      try {
        await auth.api.setPassword({
          headers: request.headers,
          body: { newPassword: password },
        });
      } catch {
        return Response.json(
          { message: 'Unable to set password.' },
          { status: 400 },
        );
      }
      return Response.json({ ok: true });
    }
    if (!Object.hasOwn(paths, action))
      return new Response(null, { status: 404 });
    return auth.handler(
      new Request(new URL('/api/auth/' + paths[action], request.url), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(
          action === 'sign-up' ? { email: body.email, type: 'sign-in' } : body,
        ),
      }),
    );
  }
}
