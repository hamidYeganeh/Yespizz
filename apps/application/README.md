This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
## Authentication

The application runs Better Auth on Node 24 with a persistent SQLite database. On first use it creates the auth tables. Deploy on a Node host with a persistent disk and set `AUTH_DATABASE_PATH` to a path on that disk. A local file on an ephemeral host will lose accounts.

Copy the settings in `.env.example` into the application's server environment. Set `BETTER_AUTH_URL` to the canonical application origin and `BETTER_AUTH_SECRET` to a stable random secret of at least 32 bytes. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.

- Email verification uses Resend. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` to a verified sender. The five-digit code expires after five minutes. After verification a new user can register a password. Returning users can use a code or their password.
- In Google Cloud, create a web OAuth client and register `<BETTER_AUTH_URL>/api/auth/callback/google`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- In Apple Developer, configure a Sign in with Apple Services ID with the HTTPS domain and return URL `<BETTER_AUTH_URL>/api/auth/callback/apple`. Set `APPLE_CLIENT_ID` to the Services ID and `APPLE_CLIENT_SECRET` to its signed client-secret JWT. Rotate it before expiry. Apple requires a registered HTTPS domain for the browser callback.

Restart the application after setting provider credentials. Accounts, sessions and verification records are stored server-side. Keep the database, its backups and the server environment private.
