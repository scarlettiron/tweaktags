//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { UploadTarget } from '../types/index.js';

//A place TweakTags can store uploaded media files. A concrete adapter, like the
//S3 one, knows how to sign an upload for its store. TweakTags never handles the
//file bytes itself: it hands the browser a presigned url, and the browser
//uploads straight to the store.
export interface StorageAdapter {
  //Returns a short lived presigned url to upload one file to, and the public url
  //to save afterwards. The key is already namespaced by tenant by the caller.
  createUploadUrl(input: { key: string; contentType: string }): Promise<UploadTarget>;
}
