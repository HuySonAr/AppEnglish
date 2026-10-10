# auth-service

## Trạng thái xác minh

**F01 implementation** — account persistence, OTP email verification, password
reset and cookie session lifecycle are implemented.

## Trách nhiệm và nghiệp vụ liên quan

- Register a public Student account.
- Verify email/password credentials.
- Reject disabled accounts.
- Issue short-lived JWT access cookies and rotating refresh cookies.
- Detect refresh-token reuse and revoke the affected family.
- Require email verification before login.
- Support verification resend and forgot/reset password OTP flows.
- Expose the three approved roles: `STUDENT`, `CONTENT_MANAGER`, `ADMIN`.
- Provide a backend `AuthorizationService` for explicit role checks.

No teacher/instructor or excluded product role is defined.

## Data ownership

- Database: `app_identity`.
- Entity: `accounts` through TypeORM `EntitySchema`.
- Migration: `apps/auth-service/src/database/migrations/1710000000000-create-accounts.js`.
- Refresh migration: `apps/auth-service/src/database/migrations/1710000001000-create-refresh-tokens.js`.
- OTP migration: `apps/auth-service/src/database/migrations/1710000002000-add-auth-verification-otp.js`.
- Account audit migration: `apps/auth-service/src/database/migrations/1710000003000-create-account-audits.js`.
- Passwords are stored as scrypt-derived hashes; plaintext passwords are never persisted.

## API/events

Public HTTP routes exist only on the gateway. Each one calls the matching RPC of
`appenglish.auth.v1.AuthService` (`packages/auth-contracts/proto/auth.proto`,
D27); auth-service itself serves no HTTP `/auth/*` route.

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| POST | `/auth/register` | `Register` | Create a Student account; a `PENDING_VERIFICATION` email resumes with `ADDITIONAL` + `nextAction: VERIFY_EMAIL` (no duplicate account, no password change, no auto OTP); an `ACTIVE` email gets `AUTH_EMAIL_ALREADY_REGISTERED` |
| POST | `/auth/login` | `Login` | Verify credentials and return the principal; a `PENDING_VERIFICATION` account with correct credentials gets 403 `AUTH_EMAIL_NOT_VERIFIED` + `nextAction: VERIFY_EMAIL`, wrong credentials stay `AUTH_INVALID_CREDENTIALS` |
| POST | `/auth/verify-email` | `VerifyEmail` | Verify email OTP and create a session; DISABLED/SUSPENDED accounts are rejected with 403 and never re-activated; an already ACTIVE email returns `nextAction: LOGIN` without a session; used OTP challenges (`usedAt` set) are rejected |
| POST | `/auth/resend-verification` | `ResendVerification` | Issue a replacement verification OTP; never creates a session (an ACTIVE account gets `nextAction: LOGIN` without cookies) |
| POST | `/auth/refresh` | `Refresh` | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | `Logout` | Revoke refresh-token family and clear cookies |
| GET | `/auth/me` | `Me` | Validate access cookie and return current account |
| POST | `/auth/forgot-password` | `ForgotPassword` | Start password reset without email enumeration |
| POST | `/auth/reset-password` | `ResetPassword` | Verify reset OTP and revoke sessions |
| GET | `/auth/admin/accounts` | `AdminListAccounts` | ADMIN-only account list with email/role/status filters and pagination |
| GET | `/auth/admin/accounts/:id` | `AdminGetAccount` | ADMIN-only safe account detail |
| PATCH | `/auth/admin/accounts/:id` | `AdminUpdateAccount` | ADMIN-only role/status update; invalidates sessions and writes audit |

Registration accepts `{ email, password }`, creates `PENDING_VERIFICATION`, and
sends a six-digit OTP. A public request cannot select `CONTENT_MANAGER` or
`ADMIN`. OTPs expire after five minutes, allow five attempts, and resend is
limited to once per minute and five per hour per account/purpose. Controllers
relay service envelopes without re-wrapping, so `ADDITIONAL` responses keep
`data.nextAction` at the top level; login keeps the service's `setCookies` and
emits them as HttpOnly `Set-Cookie` headers.

All API responses use the shared envelope `{ code, msg, data }`; `data` is always
an object. `SUCCESS=0`, `ADDITIONAL=1`, and failures use the numeric auth codes
from `@appenglish/auth-contracts`. Successful login/me returns:

```json
{
  "account": { "id": "...", "email": "...", "role": "STUDENT", "status": "ACTIVE", "createdAt": "..." },
  "authenticated": true,
  "authentication": "session"
}
```

Tokens are never in the JSON body. They are HttpOnly, SameSite=Lax cookies.
Error responses use the same envelope and never expose password hashes, OTPs,
raw tokens or secrets. OTP verification and password reset use
`AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_ATTEMPTS_EXCEEDED` and
`AUTH_EMAIL_NOT_VERIFIED`.

Admin account APIs re-validate the access session and `ADMIN` role on every
request. They return only identity metadata and `emailVerifiedAt`; passwords,
OTP/session data and tokens are never returned. Status updates accept only
`ACTIVE`, `DISABLED`, or `SUSPENDED`; a `PENDING_VERIFICATION` account cannot be
activated by an administrator. Role/status changes increment `sessionVersion`,
revoke refresh sessions, and append an audit row containing actor, target,
before/after values, and timestamp. The last active administrator cannot be
demoted or disabled.

Admin list queries omit optional role/status filters when requesting all accounts.
Explicit empty strings and unknown enums are rejected by `adminAccountQuerySchema`.
`AuthController.adminList()` maps these validation errors to HTTP 400 with
`{ code: 30, msg: 'fail', data: { issues } }`. The web client's
`adminAccountListParams()` removes empty UI filter values before Axios serializes
the query. This does not normalize or repair persisted account statuses.

`test/gateway-grpc.test.js` exercises the real gateway HTTP server, gRPC
transport, `AuthGrpcController` and `AuthController` handlers: query
preservation, empty/omitted/invalid filters, account response validation, role
rejection, admin detail/update errors, login/logout cookie relay, body
validation, readiness and the 503 envelope when auth-service is unreachable. Session lookup and the repository use fixtures; this test does not
connect to PostgreSQL or establish the migration state of a running environment.

### 2026-10-10 error-contract fixes (D26)

- Every `AuthController` handler, including `adminGet` and `adminUpdate`, maps
  `AuthError` and Zod errors through `normalizeError()`. Admin detail/update now
  return 401/403/404/409 and 400 validation envelopes instead of an unhandled 500.
- `POST /auth/resend-verification` validates its body with
  `resendVerificationSchema`; a missing or malformed email returns 400 code 30.
- Role rejection uses numeric `AUTH_FORBIDDEN_ROLE` (26) with HTTP 403; the
  former string code `FORBIDDEN_ROLE` is removed. `AUTH_EMAIL_VERIFICATION_REQUIRED`
  (25) and `NextAction.RESET_PASSWORD` are now declared in
  `@appenglish/auth-contracts`.
- `verify-email` and `reset-password` answer an unknown email with
  `AUTH_OTP_INVALID` (400), the same as a wrong code, so they no longer reveal
  which emails are registered. `AUTH_NOT_FOUND` (404) remains for `me`, refresh
  and admin lookups by id.
- Gateway-originated failures (auth-service unreachable, empty or non-JSON
  upstream body) use `{ code: 32, msg: 'fail', data: { message } }`.
- The web client refreshes the session through one shared Axios interceptor
  (`apps/web-client/src/lib/api/session-refresh.js`): any 401 outside the
  session-creating routes triggers a single `/auth/refresh` and one replay.
  Concurrent 401s share that refresh so token rotation is not mistaken for reuse.

For a first administrator, set `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` only in the local environment and run
`pnpm --filter @appenglish/auth-service admin:bootstrap` once after migrations.
The command is idempotent, never logs the password, and public registration
cannot create an administrator.

## Dependencies/config

- `POSTGRES_*` and `AUTH_DATABASE_NAME` in `.env.example`.
- Gateway calls auth-service at `AUTH_GRPC_HOST`:`AUTH_GRPC_PORT` (default
  `localhost:50051`). `AUTH_SERVICE_PORT` is only the auth-service HTTP health port.
- `AUTH_JWT_SECRET`, `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL`,
  `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_PATH`.
- `AUTH_OTP_SECRET` and backend-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- No direct database access is added to the gateway or web client.

## Kiểm thử

- `apps/auth-service/test/auth.service.test.js`: registration, pending
  registration resume (no duplicate account/password change/OTP), active-email
  rejection, invalid vs unverified credentials, disabled/suspended login and
  OTP rejection, OTP wrong/expired/single-use handling, already-verified
  verify-email guidance, resend without session creation, resend rate limit,
  password hashing and role authorization.
- `apps/auth-service/test/auth.controller.test.js`: single additional envelope
  (no double wrap), login Set-Cookie relay, 403 `VERIFY_EMAIL` guidance and
  `LOGIN` guidance for verified accounts at the HTTP-shaping layer.
- Web client `src/features/auth/flow/auth-flow.test.js`: envelope unwrapping,
  single verify-OTP outcome, OTP vs session-load error separation, verify-email
  redirect detection, register next-screen decision, role-based route mapping
  and guard behavior.
- `apps/auth-service/test/auth.controller.test.js` also covers the 400 envelope
  for a missing resend email and admin detail/update error mapping (403/409/400);
  `auth.service.test.js` covers the non-enumerating unknown-email answer.
- Web client `src/lib/api/session-refresh.test.js`: single refresh + replay on
  401, shared refresh for concurrent 401s, no loop when refresh fails, no refresh
  for session-creating routes.
- The twelve routes in the table above are registered in
  `apps/api-gateway/src/auth/auth-gateway.controller.js`; their RPC handlers are
  in `apps/auth-service/src/auth/auth.grpc.controller.js`, which delegates to the
  transport-agnostic handlers in `auth.controller.js`.

## Readiness

`GET /health` is liveness only. `GET /health/ready` on the gateway calls the `Ready` RPC, which executes `SELECT 1`
against `app_identity`. SMTP is configured only with backend `SMTP_*` variables;
real email delivery requires user-provided SMTP credentials.

## gRPC transport notes (D27)

- The gateway parses the `appenglish_access`/`appenglish_refresh` cookies and
  sends them as `access_token`/`refresh_token`; auth-service returns the
  `Set-Cookie` values in `AuthReply.set_cookies` and the gateway emits them
  unchanged.
- The gateway copies known JSON body fields into the typed request message;
  unknown body fields are dropped instead of being rejected, and non-string
  values are stringified before Zod validation in auth-service.
- A gRPC transport failure becomes `{ code: 32, msg: 'fail', data: { message } }`
  with 503 (unreachable/deadline) or 500. During startup the gateway answers 503
  until the auth-service gRPC port is listening.
