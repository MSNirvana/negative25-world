# negative25

> Don't just dream it, live it. Find your negative 25.

negative25 is a self-hostable, multi-user photography archive. It keeps the image and the evidence around it together: camera, focal length, aperture, shutter speed, ISO, capture time, elevation, coordinates, and place context.

Live product: https://n25.world/

## Highlights

- Featured, recent, random, region and masonry gallery views
- World-map discovery with clustered photo locations
- Albums with cover stacks, expansion, and shoot dates
- EXIF-aware imports with focal length, aperture, shutter, ISO and GPS metadata
- Seven-star ratings and photo detail panels
- User registration, public profiles, user search, and per-photo visibility
- Admin import batches, EXIF processing, bulk metadata actions, review and deletion
- Batch and chunked uploads for large libraries
- PostgreSQL metadata, Redis/BullMQ jobs, and S3-compatible object storage
- MinIO for self-hosting with a migration path to Cloudflare R2
- Responsive desktop, mobile and PWA layouts

## Quick start

Requirements: Node.js 22+, pnpm 11+, and Docker Desktop.

    pnpm install
    cp .env.example .env
    docker compose up -d
    pnpm db:migrate
    pnpm dev

The web app runs on http://localhost:5173 and the API on http://localhost:3000. Use N25_USE_DATABASE=0 for the in-memory demo adapter.

## Architecture

The Vue/Vite web app calls the Fastify API. PostgreSQL stores users, photo metadata, albums, locations and visibility state. Redis/BullMQ schedules imports. The Worker reads EXIF, creates Sharp variants, and persists objects to MinIO, S3 or R2. Original uploads remain private; public pages serve controlled preview variants.

See the Chinese guide in the root README, the deployment notes in infra/README.md, and the product tour in docs/DEMO.md.

## Configuration and security

Use .env.example and infra/production.env.example as templates. Never commit real JWT secrets, database passwords, storage credentials, map keys, tokens, presigned URLs, or user photos. Keep PostgreSQL, Redis and the MinIO console private in production.

## Tests

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm test:e2e
    pnpm test:visual

## License

MIT. The software license does not relicense photographs, logos, user content, map credentials or third-party services.
