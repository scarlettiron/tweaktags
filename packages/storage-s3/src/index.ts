//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { StorageAdapter, StorageConfig, UploadTarget } from '@tweaktags/core';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

//Stores media in Amazon S3, or any S3 compatible store, like Cloudflare R2,
//DigitalOcean Spaces, Backblaze B2, or MinIO. It never touches the file bytes:
//it signs a short lived PUT url so the browser uploads straight to the store,
//then hands back the public url to save as the media tag's content.
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
  }

  public async createUploadUrl(input: { key: string; contentType: string }): Promise<UploadTarget> {
    const fullKey = `${this.config.keyPrefix ?? ''}${input.key}`;

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: fullKey,
      ContentType: input.contentType,
    });

    //A short lived url, just long enough to start the upload.
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 60 });

    return {
      uploadUrl,
      publicUrl: this.publicUrl(fullKey),
      //The browser must send this exact content type on the PUT so the signature
      //matches, so we tell it which header to use.
      headers: { 'Content-Type': input.contentType },
    };
  }

  //Builds the url the file will be readable at after it is uploaded. A cdn or
  //custom domain wins, then a custom endpoint, then the default AWS url.
  private publicUrl(key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    if (this.config.publicBaseUrl) {
      return `${trimTrailingSlash(this.config.publicBaseUrl)}/${encodedKey}`;
    }

    if (this.config.endpoint) {
      return `${trimTrailingSlash(this.config.endpoint)}/${this.config.bucket}/${encodedKey}`;
    }

    const region = this.config.region ?? 'us-east-1';

    return `https://${this.config.bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
  }
}
