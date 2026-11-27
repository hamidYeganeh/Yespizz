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

The admin account is hamidyeganeh82@gmail.com. Set ADMIN_PASSWORD in the admin app environment before first startup, or use Forgot password to initialize it by email. Subsequent changes are persisted in SQLite. Supply ADMIN_AUTH_SECRET and BUSINESS_AUTH_SECRET in production. Configure BUSINESS_AUTH_SECRET in both staff apps, and point BUSINESS_DATABASE_PATH at the same absolute SQLite file on a shared local disk. ADMIN_DATABASE_PATH and AUTH_DATABASE_PATH hold the separate admin and customer databases.

Configure RESEND_API_KEY and AUTH_EMAIL_FROM (a verified sender) in all three Next.js apps. The admin app sends restaurant invitations. Each app sends recovery mail for its own accounts. Use ADMIN_AUTH_URL, BUSINESS_AUTH_URL and BETTER_AUTH_URL for their public origins. The Nest API forwards /api/v1 requests to these apps (default ports 7032, 7033 and 7031). Set API_PUBLIC_ORIGIN when the API sits behind an HTTPS reverse proxy.

Open the admin dashboard and select Create restaurant or resend invitation. Invitations last 15 minutes. A successful first sign-in exchanges the invitation for a single-use password setup token. After saving the password the owner signs in normally. Resending an invitation invalidates outstanding codes. Staff password recovery uses a separate emailed code and revokes existing sessions on success.

Run the isolated account-flow tests with Node 24: `node --test packages/staff/store.test.mjs apps/application/src/lib/auth.test.mjs`.
