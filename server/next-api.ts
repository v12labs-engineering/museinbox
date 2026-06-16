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
  fairUse?: FairUseState;
};

type InstagramIntegration = {
  accessToken?: string;
  encryptedAccessToken?: string;
  tokenType?: string;
  loginProvider?: "instagram";
  userId?: string;
  webhookAccountIds?: string[];
  permissions?: string[];
  webhookLastReceivedAt?: string;
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

type FairUseState = {
  day?: string;
  dmSendAttempts?: number;
  commentChecks?: number;
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

type InstagramCommentReadItem = InstagramCommentItem & {
  matchedRuleName?: string;
  matchedRuleId?: string;
  wouldSend: boolean;
  alreadyProcessed: boolean;
  skippedReason?: "reply_comment" | "already_processed" | "older_than_rule" | "no_matching_rule";
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

type CommentSyncResult = {
  checked: number;
  acted: number;
  failed: number;
  errors: string[];
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
const fairUseLimits = {
  activeAutomations: 5,
  dmSendAttemptsPerDay: 100,
  commentChecksPerDay: 500,
  consecutiveFailuresBeforePause: 5,
};
const defaultScopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "pages_read_engagement",
  "pages_show_list",
].join(",");
const requiredInstagramPermissions = defaultScopes.split(",");

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

    if (request.method === "GET" && pathname === "/api/instagram/comments") {
      return readInstagramComments(request, requestUrl);
    }

    if (request.method === "POST" && pathname === "/api/instagram/comments/sync") {
      return syncInstagramComments(request);
    }

    if (request.method === "GET" && pathname === "/api/auth/instagram/start") {
      return startOAuth(request);
    }

    if (
      request.method === "GET" &&
      pathname === "/api/auth/instagram/callback"
    ) {
      return handleOAuthCallback(request, requestUrl);
    }

    if (
      request.method === "POST" &&
      pathname === "/api/auth/instagram/disconnect"
    ) {
      return disconnectInstagram(request);
    }

    if (
      request.method === "POST" &&
      pathname === "/api/auth/instagram/deauthorize"
    ) {
      return handleInstagramDeauthorize();
    }

    if (
      (request.method === "GET" || request.method === "POST") &&
      pathname === "/api/auth/instagram/data-deletion"
    ) {
      return handleInstagramDataDeletionRequest(request);
    }

    if (request.method === "POST" && pathname === "/api/account/delete") {
      return deleteAccountData(request);
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
        oauthCallbackPath: "/api/auth/instagram/callback",
        oauthRedirectUri:
          data.integration?.oauthRedirectUri ??
          process.env.INSTAGRAM_OAUTH_REDIRECT_URI,
        oauthAuthorizeUrl: data.integration?.oauthAuthorizeUrl,
        lastOAuthError: data.integration?.lastOAuthError,
        graphVersion: getGraphVersion(),
        hasAccessToken: Boolean(getAccessToken(data)),
        connected: isMetaConnected(data),
        tokenSource: data.integration?.accessToken ? "oauth" : "env",
        connectedAt: data.integration?.connectedAt,
        expiresAt: data.integration?.expiresAt,
        instagramUserId: data.integration?.userId,
        webhookAccountIds: data.integration?.webhookAccountIds ?? [],
        loginProvider: data.integration?.loginProvider,
        webhookLastReceivedAt: data.integration?.webhookLastReceivedAt,
        canSendPrivateReplies: canSendPrivateReplies(data),
        privateReplyReadiness: privateReplyReadiness(data),
        permissions: data.integration?.permissions ?? [],
        webhookSubscribedAt: data.integration?.webhookSubscribedAt,
        webhookSubscriptionCheckedAt:
          data.integration?.webhookSubscriptionCheckedAt,
        webhookSubscriptionError: data.integration?.webhookSubscriptionError,
        hasAppId: Boolean(getInstagramAppId()),
        hasVerifyToken: Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
        hasAppSecret: Boolean(process.env.INSTAGRAM_APP_SECRET),
        dryRun: process.env.INSTAGRAM_DRY_RUN === "true",
        fairUse: fairUseSummary(data),
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
    const stateId = getRequestStateId(request);
    const data = await readData(stateId);
    const shouldForcePaused =
      draft.active && activeAutomationCount(data.rules) >= fairUseLimits.activeAutomations;
    const rule: Rule = {
      ...draft,
      active: shouldForcePaused ? false : draft.active,
      consecutiveFailures: 0,
      pauseReason: shouldForcePaused
        ? `Free forever fair-use limit: only ${fairUseLimits.activeAutomations} automations can be active at once.`
        : undefined,
      pausedAt: shouldForcePaused ? now : undefined,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
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
    const activatingRule = !rule.active && draft.active;
    if (
      activatingRule &&
      activeAutomationCount(data.rules, rule.id) >= fairUseLimits.activeAutomations
    ) {
      return json(429, {
        error: `Free forever fair-use limit reached. Pause another automation before activating this one.`,
      });
    }

    const updatedRule: Rule = {
      ...rule,
      ...draft,
      consecutiveFailures:
        activatingRule && rule.pauseReason ? 0 : rule.consecutiveFailures,
      pauseReason: draft.active ? undefined : rule.pauseReason,
      pausedAt: draft.active ? undefined : rule.pausedAt,
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

async function startOAuth(request: Request) {
  const clientId = getInstagramAppId();
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) {
    return json(400, {
      error: "Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET in .env.local",
    });
  }

  const redirectUri = getOAuthRedirectUri(request);
  const state = randomUUID();

  const scopes = process.env.INSTAGRAM_OAUTH_SCOPES ?? defaultScopes;
  const authBase = "https://www.instagram.com/oauth/authorize";
  const authUrl = [
    authBase,
    `force_reauth=true`,
    `auth_type=rerequest`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    "response_type=code",
    `state=${encodeURIComponent(state)}`,
    `scope=${encodeURIComponent(scopes)}`,
  ].join("&").replace("&", "?");

  return redirect(authUrl, [
    buildCookie(
      oauthCookieName,
      signCookieValue({
        state,
        redirectUri,
        oauthStartedAt: new Date().toISOString(),
        oauthAuthorizeUrl: authUrl,
      }),
      10 * 60,
    ),
  ]);
}

async function handleOAuthCallback(
  request: Request,
  requestUrl: URL,
) {
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  if (error) {
    return redirectToApp(
      request,
      formatOAuthProviderError(error, errorDescription),
    );
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthSession = readSignedCookie<{
    state?: string;
    redirectUri?: string;
    oauthAuthorizeUrl?: string;
  }>(request, oauthCookieName);
  if (!code) {
    return redirectToApp(request, "Instagram connection failed: missing OAuth code");
  }

  if (
    !oauthSession?.state ||
    state !== oauthSession.state
  ) {
    return redirectToApp(request, "Instagram connection failed: invalid OAuth state");
  }

  const redirectUri = oauthSession.redirectUri ?? getOAuthRedirectUri(request);

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

  const missingPermissions = missingRequiredInstagramPermissions(
    shortToken.permissions ?? [],
  );
  if (missingPermissions.length > 0) {
    const userId = String(shortToken.user_id ?? "");
    const stateId = userId ? accountStateId(userId) : getRequestStateId(request);
    const data = await readData(stateId);
    data.integration = {
      ...data.integration,
      lastOAuthError: formatMissingPermissionError(missingPermissions),
    };
    await writeData(data, stateId);
    return redirectToApp(
      request,
      formatMissingPermissionError(missingPermissions),
      [clearCookie(sessionCookieName), clearCookie(oauthCookieName)],
    );
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

async function deleteAccountData(request: Request) {
  const stateId = getRequestStateId(request);
  await writeData(emptyAccountData(), stateId);
  return json(200, { ok: true }, [
    clearCookie(sessionCookieName),
    clearCookie(oauthCookieName),
  ]);
}

function handleInstagramDeauthorize() {
  return json(200, { ok: true });
}

function handleInstagramDataDeletionRequest(request: Request) {
  const confirmationCode = createDiagnosticId("data_deletion");
  return json(200, {
    url: new URL("/data-deletion", request.url).toString(),
    confirmation_code: confirmationCode,
  });
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
    data.integration = {
      ...data.integration,
      webhookLastReceivedAt: new Date().toISOString(),
      webhookSubscribedAt:
        data.integration?.webhookSubscribedAt ?? new Date().toISOString(),
      webhookSubscriptionError: undefined,
    };
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
  const directResult = await postInstagramPrivateReply(
    instagramUserId,
    commentId,
    message,
    accessToken,
    diagnosticId,
  );
  if (directResult.ok || !shouldRetryPrivateReplyWithMe(directResult.error)) {
    return directResult;
  }

  const meResult = await postInstagramPrivateReply(
    "me",
    commentId,
    message,
    accessToken,
    diagnosticId,
  );
  if (meResult.ok) {
    return meResult;
  }

  return {
    ok: false,
    error: joinSendErrors(directResult.error, meResult.error),
    attempts: [...(directResult.attempts ?? []), ...(meResult.attempts ?? [])],
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
    host: instagramGraphBaseUrl(),
  });

  const result = await fetch(
    `${instagramGraphBaseUrl()}/${getGraphVersion()}/${encodeURIComponent(targetId)}/messages`,
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
    messageLength: message.length,
  });

  if (process.env.INSTAGRAM_DRY_RUN === "true") {
    logDiagnostic("message_reply_dry_run", { diagnosticId });
    return { ok: true, status: "dry_run" as const };
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
    `${instagramGraphBaseUrl()}/${getGraphVersion()}/me/messages`,
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
    if (!hasDmSendAttemptCapacity(data)) {
      entry.status = "failed";
      entry.error = "Daily DM send attempt limit reached. Try again tomorrow.";
      data.activity = [entry, ...data.activity].slice(0, 50);
      logDiagnostic("event_send_blocked_by_fair_use", {
        diagnosticId,
        matchedRuleId: safeId(matchedRule.id),
      });
      return;
    }

    recordDmSendAttempt(data);
    const sendResult = await sendWebhookReply(data, event.replyTarget, dm, diagnosticId);
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

    updateRuleFailureState(data, matchedRule.id, sendResult.ok, sendResult.error);
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

  if (data.integration?.webhookLastReceivedAt) {
    return false;
  }

  data.integration = {
    ...data.integration,
    webhookSubscriptionCheckedAt: new Date().toISOString(),
    webhookSubscriptionError:
      "Instagram webhook subscriptions are configured in the Meta App Dashboard. No webhook events have been received yet, so the app cannot confirm delivery automatically.",
  };

  return true;
}

async function handleInstagramMedia(request: Request) {
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
  const readContext = getInstagramReadContext(data);

  if (!readContext) {
    return json(401, { error: "Connect Instagram first" });
  }

  try {
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
  } catch (error) {
    const message = messageFromUnknown(error);
    return json(502, {
      error: isExpiredMetaTokenError(message)
        ? "Instagram connection expired. Reconnect Instagram, then try again."
        : message,
    });
  }
}

async function readInstagramComments(request: Request, requestUrl: URL) {
  const diagnosticId = createDiagnosticId("read_comments");
  const stateId = getRequestStateId(request);
  const data = await readData(stateId);
  const readContext = getInstagramReadContext(data);
  if (!readContext) {
    logDiagnostic("comment_read_missing_connection", {
      diagnosticId,
      stateId: safeId(stateId),
    });
    return json(401, { error: "Connect Instagram first" });
  }

  const mediaId = requestUrl.searchParams.get("mediaId")?.trim();
  if (!mediaId) {
    return json(400, { error: "Pick a post or reel first" });
  }

  if (!hasCommentCheckCapacity(data)) {
    return json(429, {
      error: `Daily comment check limit reached. Try again tomorrow.`,
      fairUse: fairUseSummary(data),
    });
  }

  try {
    const comments = await fetchInstagramComments(readContext, mediaId);
    recordCommentChecks(data, comments.length);
    await writeData(data, stateId);
    const items: InstagramCommentReadItem[] = comments.map((comment) => {
      const matchingRule = findMatchingRule(comment.text, data.rules, mediaId);
      const alreadyProcessed = data.processedCommentIds?.includes(comment.id) ?? false;
      const eligible = matchingRule ? commentIsEligibleForRule(comment, matchingRule) : false;
      const skippedReason = comment.parentId
        ? "reply_comment"
        : alreadyProcessed
          ? "already_processed"
          : matchingRule && !eligible
            ? "older_than_rule"
            : matchingRule
              ? undefined
              : "no_matching_rule";

      return {
        ...comment,
        matchedRuleId: matchingRule?.id,
        matchedRuleName: matchingRule?.name,
        wouldSend: Boolean(matchingRule && eligible && !comment.parentId && !alreadyProcessed),
        alreadyProcessed,
        skippedReason,
      };
    });

    logDiagnostic("comment_read_finished", {
      diagnosticId,
      stateId: safeId(stateId),
      mediaId: safeId(mediaId),
      comments: items.length,
      visibleSendCandidates: items.filter((item) => item.wouldSend).length,
    });

    return json(200, {
      ok: true,
      diagnosticId,
      mediaId,
      comments: items,
    });
  } catch (error) {
    const message = messageFromUnknown(error);
    const status = isExpiredMetaTokenError(message) ? 401 : 502;
    return json(status, {
      error: isExpiredMetaTokenError(message)
        ? "Instagram connection expired. Reconnect Instagram, then read comments again."
        : message,
    });
  }
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
  const mediaIds = mediaIdsForCommentSync(data, payload.mediaId);

  if (mediaIds.length === 0) {
    logDiagnostic("comment_sync_no_media", {
      diagnosticId,
      stateId: safeId(stateId),
      rules: data.rules.length,
    });
    return json(400, { error: "Pick a post or create a post-specific automation first" });
  }

  if (!hasCommentCheckCapacity(data)) {
    return json(429, {
      error: `Daily comment check limit reached. Try again tomorrow.`,
      fairUse: fairUseSummary(data),
    });
  }

  try {
    const result = await syncInstagramCommentsForData({
      data,
      readContext,
      mediaIds,
      diagnosticId,
      stateId,
      requestedMediaId: payload.mediaId,
      activitySource: "instagram_comment_sync",
    });
    await writeData(data, stateId);
    return json(200, {
      ok: true,
      diagnosticId,
      checked: result.checked,
      acted: result.acted,
      failed: result.failed,
      errors: [...new Set(result.errors)].slice(0, 3),
    });
  } catch (error) {
    const message = messageFromUnknown(error);
    const status = isExpiredMetaTokenError(message) ? 401 : 502;
    return json(status, {
      error: isExpiredMetaTokenError(message)
        ? "Instagram connection expired. Reconnect Instagram, then check comments again."
        : message,
    });
  }
}

async function syncInstagramCommentsForData({
  data,
  readContext,
  mediaIds,
  diagnosticId,
  stateId,
  requestedMediaId,
  activitySource,
}: {
  data: DataFile;
  readContext: InstagramReadContext;
  mediaIds: string[];
  diagnosticId: string;
  stateId: string;
  requestedMediaId?: string;
  activitySource: Activity["source"];
}): Promise<CommentSyncResult> {
  logDiagnostic("comment_sync_start", {
    diagnosticId,
    stateId: safeId(stateId),
    mediaIds: mediaIds.map(safeId),
    requestedMediaId: safeId(requestedMediaId),
    graphHost: "facebook",
    instagramUserId: safeId(getInstagramUserId(data)),
    hasInstagramAccess: Boolean(getInstagramAccessToken(data)),
    permissions: data.integration?.permissions,
    rules: data.rules.length,
    activeRules: data.rules.filter((rule) => rule.active).length,
  });

  const result: CommentSyncResult = {
    checked: 0,
    acted: 0,
    failed: 0,
    errors: [],
  };

  for (const mediaId of mediaIds) {
    if (!hasCommentCheckCapacity(data)) {
      result.errors.push("Daily comment check limit reached.");
      break;
    }

    let comments: InstagramCommentItem[];
    try {
      comments = await fetchInstagramComments(readContext, mediaId);
      recordCommentChecks(data, comments.length);
      logDiagnostic("comment_sync_comments_fetched", {
        diagnosticId,
        mediaId: safeId(mediaId),
        comments: comments.length,
      });
    } catch (error) {
      const message = messageFromUnknown(error);
      logDiagnostic("comment_sync_comments_fetch_failed", {
        diagnosticId,
        mediaId: safeId(mediaId),
        error: summarizeMetaError(message),
      });
      throw error;
    }

    for (const comment of comments) {
      result.checked += 1;
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
        latestEntry.source = activitySource;
        if (latestEntry.status === "failed") {
          result.failed += 1;
          if (latestEntry.error) {
            result.errors.push(latestEntry.error);
          }
          continue;
        }
      }
      result.acted += 1;
    }
  }

  logDiagnostic("comment_sync_finished", {
    diagnosticId,
    stateId: safeId(stateId),
    checked: result.checked,
    acted: result.acted,
    failed: result.failed,
    errors: result.errors.map(summarizeMetaError),
  });
  return result;
}

type InstagramReadContext = {
  accessToken: string;
};

async function fetchInstagramMedia(
  context: InstagramReadContext,
): Promise<InstagramMediaItem[]> {
  const url = new URL(`${instagramGraphBaseUrl()}/${getGraphVersion()}/me/media`);
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
    `${instagramGraphBaseUrl()}/${getGraphVersion()}/${encodeURIComponent(mediaId)}/comments`,
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
  return process.env.INSTAGRAM_GRAPH_VERSION ?? "v25.0";
}

function getOAuthRedirectUri(request: Request) {
  if (process.env.INSTAGRAM_OAUTH_REDIRECT_URI) {
    return process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return `${proto}://${host}/api/auth/instagram/callback`;
}

function redirectToApp(request: Request, message: string, cookies: string[] = []) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("instagram", message);
  return redirect(url.toString(), cookies);
}

function formatOAuthProviderError(error: string, errorDescription: string | null) {
  const rawMessage = errorDescription ?? error;
  if (/insufficient developer role/i.test(rawMessage)) {
    return "Instagram connection blocked by Meta: this Instagram account is not allowed to test this app yet. Add the account in the Meta App Dashboard app roles or switch the app to Live after permissions are approved.";
  }

  return `Instagram connection failed: ${rawMessage}`;
}

function missingRequiredInstagramPermissions(permissions: string[]) {
  return requiredInstagramPermissions.filter(
    (permission) => !permissions.includes(permission),
  );
}

function formatMissingPermissionError(missingPermissions: string[]) {
  return `Instagram connection incomplete. Approve all requested permissions before continuing. Missing: ${missingPermissions.join(", ")}.`;
}

function getInstagramAppId() {
  return process.env.INSTAGRAM_APP_ID ?? process.env.VITE_INSTAGRAM_APP_ID;
}

function getAccessToken(data: DataFile) {
  return getInstagramAccessToken(data);
}

function getInstagramAccessToken(data: DataFile) {
  return data.integration?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
}

function getInstagramUserId(data: DataFile) {
  return data.integration?.userId ?? process.env.INSTAGRAM_USER_ID;
}

function getInstagramReadContext(data: DataFile): InstagramReadContext | null {
  const accessToken = data.integration?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN;
  if (accessToken) {
    return {
      accessToken,
    };
  }

  return null;
}

function instagramGraphBaseUrl() {
  return (
    process.env.INSTAGRAM_GRAPH_BASE_URL ??
    process.env.INSTAGRAM_BASE_URL ??
    "https://graph.instagram.com"
  );
}

function canSendPrivateReplies(data: DataFile) {
  return privateReplyReadiness(data).ready;
}

function isMetaConnected(data: DataFile) {
  return Boolean(getInstagramAccessToken(data) && getInstagramUserId(data));
}

function privateReplyReadiness(data: DataFile) {
  const permissions = data.integration?.permissions ?? [];
  const hasKnownPermissions = permissions.length > 0;
  const missingPermissions = hasKnownPermissions
    ? requiredInstagramPermissions.filter((permission) => !permissions.includes(permission))
    : [];
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
    {
      key: "instagramPermissions",
      label: hasKnownPermissions
        ? "Instagram comment and message permissions"
        : "Instagram permissions recorded",
      ready: hasKnownPermissions && missingPermissions.length === 0,
      detail: hasKnownPermissions
        ? missingPermissions.length > 0
          ? `Missing: ${missingPermissions.join(", ")}`
          : "Required permissions are present"
        : "Reconnect Instagram so MuseInbox can confirm the granted permissions",
    },
    {
      key: "dryRun",
      label: "Live DM sending",
      ready: process.env.INSTAGRAM_DRY_RUN !== "true",
      detail:
        process.env.INSTAGRAM_DRY_RUN === "true"
          ? "Dry run is on, so the app will log matches without sending DMs"
          : "Dry run is off",
    },
    {
      key: "webhookVerifyToken",
      label: "Webhook verify token",
      ready: Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
      detail: "Needed for automatic comment webhooks from Meta",
    },
  ];

  return {
    ready: checks.every((check) => check.ready),
    canSendPrivateReplies: checks.every((check) => check.ready),
    checks,
    missing: checks
      .filter((check) => !check.ready)
      .map((check) => check.label),
    loginProvider: data.integration?.loginProvider,
    requiredPermissions: requiredInstagramPermissions,
    missingPermissions,
    webhookSubscribed: Boolean(data.integration?.webhookSubscribedAt),
    webhookSubscriptionError: data.integration?.webhookSubscriptionError,
  };
}

function fairUseSummary(data: DataFile) {
  const usage = todayFairUse(data);
  return {
    limits: fairUseLimits,
    usage,
    remaining: {
      activeAutomations: Math.max(
        0,
        fairUseLimits.activeAutomations - activeAutomationCount(data.rules),
      ),
      dmSendAttempts: Math.max(
        0,
        fairUseLimits.dmSendAttemptsPerDay - (usage.dmSendAttempts ?? 0),
      ),
      commentChecks: Math.max(
        0,
        fairUseLimits.commentChecksPerDay - (usage.commentChecks ?? 0),
      ),
    },
  };
}

function activeAutomationCount(rules: Rule[], excludeRuleId?: string) {
  return rules.filter((rule) => rule.active && rule.id !== excludeRuleId).length;
}

function hasDmSendAttemptCapacity(data: DataFile) {
  return (
    (todayFairUse(data).dmSendAttempts ?? 0) <
    fairUseLimits.dmSendAttemptsPerDay
  );
}

function recordDmSendAttempt(data: DataFile) {
  const usage = todayFairUse(data);
  usage.dmSendAttempts = (usage.dmSendAttempts ?? 0) + 1;
}

function hasCommentCheckCapacity(data: DataFile) {
  return (
    (todayFairUse(data).commentChecks ?? 0) <
    fairUseLimits.commentChecksPerDay
  );
}

function recordCommentChecks(data: DataFile, count: number) {
  const usage = todayFairUse(data);
  usage.commentChecks = (usage.commentChecks ?? 0) + Math.max(0, count);
}

function todayFairUse(data: DataFile) {
  const day = currentUsageDay();
  if (data.fairUse?.day !== day) {
    data.fairUse = { day, dmSendAttempts: 0, commentChecks: 0 };
  }

  return data.fairUse;
}

function currentUsageDay() {
  return new Date().toISOString().slice(0, 10);
}

function updateRuleFailureState(
  data: DataFile,
  ruleId: string,
  sent: boolean,
  error?: string,
) {
  data.rules = data.rules.map((rule) => {
    if (rule.id !== ruleId) {
      return rule;
    }

    if (sent) {
      return {
        ...rule,
        consecutiveFailures: 0,
        pauseReason: undefined,
        pausedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
    }

    const consecutiveFailures = (rule.consecutiveFailures ?? 0) + 1;
    const shouldPause =
      consecutiveFailures >= fairUseLimits.consecutiveFailuresBeforePause;
    return {
      ...rule,
      active: shouldPause ? false : rule.active,
      consecutiveFailures,
      pauseReason: shouldPause
        ? `Paused after ${fairUseLimits.consecutiveFailuresBeforePause} failed Instagram send attempts in a row. Last error: ${summarizeRulePauseError(error)}`
        : rule.pauseReason,
      pausedAt: shouldPause ? new Date().toISOString() : rule.pausedAt,
      updatedAt: new Date().toISOString(),
    };
  });
}

function summarizeRulePauseError(error?: string) {
  if (!error) {
    return "Instagram rejected the send.";
  }

  const summary = summarizeMetaError(error);
  if (typeof summary === "string") {
    return summary.slice(0, 180);
  }

  return (summary.message ?? "Instagram rejected the send.").slice(0, 180);
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
  const url = new URL(`${instagramGraphBaseUrl()}/${getGraphVersion()}/me/media`);
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

function mediaIdsForCommentSync(data: DataFile, requestedMediaId?: string) {
  return [
    requestedMediaId,
    ...data.rules.map((rule) => rule.mediaId).filter(Boolean),
  ].filter((value, index, values): value is string => {
    return typeof value === "string" && value.length > 0 && values.indexOf(value) === index;
  });
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
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (typeof signature !== "string" || !signature.startsWith("sha256=")) {
    return false;
  }

  const actual = Buffer.from(signature);
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`,
  );
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

async function readData(stateId = defaultStateId): Promise<DataFile> {
  if (hasSupabaseConfig()) {
    return readSupabaseData(stateId);
  }

  await mkdir(dataDirectory, { recursive: true });
  const localDataPath = localDataPathForState(stateId);

  if (!existsSync(localDataPath)) {
    const initialData = normalizeData({});
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
    integration: normalizeIntegration(data.integration),
    fairUse: normalizeFairUse(data.fairUse),
  };
}

function normalizeIntegration(value: unknown): InstagramIntegration {
  if (!isRecord(value)) {
    return {};
  }

  return {
    accessToken: stringFrom(value.accessToken) || undefined,
    encryptedAccessToken: stringFrom(value.encryptedAccessToken) || undefined,
    tokenType: stringFrom(value.tokenType) || undefined,
    loginProvider: stringFrom(value.loginProvider) === "instagram" ? "instagram" : undefined,
    userId: stringFrom(value.userId) || undefined,
    webhookAccountIds: Array.isArray(value.webhookAccountIds)
      ? value.webhookAccountIds.filter((id): id is string => typeof id === "string")
      : undefined,
    permissions: Array.isArray(value.permissions)
      ? value.permissions.filter((permission): permission is string => typeof permission === "string")
      : undefined,
    webhookLastReceivedAt: stringFrom(value.webhookLastReceivedAt) || undefined,
    webhookSubscribedAt: stringFrom(value.webhookSubscribedAt) || undefined,
    webhookSubscriptionCheckedAt:
      stringFrom(value.webhookSubscriptionCheckedAt) || undefined,
    webhookSubscriptionError: stringFrom(value.webhookSubscriptionError) || undefined,
    connectedAt: stringFrom(value.connectedAt) || undefined,
    expiresAt: stringFrom(value.expiresAt) || undefined,
    oauthState: stringFrom(value.oauthState) || undefined,
    oauthStartedAt: stringFrom(value.oauthStartedAt) || undefined,
    oauthRedirectUri: stringFrom(value.oauthRedirectUri) || undefined,
    oauthAuthorizeUrl: stringFrom(value.oauthAuthorizeUrl) || undefined,
    lastOAuthError: stringFrom(value.lastOAuthError) || undefined,
  };
}

function emptyAccountData(): DataFile {
  return {
    rules: [],
    activity: [],
    processedCommentIds: [],
    integration: {},
    fairUse: { day: currentUsageDay(), dmSendAttempts: 0, commentChecks: 0 },
  };
}

function normalizeFairUse(value: unknown): FairUseState {
  if (!isRecord(value)) {
    return { day: currentUsageDay(), dmSendAttempts: 0, commentChecks: 0 };
  }

  return {
    day: stringFrom(value.day) || currentUsageDay(),
    dmSendAttempts: numberFrom(value.dmSendAttempts) ?? 0,
    commentChecks: numberFrom(value.commentChecks) ?? 0,
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
      encryptedAccessToken: accessToken
        ? encryptSecret(accessToken)
        : integration.encryptedAccessToken,
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
      accessToken: encryptedAccessToken
        ? decryptSecret(encryptedAccessToken)
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
