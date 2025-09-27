Bukia HFT — README

Table of Contents

- Architectural overview
- Concurrency & retry strategy
- Idempotency design
- Why BullMQ
- Security: password hashing, JWTs, OTPs, and account lockouts
- Running the app (quick start)
- Environment variables
- Developer commands
- Tests, linting, and typechecking
- Useful internals & places to look

Architectural overview

Bukia HFT is a small service-oriented TypeScript application built on Express + TypeORM with Postgres for persistence and Redis for ephemeral state and background processing. The codebase separates concerns into controllers, services, repositories, workers, and models.

Key components

- API server (src/index.ts) — exposes REST endpoints and Swagger docs
- Services (src/services) — business logic (auth, transfer, email, analytics, etc.)
- Repositories (src/repositories) — TypeORM repository extensions that encapsulate DB access
- Workers (src/workers) — BullMQ workers for background jobs (transfer processing, email, audit log)
- Redis layer (src/services/redis.services.ts) — single Redis client configured and duplicated for connections
- Idempotency model (src/models/idempotency.ts + repositories/services) — durable idempotency records in Postgres

Concurrency & retry strategy — design choices

Background processing

- BullMQ is used as the queue and worker framework. Jobs are enqueued from the API and processed by dedicated worker processes (src/workers/\*). This decouples user-facing request latency from long-running work and improves resilience.

Worker concurrency

- Worker concurrency is configured via the environment variable WORKER_CONCURRENCY and applied to BullMQ Worker creation (src/workers/transfer.worker.ts). This allows the number of concurrently processed jobs per worker process to be tuned independently of the number of worker processes.

Optimistic concurrency on wallets

- Wallet balance updates use an optimistic concurrency model driven by a version column on wallets (src/models/wallet.ts and src/repositories/wallet.repository.ts). During a transfer the code increments wallet.version using a conditional UPDATE where id and version match; if the update affects 0 rows the operation is retried using an exponential backoff. This avoids heavyweight DB locks while still ensuring correctness under concurrent transfers.

Retry/backoff

- There are two retry layers:
  1. BullMQ job attempts and exponential backoff (configured when enqueuing jobs in TransferServices.addTransferJob)
  2. Optimistic retries inside TransferServices.process which attempt the DB transaction multiple times with exponential backoff when optimistic conflicts occur (TRANSFER_OPTIMISTIC_RETRIES, TRANSFER_BACKOFF_MS)

Idempotency — how it's modelled and why

Durable idempotency records

- A dedicated idempotency table (src/models/idempotency.ts) stores keys and statuses (pending, processing, completed, failed) and an optional JSON response. Records are created when a transfer is first requested and updated as processing proceeds.

Why durable idempotency?

- Network retries or duplicate client requests must not result in duplicate money movements. Storing idempotency state in the primary database guarantees the canonical single source of truth across restarts and across multiple worker instances.

Workflow

- When a transfer request with an idempotencyKey arrives the system:
  - Checks the idempotency record. If completed: rejects or returns the stored response. If processing: rejects to avoid duplicate concurrent processing. If none: creates a pending record.
  - A worker picks the job and marks the idempotency record as processing via a conditional update. If marking fails (someone else processed it) the worker reconciles by querying transfer/ledger tables.
  - During DB transaction the system creates ledger entries and a transfer record with the idempotencyKey. Unique indexes on ledger/transfer idempotency keys (migrations) enforce uniqueness at DB level.
  - On success the idempotency record is marked completed with the saved response. On failure it is marked failed with the error message.

Duplicate key detection & reconciliation

- The code detects duplicate key DB errors (Postgres error code 23505 or message string match) and will try to reconcile by looking up existing transfer or ledger entries for that idempotencyKey. This allows safe recovery when a previous attempt succeeded but the in-memory path thinks it failed.

Why this idempotency approach

- Combining an application-level idempotency table with DB-level uniqueness provides both fast rejection of duplicates and a final safety-net in the DB. The approach is resilient to process crashes, multi-instance deployment, and retries coming from clients or the queue system.

Why BullMQ

- Robustness: BullMQ (backed by Redis) supports retries, delayed jobs, job attempts, backoff strategies and visibility into failed/completed jobs.
- Scalability: multiple worker processes and machines can consume from the same queue, and BullMQ uses Redis for coordination.
- Observability & features: job lifecycle events are emitted and used for audit logging, email notifications and marking idempotency state on failures.

Security features

Password hashing

- Passwords are hashed using bcrypt with a per-password salt (src/models/user.ts: hashPassword and validatePassword). bcrypt is industry-standard for password hashing; the code uses bcrypt.genSalt(10) and bcrypt.hash.

Account lockouts and rate-limiting

- Login attempts are protected with a lockout decorator (src/utils/lockout.ts) that uses Redis and a Lua script to atomically count failures and set timed locks. Configurable thresholds and lock durations are used (defaults: threshold 5, lockSeconds 900).
- There is also a RateLimitByKey decorator applied to OTP endpoints to prevent abuse (src/services/auth.services.ts).

OTP & password reset

- OTPs are generated, hashed, and stored in Redis (src/services/auth.services.ts). Only the hashed OTP is stored, and TTL is enforced (OTP_TTL_SEC). A separate redis key marks verified OTPs for password reset flows.

JWT & logout

- JWT tokens are signed with a secret. A jwtVersion field on the user is incremented on logout which invalidates previously issued tokens for that user; token validation checks jwtVersion.

Other security considerations

- Sensitive operations are checked for authorization (isAuthorized decorator and role checks). Email templates avoid including secrets.

Running the application (Quick start)

Prerequisites

- Node 18+ (as appropriate for TypeScript/modern packages)
- PostgreSQL
- Redis
- (Optional) AWS SES credentials if using SES for emails

1. Install

npm ci

2. Copy .env.example to .env and fill in required variables (see next section).

3. Run DB migrations

npm run migrate

4. Run server and worker in development

# start the API server (local dev watcher)

npm run dev

# start worker process (separate terminal)

npm run worker

In production

- Build then run:
  npm run build
  npm run prod
- Run migrations against built artifacts (see package.json migrate:prod)

Environment variables (important ones)

- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME — Postgres connection
- REDIS_HOST, REDIS_PORT, REDIS_USER, REDIS_PASSWORD — Redis connection used by BullMQ and lockout
- APP_SECRET — JWT signing secret
- ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY — JWT expirations
- WORKER_CONCURRENCY — number of concurrent jobs each worker will process
- TRANSFER_RETRY_LIMIT, TRANSFER_BACKOFF_MS, TRANSFER_OPTIMISTIC_RETRIES — transfer retry configuration
- OTP_TTL_SEC — OTP TTL in seconds
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, EMAIL_FROM — for SES/email

Developer commands

- npm run dev — run API locally (ts-node-dev)
- npm run worker — run worker process
- npm run test — run Jest tests
- npm run build — compile TypeScript and run build script
- npm run check-lint — eslint + fix
- npm run check-format — prettier check
- npx tsc --noEmit — typecheck
- npm run migrate — run TypeORM migrations

Tests, linting, and typechecking

- Tests are under src/tests and use Jest and ts-jest. Mocks for Redis and pino are provided in src/tests/**mocks**.
- Run tests with npm run test. Use npx jest <path> -i to run a single test file.
- Run ESLint and Prettier with npm run check-lint and npm run check-format.
- Typecheck using npx tsc --noEmit (recommended to add as an npm script if needed).

Useful internals & places to look

- Transfers and idempotency: src/services/transfer.services.ts, src/workers/transfer.worker.ts, src/models/idempotency.ts, src/repositories/ledger.repository.ts
- Lockout logic: src/utils/lockout.ts and lockoutlua.ts
- Redis client: src/services/redis.services.ts
- Email queue & worker: src/services/email.services.ts, src/workers/email.worker.ts
- Tests: src/tests (unit tests for services and controllers)

Contact

- Repository author: chukssomzzy <chukssomzzy@gmail.com>
