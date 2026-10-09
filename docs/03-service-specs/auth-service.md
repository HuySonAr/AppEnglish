# auth-service

## Trạng thái xác minh

**F01 implementation** — account persistence, credential verification and cookie
session lifecycle are implemented.

## Trách nhiệm và nghiệp vụ liên quan

- Register a public Student account.
- Verify email/password credentials.
- Reject disabled accounts.
- Issue short-lived JWT access cookies and rotating refresh cookies.
- Detect refresh-token reuse and revoke the affected family.
- Expose the three approved roles: `STUDENT`, `CONTENT_MANAGER`, `ADMIN`.
- Provide a backend `AuthorizationService` for explicit role checks.

No teacher/instructor or excluded product role is defined.

## Data ownership

- Database: `app_identity`.
- Entity: `accounts` through TypeORM `EntitySchema`.
- Migration: `apps/auth-service/src/database/migrations/1710000000000-create-accounts.js`.
- Refresh migration: `apps/auth-service/src/database/migrations/1710000001000-create-refresh-tokens.js`.
- Passwords are stored as scrypt-derived hashes; plaintext passwords are never persisted.

## API/events

Public routes are exposed through the gateway:

| Method | Gateway route | Auth service route | Purpose |
|---|---|---|---|
| POST | `/auth/register` | `/auth/register` | Create a Student account |
| POST | `/auth/login` | `/auth/login` | Verify credentials and return the principal |
| POST | `/auth/refresh` | `/auth/refresh` | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | `/auth/logout` | Revoke refresh-token family and clear cookies |
| GET | `/auth/me` | `/auth/me` | Validate access cookie and return current account |

Registration accepts `{ email, password }`. A public request cannot select
`CONTENT_MANAGER` or `ADMIN`; privileged account provisioning is intentionally not
implemented in F01.

Successful register/login/me returns:

```json
{
  "account": { "id": "...", "email": "...", "role": "STUDENT", "status": "ACTIVE", "createdAt": "..." },
  "authenticated": true,
  "authentication": "session"
}
```

Tokens are never in the JSON body. They are HttpOnly, SameSite=Lax cookies.
Error responses use
`code`, `message`, and optional `issues`; relevant codes include
`VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`,
`EMAIL_ALREADY_REGISTERED`, and `AUTH_SERVICE_UNAVAILABLE`.

## Dependencies/config

- `POSTGRES_*` and `AUTH_DATABASE_NAME` in `.env.example`.
- Gateway forwards to `AUTH_SERVICE_PORT`.
- `AUTH_JWT_SECRET`, `AUTH_ACCESS_TTL`, `AUTH_REFRESH_TTL`,
  `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_PATH`.
- No direct database access is added to the gateway or web client.

## Kiểm thử

- `apps/auth-service/test/auth.service.test.js`: registration, duplicate account,
  invalid credentials, disabled account, password hashing and role authorization.
- Gateway and auth service bootstrap logs confirm all five auth routes and cookie
  relay.

## Readiness

`GET /health` is liveness only. `GET /health/ready` is gateway-proxied to
auth-service and executes `SELECT 1` against `app_identity`.
