# auth-service

## Trạng thái xác minh

**F01 REVIEW** — account persistence and credential verification are implemented.
Transport authentication is blocked by the unresolved session/token policy.

## Trách nhiệm và nghiệp vụ liên quan

- Register a public Student account.
- Verify email/password credentials.
- Reject disabled accounts.
- Expose the three approved roles: `STUDENT`, `CONTENT_MANAGER`, `ADMIN`.
- Provide a backend `AuthorizationService` for explicit role checks.

No teacher/instructor or excluded product role is defined.

## Data ownership

- Database: `app_identity`.
- Entity: `accounts` through TypeORM `EntitySchema`.
- Migration: `apps/auth-service/src/database/migrations/1710000000000-create-accounts.js`.
- Passwords are stored as scrypt-derived hashes; plaintext passwords are never persisted.

## API/events

Public routes are exposed through the gateway:

| Method | Gateway route | Auth service route | Purpose |
|---|---|---|---|
| POST | `/auth/register` | `/auth/register` | Create a Student account |
| POST | `/auth/login` | `/auth/login` | Verify credentials and return the principal |

Registration accepts `{ email, password }`. A public request cannot select
`CONTENT_MANAGER` or `ADMIN`; privileged account provisioning is intentionally not
implemented in F01.

Successful login currently returns:

```json
{
  "account": { "id": "...", "email": "...", "role": "STUDENT", "status": "ACTIVE", "createdAt": "..." },
  "authenticated": true,
  "authentication": "credential_verified"
}
```

This is not a session, JWT, refresh token or cookie. Error responses use
`code`, `message`, and optional `issues`; relevant codes include
`VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`,
`EMAIL_ALREADY_REGISTERED`, and `AUTH_SERVICE_UNAVAILABLE`.

## Dependencies/config

- `POSTGRES_*` and `AUTH_DATABASE_NAME` in `.env.example`.
- Gateway forwards to `AUTH_SERVICE_PORT`.
- No direct database access is added to the gateway or web client.

## Kiểm thử

- `apps/auth-service/test/auth.service.test.js`: registration, duplicate account,
  invalid credentials, disabled account, password hashing and role authorization.
- Gateway and auth service bootstrap logs confirm `/auth/register` and
  `/auth/login` routes.

## Blocked decisions

The following remain TBD in `docs/00-overview/decisions.md` and block a complete
authenticated request lifecycle:

- session versus JWT;
- refresh token behavior;
- cookie/CSRF settings;
- token/session TTL and revocation;
- OTP/OAuth/email verification/reset password;
- rate limiting.

Until these are decided, F01 must remain REVIEW and must not claim protected
request authorization is active at the HTTP boundary.
