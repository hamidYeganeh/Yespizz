# Yespiz

### Local order demo

Run `npm run demo` from the repository root. It starts the customer app on port 17331, admin on 17332, restaurant on 17333, courier on 17334, and API on 17338. Use `127.0.0.1` in the browser. The launcher prints the path to the credentials file under `.data/demo-*`. Each run creates fresh SQLite databases in the system temporary directory. For a temporary HTTPS mobile demo, build the API and all four Next.js apps, set DEMO_APPLICATION_ORIGIN, DEMO_BUSINESS_ORIGIN and DEMO_COURIER_ORIGIN to the three routed HTTPS origins, then run `node scripts/demo.mjs --mobile` on one isolated host. Route ports 17331, 17333 and 17334 respectively. The admin and API stay local. Build each Android debug app with CAPACITOR_SERVER_URL set to its matching origin and YESPIZZ_ANDROID_DEMO=1 for the customer variant.

Order as a guest with postcode 1010 and a Vienna address. Select **Place demo order** to simulate payment. Sign in to the restaurant with `central@yespizz.demo` and the generated password. Accept the order in **Restaurant operations** and mark it ready. Issue a shift code for `demo-rider`, activate it in the courier app, and dispatch the suggested order. Confirm pickup and delivery in the courier app and check the tracker in the customer app.

The Android demo uses the same APIs over USB. With the demo running and an authorized phone connected, forward ports with `adb reverse tcp:17331 tcp:17331` and `adb reverse tcp:17334 tcp:17334`. Build the courier APK with `npm run android:debug -w courier`. For the customer debug build, set `CAPACITOR_SERVER_URL=http://127.0.0.1:17331` and `YESPIZZ_ANDROID_DEMO=1`, sync Capacitor in `apps/application`, then run `gradlew.bat assembleDebug` in its Android directory. The customer demo uses a separate application ID and can coexist with the installed customer app.

Run `npm install` and `npm run dev` from the repository root to start the Next.js apps and the NestJS API.

| Workspace | Local URL |
| --- | --- |
| application | [localhost:7031](http://localhost:7031) |
| admin | [localhost:7032](http://localhost:7032) |
| business | [localhost:7033](http://localhost:7033) |
| courier | [localhost:7034](http://localhost:7034) |
| api | [localhost:7038](http://localhost:7038) |

Use `npm run dev -w application`, `npm run dev -w admin`, or `npm run dev -w api` to start one app. Run `npm run build`, `npm run lint`, and `npm run check-types` from the root to check the workspace.

Both apps use the shared `@repo/i18n` package. English is the default. Applying a language preference saves a cookie and keeps the current URL. Austrian German uses `de-AT`. Add translated messages under matching feature namespaces in each locale directory in `packages/i18n/src/messages`.

The application loads Inter and the HeroUI theme in its root layout. Its global stylesheet defines the light and dark palettes. Set `data-theme="dark"` on the document element to select dark mode.

### Staff accounts and password recovery

The NestJS API owns authentication, restaurant invitations, and business onboarding. Copy `apps/api/.env.example` to `apps/api/.env` for local development. The admin account is `hamidyeganeh82@gmail.com`. Set `ADMIN_PASSWORD` before first startup or use Forgot password to initialize it by email. Staff and customer account data currently persists in SQLite. Set `ADMIN_DATABASE_PATH`, `BUSINESS_DATABASE_PATH`, and `AUTH_DATABASE_PATH` to point to existing databases when needed.

Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the NestJS environment for invitations, verification, and recovery. Set `ADMIN_AUTH_URL`, `BUSINESS_AUTH_URL`, and `BETTER_AUTH_URL` to the browser-facing app origins. Each Next.js app forwards auth requests to `YESPIZZ_API_URL`, which defaults to `http://localhost:7038`. A hosted deployment needs persistent storage for the account databases.

Open the admin dashboard and select Create restaurant or resend invitation. Invitations last 15 minutes. A successful first sign-in exchanges the invitation for a single-use password setup token. After saving the password the owner signs in normally. Resending an invitation invalidates outstanding codes. Staff password recovery uses a separate emailed code and revokes existing sessions on success.

Run the isolated account-flow tests with Node 24: `node --test packages/staff/store.test.mjs apps/application/src/lib/auth.test.mjs`.

### Checkout and restaurant operations

- In the business panel, open `/dashboard/commerce`. Set the branch hours in Vienna time, add the delivery postcode prefixes, then enable orders. Money fields in the API and records use euro cents. The panel also manages catalog records, promotions, order status, courier assignment, and support tickets.
- Enter gross prices. Checkout displays included tax when the menu items have `taxRate` values and the branch has `deliveryTaxRate` for paid delivery. Rates use basis points, so `1000` represents 10 percent.
- Run the five services on the same host with persistent local storage for SQLite. Set the same absolute `ORDER_DATABASE_PATH` and `BUSINESS_DATABASE_PATH` in the customer, business, admin, courier, and NestJS environments. The API also uses `ADMIN_DATABASE_PATH` and `AUTH_DATABASE_PATH`. Back up the databases using SQLite's backup mechanism.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `BETTER_AUTH_URL` in the customer app environment. Set the same `STRIPE_SECRET_KEY` in the business and admin apps for refunds and Connect. Register the customer app's HTTPS endpoint `/api/v1/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, and `refund.failed`. Enable the desired payment methods in Stripe.
- Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` in the customer app for paid-order receipts. The NestJS process uses those variables for authentication emails. `GOOGLE_PLACES_API_KEY` enables address suggestions. Manual address entry and the existing map remain available.
- If using Stripe Connect, set `STRIPE_CONNECT_ENABLED=1` in the customer and business environments. The restaurant owner completes onboarding in the business panel. A customer payment for the shared catalog is collected by Yespizz. On delivery the winning restaurant receives its transfer, less its configured commission. Set `STRIPE_SECRET_KEY` in both the business and standalone courier environments because either can serve the courier delivery endpoint.
- Set `OSRM_API_URL` in the business environment to calculate a new delivery estimate when an assigned courier shares a location. Orders can also use the estimate entered by the restaurant.
- Restaurant owners can invite staff and change or revoke access in **Team**. Kitchen staff can accept and prepare orders. Dispatch staff issue shift codes and assign ready orders to active couriers. Couriers confirm pickup and delivery in the courier app.
- Published content and active ads with `placement` set to `home` are shown in the customer home feed. Provide a `headline` and a destination path such as `/menu`. Active push templates use an order `event`, `channel` set to `push`, and a `message`.
- For mobile push, configure Firebase for the Android application ID and place `google-services.json` under `apps/application/android/app`. Configure the iOS signing profile and APNs key for `com.yespiz.application`. Provide the `FCM_*` and `APNS_*` variables to the customer and business apps so both payment and staff status updates can send notifications. Use `APNS_PRODUCTION=1` for distribution-signed iOS builds.

### Production release

- Build the workspaces with `npm run build --workspaces --if-present`. Run `npm start -w application`, `npm start -w admin`, `npm start -w business` and `npm start -w courier` for the web apps. Run `npm run start:prod -w api` with `NODE_ENV=production` for the built NestJS service. Configure HTTPS at the reverse proxy and disable proxy buffering for the business orders stream.
- Before accepting real orders, configure the production auth origins and secrets, Stripe webhooks, email domains, menu prices and allergens, and restaurant hours and delivery zones. Run a Stripe test-mode checkout through the hosted HTTPS domain. Verify payment, rejection and reassignment, pickup and delivery, transfer, refund, and account recovery.
- Customer native builds without `CAPACITOR_SERVER_URL` package an offline demo. The courier workspace supports a web build and an Android test APK. Public Android and iOS distribution requires a production mobile integration, store accounts and release signing.
