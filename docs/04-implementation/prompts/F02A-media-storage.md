# F02A — Media storage foundation

## Goal

Create a reusable media-storage boundary for `content-service` before F02/F09
adds content management. Support local development/test storage and ImageKit
Free through the official server-side Node SDK.

## In scope

- Validate future MP3 audio and JPEG/PNG/WebP question-image uploads.
- Keep local files outside build output and ignored by Git.
- Keep ImageKit credentials in backend environment variables only.
- Use a mocked SDK in tests; never upload real files during CI/local checks.
- Do not create a media table, lesson/passage/question model, CRUD API, or
  public upload route.

## Acceptance criteria

1. A `MediaStorage` provider can be reused by content modules.
2. Local adapter writes bytes to configurable ignored storage.
3. ImageKit adapter uses the official `@imagekit/nodejs` SDK when explicitly
   configured and fails clearly if credentials are missing.
4. Backend rejects unsupported kind, extension, MIME type, size, or mismatched
   payload length.
5. F01 remains REVIEW and F02 remains PENDING.
6. Current official ImageKit security documentation is verified before F09
   chooses protected audio delivery. Do not invent signed-URL guarantees.
