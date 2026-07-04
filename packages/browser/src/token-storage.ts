//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//The keys the tokens are stored under in the browser, for header mode only.
const ACCESS_KEY = 'tweaktags.accessToken';
const REFRESH_KEY = 'tweaktags.refreshToken';

//The saved access and refresh tokens.
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

//Reads the saved tokens, or returns null when they are not both present.
//Returns null on the server where there is no localStorage.
export const readStoredTokens = (): StoredTokens | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
};

//Saves the tokens, or clears them when given null.
export const writeStoredTokens = (tokens: StoredTokens | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (tokens === null) {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);

    return;
  }

  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
};

//Reads a readable cookie value by name, used for the csrf token.
//Returns null on the server or when the cookie is not set.
export const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((row) => row.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
};
