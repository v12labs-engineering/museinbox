import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanDraftRule,
  composeDm,
  emptyDraft,
  findMatchingRule,
  type Activity,
  type DraftRule,
  type Rule,
} from "../src/shared/automation";

type DataFile = {
  rules: Rule[];
  activity: Activity[];
  integration?: InstagramIntegration;
};

type InstagramIntegration = {
  accessToken?: string;
  encryptedAccessToken?: string;
  tokenType?: string;
  userId?: string;
  permissions?: string[];
  connectedAt?: string;
  expiresAt?: string;
  oauthState?: string;
  oauthStartedAt?: string;
  oauthRedirectUri?: string;
  oauthAuthorizeUrl?: string;
  lastOAuthError?: string;
};

type InstagramWebhookEvent = {
  id: string;
  kind: "comment" | "mention" | "message";
  text: string;
  mediaId?: string;
  replyTarget:
    | { type: "comment"; commentId: string }
    | { type: "message"; senderId: string }
    | { type: "unsupported" };
};

type InstagramMediaItem = {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
  commentsCount?: number;
  likeCount?: number;
};

const dataDirectory = path.resolve(
  process.env.MUSEINBOX_DATA_DIR ??
    (process.env.VERCEL ? "/tmp/museinbox" : ".museinbox"),
);
const dataPath = path.join(dataDirectory, "data.json");
const supabaseStateTable = "museinbox_state";
const supabaseStateId = "default";
const defaultScopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

const starterRules: Rule[] = [
  {
    id: randomUUID(),
    name: "Send product link",
    triggerType: "keyword",
    keyword: "link",
    postLabel: "Any reel",
    message: "Thanks for your comment. Here is the product link you asked for:",
    link: "https://example.com/product",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    name: "Fallback reply",
    triggerType: "any",
    keyword: "",
    postLabel: "General posts",
    message: "Thanks for commenting. I will send you the details here:",
    link: "",
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function handleApiRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;

  try {
    if (request.method === "GET" && pathname === "/api/instagram/webhook") {
      return verifyWebhook(requestUrl);
    }

    if (request.method === "POST" && pathname === "/api/instagram/webhook") {
      return handleInstagramWebhook(request);
    }

    if (pathname === "/api/rules") {
      return handleRules(request);
    }

    if (pathname.startsWith("/api/rules/")) {
      return handleRuleById(request, pathname);
    }

    if (pathname === "/api/activity") {
      return handleActivity(request);
    }

    if (request.method === "GET" && pathname === "/api/instagram/media") {
      return handleInstagramMedia();
    }

    if (request.method === "GET" && pathname === "/api/auth/instagram/start") {
      return startInstagramOAuth(request);
    }

    if (
      request.method === "GET" &&
      pathname === "/api/auth/instagram/callback"
    ) {
      return handleInstagramOAuthCallback(request, requestUrl);
    }

    if (
      request.method === "POST" &&
      pathname === "/api/auth/instagram/disconnect"
    ) {
      return disconnectInstagram();
    }

    if (request.method === "GET" && pathname === "/api/instagram/status") {
      const data = await readData();
      return json(200, {
        webhookPath: "/api/instagram/webhook",
        oauthStartPath: "/api/auth/instagram/start",
        oauthCallbackPath: "/api/auth/instagram/callback",
        oauthRedirectUri:
          data.integration?.oauthRedirectUri ??
          process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        oauthAuthorizeUrl: data.integration?.oauthAuthorizeUrl,
        lastOAuthError: data.integration?.lastOAuthError,
        graphVersion: getGraphVersion(),
        hasAccessToken: Boolean(getAccessToken(data)),
        tokenSource: data.integration?.accessToken ? "oauth" : "env",
        connectedAt: data.integration?.connectedAt,
        expiresAt: data.integration?.expiresAt,
        instagramUserId: data.integration?.userId,
        permissions: data.integration?.permissions ?? [],
        hasAppId: Boolean(getInstagramAppId()),
        hasVerifyToken: Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
        hasAppSecret: Boolean(process.env.INSTAGRAM_APP_SECRET),
        dryRun: process.env.INSTAGRAM_DRY_RUN === "true",
      });
    }

    return json(404, { error: "Not found" });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}

async function handleRules(request: Request) {
  if (request.method === "GET") {
    const data = await readData();
    return json(200, data.rules);
  }

  if (request.method === "POST") {
    const draft = cleanDraftRule(await readJson<DraftRule>(request));
    validateDraft(draft);
    const now = new Date().toISOString();
    const rule: Rule = {
      ...draft,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const data = await readData();
    data.rules = [rule, ...data.rules];
    await writeData(data);
    return json(201, rule);
  }

  return json(405, { error: "Method not allowed" });
}

async function handleRuleById(request: Request, pathname: string) {
  const id = decodeURIComponent(pathname.replace("/api/rules/", ""));
  const data = await readData();
  const rule = data.rules.find((item) => item.id === id);

  if (!rule) {
    return json(404, { error: "Rule not found" });
  }

  if (request.method === "PUT") {
    const draft = cleanDraftRule(await readJson<DraftRule>(request));
    validateDraft(draft);
    const updatedRule: Rule = {
      ...rule,
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    data.rules = data.rules.map((item) => (item.id === id ? updatedRule : item));
    await writeData(data);
    return json(200, updatedRule);
  }

  if (request.method === "DELETE") {
    data.rules = data.rules.filter((item) => item.id !== id);
    await writeData(data);
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
}

async function handleActivity(request: Request) {
  const data = await readData();

  if (request.method === "GET") {
    return json(200, data.activity);
  }

  if (request.method === "POST") {
    const event = await readJson<{ comment: string }>(request);
    const comment = event.comment?.trim() ?? "";
    const matchedRule = findMatchingRule(comment, data.rules);
    const dm = matchedRule ? composeDm(matchedRule) : "";
    const entry: Activity = {
      id: randomUUID(),
      comment: comment || "(empty comment)",
      matchedRuleName: matchedRule?.name ?? "No matching rule",
      dm: dm || "No DM generated",
      timestamp: new Date().toISOString(),
      status: "preview",
      source: "local_preview",
    };
    data.activity = [entry, ...data.activity].slice(0, 50);
    await writeData(data);
    return json(201, entry);
  }

  return json(405, { error: "Method not allowed" });
}

async function startInstagramOAuth(request: Request) {
  const clientId = getInstagramAppId();
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) {
    return json(400, {
      error: "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET in .env.local",
    });
  }

  const redirectUri = getOAuthRedirectUri(request);
  const data = await readData();
  data.integration = {
    ...data.integration,
    oauthState: undefined,
    oauthStartedAt: new Date().toISOString(),
    oauthRedirectUri: redirectUri,
  };
  await writeData(data);

  const scopes = process.env.INSTAGRAM_OAUTH_SCOPES ?? defaultScopes;
  const authUrl = [
    "https://www.instagram.com/oauth/authorize",
    `force_reauth=true`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    "response_type=code",
    `scope=${encodeURIComponent(scopes)}`,
  ].join("&").replace("&", "?");

  data.integration.oauthAuthorizeUrl = authUrl;
  data.integration.lastOAuthError = undefined;
  await writeData(data);

  return Response.redirect(authUrl, 302);
}

async function handleInstagramOAuthCallback(request: Request, requestUrl: URL) {
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  if (error) {
    return redirectToApp(request, `Instagram connection failed: ${errorDescription ?? error}`);
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const data = await readData();
  if (!code) {
    return redirectToApp(request, "Instagram connection failed: missing OAuth code");
  }

  if (data.integration?.oauthState && state !== data.integration.oauthState) {
    return redirectToApp(request, "Instagram connection failed: invalid OAuth state");
  }

  const redirectUri = data.integration?.oauthRedirectUri ?? getOAuthRedirectUri(request);
  let shortToken: Awaited<ReturnType<typeof exchangeCodeForShortToken>>;
  try {
    shortToken = await exchangeCodeForShortToken(code, redirectUri);
  } catch (exchangeError) {
    data.integration = {
      ...data.integration,
      lastOAuthError:
        exchangeError instanceof Error ? exchangeError.message : "Unknown OAuth error",
    };
    await writeData(data);
    throw exchangeError;
  }

  const longToken = await exchangeForLongLivedToken(shortToken.access_token);
  data.integration = {
    accessToken: longToken.access_token,
    tokenType: longToken.token_type,
    userId: String(shortToken.user_id ?? ""),
    permissions: shortToken.permissions ?? [],
    connectedAt: new Date().toISOString(),
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : undefined,
  };
  await writeData(data);
  return redirectToApp(request, "Instagram connected");
}

async function disconnectInstagram() {
  const data = await readData();
  data.integration = {
    oauthState: undefined,
    oauthStartedAt: undefined,
    oauthRedirectUri: undefined,
    oauthAuthorizeUrl: undefined,
    lastOAuthError: undefined,
  };
  await writeData(data);
  return json(200, { ok: true });
}

function verifyWebhook(requestUrl: URL) {
  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");
  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && token === expectedToken && challenge) {
    return text(200, challenge);
  }

  return text(403, "Webhook verification failed");
}

async function handleInstagramWebhook(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!verifySignature(request, rawBody)) {
    return json(403, { error: "Invalid Meta signature" });
  }

  const body = JSON.parse(rawBody.toString("utf8")) as unknown;
  const events = extractInstagramWebhookEvents(body);
  const data = await readData();

  for (const event of events) {
    const matchedRule = findMatchingRule(event.text, data.rules, event.mediaId);
    const dm = matchedRule ? composeDm(matchedRule) : "";
    const entry: Activity = {
      id: randomUUID(),
      comment: event.text || "(empty comment)",
      matchedRuleName: matchedRule?.name ?? "No matching rule",
      dm: dm || "No DM generated",
      timestamp: new Date().toISOString(),
      status: matchedRule ? "dry_run" : "no_match",
      source:
        event.kind === "comment"
          ? "instagram_comment"
          : event.kind === "mention"
            ? "instagram_mention"
            : "instagram_message",
    };

    if (matchedRule && dm) {
      const sendResult = await sendWebhookReply(data, event.replyTarget, dm);
      entry.status = sendResult.ok ? sendResult.status : "failed";
      entry.error = sendResult.error;
    }

    data.activity = [entry, ...data.activity].slice(0, 50);
  }

  await writeData(data);
  return json(200, { ok: true, events: events.length });
}

async function sendWebhookReply(
  data: DataFile,
  replyTarget: InstagramWebhookEvent["replyTarget"],
  message: string,
) {
  if (replyTarget.type === "comment") {
    return sendPrivateReply(data, replyTarget.commentId, message);
  }

  if (replyTarget.type === "message") {
    return sendInstagramMessage(data, replyTarget.senderId, message);
  }

  return {
    ok: false as const,
    error: "Webhook event did not include a supported reply target",
  };
}

async function sendPrivateReply(
  data: DataFile,
  commentId: string,
  message: string,
): Promise<
  | { ok: true; status: "sent" | "dry_run"; error?: undefined }
  | { ok: false; error: string; status?: undefined }
> {
  const accessToken = getAccessToken(data);

  if (process.env.INSTAGRAM_DRY_RUN === "true") {
    return { ok: true, status: "dry_run" as const };
  }

  if (!accessToken) {
    return { ok: false, error: "Connect Instagram first" };
  }

  const apiUrl = `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(
    commentId,
  )}/private_replies`;
  const body = new URLSearchParams({ message, access_token: accessToken });
  const result = await fetch(apiUrl, { method: "POST", body });

  if (!result.ok) {
    return { ok: false, error: await result.text() };
  }

  return { ok: true, status: "sent" as const };
}

async function sendInstagramMessage(
  data: DataFile,
  senderId: string,
  message: string,
): Promise<
  | { ok: true; status: "sent" | "dry_run"; error?: undefined }
  | { ok: false; error: string; status?: undefined }
> {
  const accessToken = getAccessToken(data);

  if (process.env.INSTAGRAM_DRY_RUN === "true") {
    return { ok: true, status: "dry_run" as const };
  }

  if (!accessToken) {
    return { ok: false, error: "Connect Instagram first" };
  }

  const body = new URLSearchParams({
    recipient: JSON.stringify({ id: senderId }),
    message: JSON.stringify({ text: message }),
    access_token: accessToken,
  });
  const result = await fetch(
    `https://graph.facebook.com/${getGraphVersion()}/me/messages`,
    {
      method: "POST",
      body,
    },
  );

  if (!result.ok) {
    return { ok: false, error: await result.text() };
  }

  return { ok: true, status: "sent" as const };
}

function extractInstagramWebhookEvents(body: unknown): InstagramWebhookEvent[] {
  if (!isRecord(body) || !Array.isArray(body.entry)) {
    return [];
  }

  const events: InstagramWebhookEvent[] = [];
  for (const entry of body.entry) {
    if (!isRecord(entry)) {
      continue;
    }

    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (!isRecord(change)) {
          continue;
        }

        if (change.field === "comments" || change.field === "mentions") {
          const event = webhookEventFromChange(change);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    if (Array.isArray(entry.messaging)) {
      for (const messageEvent of entry.messaging) {
        const event = webhookEventFromMessaging(messageEvent);
        if (event) {
          events.push(event);
        }
      }
    }
  }

  return events;
}

function webhookEventFromChange(change: Record<string, unknown>) {
  const value = change.value;
  if (!isRecord(value)) {
    return null;
  }

  const media = value.media;
  const commentId = stringFrom(value.id ?? value.comment_id);
  const textValue = stringFrom(
    value.text ?? value.message ?? value.caption ?? value.comment_text,
  );
  const mediaId = stringFrom(
    value.media_id ?? (isRecord(media) ? media.id : undefined),
  );

  if (!textValue) {
    return null;
  }

  return {
    id: commentId || stringFrom(value.mention_id) || randomUUID(),
    kind: change.field === "mentions" ? "mention" as const : "comment" as const,
    text: textValue,
    mediaId: mediaId || undefined,
    replyTarget: commentId
      ? { type: "comment" as const, commentId }
      : { type: "unsupported" as const },
  };
}

function webhookEventFromMessaging(messageEvent: unknown) {
  if (!isRecord(messageEvent)) {
    return null;
  }

  const message = messageEvent.message;
  if (!isRecord(message) || message.is_echo === true) {
    return null;
  }

  const textValue = stringFrom(message.text);
  const sender = messageEvent.sender;
  const senderId = stringFrom(isRecord(sender) ? sender.id : undefined);
  const messageId = stringFrom(message.mid);

  if (!textValue || !senderId) {
    return null;
  }

  return {
    id: messageId || randomUUID(),
    kind: "message" as const,
    text: textValue,
    replyTarget: { type: "message" as const, senderId },
  };
}

async function exchangeCodeForShortToken(code: string, redirectUri: string) {
  const body = new FormData();
  body.set("client_id", requiredEnv("INSTAGRAM_APP_ID"));
  body.set("client_secret", requiredEnv("INSTAGRAM_APP_SECRET"));
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);
  body.set("code", code);

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`Instagram token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    user_id?: number | string;
    permissions?: string[];
  };
}

async function exchangeForLongLivedToken(accessToken: string) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", requiredEnv("INSTAGRAM_APP_SECRET"));
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Long-lived token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };
}

async function handleInstagramMedia() {
  const data = await readData();
  const accessToken = getAccessToken(data);

  if (!accessToken) {
    return json(401, { error: "Connect Instagram first" });
  }

  const media = await fetchInstagramMedia(accessToken);
  return json(200, media);
}

async function fetchInstagramMedia(accessToken: string): Promise<InstagramMediaItem[]> {
  const url = new URL(`https://graph.instagram.com/${getGraphVersion()}/me/media`);
  url.searchParams.set(
    "fields",
    [
      "id",
      "caption",
      "media_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp",
      "comments_count",
      "like_count",
    ].join(","),
  );
  url.searchParams.set("limit", "25");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Instagram media fetch failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? []).filter(isRecord).map((item) => ({
    id: stringFrom(item.id),
    caption: stringFrom(item.caption),
    mediaType: stringFrom(item.media_type),
    mediaUrl: stringFrom(item.media_url) || undefined,
    thumbnailUrl: stringFrom(item.thumbnail_url) || undefined,
    permalink: stringFrom(item.permalink) || undefined,
    timestamp: stringFrom(item.timestamp) || undefined,
    commentsCount: numberFrom(item.comments_count),
    likeCount: numberFrom(item.like_count),
  }));
}

function getGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION ?? "v24.0";
}

function getOAuthRedirectUri(request: Request) {
  if (process.env.INSTAGRAM_OAUTH_REDIRECT_URI) {
    return process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return `${proto}://${host}/api/auth/instagram/callback`;
}

function redirectToApp(request: Request, message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("instagram", message);
  return Response.redirect(url, 302);
}

function getInstagramAppId() {
  return process.env.INSTAGRAM_APP_ID ?? process.env.VITE_INSTAGRAM_APP_ID;
}

function getAccessToken(data: DataFile) {
  return data.integration?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function verifySignature(request: Request, rawBody: Buffer) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }

  const expected = Buffer.from(
    `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`,
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function validateDraft(draft: DraftRule) {
  if (!draft.name || !draft.message) {
    throw new Error("Rule name and DM message are required");
  }

  if (draft.triggerType === "keyword" && !draft.keyword) {
    throw new Error("Keyword rules require a keyword");
  }

  if (!["keyword", "any"].includes(draft.triggerType)) {
    throw new Error("Invalid trigger type");
  }
}

async function readData(): Promise<DataFile> {
  if (hasSupabaseConfig()) {
    return readSupabaseData();
  }

  await mkdir(dataDirectory, { recursive: true });

  if (!existsSync(dataPath)) {
    const initialData = { rules: starterRules, activity: [], integration: {} };
    await writeData(initialData);
    return initialData;
  }

  const file = await readFile(dataPath, "utf8");
  const data = JSON.parse(file) as Partial<DataFile>;
  return {
    rules: Array.isArray(data.rules) ? data.rules : starterRules,
    activity: Array.isArray(data.activity) ? data.activity : [],
    integration: isRecord(data.integration) ? data.integration : {},
  };
}

async function writeData(data: DataFile) {
  if (hasSupabaseConfig()) {
    await writeSupabaseData(data);
    return;
  }

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataPath, JSON.stringify(data, null, 2));
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function readSupabaseData(): Promise<DataFile> {
  const url = supabaseRestUrl();
  url.searchParams.set("id", `eq.${supabaseStateId}`);
  url.searchParams.set("select", "data");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{ data?: unknown }>;
  const data = rows[0]?.data;
  if (!isRecord(data)) {
    const initialData = normalizeData({});
    await writeSupabaseData(initialData);
    return initialData;
  }

  return normalizeData(decryptData(data));
}

async function writeSupabaseData(data: DataFile) {
  const response = await fetch(supabaseRestUrl(), {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: supabaseStateId,
      data: encryptData(data),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${await response.text()}`);
  }
}

function supabaseRestUrl() {
  return new URL(`/rest/v1/${supabaseStateTable}`, requiredEnv("SUPABASE_URL"));
}

function supabaseHeaders() {
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function normalizeData(data: Partial<DataFile>): DataFile {
  return {
    rules: Array.isArray(data.rules) ? data.rules : starterRules,
    activity: Array.isArray(data.activity) ? data.activity : [],
    integration: isRecord(data.integration) ? data.integration : {},
  };
}

function encryptData(data: DataFile): DataFile {
  const integration = data.integration;
  if (!integration?.accessToken) {
    return data;
  }

  const { accessToken, ...restIntegration } = integration;
  return {
    ...data,
    integration: {
      ...restIntegration,
      encryptedAccessToken: encryptSecret(accessToken),
    },
  };
}

function decryptData(data: Record<string, unknown>): Partial<DataFile> {
  const integration = data.integration;
  if (!isRecord(integration)) {
    return data as Partial<DataFile>;
  }

  const encryptedAccessToken = stringFrom(integration.encryptedAccessToken);
  if (!encryptedAccessToken) {
    return data as Partial<DataFile>;
  }

  return {
    ...data,
    integration: {
      ...integration,
      accessToken: decryptSecret(encryptedAccessToken),
    },
  } as Partial<DataFile>;
}

function encryptSecret(secret: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSecret(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing APP_ENCRYPTION_KEY for encrypted Supabase storage");
  }

  return createHash("sha256").update(secret).digest();
}

async function readJson<T>(request: Request): Promise<T> {
  const textBody = await request.text();
  return textBody ? (JSON.parse(textBody) as T) : (emptyDraft as T);
}

function json(statusCode: number, payload: unknown) {
  return Response.json(payload, { status: statusCode });
}

function text(statusCode: number, payload: string) {
  return new Response(payload, {
    status: statusCode,
    headers: { "Content-Type": "text/plain" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberFrom(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
