# Web Deployment & Browser Demonstration Guide

This guide describes how the CommonGround Expo application is exported, hosted, and operated as a browser-accessible web application for hackathon judges and desktop/mobile browser users.

---

## 1. Web Architecture Overview

CommonGround is built with **Expo Router v58** and **React Native for Web** (`react-native-web ~0.21.0`).
- **Single Source of Truth:** The same TypeScript components and state management power both the native iOS/Android apps and the browser application.
- **Client-Side Routing:** Managed by Expo Router with HTML5 History API.
- **Static Export:** Compiled into standalone, pre-bundled static web assets (`apps/mobile/dist/`) via Metro Bundler.
- **Zero Secrets in Web Build:** All network calls flow through the CommonGround FastAPI backend via `EXPO_PUBLIC_API_BASE_URL`.

---

## 2. Generating the Web Export

To produce the static web bundle:

```bash
cd apps/mobile

# Optional: Set the production backend URL for the build
export EXPO_PUBLIC_API_BASE_URL="https://commonground-api.example.com"

# Export static web assets
npx expo export --platform web
```

### Verification Evidence
During the Phase 5 technical review:
```
Web Bundled 11782ms node_modules/expo-router/entry.js (906 modules)
› 39 font and icon assets compiled
› 12 route bundles generated (_layout, index, party, [id], search, discover, negotiate, plan, status)
› Exported to: apps/mobile/dist
```

---

## 3. Web Server & Single-Page Application (SPA) Routing

Because Expo Router uses HTML5 pushState routing (e.g., `/party`, `/negotiate`, `/plan`), any web server hosting `dist/` must rewrite non-asset requests to `index.html`.

### Configuration by Platform

#### Vercel (`apps/mobile/vercel.json`)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Netlify (`apps/mobile/_redirects` in build output)
```text
/*    /index.html   200
```

#### Cloudflare Pages
Create a `_redirects` file in `dist/` with:
```text
/* /index.html 200
```

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name commonground.app;
    root /var/www/commonground/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 4. Deploying to Recommended Hosting Providers

### Option A: Vercel (Recommended)
```bash
cd apps/mobile
npx vercel --prod
```
Set `EXPO_PUBLIC_API_BASE_URL` in the Vercel Project Settings to your deployed backend URL.

### Option B: Netlify
```bash
cd apps/mobile
npx netlify deploy --prod --dir=dist
```

### Option C: GitHub Pages
GitHub Pages can host the static export by copying `dist/` to a `gh-pages` branch with a `404.html` redirecting to `index.html`.

---

## 5. Local Web Preview Verification

To preview the built web application locally:
```bash
# Serve the exported dist folder with any static file server
npx serve apps/mobile/dist -s -l 3000
```
Open `http://localhost:3000` in any desktop or mobile browser.

---

## 6. Current Web Deployment Status

- **Status:** **DEPLOYMENT-READY, PENDING EXTERNAL HOSTING ACCESS.**
- Static web export has been built, bundled (906 modules), and verified locally. Production deployment will be triggered once cloud hosting accounts are connected.

