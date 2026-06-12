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
  processedCommentIds?: string[];
  integration?: InstagramIntegration;
};

type InstagramIntegration = {
  accessToken?: string;
  encryptedAccessToken?: string;
  pageAccessToken?: string;
  encryptedPageAccessToken?: string;
  pageId?: string;
  pageName?: string;
  tokenType?: string;
  loginProvider?: "instagram" | "facebook";
  facebookUserId?: string;
  userId?: string;
  webhookAccountIds?: string[];
  permissions?: string[];
  webhookSubscribedAt?: string;
  webhookSubscriptionCheckedAt?: string;
  webhookSubscriptionError?: string;
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
  accountId?: string;
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
  ownerId?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
  commentsCount?: number;
  likeCount?: number;
};

type InstagramCommentItem = {
  id: string;
  text: string;
  timestamp?: string;
  username?: string;
  mediaId?: string;
  parentId?: string;
};

type SendReplyResult =
  | {
      ok: true;
      status: "sent" | "dry_run";
      error?: undefined;
      attempts?: string[];
    }
  | {
      ok: false;
      error: string;
      status?: undefined;
      attempts?: string[];
    };

const dataDirectory = path.resolve(
  process.env.MUSEINBOX_DATA_DIR ??
    (process.env.VERCEL ? "/tmp/museinbox" : ".museinbox"),
);
const dataPath = path.join(dataDirectory, "data.json");
const supabaseStateTable = "museinbox_state";
const defaultStateId = "default";
const sessionCookieName = "museinbox_session";
const oauthCookieName = "museinbox_oauth";
const defaultScopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");
const defaultFacebookScopes = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_messaging",
  "business_management",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
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
      return handleInstagramMedia(request);
    }

    if (request.method === "POST" && pathname === "/api/instagram/comments/sync") {
      return syncInstagramComments(request);
    }

    if (request.method === "GET" && pathname === "/api/auth/instagram/start") {
      return startOAuth(request, "instagram");
    }

    if (request.method === "GET" && pathname === "/api/auth/facebook/start") {
      return startOAuth(request, "facebook");
    }

    if (
      request.method === "GET" &&
      pathname === "/api/auth/instagram/callback"
    ) {
      return handleOAuthCallback(request, requestUrl, "instagram");
    }

    if (
      request.method === "GET" &&
      pathname === "/api/auth/facebook/callback"
    ) {
      return handleOAuthCallback(request, requestUrl, "facebook");
    }

    if (
      request.method === "POST" &&
      pathname === "/api/auth/instagram/disconnect"
    ) {
      return disconnectInstagram(request);
    }

    if (request.method === "GET" && pathname === "/api/instagram/status") {
      const stateId = getRequestStateId(request);
      const data = await readData(stateId);
      const subscriptionChanged = await ensureInstagramWebhookSubscription(
        data,
        "status",
      );
      const aliasChanged = await discoverInstagramWebhookAccountAliases(
        data,
        "status",
      );
      if (subscriptionChanged || aliasChanged) {
        await writeData(data, stateId);
      }

      return json(200, {
        webhookPath: "/api/instagram/webhook",
        oauthStartPath: "/api/auth/instagram/start",
        facebookOAuthStartPath: "/api/auth/facebook/start",
        oauthCallbackPath: "/api/auth/instagram/callback",
        facebookOAuthCallbackPath: "/api/auth/facebook/callback",
        oauthRedirectUri:
          data.integration?.oauthRedirectUri ??
          process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        oauthAuthorizeUrl: data.integration?.oauthAuthorizeUrl,
        lastOAuthError: data.integration?.lastOAuthError,
        graphVersion: getGraphVersion(),
        hasAccessToken: Boolean(getAccessToken(data)),
        hasPageAccess: Boolean(getPageAccessToken(data)),
        connected: isMetaConnected(data),
        tokenSource:
          data.integration?.accessToken || data.integration?.pageAccessToken
            ? "oauth"
            : "env",
        connectedAt: data.integration?.connectedAt,
        expiresAt: data.integration?.expiresAt,
        instagramUserId: data.integration?.userId,
        webhookAccountIds: data.integration?.webhookAccountIds ?? [],
        facebookUserId: data.integration?.facebookUserId,
        loginProvider: data.integration?.loginProvider,
        pageId: data.integration?.pageId,
        pageName: data.integration?.pageName,
        canSendPrivateReplies: canSendPrivateReplies(data),
        permissions: data.integration?.permissions ?? [],
        webhookSubscribedAt: data.integration?.webhookSubscribedAt,
        webhookSubscriptionCheckedAt:
          data.integration?.webhookSubscriptionCheckedAt,
        webhookSubscriptionError: data.integration?.webhookSubscriptionError,
        hasAppId: Boolean(getInstagramAppId()),
        hasFacebookAppId: Boolean(getFacebookAppId()),
        hasFacebookLoginConfigId: Boolean(getFacebookLoginConfigId()),
        hasVerifyToken: Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
        hasAppSecret: Boolean(process.env.INSTAGRAM_APP_SECRET),
        hasFacebookAppSecret: Boolean(getFacebookAppSecret()),
        dryRun: process.env.INSTAGRAM_DRY_RUN === "true",
      });
    }

    if (request.method === "GET" && pathname === "/api/instagram/private-reply-readiness") {
      const data = await readData(getRequestStateId(request));
      return json(200, privateReplyReadiness(data));
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
    const data = await readData(getRequestStateId(request));
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
    const stateId = getRequestStateId(request);
    const data = await readData(stateId);
    data.rules = [rule, ...data.rules];
    await writeData(data, stateId);
    return json(201, rule);
  }

  return json(405, { error: "Method not allowed" });
}

async function handleRuleById(request: Request, pathname: string) {
  const id = decodeURIComponent(pathname.replace("/api/rules/", ""));
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
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
    await writeData(data, stateId);
    return json(200, updatedRule);
  }

  if (request.method === "DELETE") {
    data.rules = data.rules.filter((item) => item.id !== id);
    await writeData(data, stateId);
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
}

async function handleActivity(request: Request) {
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);

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
    await writeData(data, stateId);
    return json(201, entry);
  }

  return json(405, { error: "Method not allowed" });
}

async function startOAuth(request: Request, provider: "instagram" | "facebook") {
  const clientId = provider === "facebook" ? getFacebookAppId() : getInstagramAppId();
  const clientSecret =
    provider === "facebook" ? getFacebookAppSecret() : process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) {
    return json(400, {
      error:
        provider === "facebook"
          ? "Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET in .env.local"
          : "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET in .env.local",
    });
  }

  const redirectUri = getOAuthRedirectUri(request, provider);
  const state = randomUUID();

  const scopes =
    provider === "facebook"
      ? process.env.FACEBOOK_OAUTH_SCOPES ?? defaultFacebookScopes
      : process.env.INSTAGRAM_OAUTH_SCOPES ?? defaultScopes;
  const authBase =
    provider === "facebook"
      ? `https://www.facebook.com/${getGraphVersion()}/dialog/oauth`
      : "https://www.instagram.com/oauth/authorize";
  const authUrl = [
    authBase,
    `force_reauth=true`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    "response_type=code",
    `state=${encodeURIComponent(state)}`,
    `scope=${encodeURIComponent(scopes)}`,
  ].join("&").replace("&", "?");
  const finalAuthUrl = addFacebookLoginConfig(authUrl, provider);

  return redirect(finalAuthUrl, [
    buildCookie(
      oauthCookieName,
      signCookieValue({
        state,
        provider,
        redirectUri,
        oauthStartedAt: new Date().toISOString(),
        oauthAuthorizeUrl: finalAuthUrl,
      }),
      10 * 60,
    ),
  ]);
}

async function handleOAuthCallback(
  request: Request,
  requestUrl: URL,
  provider: "instagram" | "facebook",
) {
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  if (error) {
    return redirectToApp(request, `${providerLabel(provider)} connection failed: ${errorDescription ?? error}`);
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthSession = readSignedCookie<{
    state?: string;
    provider?: "instagram" | "facebook";
    redirectUri?: string;
    oauthAuthorizeUrl?: string;
  }>(request, oauthCookieName);
  if (!code) {
    return redirectToApp(request, `${providerLabel(provider)} connection failed: missing OAuth code`);
  }

  if (
    !oauthSession?.state ||
    state !== oauthSession.state ||
    (oauthSession.provider && oauthSession.provider !== provider)
  ) {
    return redirectToApp(request, `${providerLabel(provider)} connection failed: invalid OAuth state`);
  }

  const redirectUri = oauthSession.redirectUri ?? getOAuthRedirectUri(request, provider);
  if (provider === "facebook") {
    return handleFacebookOAuthCallback(request, code, redirectUri, oauthSession.oauthAuthorizeUrl);
  }

  let shortToken: Awaited<ReturnType<typeof exchangeCodeForShortToken>>;
  try {
    shortToken = await exchangeCodeForShortToken(code, redirectUri);
  } catch (exchangeError) {
    const stateId = getRequestStateId(request);
    const data = await readData(stateId);
    data.integration = {
      ...data.integration,
      lastOAuthError:
        exchangeError instanceof Error ? exchangeError.message : "Unknown OAuth error",
    };
    await writeData(data, stateId);
    throw exchangeError;
  }

  const longToken = await exchangeForLongLivedToken(shortToken.access_token);
  const userId = String(shortToken.user_id ?? "");
  const stateId = accountStateId(userId);
  const data = await readData(stateId);
  data.integration = {
    ...data.integration,
    accessToken: longToken.access_token,
    tokenType: longToken.token_type,
    loginProvider: "instagram",
    userId,
    webhookAccountIds: [
      userId,
      ...(data.integration?.webhookAccountIds ?? []),
    ]
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index),
    permissions: shortToken.permissions ?? [],
    connectedAt: new Date().toISOString(),
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : undefined,
    oauthRedirectUri: redirectUri,
    oauthAuthorizeUrl: oauthSession.oauthAuthorizeUrl,
  };
  await ensureInstagramWebhookSubscription(data, "oauth");
  await discoverInstagramWebhookAccountAliases(data, "oauth");
  await writeData(data, stateId);
  return redirectToApp(request, "Instagram connected. Private replies are ready when comment permissions are granted.", [
    buildCookie(
      sessionCookieName,
      signCookieValue({
        stateId,
        instagramUserId: userId,
        signedInAt: new Date().toISOString(),
      }),
      60 * 60 * 24 * 60,
    ),
    clearCookie(oauthCookieName),
  ]);
}

async function handleFacebookOAuthCallback(
  request: Request,
  code: string,
  redirectUri: string,
  oauthAuthorizeUrl?: string,
) {
  let shortToken: Awaited<ReturnType<typeof exchangeFacebookCodeForToken>>;
  try {
    shortToken = await exchangeFacebookCodeForToken(code, redirectUri);
  } catch (exchangeError) {
    const stateId = getRequestStateId(request);
    const data = await readData(stateId);
    data.integration = {
      ...data.integration,
      lastOAuthError:
        exchangeError instanceof Error ? exchangeError.message : "Unknown OAuth error",
    };
    await writeData(data, stateId);
    throw exchangeError;
  }

  const longToken = await exchangeForLongLivedFacebookToken(shortToken.access_token);
  const profile = await fetchFacebookProfile(longToken.access_token);
  const page = await fetchConnectedInstagramPage(longToken.access_token);
  const stateId = accountStateId(page.instagramUserId);
  const data = await readData(stateId);
  data.integration = {
    ...data.integration,
    accessToken: data.integration?.accessToken,
    pageAccessToken: page.accessToken,
    pageId: page.id,
    pageName: page.name,
    loginProvider: "facebook",
    facebookUserId: profile.id,
    userId: page.instagramUserId,
    webhookAccountIds: [
      page.instagramUserId,
      ...(data.integration?.webhookAccountIds ?? []),
    ]
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index),
    permissions: longToken.permissions ?? data.integration?.permissions ?? [],
    connectedAt: new Date().toISOString(),
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : data.integration?.expiresAt,
    oauthRedirectUri: redirectUri,
    oauthAuthorizeUrl,
    lastOAuthError: undefined,
  };
  await writeData(data, stateId);
  return redirectToApp(request, "Facebook Page connected. Private replies are ready.", [
    buildCookie(
      sessionCookieName,
      signCookieValue({
        stateId,
        instagramUserId: page.instagramUserId,
        facebookUserId: profile.id,
        signedInAt: new Date().toISOString(),
      }),
      60 * 60 * 24 * 60,
    ),
    clearCookie(oauthCookieName),
  ]);
}

async function disconnectInstagram(request: Request) {
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
  data.integration = {
    oauthState: undefined,
    oauthStartedAt: undefined,
    oauthRedirectUri: undefined,
    oauthAuthorizeUrl: undefined,
    lastOAuthError: undefined,
  };
  await writeData(data, stateId);
  return json(200, { ok: true }, [clearCookie(sessionCookieName)]);
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
  const diagnosticId = createDiagnosticId("webhook");
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!verifySignature(request, rawBody)) {
    logDiagnostic("webhook_signature_rejected", { diagnosticId });
    return json(403, { error: "Invalid Meta signature" });
  }

  const body = JSON.parse(rawBody.toString("utf8")) as unknown;
  const events = extractInstagramWebhookEvents(body);
  logDiagnostic("webhook_received", {
    diagnosticId,
    events: events.length,
    eventKinds: events.map((event) => event.kind),
    accountIds: events.map((event) => safeId(event.accountId)),
  });

  for (const event of events) {
    const stateId = event.accountId
      ? await resolveWebhookStateId(event.accountId, diagnosticId)
      : defaultStateId;
    const data = await readData(stateId);
    await processInstagramEvent(data, event, diagnosticId);
    await writeData(data, stateId);
  }

  return json(200, { ok: true, events: events.length });
}

async function sendWebhookReply(
  data: DataFile,
  replyTarget: InstagramWebhookEvent["replyTarget"],
  message: string,
  diagnosticId: string,
) {
  if (replyTarget.type === "comment") {
    return sendPrivateReply(data, replyTarget.commentId, message, diagnosticId);
  }

  if (replyTarget.type === "message") {
    return sendInstagramMessage(data, replyTarget.senderId, message, diagnosticId);
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
  diagnosticId: string,
): Promise<SendReplyResult> {
  logDiagnostic("private_reply_start", {
    diagnosticId,
    commentId: safeId(commentId),
    hasInstagramAccess: Boolean(getInstagramAccessToken(data)),
    instagramUserId: safeId(getInstagramUserId(data)),
    hasPageAccess: Boolean(getPageAccessToken(data)),
    pageId: safeId(getPageId(data)),
    loginProvider: data.integration?.loginProvider,
    permissions: data.integration?.permissions,
    messageLength: message.length,
  });

  if (process.env.INSTAGRAM_DRY_RUN === "true") {
    logDiagnostic("private_reply_dry_run", { diagnosticId });
    return { ok: true, status: "dry_run" as const, attempts: ["dry_run"] };
  }

  const accessToken = getInstagramAccessToken(data);
  const instagramUserId = getInstagramUserId(data);
  if (accessToken && instagramUserId) {
    const instagramResult = await sendInstagramPrivateReply(
      instagramUserId,
      commentId,
      message,
      accessToken,
      diagnosticId,
    );
    if (instagramResult.ok) {
      return instagramResult;
    }

    const pageId = getPageId(data);
    const pageAccessToken = getPageAccessToken(data);
    if (pageId && pageAccessToken) {
      const pageResult = await sendPagePrivateReply(
        pageId,
        commentId,
        message,
        pageAccessToken,
        diagnosticId,
      );
      if (pageResult.ok) {
        return pageResult;
      }

      return {
        ok: false,
        error: joinSendErrors(instagramResult.error, pageResult.error),
        attempts: [...(instagramResult.attempts ?? []), ...(pageResult.attempts ?? [])],
      };
    }

    return instagramResult;
  }

  return {
    ok: false,
    error:
      "Private replies require a connected Instagram professional account. Reconnect Instagram before sending comment-to-DM replies.",
    attempts: ["missing_instagram_connection"],
  };
}

async function sendInstagramPrivateReply(
  instagramUserId: string,
  commentId: string,
  message: string,
  accessToken: string,
  diagnosticId: string,
): Promise<SendReplyResult> {
  const meResult = await postInstagramPrivateReply(
    "me",
    commentId,
    message,
    accessToken,
    diagnosticId,
  );
  if (meResult.ok || !shouldRetryPrivateReplyWithMe(meResult.error)) {
    return meResult;
  }

  const directResult = await postInstagramPrivateReply(
    instagramUserId,
    commentId,
    message,
    accessToken,
    diagnosticId,
  );
  if (directResult.ok) {
    return directResult;
  }

  return {
    ok: false,
    error: joinSendErrors(meResult.error, directResult.error),
    attempts: [...(meResult.attempts ?? []), ...(directResult.attempts ?? [])],
  };
}

async function postInstagramPrivateReply(
  targetId: string,
  commentId: string,
  message: string,
  accessToken: string,
  diagnosticId: string,
): Promise<SendReplyResult> {
  const route = `Instagram ${targetId}/messages`;
  logDiagnostic("private_reply_route_attempt", {
    diagnosticId,
    route,
    targetId: safeId(targetId),
    commentId: safeId(commentId),
    host: "graph.instagram.com",
  });

  const result = await fetch(
    `https://graph.instagram.com/${getGraphVersion()}/${encodeURIComponent(targetId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message },
      }),
    },
  );

  if (!result.ok) {
    const error = await result.text();
    logDiagnostic("private_reply_route_failed", {
      diagnosticId,
      route,
      status: result.status,
      error: summarizeMetaError(error),
    });
    return {
      ok: false,
      error: labelMetaError(route, error),
      attempts: [`${route}: ${result.status}`],
    };
  }

  logDiagnostic("private_reply_route_sent", {
    diagnosticId,
    route,
    status: result.status,
  });
  return { ok: true, status: "sent" as const, attempts: [`${route}: sent`] };
}

async function sendPagePrivateReply(
  pageId: string,
  commentId: string,
  message: string,
  accessToken: string,
  diagnosticId: string,
): Promise<SendReplyResult> {
  const route = "Facebook Page messages";
  logDiagnostic("private_reply_route_attempt", {
    diagnosticId,
    route,
    pageId: safeId(pageId),
    commentId: safeId(commentId),
    host: "graph.facebook.com",
  });

  const result = await fetch(
    `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(pageId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message },
      }),
    },
  );

  if (!result.ok) {
    const error = await result.text();
    logDiagnostic("private_reply_route_failed", {
      diagnosticId,
      route,
      status: result.status,
      error: summarizeMetaError(error),
    });
    return {
      ok: false,
      error: labelMetaError(route, error),
      attempts: [`${route}: ${result.status}`],
    };
  }

  logDiagnostic("private_reply_route_sent", {
    diagnosticId,
    route,
    status: result.status,
  });
  return { ok: true, status: "sent" as const, attempts: [`${route}: sent`] };
}

async function sendInstagramMessage(
  data: DataFile,
  senderId: string,
  message: string,
  diagnosticId: string,
): Promise<SendReplyResult> {
  const accessToken = getAccessToken(data);
  logDiagnostic("message_reply_start", {
    diagnosticId,
    senderId: safeId(senderId),
    hasAccessToken: Boolean(accessToken),
    hasPageAccess: Boolean(getPageAccessToken(data)),
    pageId: safeId(getPageId(data)),
    messageLength: message.length,
  });

  if (process.env.INSTAGRAM_DRY_RUN === "true") {
    logDiagnostic("message_reply_dry_run", { diagnosticId });
    return { ok: true, status: "dry_run" as const };
  }

  const pageId = getPageId(data);
  const pageAccessToken = getPageAccessToken(data);
  if (pageId && pageAccessToken) {
    const body = new URLSearchParams({
      recipient: JSON.stringify({ id: senderId }),
      message: JSON.stringify({ text: message }),
      access_token: pageAccessToken,
    });
    const result = await fetch(
      `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(pageId)}/messages`,
      {
        method: "POST",
        body,
      },
    );

    if (!result.ok) {
      const error = await result.text();
      logDiagnostic("message_reply_failed", {
        diagnosticId,
        route: "Facebook Page messages",
        status: result.status,
        error: summarizeMetaError(error),
      });
      return { ok: false, error };
    }

    logDiagnostic("message_reply_sent", {
      diagnosticId,
      route: "Facebook Page messages",
      status: result.status,
    });
    return { ok: true, status: "sent" as const };
  }

  if (!accessToken) {
    logDiagnostic("message_reply_missing_token", { diagnosticId });
    return { ok: false, error: "Connect Instagram first" };
  }

  const body = new URLSearchParams({
    recipient: JSON.stringify({ id: senderId }),
    message: JSON.stringify({ text: message }),
    access_token: accessToken,
  });
  const result = await fetch(
    `https://graph.instagram.com/${getGraphVersion()}/me/messages`,
    {
      method: "POST",
      body,
    },
  );

  if (!result.ok) {
    const error = await result.text();
    logDiagnostic("message_reply_failed", {
      diagnosticId,
      route: "Instagram me/messages",
      status: result.status,
      error: summarizeMetaError(error),
    });
    return { ok: false, error };
  }

  logDiagnostic("message_reply_sent", {
    diagnosticId,
    route: "Instagram me/messages",
    status: result.status,
  });
  return { ok: true, status: "sent" as const };
}

async function processInstagramEvent(
  data: DataFile,
  event: InstagramWebhookEvent,
  diagnosticId: string,
) {
  logDiagnostic("event_processing_start", {
    diagnosticId,
    eventId: safeId(event.id),
    kind: event.kind,
    mediaId: safeId(event.mediaId),
    replyTarget:
      event.replyTarget.type === "comment"
        ? { type: "comment", commentId: safeId(event.replyTarget.commentId) }
        : event.replyTarget.type === "message"
          ? { type: "message", senderId: safeId(event.replyTarget.senderId) }
          : { type: "unsupported" },
    rules: data.rules.length,
    activeRules: data.rules.filter((rule) => rule.active).length,
    hasInstagramAccess: Boolean(getInstagramAccessToken(data)),
    instagramUserId: safeId(getInstagramUserId(data)),
    hasPageAccess: Boolean(getPageAccessToken(data)),
  });

  if (
    event.replyTarget.type === "comment" &&
    data.processedCommentIds?.includes(event.replyTarget.commentId)
  ) {
    logDiagnostic("event_skipped_already_processed", {
      diagnosticId,
      commentId: safeId(event.replyTarget.commentId),
    });
    return;
  }

  const matchedRule = findMatchingRule(event.text, data.rules, event.mediaId);
  const dm = matchedRule ? composeDm(matchedRule) : "";
  logDiagnostic("event_rule_match_evaluated", {
    diagnosticId,
    eventId: safeId(event.id),
    mediaId: safeId(event.mediaId),
    matched: Boolean(matchedRule),
    matchedRuleId: safeId(matchedRule?.id),
    matchedRuleName: matchedRule?.name,
    triggerType: matchedRule?.triggerType,
    dmLength: dm.length,
  });
  const entry: Activity = {
    id: randomUUID(),
    externalId:
      event.replyTarget.type === "comment"
        ? event.replyTarget.commentId
        : event.replyTarget.type === "message"
          ? event.replyTarget.senderId
          : event.id,
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
    diagnosticId,
  };

  if (matchedRule && dm) {
    const sendResult = await sendWebhookReply(
      data,
      event.replyTarget,
      dm,
      diagnosticId,
    );
    entry.status = sendResult.ok ? sendResult.status : "failed";
    entry.error = sendResult.error;
    entry.deliveryAttempts = sendResult.attempts;

    if (sendResult.ok && event.replyTarget.type === "comment") {
      const commentId = event.replyTarget.commentId;
      data.processedCommentIds = [
        commentId,
        ...(data.processedCommentIds ?? []).filter((id) => id !== commentId),
      ].slice(0, 1000);
    }
  }

  data.activity = [entry, ...data.activity].slice(0, 50);
  logDiagnostic("activity_entry_written", {
    diagnosticId,
    activityId: safeId(entry.id),
    status: entry.status,
    source: entry.source,
    matchedRuleName: entry.matchedRuleName,
    hasError: Boolean(entry.error),
    deliveryAttempts: entry.deliveryAttempts,
  });
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

    const accountId = stringFrom(entry.id);

    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (!isRecord(change)) {
          continue;
        }

        if (change.field === "comments" || change.field === "mentions") {
          const event = webhookEventFromChange(change, accountId);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    if (Array.isArray(entry.messaging)) {
      for (const messageEvent of entry.messaging) {
        const event = webhookEventFromMessaging(messageEvent, accountId);
        if (event) {
          events.push(event);
        }
      }
    }
  }

  return events;
}

function webhookEventFromChange(change: Record<string, unknown>, accountId?: string) {
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
    accountId,
    kind: change.field === "mentions" ? "mention" as const : "comment" as const,
    text: textValue,
    mediaId: mediaId || undefined,
    replyTarget: commentId
      ? { type: "comment" as const, commentId }
      : { type: "unsupported" as const },
  };
}

function webhookEventFromMessaging(messageEvent: unknown, accountId?: string) {
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
    accountId,
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

async function ensureInstagramWebhookSubscription(
  data: DataFile,
  diagnosticId: string,
) {
  const accessToken = getInstagramAccessToken(data);
  const instagramUserId = getInstagramUserId(data);
  if (!accessToken || !instagramUserId) {
    return false;
  }

  if (data.integration?.webhookSubscribedAt) {
    return false;
  }

  const lastCheckedAt = Date.parse(
    data.integration?.webhookSubscriptionCheckedAt ?? "",
  );
  if (
    !data.integration?.webhookSubscriptionError &&
    Number.isFinite(lastCheckedAt) &&
    Date.now() - lastCheckedAt < 5 * 60 * 1000
  ) {
    return false;
  }

  const fields = "comments,messages";
  logDiagnostic("webhook_account_subscription_start", {
    diagnosticId,
    instagramUserId: safeId(instagramUserId),
    fields,
  });

  data.integration = {
    ...data.integration,
    webhookSubscriptionCheckedAt: new Date().toISOString(),
  };

  const attempts = [
    { label: "Instagram me/subscribed_apps", targetId: "me" },
    { label: "Instagram ID subscribed_apps", targetId: instagramUserId },
  ];
  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await postInstagramWebhookSubscription(
      attempt.targetId,
      attempt.label,
      fields,
      accessToken,
      diagnosticId,
    );
    if (result.ok) {
      data.integration = {
        ...data.integration,
        webhookSubscribedAt: new Date().toISOString(),
        webhookSubscriptionError:
          result.success === false ? "Meta did not confirm subscription" : undefined,
      };
      return true;
    }

    errors.push(result.error);
  }

  data.integration = {
    ...data.integration,
    webhookSubscriptionError: joinSendErrors(...errors),
  };
  return true;
}

async function postInstagramWebhookSubscription(
  targetId: string,
  label: string,
  fields: string,
  accessToken: string,
  diagnosticId: string,
): Promise<{ ok: true; success?: boolean } | { ok: false; error: string }> {
  const url = new URL(
    `https://graph.instagram.com/${getGraphVersion()}/${encodeURIComponent(targetId)}/subscribed_apps`,
  );
  url.searchParams.set("subscribed_fields", fields);
  url.searchParams.set("access_token", accessToken);

  logDiagnostic("webhook_account_subscription_attempt", {
    diagnosticId,
    route: label,
    targetId: safeId(targetId),
    fields,
  });

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const error = await response.text();
    logDiagnostic("webhook_account_subscription_failed", {
      diagnosticId,
      route: label,
      targetId: safeId(targetId),
      status: response.status,
      error: summarizeMetaError(error),
    });
    return {
      ok: false,
      error: labelMetaError(label, error),
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
  };
  logDiagnostic("webhook_account_subscription_enabled", {
    diagnosticId,
    route: label,
    targetId: safeId(targetId),
    fields,
    success: payload.success ?? true,
  });
  return { ok: true, success: payload.success };
}

async function exchangeFacebookCodeForToken(code: string, redirectUri: string) {
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", requiredEnv("FACEBOOK_APP_ID"));
  url.searchParams.set("client_secret", requiredEnv("FACEBOOK_APP_SECRET"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facebook token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };
}

async function exchangeForLongLivedFacebookToken(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", requiredEnv("FACEBOOK_APP_ID"));
  url.searchParams.set("client_secret", requiredEnv("FACEBOOK_APP_SECRET"));
  url.searchParams.set("fb_exchange_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Long-lived Facebook token exchange failed: ${await response.text()}`);
  }

  const token = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };
  const permissions = await fetchFacebookPermissions(token.access_token);
  return { ...token, permissions };
}

async function fetchFacebookProfile(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facebook profile fetch failed: ${await response.text()}`);
  }

  const profile = (await response.json()) as { id?: string; name?: string };
  if (!profile.id) {
    throw new Error("Facebook profile fetch did not return an account id");
  }

  return { id: profile.id, name: profile.name };
}

async function fetchFacebookPermissions(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? [])
    .filter(isRecord)
    .filter((item) => stringFrom(item.status) === "granted")
    .map((item) => stringFrom(item.permission))
    .filter(Boolean);
}

async function fetchConnectedInstagramPage(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${getGraphVersion()}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,tasks,instagram_business_account{id,username}",
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Facebook Pages fetch failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  const pages = (payload.data ?? []).filter(isRecord);
  const page = pages.find((item) => {
    const account = item.instagram_business_account;
    return isRecord(account) && stringFrom(account.id);
  });

  if (!page) {
    throw new Error(
      "No Facebook Page with a connected Instagram professional account was found",
    );
  }

  const instagramAccount = page.instagram_business_account;
  if (!isRecord(instagramAccount)) {
    throw new Error("Connected Facebook Page did not include an Instagram account");
  }

  const id = stringFrom(page.id);
  const pageAccessToken = stringFrom(page.access_token);
  const instagramUserId = stringFrom(instagramAccount.id);
  if (!id || !pageAccessToken || !instagramUserId) {
    throw new Error("Connected Facebook Page is missing private-reply credentials");
  }

  return {
    id,
    name: stringFrom(page.name) || "Connected Facebook Page",
    accessToken: pageAccessToken,
    instagramUserId,
    instagramUsername: stringFrom(instagramAccount.username),
  };
}

async function handleInstagramMedia(request: Request) {
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
  const readContext = getInstagramReadContext(data);

  if (!readContext) {
    return json(401, { error: "Connect Instagram first" });
  }

  const media = await fetchInstagramMedia(readContext);
  if (
    updateWebhookAccountAliases(
      data,
      media.map((item) => item.ownerId).filter(Boolean),
      "media",
    )
  ) {
    await writeData(data, stateId);
  }
  return json(200, media);
}

async function syncInstagramComments(request: Request) {
  const diagnosticId = createDiagnosticId("sync");
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
  const subscriptionChanged = await ensureInstagramWebhookSubscription(
    data,
    diagnosticId,
  );
  if (subscriptionChanged) {
    await writeData(data, stateId);
  }

  const readContext = getInstagramReadContext(data);
  if (!readContext) {
    logDiagnostic("comment_sync_missing_connection", {
      diagnosticId,
      stateId: safeId(stateId),
    });
    return json(401, { error: "Connect Instagram first" });
  }

  const payload = await readJson<{ mediaId?: string }>(request);
  const mediaIds = [
    payload.mediaId,
    ...data.rules.map((rule) => rule.mediaId).filter(Boolean),
  ].filter((value, index, values): value is string => {
    return typeof value === "string" && value.length > 0 && values.indexOf(value) === index;
  });

  if (mediaIds.length === 0) {
    logDiagnostic("comment_sync_no_media", {
      diagnosticId,
      stateId: safeId(stateId),
      rules: data.rules.length,
    });
    return json(400, { error: "Pick a post or create a post-specific automation first" });
  }

  logDiagnostic("comment_sync_start", {
    diagnosticId,
    stateId: safeId(stateId),
    mediaIds: mediaIds.map(safeId),
    requestedMediaId: safeId(payload.mediaId),
    graphHost: readContext.graphHost,
    instagramUserId: safeId(readContext.instagramUserId ?? getInstagramUserId(data)),
    hasInstagramAccess: Boolean(getInstagramAccessToken(data)),
    hasPageAccess: Boolean(getPageAccessToken(data)),
    permissions: data.integration?.permissions,
    rules: data.rules.length,
    activeRules: data.rules.filter((rule) => rule.active).length,
  });

  let checked = 0;
  let acted = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const mediaId of mediaIds) {
    let comments: InstagramCommentItem[];
    try {
      comments = await fetchInstagramComments(readContext, mediaId);
      logDiagnostic("comment_sync_comments_fetched", {
        diagnosticId,
        mediaId: safeId(mediaId),
        comments: comments.length,
      });
    } catch (error) {
      const message = messageFromUnknown(error);
      const status = isExpiredMetaTokenError(message) ? 401 : 502;
      logDiagnostic("comment_sync_comments_fetch_failed", {
        diagnosticId,
        mediaId: safeId(mediaId),
        status,
        error: summarizeMetaError(message),
      });
      return json(status, {
        error: isExpiredMetaTokenError(message)
          ? "Instagram connection expired. Reconnect Instagram, then check comments again."
          : message,
      });
    }

    for (const comment of comments) {
      checked += 1;
      if (comment.parentId || data.processedCommentIds?.includes(comment.id)) {
        logDiagnostic("comment_sync_comment_skipped", {
          diagnosticId,
          commentId: safeId(comment.id),
          mediaId: safeId(mediaId),
          reason: comment.parentId ? "reply_comment" : "already_processed",
        });
        continue;
      }

      const matchingRule = findMatchingRule(comment.text, data.rules, mediaId);
      if (!matchingRule || !commentIsEligibleForRule(comment, matchingRule)) {
        logDiagnostic("comment_sync_comment_no_action", {
          diagnosticId,
          commentId: safeId(comment.id),
          mediaId: safeId(mediaId),
          matched: Boolean(matchingRule),
          matchedRuleId: safeId(matchingRule?.id),
          reason: matchingRule ? "older_than_rule" : "no_matching_rule",
        });
        continue;
      }

      logDiagnostic("comment_sync_comment_matched", {
        diagnosticId,
        commentId: safeId(comment.id),
        mediaId: safeId(mediaId),
        matchedRuleId: safeId(matchingRule.id),
        matchedRuleName: matchingRule.name,
      });
      await processInstagramEvent(data, {
        id: comment.id,
        kind: "comment",
        text: comment.text,
        mediaId,
        replyTarget: { type: "comment", commentId: comment.id },
      }, diagnosticId);
      const latestEntry = data.activity[0];
      if (latestEntry) {
        latestEntry.source = "instagram_comment_sync";
        if (latestEntry.status === "failed") {
          failed += 1;
          if (latestEntry.error) {
            errors.push(latestEntry.error);
          }
          continue;
        }
      }
      acted += 1;
    }
  }

  await writeData(data, stateId);
  logDiagnostic("comment_sync_finished", {
    diagnosticId,
    stateId: safeId(stateId),
    checked,
    acted,
    failed,
    errors: errors.map(summarizeMetaError),
  });
  return json(200, {
    ok: true,
    diagnosticId,
    checked,
    acted,
    failed,
    errors: [...new Set(errors)].slice(0, 3),
  });
}

type InstagramReadContext = {
  accessToken: string;
  graphHost: "facebook" | "instagram";
  instagramUserId?: string;
};

async function fetchInstagramMedia(
  context: InstagramReadContext,
): Promise<InstagramMediaItem[]> {
  const mediaOwner =
    context.graphHost === "facebook" && context.instagramUserId
      ? encodeURIComponent(context.instagramUserId)
      : "me";
  const url = new URL(`${graphBaseUrl(context)}/${mediaOwner}/media`);
  url.searchParams.set(
    "fields",
    [
      "id",
      "caption",
      "owner",
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
  url.searchParams.set("access_token", context.accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Instagram media fetch failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? []).filter(isRecord).map((item) => ({
    id: stringFrom(item.id),
    caption: stringFrom(item.caption),
    mediaType: stringFrom(item.media_type),
    ownerId: isRecord(item.owner) ? stringFrom(item.owner.id) || undefined : undefined,
    mediaUrl: stringFrom(item.media_url) || undefined,
    thumbnailUrl: stringFrom(item.thumbnail_url) || undefined,
    permalink: stringFrom(item.permalink) || undefined,
    timestamp: stringFrom(item.timestamp) || undefined,
    commentsCount: numberFrom(item.comments_count),
    likeCount: numberFrom(item.like_count),
  }));
}

async function fetchInstagramComments(
  context: InstagramReadContext,
  mediaId: string,
): Promise<InstagramCommentItem[]> {
  const url = new URL(
    `${graphBaseUrl(context)}/${encodeURIComponent(mediaId)}/comments`,
  );
  url.searchParams.set("fields", "id,text,timestamp,username,parent_id");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", context.accessToken);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Instagram comments fetch failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? []).filter(isRecord).map((item) => ({
    id: stringFrom(item.id),
    text: stringFrom(item.text),
    timestamp: stringFrom(item.timestamp) || undefined,
    username: stringFrom(item.username) || undefined,
    parentId: stringFrom(item.parent_id) || undefined,
  }));
}

function commentIsEligibleForRule(comment: InstagramCommentItem, rule: Rule) {
  if (!comment.timestamp) {
    return true;
  }

  const commentTime = Date.parse(comment.timestamp);
  const ruleTime = Date.parse(rule.createdAt);
  if (!Number.isFinite(commentTime) || !Number.isFinite(ruleTime)) {
    return true;
  }

  return commentTime >= ruleTime - 2 * 60 * 1000;
}

function getGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION ?? "v24.0";
}

function getOAuthRedirectUri(request: Request, provider: "instagram" | "facebook" = "instagram") {
  if (provider === "facebook" && process.env.FACEBOOK_OAUTH_REDIRECT_URI) {
    return process.env.FACEBOOK_OAUTH_REDIRECT_URI;
  }

  if (provider === "instagram" && process.env.INSTAGRAM_OAUTH_REDIRECT_URI) {
    return process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return `${proto}://${host}/api/auth/${provider}/callback`;
}

function redirectToApp(request: Request, message: string, cookies: string[] = []) {
  const url = new URL("/", request.url);
  url.searchParams.set("instagram", message);
  return redirect(url.toString(), cookies);
}

function getInstagramAppId() {
  return process.env.INSTAGRAM_APP_ID ?? process.env.VITE_INSTAGRAM_APP_ID;
}

function getFacebookAppId() {
  return process.env.FACEBOOK_APP_ID;
}

function getFacebookAppSecret() {
  return process.env.FACEBOOK_APP_SECRET;
}

function getFacebookLoginConfigId() {
  return process.env.FACEBOOK_LOGIN_CONFIG_ID;
}

function addFacebookLoginConfig(authUrl: string, provider: "instagram" | "facebook") {
  const configId = getFacebookLoginConfigId();
  if (provider !== "facebook" || !configId) {
    return authUrl;
  }

  const url = new URL(authUrl);
  url.searchParams.set("config_id", configId);
  return url.toString();
}

function getAccessToken(data: DataFile) {
  return (
    getInstagramAccessToken(data) ??
    data.integration?.pageAccessToken ??
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  );
}

function getInstagramAccessToken(data: DataFile) {
  return data.integration?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
}

function getInstagramUserId(data: DataFile) {
  return data.integration?.userId ?? process.env.INSTAGRAM_USER_ID;
}

function getInstagramReadContext(data: DataFile): InstagramReadContext | null {
  const pageAccessToken = getPageAccessToken(data);
  const instagramUserId = data.integration?.userId ?? process.env.INSTAGRAM_USER_ID;
  if (pageAccessToken && instagramUserId) {
    return {
      accessToken: pageAccessToken,
      graphHost: "facebook",
      instagramUserId,
    };
  }

  const accessToken = data.integration?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  if (accessToken) {
    return {
      accessToken,
      graphHost: "instagram",
    };
  }

  return null;
}

function graphBaseUrl(context: InstagramReadContext) {
  const host =
    context.graphHost === "facebook"
      ? "https://graph.facebook.com"
      : "https://graph.instagram.com";
  return `${host}/${getGraphVersion()}`;
}

function getPageId(data: DataFile) {
  return data.integration?.pageId ?? process.env.FACEBOOK_PAGE_ID;
}

function getPageAccessToken(data: DataFile) {
  return data.integration?.pageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
}

function canSendPrivateReplies(data: DataFile) {
  return Boolean(getInstagramAccessToken(data) && getInstagramUserId(data));
}

function isMetaConnected(data: DataFile) {
  return Boolean(getAccessToken(data) || canSendPrivateReplies(data));
}

function privateReplyReadiness(data: DataFile) {
  const checks = [
    {
      key: "instagramAppId",
      label: "Instagram app ID",
      ready: Boolean(getInstagramAppId()),
    },
    {
      key: "instagramAppSecret",
      label: "Instagram app secret",
      ready: Boolean(process.env.INSTAGRAM_APP_SECRET),
    },
    {
      key: "instagramAccessToken",
      label: "Instagram access",
      ready: Boolean(getInstagramAccessToken(data)),
    },
    {
      key: "instagramUserId",
      label: "Instagram professional account",
      ready: Boolean(getInstagramUserId(data)),
    },
  ];

  return {
    ready: checks.every((check) => check.ready),
    canSendPrivateReplies: canSendPrivateReplies(data),
    checks,
    missing: checks
      .filter((check) => !check.ready)
      .map((check) => check.label),
    pageName: data.integration?.pageName,
    loginProvider: data.integration?.loginProvider,
  };
}

function providerLabel(provider: "instagram" | "facebook") {
  return provider === "facebook" ? "Facebook Page" : "Instagram";
}

function getRequestStateId(request: Request) {
  const session = readSignedCookie<{ stateId?: string }>(request, sessionCookieName);
  return session?.stateId || defaultStateId;
}

function accountStateId(instagramUserId: string) {
  return instagramUserId ? `ig:${instagramUserId}` : defaultStateId;
}

async function resolveWebhookStateId(accountId: string, diagnosticId: string) {
  const directStateId = accountStateId(accountId);
  if (!hasSupabaseConfig()) {
    return directStateId;
  }

  const resolvedStateId = await findSupabaseStateIdForWebhookAccount(accountId);
  logDiagnostic("webhook_state_resolved", {
    diagnosticId,
    accountId: safeId(accountId),
    stateId: safeId(resolvedStateId ?? directStateId),
    matchedAlias: Boolean(resolvedStateId),
  });
  return resolvedStateId ?? directStateId;
}

async function findSupabaseStateIdForWebhookAccount(accountId: string) {
  const url = supabaseRestUrl();
  url.searchParams.set("select", "id,data");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase webhook state lookup failed: ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{ id?: unknown; data?: unknown }>;
  for (const row of rows) {
    const data = row.data;
    if (!isRecord(data) || !isRecord(data.integration)) {
      continue;
    }

    const userId = stringFrom(data.integration.userId);
    const aliases = Array.isArray(data.integration.webhookAccountIds)
      ? data.integration.webhookAccountIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (userId === accountId || aliases.includes(accountId)) {
      return stringFrom(row.id) || null;
    }
  }

  return null;
}

async function discoverInstagramWebhookAccountAliases(
  data: DataFile,
  diagnosticId: string,
) {
  const readContext = getInstagramReadContext(data);
  if (!readContext) {
    return false;
  }

  try {
    const accountIds = await fetchInstagramWebhookAccountIds(readContext);
    return updateWebhookAccountAliases(data, accountIds, diagnosticId);
  } catch (error) {
    logDiagnostic("webhook_alias_discovery_failed", {
      diagnosticId,
      error: summarizeMetaError(messageFromUnknown(error)),
    });
    return false;
  }
}

async function fetchInstagramWebhookAccountIds(context: InstagramReadContext) {
  const mediaOwner =
    context.graphHost === "facebook" && context.instagramUserId
      ? encodeURIComponent(context.instagramUserId)
      : "me";
  const url = new URL(`${graphBaseUrl(context)}/${mediaOwner}/media`);
  url.searchParams.set("fields", "id,owner");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", context.accessToken);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Instagram webhook alias discovery failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  return (payload.data ?? [])
    .filter(isRecord)
    .map((item) => (isRecord(item.owner) ? stringFrom(item.owner.id) : ""))
    .filter((value): value is string => Boolean(value));
}

function updateWebhookAccountAliases(
  data: DataFile,
  accountIds: Array<string | undefined>,
  diagnosticId: string,
) {
  const integration = data.integration;
  if (!integration) {
    return false;
  }

  const aliases = [
    integration.userId,
    ...(integration.webhookAccountIds ?? []),
    ...accountIds,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .filter((value, index, values) => values.indexOf(value) === index);

  const currentAliases = integration.webhookAccountIds ?? [];
  const changed =
    aliases.length !== currentAliases.length ||
    aliases.some((value) => !currentAliases.includes(value));
  if (!changed) {
    return false;
  }

  data.integration = {
    ...integration,
    webhookAccountIds: aliases,
  };
  logDiagnostic("webhook_aliases_updated", {
    diagnosticId,
    aliases: aliases.map(safeId),
  });
  return true;
}

function readSignedCookie<T>(request: Request, name: string): T | null {
  const value = getCookie(request, name);
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = signValue(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function signCookieValue(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded)}`;
}

function signValue(value: string) {
  return createHmac("sha256", cookieSecret()).update(value).digest("base64url");
}

function cookieSecret() {
  return (
    process.env.APP_SESSION_SECRET ??
    process.env.APP_ENCRYPTION_KEY ??
    process.env.INSTAGRAM_APP_SECRET ??
    "museinbox-local-dev-secret"
  );
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const cookie of cookieHeader.split(";")) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      return valueParts.join("=");
    }
  }

  return "";
}

function buildCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function messageFromUnknown(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createDiagnosticId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function logDiagnostic(event: string, details: Record<string, unknown> = {}) {
  const safeDetails = redactDiagnosticDetails(details);
  console.info(
    JSON.stringify({
      component: "museinbox",
      event,
      at: new Date().toISOString(),
      ...safeDetails,
    }),
  );
}

function redactDiagnosticDetails(value: Record<string, unknown>): Record<string, unknown>;
function redactDiagnosticDetails(value: unknown): unknown;
function redactDiagnosticDetails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactDiagnosticDetails);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/token|secret|authorization|cookie|key/i.test(key)) {
        return [key, item ? "[redacted]" : item];
      }

      return [key, redactDiagnosticDetails(item)];
    }),
  );
}

function safeId(value: unknown) {
  const id = stringFrom(value);
  if (!id) {
    return undefined;
  }

  if (id === "me") {
    return id;
  }

  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function summarizeMetaError(value: string) {
  const payloadStart = value.indexOf("{");
  const jsonValue = payloadStart >= 0 ? value.slice(payloadStart) : value;

  try {
    const payload = JSON.parse(jsonValue) as {
      error?: {
        message?: string;
        type?: string;
        code?: number;
        error_subcode?: number;
        fbtrace_id?: string;
      };
    };
    if (payload.error) {
      return {
        message: payload.error.message,
        type: payload.error.type,
        code: payload.error.code,
        subcode: payload.error.error_subcode,
        traceId: payload.error.fbtrace_id,
      };
    }
  } catch {
    // Fall through to text summary.
  }

  return value.slice(0, 500);
}

function isExpiredMetaTokenError(message: string) {
  return (
    message.includes('"code":190') ||
    message.includes("code 190") ||
    /expired|failed to decrypt|invalid oauth access token/i.test(message)
  );
}

function shouldRetryPrivateReplyWithMe(message: string) {
  return (
    message.includes('"code":100') ||
    /object with id .*does not exist|unsupported post request/i.test(message)
  );
}

function labelMetaError(route: string, error: string) {
  return `${route}: ${error}`;
}

function joinSendErrors(...errors: string[]) {
  return errors.filter(Boolean).join("\n");
}

function redirect(url: string, cookies: string[] = []) {
  const headers = new Headers();
  headers.set("Location", url);
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(null, { status: 302, headers });
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function verifySignature(request: Request, rawBody: Buffer) {
  const appSecrets = [
    process.env.INSTAGRAM_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
  ].filter((secret): secret is string => Boolean(secret));
  if (appSecrets.length === 0) {
    return true;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }

  const actual = Buffer.from(signature);
  return appSecrets.some((appSecret) => {
    const expected = Buffer.from(
      `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`,
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
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

async function readData(stateId = defaultStateId): Promise<DataFile> {
  if (hasSupabaseConfig()) {
    return readSupabaseData(stateId);
  }

  await mkdir(dataDirectory, { recursive: true });
  const localDataPath = localDataPathForState(stateId);

  if (!existsSync(localDataPath)) {
    const initialData = { rules: starterRules, activity: [], integration: {} };
    await writeData(initialData, stateId);
    return initialData;
  }

  const file = await readFile(localDataPath, "utf8");
  const data = JSON.parse(file) as Partial<DataFile>;
  return normalizeData(data);
}

async function writeData(data: DataFile, stateId = defaultStateId) {
  if (hasSupabaseConfig()) {
    await writeSupabaseData(data, stateId);
    return;
  }

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(localDataPathForState(stateId), JSON.stringify(data, null, 2));
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function readSupabaseData(stateId: string): Promise<DataFile> {
  const url = supabaseRestUrl();
  url.searchParams.set("id", `eq.${stateId}`);
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
    await writeSupabaseData(initialData, stateId);
    return initialData;
  }

  return normalizeData(decryptData(data));
}

async function writeSupabaseData(data: DataFile, stateId: string) {
  const response = await fetch(supabaseRestUrl(), {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: stateId,
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

function localDataPathForState(stateId: string) {
  if (stateId === defaultStateId) {
    return dataPath;
  }

  return path.join(dataDirectory, `data-${stateId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
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
    processedCommentIds: Array.isArray(data.processedCommentIds)
      ? data.processedCommentIds.filter((id): id is string => typeof id === "string")
      : [],
    integration: isRecord(data.integration) ? data.integration : {},
  };
}

function encryptData(data: DataFile): DataFile {
  const integration = data.integration;
  if (!integration?.accessToken && !integration?.pageAccessToken) {
    return data;
  }

  const { accessToken, pageAccessToken, ...restIntegration } = integration;
  return {
    ...data,
    integration: {
      ...restIntegration,
      encryptedAccessToken: accessToken
        ? encryptSecret(accessToken)
        : integration.encryptedAccessToken,
      encryptedPageAccessToken: pageAccessToken
        ? encryptSecret(pageAccessToken)
        : integration.encryptedPageAccessToken,
    },
  };
}

function decryptData(data: Record<string, unknown>): Partial<DataFile> {
  const integration = data.integration;
  if (!isRecord(integration)) {
    return data as Partial<DataFile>;
  }

  const encryptedAccessToken = stringFrom(integration.encryptedAccessToken);
  const encryptedPageAccessToken = stringFrom(integration.encryptedPageAccessToken);
  if (!encryptedAccessToken && !encryptedPageAccessToken) {
    return data as Partial<DataFile>;
  }

  return {
    ...data,
    integration: {
      ...integration,
      accessToken: encryptedAccessToken
        ? decryptSecret(encryptedAccessToken)
        : undefined,
      pageAccessToken: encryptedPageAccessToken
        ? decryptSecret(encryptedPageAccessToken)
        : undefined,
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

function json(statusCode: number, payload: unknown, cookies: string[] = []) {
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return Response.json(payload, { status: statusCode, headers });
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
