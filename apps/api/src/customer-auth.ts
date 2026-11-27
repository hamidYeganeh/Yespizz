import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { getMigrations } from 'better-auth/db/migration';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { eraseCustomer } from './customer-data.mjs';
import { AsyncLocalStorage } from 'node:async_hooks';

const mailAttempt = new AsyncLocalStorage<{ failed: boolean }>();

async function sendCustomerMail(email: string, subject: string, text: string) {
  const { RESEND_API_KEY, AUTH_EMAIL_FROM } = process.env;
  try {
    if (!RESEND_API_KEY || !AUTH_EMAIL_FROM) throw Error('Email delivery is not configured');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: AUTH_EMAIL_FROM, to: [email], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error('Email delivery failed');
  } catch (error) {
    const attempt = mailAttempt.getStore();
    if (attempt) attempt.failed = true;
    throw error;
  }
}

export async function handleCustomerAuth(request: Request) {
  const auth = await getAuth();
  const path = new URL(request.url).pathname;
  // Recovery stays account-neutral. Sign-in sends codes to both new and returning customers.
  const checkDelivery = path.endsWith('/delete-user') || (path.endsWith('/send-verification-otp') &&
    (await request.clone().json().catch(() => null))?.type === 'sign-in');
  if (!checkDelivery) return auth.handler(request);
  return mailAttempt.run({ failed: false }, async () => {
    const response = await auth.handler(request);
    return mailAttempt.getStore()?.failed ? Response.json(
      { message: 'The email could not be sent. Please try again later.' }, { status: 503 },
    ) : response;
  });
}

async function initialize() {
  const file = resolve(
    process.env.AUTH_DATABASE_PATH || '../application/.data/auth.sqlite',
  );
  mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec(
    'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON',
  );
  const options = {
    baseURL:
      process.env.BETTER_AUTH_URL ||
      (process.env.NODE_ENV !== 'production'
        ? 'http://localhost:7031'
        : undefined),
    secret: process.env.BETTER_AUTH_SECRET,
    database,
    trustedOrigins: ['https://appleid.apple.com'],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      requireEmailVerification: true,
    },
    rateLimit: { enabled: true, storage: 'database' },
    databaseHooks: {
      user: {
        delete: {
          after: async (user) => {
            eraseCustomer(user.id);
          },
        },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        async sendDeleteAccountVerification({ user, url }) {
          await sendCustomerMail(user.email, 'Confirm account deletion', url);
        },
      },
      additionalFields: {
        inviteCode: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: () =>
            crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase(),
        },
        contactPhone: { type: 'string', required: false },
      },
    },
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET && {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }),
      ...(process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_CLIENT_SECRET && {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          },
        }),
    },
    plugins: [
      emailOTP({
        otpLength: 5,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          await sendCustomerMail(email, 'Your Yespiz verification code',
            `Your verification code is ${otp}. It expires in five minutes.`);
        },
      }),
    ],
  } satisfies Parameters<typeof betterAuth>[0];
  try {
    if (!options.secret || !options.baseURL)
      throw new Error('Set BETTER_AUTH_SECRET and BETTER_AUTH_URL');
    const migration = await getMigrations(options);
    await migration.runMigrations();
    database.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS user_invite_code ON user(inviteCode)',
    );
    database.exec(
      "UPDATE user SET inviteCode = upper(hex(randomblob(8))) WHERE inviteCode IS NULL OR inviteCode = ''",
    );
    return betterAuth(options);
  } catch (error) {
    database.close();
    throw error;
  }
}

let instance: ReturnType<typeof initialize> | undefined;
export function getAuth() {
  return (instance ??= initialize().catch((error) => {
    instance = undefined;
    throw error;
  }));
}
