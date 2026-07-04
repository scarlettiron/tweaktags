//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import {
  CSRF_HEADER,
  TweakTagsError,
  resolveConfig,
  resolveTenant,
  type TweakTagsConfig,
  type TweakTagsUserConfig,
} from '@tweaktags/core';
import {
  assertCsrf,
  createTweakTagsServer,
  parseCookies,
  resolveAuthCookie,
  toTweakTagsRequest,
  type NodeRequestHandler,
  type TweakTagsServer,
} from '@tweaktags/server';

//The functions Next expects to export from a route handler file.
//Mount POST in your app/api/tweaktags/route.ts file.
export interface TweakTagsRouteHandlers {
  POST: (request: Request) => Promise<Response>;

  //The underlying server, in case you need the adapters or want to close them.
  server: TweakTagsServer;
}

//Reads the bearer token from a web Request.
const readToken = (request: Request): string | undefined => {
  const header = request.headers.get('authorization');

  if (!header || !header.startsWith('Bearer ')) {
    return undefined;
  }

  const token = header.slice('Bearer '.length).trim();

  return token === '' ? undefined : token;
};

//Turns a normalized response into a web Response with JSON.
const toJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

//Builds a Next route handler from your config.
//You can pass the config object straight from your tweaktags.config file.
//It fills in defaults, checks the config, and creates the server once.
export const createTweakTagsRouteHandler = (
  config: TweakTagsUserConfig | TweakTagsConfig,
): TweakTagsRouteHandlers => {
  const resolved = resolveConfig(config as TweakTagsUserConfig);
  const server = createTweakTagsServer(resolved);

  const POST = async (request: Request): Promise<Response> => {
    let body: unknown = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    try {
      //The access token can arrive as a bearer header or the access cookie.
      //The refresh token arrives as its own cookie.
      const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
      const accessToken = readToken(request) ?? cookies[resolved.auth.cookieName];
      const refreshToken = cookies[resolved.auth.refreshCookieName];
      const tweaktagsRequest = toTweakTagsRequest(body, accessToken, refreshToken);

      //Decide the tenant on the server, from the config or the request host,
      //so the client can never choose which site's tags it touches.
      const headerRecord: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headerRecord[key] = value;
      });

      tweaktagsRequest.tenant = resolveTenant(resolved, {
        host: request.headers.get('host') ?? undefined,
        headers: headerRecord,
      });

      //Block cross site request forgery on the actions that change data.
      assertCsrf(
        resolved.auth,
        tweaktagsRequest.action,
        cookies,
        request.headers.get(CSRF_HEADER) ?? undefined,
      );

      const response = await server.handle(tweaktagsRequest);

      //In cookie mode this sets or clears the httpOnly cookies and keeps the
      //tokens out of the response body.
      const { setCookies, body: responseBody } = resolveAuthCookie(
        resolved.auth,
        tweaktagsRequest.action,
        response,
      );

      const responseHeaders = new Headers({ 'Content-Type': 'application/json' });

      for (const cookie of setCookies) {
        responseHeaders.append('Set-Cookie', cookie);
      }

      return new Response(JSON.stringify(responseBody), {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      if (error instanceof TweakTagsError) {
        return toJsonResponse(error.status, { error: error.code, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      return toJsonResponse(500, { error: 'internal_error', message });
    }
  };

  return { POST, server };
};

//Builds a Pages Router API handler from your config.
//Use this in a pages/api file. It returns a Node style (req, res) handler,
//which is what the Pages Router expects, unlike the App Router web handler above.
//Remember to turn off Next's body parser in that file so TweakTags can read the
//raw request body:
//
//  export const config = { api: { bodyParser: false } };
//
export const createTweakTagsPagesApiRoute = (
  config: TweakTagsUserConfig | TweakTagsConfig,
): NodeRequestHandler => {
  const resolved = resolveConfig(config as TweakTagsUserConfig);
  const server = createTweakTagsServer(resolved);

  return server.nodeHandler;
};
