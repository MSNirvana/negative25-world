# Production deployment

Deploy the Web app, Fastify API, and Worker independently. Use managed PostgreSQL and Redis, and keep original uploads in a private S3/R2 bucket. Only generated preview variants should be served through `S3_PUBLIC_BASE_URL` or a CDN. For local Docker development, `minio-init` applies the same policy automatically: `thumbnail.jpg`, `preview.jpg`, and `large.jpg` are readable anonymously, while `uploads/` remains private.

The negative25 API publishes import jobs when `N25_IMPORT_QUEUE=1`. Run the Worker with `RUN_WORKER=1` and `N25_USE_DATABASE=1` so it uses the same PostgreSQL database as the API. The import pipeline is: browser upload -> API batch preview/confirm -> BullMQ -> Worker EXIF/Sharp processing -> private original plus public variants -> PostgreSQL batch completion.

Set the variables in `production.env.example` through the deployment secret manager, including `N25_USE_DATABASE=1` so the API uses PostgreSQL instead of its development memory adapter. The public origin is `https://n25.world`; rotate JWT secrets and storage keys without committing them. Run `pnpm db:migrate` before deploying an API version that requires a new schema, then verify `/health`, `/api/v1/health`, public space reads, upload URL creation, and one preview URL.

Back up PostgreSQL and the object store separately. Keep the previous Web/API/Worker release available for rollback; never delete originals as part of a failed variant job.
