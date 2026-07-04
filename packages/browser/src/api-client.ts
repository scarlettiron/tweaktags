//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { ACTIONS, CSRF_HEADER, type TweakTagsAction } from '@tweaktags/core';

//The settings the api client needs.
//It asks for the token on every call so it always sends the latest one.
export interface ApiClientOptions {
  basePath: string;
  getToken: () => string | null;

  //How the browser sends credentials. Use 'include' for the cookie based mode,
  //especially when the api is on another origin.
  credentials?: RequestCredentials;

  //Called when a request comes back as unauthorized. It should try to refresh
  //the session and return true when it worked, so the request can be retried.
  onUnauthorized?: () => Promise<boolean>;

  //Returns the csrf token to send in a header, for the double submit csrf check.
  getCsrfToken?: () => string | null;
}

//An error from the api that also carries the http status.
export interface ApiError extends Error {
  status?: number;
}

//A small wrapper around fetch that talks to the TweakTags backend handler.
//Every call is a POST with an action and an optional payload.
export interface ApiClient {
  request<T>(action: TweakTagsAction, payload?: unknown): Promise<T>;
}

//Actions that must never trigger a refresh and retry, to avoid loops.
const NO_RETRY: TweakTagsAction[] = [ACTIONS.LOGIN, ACTIONS.REFRESH, ACTIONS.LOGOUT];

//Builds an api client bound to a base path and a token getter.
export const createApiClient = ({
  basePath,
  getToken,
  credentials,
  onUnauthorized,
  getCsrfToken,
}: ApiClientOptions): ApiClient => {
  const sendRequest = (action: TweakTagsAction, payload?: unknown): Promise<Response> => {
    const token = getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const csrf = getCsrfToken?.();

    if (csrf) {
      headers[CSRF_HEADER] = csrf;
    }

    return fetch(basePath, {
      method: 'POST',
      headers,
      credentials: credentials ?? 'same-origin',
      body: JSON.stringify({ action, payload }),
    });
  };

  const request = async <T>(action: TweakTagsAction, payload?: unknown): Promise<T> => {
    let response = await sendRequest(action, payload);

    //If the access token has expired, try to refresh once and repeat the call.
    const canRetry = Boolean(onUnauthorized) && !NO_RETRY.includes(action);

    if (response.status === 401 && canRetry && onUnauthorized) {
      const refreshed = await onUnauthorized();

      if (refreshed) {
        response = await sendRequest(action, payload);
      }
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof data.message === 'string'
          ? data.message
          : `The request failed with status ${response.status}`;

      const error = new Error(message) as ApiError;
      error.status = response.status;

      throw error;
    }

    return data as T;
  };

  return { request };
};
