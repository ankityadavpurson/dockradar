# DockRadar landing page

Standalone marketing site for DockRadar. It uses the same stack and theme as the
dashboard in `../frontend` (React, Tailwind, [xedonium](https://www.npmjs.com/package/xedonium),
the navy dark theme and the emerald/sky brand palette) but is a separate project —
it is not served by the backend and is not part of the Docker image.

```bash
cd landing
yarn install
yarn dev      # http://localhost:5174
yarn build    # static site in landing/dist
```

The build uses a relative base (`./`), so `dist/` can be hosted anywhere: GitHub
Pages, Netlify, Vercel, or any static file server.

## Deploy to Firebase Hosting

`firebase.json` serves `dist/` (hashed assets cached for a year, HTML never
cached) and `.firebaserc` names the project.

1. Create a project with ID `dockradar` in the [Firebase console](https://console.firebase.google.com)
   and enable **Hosting**. (The ID is set in `.firebaserc`; change it there if you use a different project.)
2. Manual deploy:

   ```bash
   cd landing
   yarn build
   npx firebase-tools login
   npx firebase-tools deploy --only hosting
   ```

3. Automatic deploys: the `deploy-landing` job in `.github/workflows/pipeline.yml`
   publishes the site on every push to `main`, as one stage of a single pipeline:
   tests (`ci.yml`, which also builds the landing page) → Docker image → deploy
   landing → release.
   Add the `FIREBASE_SERVICE_ACCOUNT_DOCKRADAR` repository secret first  - the easiest way is
   `npx firebase-tools init hosting:github` inside `landing/`, which creates the
   service account and the secret for you (answer **no** when it offers to
   overwrite `firebase.json` or write workflow files; this repo already has them).

For a custom domain, add it under Hosting → Add custom domain in the console.

## Where things live

| What | Where |
| --- | --- |
| Sections (hero, features, how it works, install, security, FAQ) | `src/sections/` |
| Interactive demo table in the hero (sample data only) | `src/sections/MockDashboard.jsx` |
| External links (GitHub, Docker Hub, …) | `src/links.js` |
| Brand assets (copied from `frontend/assets`) | `assets/` |

The install commands and feature copy mirror the root `README.md`  - update both
together when behavior changes.
