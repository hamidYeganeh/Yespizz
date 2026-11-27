import { Injectable } from '@nestjs/common';
import { staffStore } from './staff-auth.mjs';
import { StaffAuthService } from './staff-auth.service.js';
import { groups, nextStep, steps, type Profile } from './restaurant-profile.js';

@Injectable()
export class RestaurantService {
  constructor(private readonly staff: StaffAuthService) {}

  async profile(request: Request) {
    const session = await this.staff.session('business', request.headers);
    if (!session) return new Response(null, { status: 401 });
    const owner = session.user.id;
    const { db } = await staffStore('business');
    db.prepare(
      'INSERT OR IGNORE INTO restaurant_profile(owner) VALUES (?)',
    ).run(owner);
    const row = db
      .prepare(
        'SELECT name,city,handle,specialties FROM restaurant_profile WHERE owner=?',
      )
      .get(owner)!;
    const profile: Profile = {
      name: String(row.name),
      city: String(row.city),
      handle: String(row.handle ?? ''),
      specialties: JSON.parse(String(row.specialties)),
    };
    if (request.method === 'GET') {
      const terms = db
        .prepare(
          'SELECT commission,latitude,longitude,ovens FROM restaurant_terms WHERE owner=?',
        )
        .get(owner);
      return Response.json({ owner, profile, terms });
    }

    const body = await request.json().catch(() => null);
    const step = steps.find((candidate) => candidate === body?.step);
    const current = nextStep(profile);
    if (
      !step ||
      (current !== 'complete' && steps.indexOf(step) > steps.indexOf(current))
    ) {
      return Response.json({ next: current });
    }
    const value = body.value;
    const error = (message: string) =>
      Response.json({ message }, { status: 400 });
    if (step === 'specialties') {
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.some((item) => !Object.values(groups).flat().includes(item))
      ) {
        return error('Choose at least one specialty.');
      }
      db.prepare(
        'UPDATE restaurant_profile SET specialties=? WHERE owner=?',
      ).run(JSON.stringify([...new Set(value)]), owner);
    } else {
      if (typeof value !== 'string' || !value.trim() || value.length > 80)
        return error('Enter a value of up to 80 characters.');
      const text = value.trim();
      if (step === 'handle' && !/^[a-z0-9][a-z0-9-]{2,29}$/.test(text))
        return error('Use 3–30 lowercase letters, numbers or hyphens.');
      const column = { name: 'name', location: 'city', handle: 'handle' }[step];
      try {
        db.prepare(
          'UPDATE restaurant_profile SET ' + column + '=? WHERE owner=?',
        ).run(text, owner);
      } catch (cause) {
        if (
          step === 'handle' &&
          cause instanceof Error &&
          cause.message.includes('UNIQUE')
        ) {
          return error('That handle is taken. Try another.');
        }
        throw cause;
      }
    }
    return Response.json({
      next: steps[steps.indexOf(step) + 1] || 'complete',
    });
  }
}
