//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  CSRF_HEADER,
  TweakTagsError,
  createHandler,
  resolveConfig,
  resolveTenant,
  type AuthAdapter,
  type DbAdapter,
  type TweakTagsConfig,
  type TweakTagsHandler,
  type TweakTagsUserConfig,
} from '@tweaktags/core';
import { loadConfig, type LoadConfigOptions } from '@tweaktags/core/loader';

import { buildAuthAdapter, buildDbAdapter, buildStorageAdapter } from './adapters/select-adapters.js';
import { readBearerToken, readJsonBody, toTweakTagsRequest } from './utilities/http.js';
import { applyCors } from './utilities/cors.js';
import { parseCookies, resolveAuthCookie } from './utilities/cookies.js';
import { assertCsrf } from './utilities/csrf.js';

//A Node style request handler that the host mounts on a route.
export type NodeRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

//Everything the server factory hands back.
//Most hosts only need nodeHandler, but the lower level pieces are here too.
export interface TweakTagsServer {
  config: TweakTagsConfig;
  db: DbAdapter;
  auth: AuthAdapter;
  //Works with already normalized requests, useful for Next route handlers.
  handle: TweakTagsHandler;
  //Works with raw Node request and response objects.
  nodeHandler: NodeRequestHandler;
  //Closes the database connections.
  close(): Promise<void>;
}

//Writes a normalized response onto a Node response object as JSON.
const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
};

//Builds a TweakTags server from a fully resolved config.
//This wires the database and auth adapters into the core request handler.
export const createTweakTagsServer = (config: TweakTagsConfig): TweakTagsServer => {
  const db = buildDbAdapter(config);
  const auth = buildAuthAdapter(config, db);
  const storage = buildStorageAdapter(config);
  const handle = createHandler({ db, auth, storage, config });

  const nodeHandler: NodeRequestHandler = async (req, res) => {
    //Add cross origin headers when configured. This also answers the browser's
    //preflight OPTIONS request, in which case we are done.
    if (applyCors(req, res, config.cors)) {
      return;
    }

    //Every TweakTags action arrives as a POST with a JSON body.
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'bad_request', message: 'Use a POST request' });
      return;
    }

    try {
      const body = await readJsonBody(req);

      //The access token can arrive as a bearer header or the access cookie.
      //The refresh token arrives as its own cookie.
      const cookies = parseCookies(req.headers.cookie);
      const accessToken = readBearerToken(req) ?? cookies[config.auth.cookieName];
      const refreshToken = cookies[config.auth.refreshCookieName];
      const request = toTweakTagsRequest(body, accessToken, refreshToken);

      //Decide the tenant on the server, from the config or the request host.
      //The client never sends it, so a site can only ever touch its own tags.
      request.tenant = resolveTenant(config, { host: req.headers.host, headers: req.headers });

      //Block cross site request forgery on the actions that change data.
      const csrfHeaderRaw = req.headers[CSRF_HEADER];
      const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
      assertCsrf(config.auth, request.action, cookies, csrfHeader);

      const response = await handle(request);

      //In cookie mode this sets or clears the httpOnly cookies and keeps the
      //tokens out of the response body.
      const { setCookies, body: responseBody } = resolveAuthCookie(
        config.auth,
        request.action,
        response,
      );

      if (setCookies.length > 0) {
        res.setHeader('Set-Cookie', setCookies);
      }

      sendJson(res, response.status, responseBody);
    } catch (error) {
      if (error instanceof TweakTagsError) {
        sendJson(res, error.status, { error: error.code, message: error.message });
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 500, { error: 'internal_error', message });
    }
  };

  return {
    config,
    db,
    auth,
    handle,
    nodeHandler,
    close: () => db.close(),
  };
};

//Loads the config from disk and then builds the server.
//This is the easiest entry point for most backends.
export const createTweakTagsServerFromConfig = async (
  options?: LoadConfigOptions,
): Promise<TweakTagsServer> => {
  const config = await loadConfig(options);

  return createTweakTagsServer(config);
};

//A standalone TweakTags server that runs on its own, for apps like a plain React
//SPA that have no backend of their own.
export interface StandaloneServer {
  tweaktags: TweakTagsServer;
  http: Server;
  //Stops the http server and closes the database connections.
  close(): Promise<void>;
}

//Starts a small http server that serves only the TweakTags api.
//Point your React app's apiBasePath at this server's url. When the app runs on
//a different origin, set cors in your config so the browser allows the calls.
export const startStandaloneServer = async (
  config: TweakTagsUserConfig | TweakTagsConfig,
  options: { port: number },
): Promise<StandaloneServer> => {
  const tweaktags = createTweakTagsServer(resolveConfig(config as TweakTagsUserConfig));

  const httpServer = createServer((req, res) => {
    void tweaktags.nodeHandler(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(options.port, () => resolve());
  });

  return {
    tweaktags,
    http: httpServer,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((closeError) => {
          if (closeError) {
            reject(closeError);

            return;
          }

          void tweaktags.close().then(resolve, reject);
        });
      }),
  };
};
