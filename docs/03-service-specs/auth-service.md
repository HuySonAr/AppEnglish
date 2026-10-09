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
- Passwords are stored as scrypt-derived hashes; plaintext passwords are never persisted.

## API/events

Public routes are exposed through the gateway:

| Method | Gateway route | Auth service route | Purpose |
|---|---|---|---|
| POST | `/auth/register` | `/auth/register` | Create a Student account |
| POST | `/auth/login` | `/auth/login` | Verify credentials and return the principal |
| POST | `/auth/verify-email` | `/auth/verify-email` | Verify email OTP and create a session; DISABLED/SUSPENDED accounts are rejected with 403 and never re-activated |
| POST | `/auth/resend-verification` | `/auth/resend-verification` | Issue a replacement verification OTP; never creates a session (an ACTIVE account gets `nextAction: LOGIN` without cookies) |
| POST | `/auth/refresh` | `/auth/refresh` | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | `/auth/logout` | Revoke refresh-token family and clear cookies |
| GET | `/auth/me` | `/auth/me` | Validate access cookie and return current account |
| POST | `/auth/forgot-password` | `/auth/forgot-password` | Start password reset without email enumeration |
| POST | `/auth/reset-password` | `/auth/reset-password` | Verify reset OTP and revoke sessions |

Registration accepts `{ email, password }`, creates `PENDING_VERIFICATION`, and
sends a six-digit OTP. A public request cannot select `CONTENT_MANAGER` or
`ADMIN`. OTPs expire after five minutes, allow five attempts, and resend is
limited to once per minute and five per hour per account/purpose.

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

## Dependencies/config

- `POSTGRES_*` and `AUTH_DATABASE_NAME` in `.env.example`.
- Gateway forwards to `AUTH_SERVICE_PORT`.
- `AUTH_JWT_SECRET`, `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL`,
  `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_PATH`.
- `AUTH_OTP_SECRET` and backend-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- No direct database access is added to the gateway or web client.

## Kiểm thử

- `apps/auth-service/test/auth.service.test.js`: registration, duplicate account,
  invalid credentials, disabled/suspended login and OTP rejection, OTP
  wrong/expired/used handling, resend without session creation, password
  hashing and role authorization.
- Web client `src/features/auth/flow/auth-flow.test.js`: envelope unwrapping,
  single verify-OTP outcome, OTP vs session-load error separation, role-based
  route mapping and guard behavior.
- Gateway and auth service bootstrap logs confirm all five auth routes and cookie
  relay.

## Readiness

`GET /health` is liveness only. `GET /health/ready` is gateway-proxied to auth-service and executes `SELECT 1`
against `app_identity`. SMTP is configured only with backend `SMTP_*` variables;
real email delivery requires user-provided SMTP credentials.
