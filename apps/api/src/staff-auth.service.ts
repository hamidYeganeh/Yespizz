import { Injectable } from '@nestjs/common';
import {
  adminEmail,
  businessAccess,
  provision,
  staffAction,
  staffStore,
} from './staff-auth.mjs';

type Role = 'admin' | 'business';

@Injectable()
export class StaffAuthService {
  async session(role: Role, headers: Headers) {
    const { auth, db } = await staffStore(role);
    const session = await auth.api.getSession({ headers });
    if (!session || (role === 'admin' && session.user.email !== adminEmail)) return null;
    const access = role === 'business' ? businessAccess(db, session.user.id) : null;
    if (role === 'business' && !access) return null;
    return { ...session, user: { ...session.user, businessOwner: access?.owner, businessRole: access?.role } };
  }

  async run(role: Role, action: string, request: Request) {
    if (request.method === 'POST') return staffAction(role, action, request);
    if (action !== 'me' && action !== 'session')
      return new Response(null, { status: 404 });
    const session = await this.session(role, request.headers);
    return Response.json(
      session
        ? action === 'session'
          ? { user: session.user }
          : session.user
        : null,
      { status: session ? 200 : 401 },
    );
  }

  async businessSignOut(request: Request) {
    const { auth } = await staffStore('business');
    return auth.handler(request);
  }

  async createRestaurant(request: Request) {
    if (!(await this.session('admin', request.headers)))
      return new Response(null, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object')
      return new Response(null, { status: 400 });
    return provision(body, body.resend === true);
  }
}
