//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The options you can give the engine when you create it. Anything left out
//falls back to a sensible default.
export interface EngineOptions {
  //Where the backend handler is mounted. Defaults to /api/tweaktags.
  apiBasePath?: string;

  //When true, editing happens in place on the page. When false, a UI shows a
  //popup form instead. Defaults to true.
  editInView?: boolean;

  //Turns on the rich text editor and tag types. Defaults to false.
  richText?: boolean;

  //Turns on the upload button for media tags. The server must have storage
  //configured for uploads to work. Defaults to false, which allows media urls
  //to be pasted in but shows no upload button.
  mediaUpload?: boolean;

  //When true, no TweakTags branding shows anywhere in the UI, including the
  //admin panel. Use it to ship the editor under your own name. Defaults to false.
  whiteLabel?: boolean;

  //How the login token is kept. 'cookie' relies on a secure httpOnly cookie set
  //by the server. 'header' keeps the token in the browser and sends it as a
  //bearer header. Must match your server config. Defaults to 'cookie'.
  tokenStorage?: 'cookie' | 'header';

  //The csrf cookie name, must match the server config. Defaults to
  //'tweaktags_csrf'.
  csrfCookieName?: string;
}

//A snapshot of the engine state that UIs render from.
export interface EngineState {
  user: import('@tweaktags/core').AuthUser | null;
  isEditing: boolean;
  canEdit: boolean;
  editInView: boolean;
  richText: boolean;
  mediaUpload: boolean;
  whiteLabel: boolean;
  hasUnsavedChanges: boolean;
}

//Whether a toast is a success or an error.
export type ToastType = 'success' | 'error';

//A short message the engine asks the UI to show and then fade away.
export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

//Where the floating rich text toolbar should sit, in fixed page coordinates.
export interface ToolbarPosition {
  left: number;
  top: number;
}
