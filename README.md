# Yespiz

Run `npm install` and `npm run dev` from the repository root to start the Next.js apps and the NestJS API.

| Workspace | Local URL |
| --- | --- |
| application | [localhost:7031](http://localhost:7031) |
| admin | [localhost:7032](http://localhost:7032) |
| api | [localhost:7038](http://localhost:7038) |

Use `npm run dev -w application`, `npm run dev -w admin`, or `npm run dev -w api` to start one app. Run `npm run build`, `npm run lint`, and `npm run check-types` from the root to check the workspace.

Both apps use the shared `@repo/i18n` package. English is the default. Applying a language preference saves a cookie and keeps the current URL. Austrian German uses `de-AT`. Add translated messages under matching feature namespaces in each locale directory in `packages/i18n/src/messages`.

The application loads Inter and the HeroUI theme in its root layout. Its global stylesheet defines the light and dark palettes. Set `data-theme="dark"` on the document element to select dark mode.

### Staff accounts and password recovery

The NestJS API owns authentication, restaurant invitations, and business onboarding. Copy `apps/api/.env.example` to `apps/api/.env` for local development. The admin account is `hamidyeganeh82@gmail.com`. Set `ADMIN_PASSWORD` before first startup or use Forgot password to initialize it by email. Staff and customer account data currently persists in SQLite. Set `ADMIN_DATABASE_PATH`, `BUSINESS_DATABASE_PATH`, and `AUTH_DATABASE_PATH` to point to existing databases when needed.

Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the NestJS environment for invitations, verification, and recovery. Set `ADMIN_AUTH_URL`, `BUSINESS_AUTH_URL`, and `BETTER_AUTH_URL` to the browser-facing app origins. Each Next.js app forwards auth requests to `YESPIZZ_API_URL`, which defaults to `http://localhost:7038`. A hosted deployment needs persistent storage for the account databases.

Open the admin dashboard and select Create restaurant or resend invitation. Invitations last 15 minutes. A successful first sign-in exchanges the invitation for a single-use password setup token. After saving the password the owner signs in normally. Resending an invitation invalidates outstanding codes. Staff password recovery uses a separate emailed code and revokes existing sessions on success.

Run the isolated account-flow tests with Node 24: `node --test packages/staff/store.test.mjs apps/application/src/lib/auth.test.mjs`.
