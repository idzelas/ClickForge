# Threat Model

## Project Overview

This project is a pnpm monorepo for a web application that lets users upload or create SVG-based designs, preview them as 3D fidget toys, export printable model files, and save projects to a personal account. The production stack is a React + Vite frontend (`artifacts/fidget-toy`) backed by an Express 5 API (`artifacts/api-server`) and PostgreSQL via Drizzle. Authentication is handled by Clerk, with a production-only Clerk proxy mounted at `/api/__clerk`.

Production scope for this scan excludes `artifacts/mockup-sandbox` unless production reachability is demonstrated. Replit deployment provides TLS in production, and `NODE_ENV` can be assumed to be `production` there.

## Assets

- **User accounts and sessions** -- Clerk-authenticated sessions and any bearer tokens or session cookies associated with the signed-in user. Compromise would let an attacker act as the victim and access saved projects and account-linked features.
- **User-created project data** -- saved SVGs, project settings, export counts, and names stored in PostgreSQL. This is core user content and crosses the browser/API/database trust boundaries.
- **Saved SVG design library** -- reusable SVG assets users store and later reopen in Studio. Because SVG is active content in browsers, stored designs must be treated as potentially hostile input.
- **Application secrets** -- Clerk secret key, database connection data, and any future billing credentials. Exposure could compromise authentication or backend integrity.
- **Service availability** -- the API and browser-facing Studio experience. Large or malformed user-controlled SVG/settings payloads can threaten availability if parsing or persistence is unbounded.

## Trust Boundaries

- **Browser to API** -- all client requests to `/api` cross from an untrusted browser into trusted backend code. Every protected route must authenticate and authorize server-side; the client cannot be trusted.
- **API to PostgreSQL** -- the API writes and reads raw project SVG and settings from the database. Validation failures here can become persistent stored-content vulnerabilities.
- **App to Clerk services** -- authentication depends on Clerk middleware plus the `/api/__clerk` proxy in production. Host/header handling and token validation must not permit spoofing or auth confusion.
- **Public to authenticated features** -- `/studio` supports guest usage, while saved projects, library access, and user preferences are authenticated features. Server-side enforcement must match the UI boundary.
- **Production to dev-only artifacts** -- `artifacts/mockup-sandbox` is treated as non-production and should usually be ignored unless a route or deployment config exposes it.

## Scan Anchors

- Production frontend entry: `artifacts/fidget-toy/src/main.tsx`, `artifacts/fidget-toy/src/App.tsx`
- Production API entry: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`
- Highest-risk areas: `artifacts/api-server/src/routes/projects.ts`, `artifacts/api-server/src/routes/svgDesigns.ts`, `artifacts/fidget-toy/src/pages/Projects.tsx`, `artifacts/fidget-toy/src/pages/Studio.tsx`, `artifacts/fidget-toy/src/lib/svgParser.ts`
- Public surface: `/`, `/studio`, Clerk sign-in/up flows, `/api/healthz`
- Authenticated surface: `/projects`, `/library`, `/studio/:id`, `/api/projects*`, `/api/svg-designs*`, `/api/user/preferences`
- Dev-only area usually out of scope: `artifacts/mockup-sandbox`

## Threat Categories

### Spoofing

The application relies on Clerk sessions to identify users. All API endpoints that access or mutate user data MUST require a valid authenticated Clerk session and MUST derive the acting user from trusted server-side auth state rather than client-supplied identifiers. Clerk proxy host handling MUST not let attacker-controlled headers confuse which frontend API host or proxy URL is used in production.

### Tampering

Users can upload and save arbitrary SVG content plus JSON settings blobs. The backend MUST validate and constrain this content before persisting it, and the frontend MUST not trust persisted SVG as safe DOM. Business and feature-tier decisions that matter for persistence or export access MUST be enforced server-side, not just by React UI controls.

### Information Disclosure

Saved projects and preferences are private per user and MUST always be scoped by server-side `userId` checks. Error responses and logs MUST not leak secrets, raw tokens, or internal stack traces. Any browser rendering of stored SVG or other active markup MUST prevent script execution because arbitrary JavaScript in the app origin can exfiltrate user data and perform authenticated actions.

### Denial of Service

The service accepts complex user-controlled SVG and settings payloads that feed expensive parsing and geometry generation logic. Request bodies, stored fields, and high-cost parsing paths MUST have size and complexity limits appropriate for production, especially on authenticated save/update endpoints that persist data to PostgreSQL or trigger repeated heavy processing.

### Elevation of Privilege

Every project, SVG design, and preference operation MUST enforce ownership server-side. The app MUST prevent stored-content or script injection bugs that would let a lower-privileged attacker execute JavaScript in another user's authenticated session. Database access MUST continue to use structured Drizzle queries rather than string-built SQL.
