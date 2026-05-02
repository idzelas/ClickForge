# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (Replit-managed, `@clerk/react` frontend + `@clerk/express` backend)
- **3D**: Three.js + @react-three/fiber + @react-three/drei

## Artifacts

### SVG Fidget Clicker (`artifacts/fidget-toy`) — preview `/`
A web app where users upload an SVG and generate a 3D printable fidget clicker toy.
- Landing page (public), Studio (3D editor), Projects gallery
- SVG parsed with Three.js SVGLoader → extruded into two pieces: outer shell + inner clicker
- Export as STL (`STLExporter`) or 3MF (JSZip XML)
- Saved projects stored in PostgreSQL

### API Server (`artifacts/api-server`) — `/api`
Express 5 backend with Clerk auth middleware.
- Routes: `/api/projects` CRUD, `/api/projects/stats`, `/api/healthz`
- Clerk proxy at `/api/__clerk`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Schema

- `projects` table: id, userId, name, svgData, extrudeDepth, keycapSize, pegRadius, exportCount, createdAt, updatedAt

## Key Libraries (fidget-toy frontend)

- `@react-three/fiber` + `@react-three/drei` — 3D canvas
- `three` — Three.js (SVGLoader, ExtrudeGeometry, STLExporter)
- `jszip` — 3MF export packaging
- `@clerk/react` + `@clerk/themes` — authentication

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
