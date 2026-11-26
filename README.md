# Yespiz

Run `npm install` and `npm run dev` from the repository root to start both Next.js apps.

| Workspace | Local URL |
| --- | --- |
| application | [localhost:7031](http://localhost:7031) |
| admin | [localhost:7032](http://localhost:7032) |

Use `npm run dev -w application` or `npm run dev -w admin` to start one app. Run `npm run build`, `npm run lint`, and `npm run check-types` from the root to check the workspace.

Both apps use the shared `@repo/i18n` package. English is the default. Applying a language preference saves a cookie and keeps the current URL. Dutch uses the Austrian regional locale (`nl-AT`). Add translated messages under matching feature namespaces in each locale directory in `packages/i18n/src/messages`.

The application loads Inter and the HeroUI theme in its root layout. Its global stylesheet defines the light and dark palettes. Set `data-theme="dark"` on the document element to select dark mode.
