//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import type { ACTIONS, ERROR_CODES, ROLES, TAG_TYPES } from '../constants/index.js';

//A role is one of the values defined in the ROLES constant.
export type Role = (typeof ROLES)[keyof typeof ROLES];

//A tag type is one of the values defined in the TAG_TYPES constant.
export type TagType = (typeof TAG_TYPES)[keyof typeof TAG_TYPES];

//An action is one of the values defined in the ACTIONS constant.
export type TweakTagsAction = (typeof ACTIONS)[keyof typeof ACTIONS];

//An error code is one of the values defined in the ERROR_CODES constant.
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

//The user performing an action, after their token has been verified.
export interface Actor {
  userId: string;
  role: Role;

  //Which family of refresh tokens this session belongs to, when the token
  //carried one. It lets somebody changing their own password end every other
  //session but the one they are using.
  familyId?: string;
}

//A user as the outside world sees them, without any secret fields.
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

//A user as stored in the database, including the password hash.
//Only the auth adapter and the database adapter should touch this shape.
export interface StoredUser extends AuthUser {
  passwordHash: string;

  //This user's id at the identity provider, when their login lives outside
  //TweakTags. It is the AWS Cognito "sub" when the provider is aws-cognito, and
  //null for an ordinary user whose password is the hash above.
  //Deliberately not named after any one provider: it is what links a TweakTags
  //row to whoever actually holds the password.
  externalId: string | null;
}

//The fields needed to create a new user row.
export interface CreateUserInput {
  email: string;
  role: Role;
  passwordHash: string;

  //Set when the login lives at an identity provider. See StoredUser.externalId.
  externalId?: string;
}

//A single editable piece of content, keyed by its tag.
export interface ContentRecord {
  tag: string;
  //Whether this tag holds plain text, rich html, or a media url.
  type: TagType;
  body: string;
  mediaUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

//The fields a caller can send when saving content.
export interface ContentInput {
  tag: string;
  body: string;
  mediaUrl?: string | null;
}

//Which databases TweakTags can talk to.
//mysql and mariadb use the same driver, since MariaDB speaks the MySQL protocol.
export type DatabaseProvider = 'postgres' | 'mysql' | 'mariadb' | 'sqlite';

//The database connection settings.
//For servers, either give a full connection string or the individual parts.
//For sqlite, give a filename instead.
//Connection pool settings for the databases that pool, which is Postgres,
//MySQL, and MariaDB. Every field is optional, and leaving the whole block out
//keeps the driver's own defaults, which is what a long running server wants.
//
//It matters on serverless hosts. Each instance that wakes up builds its own
//pool, so fifty warm instances holding ten connections each is five hundred
//connections at the database, and Postgres refuses new ones past max_connections.
//A small max, and an idle timeout short enough that a sleeping instance lets go
//of its connections, is the usual fix: max 2, idleTimeoutMillis 10_000, and
//connectionTimeoutMillis 5_000 is a reasonable starting point.
//SQLite has a single file handle and no pool, so it ignores this.
export interface DatabasePoolConfig {
  //The most connections one pool will open. Driver default is 10.
  max?: number;

  //Connections to keep open when idle. Only Postgres and MySQL honour it.
  min?: number;

  //How long an idle connection is kept before it is closed, in milliseconds.
  idleTimeoutMillis?: number;

  //How long to wait for a connection before giving up, in milliseconds. Without
  //it a request can hang instead of failing, which on serverless means paying
  //for the wait and then timing out anyway.
  connectionTimeoutMillis?: number;
}

export interface DatabaseConfig {
  provider: DatabaseProvider;
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  //The path to the database file, used only by sqlite.
  filename?: string;

  //Optional connection pool tuning. Leave it out for the driver defaults.
  pool?: DatabasePoolConfig;
}

//Where the browser keeps the login token.
//'cookie' uses a secure httpOnly cookie that JavaScript cannot read, which is
//the safest option and works for same origin apps. 'header' returns the token
//for the client to store and send itself, which is needed for a separate app on
//a different origin.
export type TokenStorage = 'cookie' | 'header';

//An AWS Cognito user pool, for installs where the people who edit the site
//already have logins somewhere central.
//There are no credential fields on purpose. The AWS SDK finds them the usual
//way, from an instance role or the environment, which is the same choice the
//storage adapter makes and keeps secrets out of the config file.
export interface AwsCognitoConfig {
  //The region the pool lives in, for example 'us-east-1'.
  region: string;

  //The pool id, which looks like 'us-east-1_AbCdEfGhI'.
  userPoolId: string;

  //The app client TweakTags signs in through. It must allow the
  //ADMIN_USER_PASSWORD_AUTH flow, since the password is checked on the server.
  clientId: string;

  //Only when the app client was created with a secret. Every call then needs a
  //SECRET_HASH built from it, which the adapter does for you.
  clientSecret?: string;
}

//The auth settings every provider shares. The session shape, the cookies and the
//csrf check are TweakTags' own, whoever is checking the password.
export interface AuthConfigBase {
  //How long the short lived access token lasts, in seconds. Defaults to 15 minutes.
  accessTtlSeconds?: number;

  //How long the refresh token lasts, in seconds. Defaults to 7 days.
  //When this expires the user is signed out and must log back in.
  refreshTtlSeconds?: number;

  //When true, every request checks that the session has not been revoked, so a
  //logout or a revoked session ends access right away. This costs one database
  //read per request. When false, access tokens are stateless and simply expire.
  //Defaults to false.
  //It applies to the jwt provider only. AWS Cognito owns its own sessions, so it
  //already revokes at the source and this setting does nothing there.
  strictRevocation?: boolean;

  //How the browser holds the tokens. Defaults to 'cookie'.
  tokenStorage?: TokenStorage;

  //The access cookie name, defaults to 'tweaktags_token'.
  cookieName?: string;

  //The refresh cookie name, defaults to 'tweaktags_refresh'.
  refreshCookieName?: string;

  //Whether to protect against cross site request forgery. Defaults to true.
  //Set to false only if the csrf check is causing problems and you understand
  //the risk. It has no effect in header mode, which is already safe from csrf.
  csrfProtection?: boolean;

  //The csrf cookie name, defaults to 'tweaktags_csrf'. This cookie is readable by
  //the client so it can echo the value back in a header.
  csrfCookieName?: string;

  //Whether the cookies are marked Secure, so they only travel over https.
  //Defaults to true. Set to false only for local http development.
  cookieSecure?: boolean;

  //The cookie SameSite setting, defaults to 'lax'.
  //Use 'none' with Secure for a separate app on another origin.
  cookieSameSite?: 'strict' | 'lax' | 'none';
}

//Email and password, checked against the users table and signed into TweakTags'
//own JSON Web Tokens. This is the default and needs nothing installed.
export interface JwtAuthConfig extends AuthConfigBase {
  provider: 'jwt';
  jwtSecret: string;
}

//Email and password, checked against an AWS Cognito user pool. Needs the
//@tweaktags/auth-aws-cognito package installed.
export interface AwsCognitoAuthConfig extends AuthConfigBase {
  provider: 'aws-cognito';
  awsCognito: AwsCognitoConfig;
}

//The auth settings. A union rather than one interface, so that jwtSecret is
//required for jwt and cannot be set for cognito, and the other way round.
export type AuthConfig = JwtAuthConfig | AwsCognitoAuthConfig;

//The auth settings after defaults have been applied.
export interface ResolvedAuthConfigBase {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  strictRevocation: boolean;
  tokenStorage: TokenStorage;
  cookieName: string;
  refreshCookieName: string;
  csrfProtection: boolean;
  csrfCookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
}

export interface ResolvedJwtAuthConfig extends ResolvedAuthConfigBase {
  provider: 'jwt';
  jwtSecret: string;
}

export interface ResolvedAwsAwsCognitoAuthConfig extends ResolvedAuthConfigBase {
  provider: 'aws-cognito';
  awsCognito: AwsCognitoConfig;
}

export type ResolvedAuthConfig = ResolvedJwtAuthConfig | ResolvedAwsAwsCognitoAuthConfig;

//Where uploaded media files are stored. Optional, so media can always just be a
//url the user pastes in. When set, editors get an upload button, and the server
//hands out a short lived presigned url so the browser uploads straight to the
//store. Provider 's3' also covers any S3 compatible store, like Cloudflare R2,
//DigitalOcean Spaces, Backblaze B2, or MinIO, by setting an endpoint.
export interface StorageConfig {
  provider: 's3';
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  //A custom endpoint for an S3 compatible store. Leave out for AWS S3.
  endpoint?: string;
  //Use path style urls, needed by some S3 compatible stores like MinIO.
  forcePathStyle?: boolean;
  //A cdn or custom domain in front of the bucket, used to build the public url.
  publicBaseUrl?: string;
  //An optional prefix added to every stored key, like 'uploads/'.
  keyPrefix?: string;
}

//The presigned target the server hands back for one upload.
export interface UploadTarget {
  //The presigned url the browser uploads the file to with a PUT.
  uploadUrl: string;
  //The final public url to save as the media tag's content.
  publicUrl: string;
  //Headers the browser must send on the PUT, like the content type.
  headers?: Record<string, string>;
}

//What the tenant resolver is given to work out the tenant for a request.
//It carries the request host and headers, so one shared server can map a domain
//to a tenant.
export interface TenantContext {
  host?: string;
  headers: Record<string, string | string[] | undefined>;
}

//Cross origin settings, needed when the TweakTags server runs on a different
//origin than the site that calls it, like a separate React app.
export interface CorsConfig {
  //Which origins may call the api.
  //Use '*' to allow any origin, or a list of exact origins like
  //['https://my-site.com', 'http://localhost:5173'].
  origins: string[] | '*';
}

//The config shape the user writes in tweaktags.config.ts.
//Most fields are optional because the loader fills in sensible defaults.
export interface TweakTagsUserConfig {
  mode?: 'embedded' | 'standalone';
  editInView?: boolean;
  //Turns on the rich text editor and lets tags be created with a type.
  richText?: boolean;

  //When true, no TweakTags branding shows anywhere in the UI, including the
  //admin panel, so the editor carries your own name instead. Defaults to true.
  //Set it to false to show the TweakTags name in the UI.
  //The client packages take the same option, so set it in both places.
  whiteLabel?: boolean;
  apiBasePath?: string;
  database: DatabaseConfig;
  auth: AuthConfig;
  cors?: CorsConfig;

  //Optional storage for media uploads. Leave it out to only allow media urls.
  storage?: StorageConfig;

  //The tenant this site's content belongs to, for sharing one database across
  //several sites. Tags are scoped to it, so a site only sees and edits its own.
  //Defaults to 'default'.
  tenant?: string;

  //An optional way to work out the tenant from the request, for one server that
  //serves several domains. Return undefined to fall back to the tenant above.
  resolveTenant?: (context: TenantContext) => string | undefined;

  //Where server side log entries go. Leave it out to write readable lines to the
  //console, which is enough for a self hosted install. Set it to send entries to
  //your own logging instead. Failures are always logged, whichever you use.
  logger?: Logger;
}

//The fully resolved config, after defaults have been applied.
//This is what the rest of the system actually uses.
export interface TweakTagsConfig {
  mode: 'embedded' | 'standalone';
  editInView: boolean;
  richText: boolean;
  whiteLabel: boolean;
  apiBasePath: string;
  database: DatabaseConfig;
  auth: ResolvedAuthConfig;
  cors?: CorsConfig;

  //Optional storage for media uploads.
  storage?: StorageConfig;

  //The default tenant for this server. Always set after resolving the config.
  tenant: string;

  //An optional resolver to pick the tenant per request, for a shared server.
  resolveTenant?: (context: TenantContext) => string | undefined;

  //Where server side log entries go. resolveConfig always fills this in, but it
  //stays optional so a hand built config object is still valid. The handler
  //falls back to console logging when it is missing.
  logger?: Logger;
}

//One stored refresh token, used to rotate tokens and detect reuse.
//A family groups all the refresh tokens from one login. When an already used
//token is presented again, the whole family is revoked, which signs the session
//out everywhere because the token was probably stolen.
export interface RefreshTokenRecord {
  //A unique id for this token, the jti claim inside the refresh token.
  id: string;
  //The login family this token belongs to.
  familyId: string;
  //The user the token belongs to.
  userId: string;
  //When the token expires, as an iso string.
  expiresAt: string;
  //Whether this token has already been used or revoked.
  revoked: boolean;
}

//The result of a successful login or refresh.
//The access token authenticates requests, the refresh token gets a new access
//token when it expires.
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

//A request that has been normalized away from any specific web framework.
export interface TweakTagsRequest {
  action: TweakTagsAction;
  payload?: unknown;
  //The access token, from the access cookie or a bearer header.
  authToken?: string;
  //The refresh token, from the refresh cookie.
  refreshToken?: string;
  //The tenant this request is scoped to. The server sets this from the config,
  //so the client can never choose or spoof it. Defaults to 'default'.
  tenant?: string;
}

//A response that has been normalized away from any specific web framework.
export interface TweakTagsResponse {
  status: number;
  body: Record<string, unknown>;
}

//How serious a log entry is.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

//What went wrong underneath, when we recognise it. Used for the log hint, so an
//install can be fixed without reading the TweakTags source.
export type FailureReason =
  | 'database_ssl_not_supported'
  | 'database_ssl_required'
  | 'database_unreachable'
  | 'database_auth_failed'
  | 'database_missing'
  | 'migrations_missing'
  | 'unknown';

//The result of looking at a thrown value and trying to explain it.
export interface FailureDiagnosis {
  reason: FailureReason;
  //Plain language guidance for whoever is troubleshooting. Server side only.
  hint?: string;
  //The driver's own error code, when it had one.
  driverCode?: string;
}

//One structured line from the TweakTags server. Every failed request produces
//one, carrying the same traceId the caller was given, so a report of "it broke"
//can be tied to the exact failure.
export interface LogEntry {
  level: LogLevel;
  //What happened, as a stable name like 'request.failed'.
  event: string;
  message: string;
  traceId: string;
  action?: string;
  status?: number;
  code?: string;
  tenant?: string;
  userId?: string;
  durationMs?: number;
  reason?: FailureReason;
  hint?: string;
  error?: { name: string; message: string; code?: string; stack?: string };
}

//Where log entries go. Supply your own in the config to send them to whatever
//you already run, instead of the console.
export type Logger = (entry: LogEntry) => void;
