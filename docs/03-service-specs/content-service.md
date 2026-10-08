# Content service

## Ownership

`content-service` owns content-domain data in PostgreSQL `app_content`. F02A
adds only a reusable media-storage boundary; it does not add a media table,
content entity, upload controller, or public upload route.

## Media storage boundary (F02A)

The `MediaStorage` contract is represented by the `MEDIA_STORAGE` provider in
`apps/content-service/src/media/media-storage.js`. Adapters expose
`upload({ kind, fileName, mimeType, sizeBytes, data })` and return a normalized
media object with an identifier, delivery URL, and storage type.

- `local` is the default when no ImageKit credentials are configured. It writes
  outside build output to `MEDIA_LOCAL_ROOT`.
- `@imagekit/nodejs` uses the official ImageKit Node SDK and backend-only credentials.
- Supported future inputs are MP3 audio (`audio/mpeg`) and JPEG/PNG/WebP
  question images. The adapter validates extension, MIME type, payload size,
  and declared/payload byte length.

F02/F09 must add the owning domain contract and authorization before exposing
this boundary through an API. No browser or gateway route is available in F02A.

## ImageKit security limitation

The official Node SDK/upload documentation was checked for server-side upload.
ImageKit's current security documentation URL could not be verified during this
feature, so this project does not claim that a delivery URL or signed URL
protects audio in every delivery context. F09 must verify private-file and
signed-URL behavior from current official documentation before serving
protected audio. The private key remains server-only.
