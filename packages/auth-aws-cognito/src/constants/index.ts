//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//Separates the user's sub from Cognito's refresh token in the value the browser
//holds. A pipe because Cognito's refresh tokens are base64url, which uses only
//letters, digits, dash, underscore and the occasional dot, so a pipe can never
//appear inside one and the split is always unambiguous.
export const REFRESH_SEPARATOR = '|';
