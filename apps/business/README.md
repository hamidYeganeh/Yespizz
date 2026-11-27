# Yespiz Business Panel

From the repository root, run:

```sh
npm run dev --workspace business
```

Open [the business panel](http://localhost:7033/). Development stores onboarding and account data in `apps/business/.data/business.sqlite`. Set `BUSINESS_DATABASE_PATH` to use a different database.

Production requires `BUSINESS_AUTH_SECRET` and should set `BUSINESS_AUTH_URL` to the deployed panel URL.
