# @tweaktags/storage-s3

Optional media uploads to S3 or any S3 compatible store, using short lived presigned uploads.

Part of **[TweakTags](https://github.com/scarlettiron/tweaktags)**, a lightweight edit in place content layer for React, Next,
and plain HTML sites. Mark any element with a `data-tweaktags-*` attribute, and signed in editors
change its text, rich text, or media right on the live page. Everyone else just sees the saved content.

**Full documentation and guides:** https://scarlettiron.github.io/tweaktags/

## Install

```sh
npm install @tweaktags/storage-s3
```
Add it to turn on the upload button for media tags. It works with Amazon S3, Cloudflare R2,
DigitalOcean Spaces, Backblaze B2, and MinIO. The browser uploads straight to your bucket with a
short lived presigned url, so files never pass through the TweakTags server.

## Step by step

### 1. Add a `storage` block to your config

```ts
  storage: {
    provider: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
```

For an S3 compatible store, add an `endpoint` (and `forcePathStyle: true` for MinIO). A `publicBaseUrl`
sets a cdn or custom domain for the saved urls.

### 2. Turn on the upload button in the client

Pass `mediaUpload` to the React provider (or `mediaUpload: true` to `TweakTags.init`):

```tsx
<TweakTagsProvider apiBasePath="/api/tweaktags" mediaUpload>
  {children}
</TweakTagsProvider>
```

Now editors can upload an image for any media tag instead of pasting a url. Every storage option is in
the [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts).

## Links

- **Documentation and guides:** https://scarlettiron.github.io/tweaktags/
- **Every config setting:** [config type reference](https://github.com/scarlettiron/tweaktags/blob/main/packages/core/src/types/index.ts)
- **Source and issues:** [github.com/scarlettiron/tweaktags](https://github.com/scarlettiron/tweaktags)

## License

MIT
