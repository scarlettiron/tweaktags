# @tweaktags/storage-s3

Optional media uploads to S3 or any S3 compatible store, using presigned uploads.

Part of [TweakTags](https://github.com/scarlettiron/tweaktags), a lightweight edit in place content layer for React, Next, and
plain HTML sites. Mark content with a `data-tweaktags-*` attribute and signed in editors change
it right on the page.

## Install

```sh
npm install @tweaktags/storage-s3
```

Add it to turn on the upload button for media tags. It works with Amazon S3, Cloudflare R2,
DigitalOcean Spaces, Backblaze B2, and MinIO. The browser uploads straight to your bucket with a
short lived presigned url, so files never pass through the TweakTags server. Set a `storage` block
in your config to use it.

## Documentation

Full setup and guides: https://scarlettiron.github.io/tweaktags

## License

MIT
