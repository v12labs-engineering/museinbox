"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  GalleryHorizontalEnd,
  ExternalLink,
  Image,
  LayoutDashboard,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import {
  cleanDraftRule,
  composeDm,
  emptyDraft,
  findMatchingRule,
  ruleToDraft,
  type Activity,
  type DraftRule,
  type Rule,
} from "./shared/automation";

type InstagramStatus = {
  webhookPath: string;
  oauthStartPath: string;
  oauthCallbackPath: string;
  graphVersion: string;
  hasAccessToken: boolean;
  tokenSource: "oauth" | "env";
  connectedAt?: string;
  expiresAt?: string;
  instagramUserId?: string;
  permissions: string[];
  hasAppId: boolean;
  hasVerifyToken: boolean;
  hasAppSecret: boolean;
  dryRun: boolean;
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

type AppView = "dashboard" | "automations" | "activity" | "settings";

type AppProps = {
  currentView: AppView;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function MuseInboxLogo() {
  return (
    <span className="brand-logo" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <rect className="logo-base" width="48" height="48" rx="10" />
        <path
          className="logo-bubble"
          d="M12.5 17.2c0-3.18 2.58-5.75 5.75-5.75h13.5c3.17 0 5.75 2.57 5.75 5.75v8.55c0 3.18-2.58 5.75-5.75 5.75H23.3l-7.05 5.8v-6.05a5.76 5.76 0 0 1-3.75-5.4v-8.65Z"
        />
        <path className="logo-line" d="M18.5 21.5h14" />
        <path className="logo-line" d="M18.5 27.5h8.5" />
        <circle className="logo-signal" cx="34.5" cy="14" r="4.25" />
      </svg>
    </span>
  );
}

function InstagramButtonIcon() {
  return (
    <span className="instagram-button-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <rect
          x="4.25"
          y="4.25"
          width="15.5"
          height="15.5"
          rx="4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r="3.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="16.85" cy="7.15" r="1.15" fill="currentColor" />
      </svg>
    </span>
  );
}

function App({ currentView }: AppProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRule>(emptyDraft);
  const [sampleComment, setSampleComment] = useState("Can you send the link?");
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string>("");
  const [automationScope, setAutomationScope] = useState<
    "selected" | "all" | "global"
  >("selected");
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedMedia =
    media.find((mediaItem) => mediaItem.id === selectedMediaId) ?? null;
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? null;
  const visibleRules = rules.filter((rule) => {
    if (automationScope === "all") {
      return true;
    }

    if (automationScope === "global") {
      return !rule.mediaId;
    }

    return selectedMedia ? rule.mediaId === selectedMedia.id : !rule.mediaId;
  });
  const activeAnyRules = rules.filter(
    (rule) => rule.active && rule.triggerType === "any",
  );
  const matchedRule = useMemo(
    () => findMatchingRule(sampleComment, rules, selectedMedia?.id),
    [sampleComment, rules, selectedMedia],
  );
  const matchedDm = matchedRule ? composeDm(matchedRule) : "";

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [nextRules, nextActivity, nextStatus] = await Promise.all([
        apiRequest<Rule[]>("/api/rules"),
        apiRequest<Activity[]>("/api/activity"),
        apiRequest<InstagramStatus>("/api/instagram/status"),
      ]);
      setRules(nextRules);
      setActivity(nextActivity);
      setStatus(nextStatus);
      const shouldLoadMedia = nextStatus.hasAccessToken;
      setSelectedRuleId((currentId) => currentId ?? nextRules[0]?.id ?? null);
      setDraft((currentDraft) => {
        if (currentDraft !== emptyDraft) {
          return currentDraft;
        }
        return nextRules[0] ? ruleToDraft(nextRules[0]) : emptyDraft;
      });
      setError("");
      if (shouldLoadMedia) {
        await loadInstagramMedia();
      } else {
        setMedia([]);
      }
      const params = new URLSearchParams(window.location.search);
      const instagramMessage = params.get("instagram");
      if (instagramMessage) {
        setNotice(instagramMessage);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (loadError) {
      setError(messageFromError(loadError));
    }
  }

  async function loadInstagramMedia() {
    setMediaLoading(true);
    try {
      const nextMedia = await apiRequest<InstagramMediaItem[]>(
        "/api/instagram/media",
      );
      setMedia(nextMedia);
      setSelectedMediaId((currentId) => currentId || nextMedia[0]?.id || "");
      setError("");
    } catch (mediaError) {
      setMedia([]);
      setError(messageFromError(mediaError));
    } finally {
      setMediaLoading(false);
    }
  }

  function selectRule(rule: Rule) {
    setSelectedRuleId(rule.id);
    setDraft(ruleToDraft(rule));
    setAutomationModalOpen(true);
  }

  function createRule() {
    setSelectedRuleId(null);
    if (selectedMedia) {
      setDraft({
        ...emptyDraft,
        mediaId: selectedMedia.id,
        mediaPermalink: selectedMedia.permalink,
        mediaType: selectedMedia.mediaType,
        postLabel: mediaLabel(selectedMedia),
      });
      setAutomationModalOpen(true);
      return;
    }

    setDraft(emptyDraft);
    setAutomationModalOpen(true);
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedDraft = cleanDraftRule(draft);

    try {
      const savedRule = selectedRule
        ? await apiRequest<Rule>(`/api/rules/${selectedRule.id}`, {
            method: "PUT",
            body: JSON.stringify(cleanedDraft),
          })
        : await apiRequest<Rule>("/api/rules", {
            method: "POST",
            body: JSON.stringify(cleanedDraft),
          });

      setRules((currentRules) => {
        const exists = currentRules.some((rule) => rule.id === savedRule.id);
        return exists
          ? currentRules.map((rule) =>
              rule.id === savedRule.id ? savedRule : rule,
            )
          : [savedRule, ...currentRules];
      });
      setSelectedRuleId(savedRule.id);
      setDraft(cleanedDraft);
      setAutomationModalOpen(false);
      setError("");
    } catch (saveError) {
      setError(messageFromError(saveError));
    }
  }

  async function deleteRule(ruleId: string) {
    try {
      await apiRequest(`/api/rules/${ruleId}`, { method: "DELETE" });
      setRules((currentRules) =>
        currentRules.filter((rule) => rule.id !== ruleId),
      );
      if (selectedRuleId === ruleId) {
        const nextRule = rules.find((rule) => rule.id !== ruleId) ?? null;
        setSelectedRuleId(nextRule?.id ?? null);
        setDraft(nextRule ? ruleToDraft(nextRule) : emptyDraft);
      }
      setAutomationModalOpen(false);
      setError("");
    } catch (deleteError) {
      setError(messageFromError(deleteError));
    }
  }

  async function toggleRule(rule: Rule) {
    try {
      const updatedRule = await apiRequest<Rule>(`/api/rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...ruleToDraft(rule), active: !rule.active }),
      });
      setRules((currentRules) =>
        currentRules.map((currentRule) =>
          currentRule.id === rule.id ? updatedRule : currentRule,
        ),
      );
      if (selectedRuleId === rule.id) {
        setDraft(ruleToDraft(updatedRule));
      }
      setError("");
    } catch (toggleError) {
      setError(messageFromError(toggleError));
    }
  }

  async function testComment() {
    try {
      const entry = await apiRequest<Activity>("/api/activity", {
        method: "POST",
        body: JSON.stringify({ comment: sampleComment }),
      });
      setActivity((currentActivity) => [entry, ...currentActivity].slice(0, 50));
      setError("");
    } catch (activityError) {
      setError(messageFromError(activityError));
    }
  }

  async function disconnectInstagram() {
    try {
      await apiRequest("/api/auth/instagram/disconnect", { method: "POST" });
      await loadDashboard();
      setNotice("Instagram disconnected");
    } catch (disconnectError) {
      setError(messageFromError(disconnectError));
    }
  }

  function selectMediaTarget(mediaId: string) {
    if (!mediaId) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        mediaId: undefined,
        mediaPermalink: undefined,
        mediaType: undefined,
        postLabel: "",
      }));
      return;
    }

    const item = media.find((mediaItem) => mediaItem.id === mediaId);
    if (!item) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      mediaId: item.id,
      mediaPermalink: item.permalink,
      mediaType: item.mediaType,
      postLabel: mediaLabel(item),
    }));
  }

  function selectContent(item: InstagramMediaItem) {
    setSelectedMediaId(item.id);
    setAutomationScope("selected");
    const firstRuleForMedia = rules.find((rule) => rule.mediaId === item.id);
    if (firstRuleForMedia) {
      setSelectedRuleId(firstRuleForMedia.id);
      setDraft(ruleToDraft(firstRuleForMedia));
      return;
    }

    setSelectedRuleId(null);
    setDraft({
      ...emptyDraft,
      mediaId: item.id,
      mediaPermalink: item.permalink,
      mediaType: item.mediaType,
      postLabel: mediaLabel(item),
    });
  }

  const formInvalid =
    !draft.name.trim() ||
    !draft.message.trim() ||
    (draft.triggerType === "keyword" && !draft.keyword.trim());
  const viewTitle = {
    dashboard: "Content dashboard",
    automations: "Automations",
    activity: "Activity",
    settings: "Settings",
  }[currentView];
  const isEditingRule = Boolean(selectedRule);

  return (
    <main className="app-frame">
      <aside className="app-sidebar" aria-label="MuseInbox navigation">
        <Link className="brand-lockup" href="/" aria-label="MuseInbox home">
          <MuseInboxLogo />
          <span>
            <strong>MuseInbox</strong>
            <small>Instagram automations</small>
          </span>
        </Link>
        <nav>
          <Link
            className={currentView === "dashboard" ? "active" : ""}
            href="/"
          >
            <LayoutDashboard size={19} aria-hidden="true" />
            Dashboard
          </Link>
          <Link
            className={currentView === "automations" ? "active" : ""}
            href="/automations"
          >
            <GalleryHorizontalEnd size={19} aria-hidden="true" />
            Automations
          </Link>
          <Link
            className={currentView === "activity" ? "active" : ""}
            href="/activity"
          >
            <BarChart3 size={19} aria-hidden="true" />
            Activity
          </Link>
          <Link
            className={currentView === "settings" ? "active" : ""}
            href="/settings"
          >
            <Settings size={19} aria-hidden="true" />
            Settings
          </Link>
        </nav>
        <div className="sidebar-status">
          <span className={status?.hasAccessToken ? "status-dot ready" : "status-dot"} />
          <span>{status?.hasAccessToken ? "Connected" : "Not connected"}</span>
        </div>
      </aside>

      <section className="app-main" data-view={currentView}>
        <header className="topbar">
          <div>
            <p className="eyebrow">MuseInbox</p>
            <h1>{viewTitle}</h1>
          </div>
          <div className="topbar-actions">
            {status?.hasAccessToken ? (
              <>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={loadInstagramMedia}
                  disabled={mediaLoading}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  Refresh content
                </button>
                <button
                  className="secondary-action quiet"
                  type="button"
                  onClick={disconnectInstagram}
                >
                  <Unplug size={18} aria-hidden="true" />
                  Disconnect
                </button>
              </>
            ) : (
              <a className="primary-action link-action" href="/api/auth/instagram/start">
                <InstagramButtonIcon />
                Connect Instagram
              </a>
            )}
          </div>
        </header>

        {notice ? (
          <section className="success" role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>{notice}</span>
          </section>
        ) : null}

        {error ? (
          <section className="warning" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Something needs attention.</strong>
              <span>{error}</span>
            </div>
          </section>
        ) : null}

        {activeAnyRules.length > 1 ? (
          <section className="warning" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Multiple “any word” rules are active.</strong>
              <span>
                Preview will use “{activeAnyRules[0].name}”. Turn off the extras
                to avoid confusion later.
              </span>
            </div>
          </section>
        ) : null}

        <section className="content-workspace" id="content">
          <section className="content-browser panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Instagram content</p>
                <h2>{media.length} posts and reels</h2>
              </div>
              <button className="icon-button" type="button" onClick={loadInstagramMedia}>
                <RefreshCw size={17} aria-hidden="true" />
                <span className="sr-only">Refresh content</span>
              </button>
            </div>

            <div className="content-list">
              {mediaLoading ? (
                <p className="empty-copy">Fetching Instagram content...</p>
              ) : media.length === 0 ? (
                <p className="empty-copy">Connect Instagram to load posts and reels.</p>
              ) : (
                media.map((item) => (
                  <article
                    className={`content-item ${
                      selectedMedia?.id === item.id ? "selected" : ""
                    }`}
                    key={item.id}
                  >
                    <button type="button" onClick={() => selectContent(item)}>
                      {item.thumbnailUrl || item.mediaUrl ? (
                        <img alt="" src={item.thumbnailUrl ?? item.mediaUrl} loading="lazy" />
                      ) : (
                        <span className="media-placeholder">
                          <Image size={22} aria-hidden="true" />
                        </span>
                      )}
                      <span>
                        <em>{item.mediaType === "VIDEO" ? "Reel/video" : "Post"}</em>
                        <strong>{mediaTitle(item)}</strong>
                        <small>{mediaStats(item)}</small>
                      </span>
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="selected-workspace">
            <section className="selected-media panel">
              {selectedMedia ? (
                <>
                  <div className="selected-preview">
                    {selectedMedia.thumbnailUrl || selectedMedia.mediaUrl ? (
                      <img
                        alt=""
                        src={selectedMedia.thumbnailUrl ?? selectedMedia.mediaUrl}
                      />
                    ) : (
                      <span className="media-placeholder">
                        <Image size={28} aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <p className="section-label">Selected post/reel</p>
                      <h2>{mediaLabel(selectedMedia)}</h2>
                      <p>{mediaStats(selectedMedia)}</p>
                    </div>
                  </div>
                  <div className="selected-actions">
                    <button className="primary-action" type="button" onClick={createRule}>
                      <Plus size={18} aria-hidden="true" />
                      New automation
                    </button>
                    {selectedMedia.permalink ? (
                      <a
                        className="secondary-action link-action"
                        href={selectedMedia.permalink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink size={17} aria-hidden="true" />
                        Open
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <div>
                  <p className="section-label">Selected post/reel</p>
                  <h2>Pick content to start</h2>
                  <p className="empty-copy">
                    Choose a post or reel from the content list to create targeted
                    comment automations.
                  </p>
                </div>
              )}
            </section>

            <section className="automation-panel panel" id="automations">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Automations</p>
                  <h2>
                    {currentView === "automations"
                      ? `${rules.length} total`
                      : `${visibleRules.length} shown`}
                  </h2>
                </div>
                <button className="primary-action" type="button" onClick={createRule}>
                  <Plus size={18} aria-hidden="true" />
                  New automation
                </button>
              </div>

              {currentView === "automations" ? (
                <div className="automation-table-wrap">
                  <table className="automation-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Automation</th>
                        <th>Trigger</th>
                        <th>Post/Reel</th>
                        <th>DM</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.length === 0 ? (
                        <tr>
                          <td className="table-empty" colSpan={6}>
                            No automations created yet.
                          </td>
                        </tr>
                      ) : (
                        rules.map((rule) => (
                          <tr key={rule.id}>
                            <td>
                              <span
                                className={`table-status ${
                                  rule.active ? "active" : "paused"
                                }`}
                              >
                                {rule.active ? "Active" : "Paused"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="table-title-button"
                                type="button"
                                onClick={() => selectRule(rule)}
                              >
                                {rule.name}
                              </button>
                            </td>
                            <td>
                              {rule.triggerType === "any"
                                ? "Any word"
                                : `Keyword: ${rule.keyword}`}
                            </td>
                            <td>{rule.postLabel || "All posts and reels"}</td>
                            <td>{shortText(composeDm(rule), 90)}</td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="secondary-action quiet"
                                  type="button"
                                  onClick={() => selectRule(rule)}
                                >
                                  Edit
                                </button>
                                <button
                                  className={`status-button ${
                                    rule.active ? "active" : ""
                                  }`}
                                  type="button"
                                  onClick={() => toggleRule(rule)}
                                  aria-label={
                                    rule.active ? "Pause rule" : "Activate rule"
                                  }
                                >
                                  {rule.active ? (
                                    <PlayCircle size={18} aria-hidden="true" />
                                  ) : (
                                    <PauseCircle size={18} aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <div className="scope-tabs" role="tablist" aria-label="Automation scope">
                    <button
                      className={automationScope === "selected" ? "active" : ""}
                      type="button"
                      onClick={() => setAutomationScope("selected")}
                    >
                      This post
                    </button>
                    <button
                      className={automationScope === "all" ? "active" : ""}
                      type="button"
                      onClick={() => setAutomationScope("all")}
                    >
                      All
                    </button>
                    <button
                      className={automationScope === "global" ? "active" : ""}
                      type="button"
                      onClick={() => setAutomationScope("global")}
                    >
                      Global
                    </button>
                  </div>

                  <div className="rule-list">
                    {visibleRules.length === 0 ? (
                      <p className="empty-copy">No automations in this view yet.</p>
                    ) : (
                      visibleRules.map((rule) => (
                        <article
                          className={`rule-row ${
                            selectedRuleId === rule.id ? "selected" : ""
                          }`}
                          key={rule.id}
                        >
                          <button type="button" onClick={() => selectRule(rule)}>
                            <span className="rule-title">{rule.name}</span>
                            <span className="rule-meta">
                              {rule.triggerType === "any"
                                ? "Any word"
                                : `Keyword: ${rule.keyword}`}
                            </span>
                            <span className="rule-post">
                              {rule.postLabel || "All posts and reels"}
                            </span>
                          </button>
                          <button
                            className={`status-button ${rule.active ? "active" : ""}`}
                            type="button"
                            onClick={() => toggleRule(rule)}
                            aria-label={rule.active ? "Pause rule" : "Activate rule"}
                          >
                            {rule.active ? (
                              <PlayCircle size={18} aria-hidden="true" />
                            ) : (
                              <PauseCircle size={18} aria-hidden="true" />
                            )}
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          </section>

          <aside className="builder-stack">
            <section className="preview-panel panel" aria-label="Preview automation">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">Preview</p>
                  <h2>Test comment</h2>
                </div>
                <Search size={19} aria-hidden="true" />
              </div>

              <label className="sample-comment">
                <span>Sample comment</span>
                <textarea
                  value={sampleComment}
                  onChange={(event) => setSampleComment(event.target.value)}
                  rows={3}
                />
              </label>

              <div className="match-result">
                {matchedRule ? (
                  <>
                    <p className="match-label">Matched</p>
                    <h3>{matchedRule.name}</h3>
                    <div className="dm-preview">
                      <MessageCircle size={18} aria-hidden="true" />
                      <p>{matchedDm}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="match-label">No match</p>
                    <h3>No DM would be sent</h3>
                    <p className="empty-copy">
                      Add a keyword rule or activate an “any word” rule.
                    </p>
                  </>
                )}
              </div>

              <button className="secondary-action full-width" onClick={testComment}>
                <Send size={18} aria-hidden="true" />
                Add to log
              </button>
            </section>

            <section className="activity-panel panel" id="activity" aria-label="Activity log">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">Activity</p>
                  <h2>Recent</h2>
                </div>
              </div>
              <div className="activity-list">
                {activity.length === 0 ? (
                  <p className="empty-copy">Run a preview to record the match.</p>
                ) : (
                  activity.map((entry) => (
                    <article className="activity-item" key={entry.id}>
                      <div>
                        <strong>{entry.matchedRuleName}</strong>
                        <time>{formatTime(entry.timestamp)}</time>
                      </div>
                      <span className={`activity-status ${entry.status}`}>
                        {entry.source === "local_preview" ? "Preview" : "Instagram"} ·{" "}
                        {entry.status.replace("_", " ")}
                      </span>
                      <p className="comment-text">“{entry.comment}”</p>
                      <p>{entry.dm}</p>
                      {entry.error ? <p className="error-text">{entry.error}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>

        <section className="settings-view panel" aria-label="Settings">
          <div className="panel-heading">
            <div>
              <p className="section-label">Connection</p>
              <h2>Instagram and webhooks</h2>
            </div>
            {status?.hasAccessToken ? (
              <button
                className="danger-button"
                type="button"
                onClick={disconnectInstagram}
              >
                <Unplug size={17} aria-hidden="true" />
                Disconnect
              </button>
            ) : (
              <a className="primary-action link-action" href="/api/auth/instagram/start">
                <InstagramButtonIcon />
                Connect Instagram
              </a>
            )}
          </div>

          <div className="settings-grid">
            <article>
              <span>Instagram</span>
              <strong>{status?.hasAccessToken ? "Connected" : "Not connected"}</strong>
              <p>
                {status?.instagramUserId
                  ? `User ID: ${status.instagramUserId}`
                  : "Connect an Instagram account to fetch content and send replies."}
              </p>
            </article>
            <article>
              <span>Webhook</span>
              <strong>{status?.webhookPath ?? "Not configured"}</strong>
              <p>
                {status?.hasVerifyToken
                  ? "Verify token is configured."
                  : "Verify token is missing."}
              </p>
            </article>
            <article>
              <span>Reply mode</span>
              <strong>{status?.dryRun ? "Dry run" : "Live replies"}</strong>
              <p>
                {status?.dryRun
                  ? "Matching comments are logged without sending DMs."
                  : "Matching comments can trigger real Instagram replies."}
              </p>
            </article>
            <article>
              <span>Token</span>
              <strong>{status?.tokenSource ?? "None"}</strong>
              <p>
                {status?.expiresAt
                  ? `Expires ${formatTime(status.expiresAt)}.`
                  : "No token expiry available."}
              </p>
            </article>
          </div>
        </section>

        {automationModalOpen ? (
          <section className="modal-backdrop" aria-label="Automation setup">
            <div
              className="automation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="automation-modal-title"
            >
              <div className="modal-heading">
                <div>
                  <p className="section-label">Automation setup</p>
                  <h2 id="automation-modal-title">
                    {isEditingRule ? "Edit automation" : "New automation"}
                  </h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setAutomationModalOpen(false)}
                  aria-label="Close automation setup"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form className="rule-form" onSubmit={saveRule}>
                <label>
                  <span>Name</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Send toy link"
                  />
                </label>

                <fieldset>
                  <legend>Trigger</legend>
                  <div className="segmented-control">
                    <label>
                      <input
                        checked={draft.triggerType === "keyword"}
                        aria-label="Keyword trigger"
                        name="triggerType"
                        onChange={() =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            triggerType: "keyword",
                          }))
                        }
                        type="radio"
                      />
                      <span>Keyword</span>
                    </label>
                    <label>
                      <input
                        checked={draft.triggerType === "any"}
                        aria-label="Any word trigger"
                        name="triggerType"
                        onChange={() =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            triggerType: "any",
                          }))
                        }
                        type="radio"
                      />
                      <span>Any word</span>
                    </label>
                  </div>
                </fieldset>

                {draft.triggerType === "keyword" ? (
                  <label>
                    <span>Keyword</span>
                    <input
                      value={draft.keyword}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          keyword: event.target.value,
                        }))
                      }
                      placeholder="TOY"
                    />
                  </label>
                ) : (
                  <div className="inline-note">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Matches any comment when no keyword rule matches first.
                  </div>
                )}

                <label>
                  <span>Post or reel</span>
                  <select
                    value={draft.mediaId ?? ""}
                    onChange={(event) => selectMediaTarget(event.target.value)}
                  >
                    <option value="">All posts and reels</option>
                    {media.map((item) => (
                      <option key={item.id} value={item.id}>
                        {mediaLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>DM message</span>
                  <textarea
                    value={draft.message}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Thanks for commenting. Here are the details:"
                    rows={5}
                  />
                </label>

                <label>
                  <span>Link</span>
                  <input
                    value={draft.link}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        link: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </label>

                <label className="toggle-row">
                  <input
                    checked={draft.active}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        active: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Active</span>
                </label>

                <div className="modal-actions">
                  {selectedRule ? (
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => deleteRule(selectedRule.id)}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                      Delete
                    </button>
                  ) : (
                    <span />
                  )}
                  <div>
                    <button
                      className="secondary-action quiet"
                      type="button"
                      onClick={() => setAutomationModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button className="primary-action" disabled={formInvalid}>
                      <Save size={18} aria-hidden="true" />
                      Save automation
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function mediaLabel(item: InstagramMediaItem) {
  const type = item.mediaType === "VIDEO" ? "Reel/video" : "Post";
  const title = mediaTitle(item);
  return `${type}: ${title}`;
}

function mediaTitle(item: InstagramMediaItem) {
  const caption = item.caption.trim().replace(/\s+/g, " ");
  return caption ? caption.slice(0, 62) : `Instagram media ${item.id}`;
}

function mediaStats(item: InstagramMediaItem) {
  const parts = [
    item.commentsCount === undefined ? null : `${item.commentsCount} comments`,
    item.likeCount === undefined ? null : `${item.likeCount} likes`,
    item.timestamp ? formatTime(item.timestamp) : null,
  ].filter(Boolean);

  return parts.join(" · ") || item.mediaType || "Instagram media";
}

function shortText(value: string, limit: number) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

export default App;
