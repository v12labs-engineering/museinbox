"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  GalleryHorizontalEnd,
  Image,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Unplug,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

const navItems = [
  { href: "/", label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  {
    href: "/automations",
    label: "Automations",
    view: "automations",
    icon: GalleryHorizontalEnd,
  },
  { href: "/activity", label: "Activity", view: "activity", icon: BarChart3 },
  { href: "/settings", label: "Settings", view: "settings", icon: Settings },
] as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function MuseInboxLogo() {
  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#ff6a3d,#e1306c_52%,#833ab4)] shadow-[0_16px_36px_rgba(225,48,108,0.22)]"
      aria-hidden="true"
    >
      <svg className="size-11" viewBox="0 0 48 48" role="img">
        <rect width="48" height="48" rx="14" fill="transparent" />
        <path
          d="M12.5 17.2c0-3.18 2.58-5.75 5.75-5.75h13.5c3.17 0 5.75 2.57 5.75 5.75v8.55c0 3.18-2.58 5.75-5.75 5.75H23.3l-7.05 5.8v-6.05a5.76 5.76 0 0 1-3.75-5.4v-8.65Z"
          fill="rgba(255,255,255,0.92)"
        />
        <path
          d="M18.5 21.5h14M18.5 27.5h8.5"
          stroke="#e1306c"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="34.5" cy="14" r="4.25" fill="#ffdc80" />
      </svg>
    </span>
  );
}

export function InstagramButtonIcon() {
  return (
    <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
      <svg className="size-5" viewBox="0 0 24 24" role="img">
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
      setSelectedRuleId((currentId) => currentId ?? nextRules[0]?.id ?? null);
      setDraft((currentDraft) => {
        if (currentDraft !== emptyDraft) {
          return currentDraft;
        }
        return nextRules[0] ? ruleToDraft(nextRules[0]) : emptyDraft;
      });
      setError("");
      if (nextStatus.hasAccessToken) {
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

  async function syncSelectedComments() {
    if (!selectedMedia) {
      return;
    }

    try {
      const result = await apiRequest<{ checked: number; acted: number }>(
        "/api/instagram/comments/sync",
        {
          method: "POST",
          body: JSON.stringify({ mediaId: selectedMedia.id }),
        },
      );
      await loadDashboard();
      setNotice(
        result.acted > 0
          ? `Checked ${result.checked} comments and handled ${result.acted}.`
          : `Checked ${result.checked} comments. No new matching comments found.`,
      );
      setError("");
    } catch (syncError) {
      setError(messageFromError(syncError));
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
  const viewSubtitle = {
    dashboard: "Pick a post, attach a comment trigger, and preview the DM.",
    automations: "Manage every comment-to-DM rule from one clear list.",
    activity: "Review previews, live matches, and delivery issues.",
    settings: "Check Instagram connection health and local reply mode.",
  }[currentView];
  const isEditingRule = Boolean(selectedRule);
  const connectionReady = Boolean(status?.hasAccessToken);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(253,186,116,0.28),transparent_34%),linear-gradient(180deg,#fff7f4_0%,#fff_38%,#fafafa_100%)] text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-[1540px] lg:grid-cols-[252px_minmax(0,1fr)]">
        <DesktopSidebar
          currentView={currentView}
          connected={connectionReady}
          onDisconnect={disconnectInstagram}
        />

        <section className="min-w-0 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <MobileMenu
                  currentView={currentView}
                  connected={connectionReady}
                  onDisconnect={disconnectInstagram}
                />
                <div className="min-w-0">
                  <h1 className="text-lg font-black leading-tight tracking-tight text-foreground sm:text-3xl">
                    {viewTitle}
                  </h1>
                  <p className="hidden text-sm text-muted-foreground sm:block">
                    {viewSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {connectionReady ? (
                  <>
                    <Button
                      className="hidden sm:inline-flex"
                      type="button"
                      variant="outline"
                      onClick={loadInstagramMedia}
                      disabled={mediaLoading}
                    >
                      <RefreshCw className="size-4" />
                      Refresh
                    </Button>
                    <Button
                      className="hidden md:inline-flex"
                      type="button"
                      variant="ghost"
                      onClick={disconnectInstagram}
                    >
                      <Unplug className="size-4" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    asChild
                    className="bg-[linear-gradient(135deg,#f77737,#e1306c_55%,#833ab4)] !text-white shadow-[0_14px_34px_rgba(225,48,108,0.24)] hover:opacity-95"
                  >
                    <Link href="/login">
                      <InstagramButtonIcon />
                      <span className="hidden sm:inline">Continue with Instagram</span>
                      <span className="sm:hidden">Connect</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </header>

          <div className="space-y-4 px-4 py-4 sm:px-6 lg:px-8">
            {notice ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <AlertDescription className="font-semibold">
                  {notice}
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle className="size-4 text-amber-600" />
                <AlertTitle>Something needs attention.</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {activeAnyRules.length > 1 ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle className="size-4 text-amber-600" />
                <AlertTitle>Multiple “any word” rules are active.</AlertTitle>
                <AlertDescription>
                  Preview will use “{activeAnyRules[0].name}”. Turn off the
                  extras to keep matching predictable.
                </AlertDescription>
              </Alert>
            ) : null}

            {currentView === "settings" ? (
              <SettingsView
                status={status}
                connected={connectionReady}
                onDisconnect={disconnectInstagram}
              />
            ) : currentView === "activity" ? (
              <ActivityView activity={activity} />
            ) : (
              <section
                className={cn(
                  "grid min-w-0 gap-4",
                  currentView === "dashboard"
                    ? "xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.45fr)]"
                    : "xl:grid-cols-[minmax(0,1fr)_360px]",
                )}
              >
                {currentView === "dashboard" ? (
                  <ContentBrowser
                    media={media}
                    loading={mediaLoading}
                    selectedMedia={selectedMedia}
                    onRefresh={loadInstagramMedia}
                    onSelect={selectContent}
                  />
                ) : null}

                <div className="grid min-w-0 gap-4">
                  {currentView === "dashboard" ? (
                    <SelectedMediaCard
                      selectedMedia={selectedMedia}
                      onCreateRule={createRule}
                      onSyncComments={syncSelectedComments}
                    />
                  ) : null}

                  <AutomationPanel
                    currentView={currentView}
                    rules={rules}
                    visibleRules={visibleRules}
                    selectedRuleId={selectedRuleId}
                    automationScope={automationScope}
                    onScopeChange={setAutomationScope}
                    onCreateRule={createRule}
                    onSelectRule={selectRule}
                    onToggleRule={toggleRule}
                  />
                </div>

                {currentView === "automations" ? (
                  <PreviewAndActivity
                    activity={activity}
                    matchedDm={matchedDm}
                    matchedRule={matchedRule}
                    sampleComment={sampleComment}
                    onSampleChange={setSampleComment}
                    onTestComment={testComment}
                  />
                ) : null}
              </section>
            )}
          </div>
        </section>
      </div>

      <MobileBottomNav currentView={currentView} />

      <AutomationDialog
        draft={draft}
        formInvalid={formInvalid}
        isEditingRule={isEditingRule}
        media={media}
        open={automationModalOpen}
        selectedRule={selectedRule}
        onDeleteRule={deleteRule}
        onOpenChange={setAutomationModalOpen}
        onSaveRule={saveRule}
        onSelectMediaTarget={selectMediaTarget}
        onUpdateDraft={setDraft}
      />
    </main>
  );
}

function DesktopSidebar({
  connected,
  currentView,
  onDisconnect,
}: {
  connected: boolean;
  currentView: AppView;
  onDisconnect: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen min-w-0 border-r border-border/70 bg-background/86 p-4 backdrop-blur-xl lg:flex lg:flex-col">
      <BrandLockup subtitle="Business or creator" />
      <nav className="mt-7 grid gap-1">
        {navItems.map((item) => (
          <NavLink
            active={currentView === item.view}
            href={item.href}
            icon={item.icon}
            key={item.href}
            label={item.label}
          />
        ))}
      </nav>
      <Card className="mt-auto overflow-hidden border-border/80 bg-card/82 shadow-sm">
        <CardContent className="grid gap-3 p-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "size-2.5 rounded-full",
                connected ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {connected ? "Connected" : "Not connected"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Instagram workspace
              </p>
            </div>
          </div>
          {!connected ? (
            <Button asChild className="w-full justify-start" variant="outline">
              <Link href="/login">
                <InstagramButtonIcon />
                Connect Instagram
              </Link>
            </Button>
          ) : null}
          <Button
            className="w-full justify-start"
            disabled={!connected}
            type="button"
            variant="outline"
            onClick={onDisconnect}
          >
            <Unplug className="size-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}

function MobileMenu({
  connected,
  currentView,
  onDisconnect,
}: {
  connected: boolean;
  currentView: AppView;
  onDisconnect: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="lg:hidden" size="icon" variant="outline">
          <Menu className="size-4" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[320px] max-w-[88vw] p-4" side="left">
        <SheetHeader className="text-left">
          <SheetTitle>
            <BrandLockup subtitle={connected ? "Connected" : "Not connected"} />
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 grid gap-1">
          {navItems.map((item) => (
            <NavLink
              active={currentView === item.view}
              href={item.href}
              icon={item.icon}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
        <div className="mt-6 rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-bold">
            {connected ? "Connected" : "Not connected"}
          </p>
          <p className="text-xs text-muted-foreground">Instagram workspace</p>
          {!connected ? (
            <Button asChild className="mt-3 w-full justify-start" variant="outline">
              <Link href="/login">
                <InstagramButtonIcon />
                Connect Instagram
              </Link>
            </Button>
          ) : null}
          <Button
            className="mt-2 w-full justify-start"
            disabled={!connected}
            type="button"
            variant="outline"
            onClick={onDisconnect}
          >
            <Unplug className="size-4" />
            Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileBottomNav({ currentView }: { currentView: AppView }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 px-2 py-2 backdrop-blur-xl lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = currentView === item.view;
        return (
          <Link
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[0.68rem] font-bold text-muted-foreground",
              active && "bg-primary/10 text-primary",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BrandLockup({ subtitle }: { subtitle: string }) {
  return (
    <Link
      className="flex min-w-0 items-center gap-3 rounded-xl text-foreground"
      href="/"
      aria-label="MuseInbox home"
    >
      <MuseInboxLogo />
      <span className="min-w-0">
        <strong className="block truncate text-lg font-black leading-none">
          MuseInbox
        </strong>
        <small className="mt-1 block truncate text-xs font-bold text-muted-foreground">
          {subtitle}
        </small>
      </span>
    </Link>
  );
}

function NavLink({
  active,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
        active &&
          "bg-[linear-gradient(135deg,rgba(247,119,55,0.14),rgba(225,48,108,0.13))] text-primary shadow-sm",
      )}
      href={href}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ContentBrowser({
  loading,
  media,
  onRefresh,
  onSelect,
  selectedMedia,
}: {
  loading: boolean;
  media: InstagramMediaItem[];
  onRefresh: () => void;
  onSelect: (item: InstagramMediaItem) => void;
  selectedMedia: InstagramMediaItem | null;
}) {
  return (
    <Card className="min-w-0 border-border/80 bg-card/92 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardDescription className="font-bold uppercase tracking-[0.16em] text-primary">
            Instagram content
          </CardDescription>
          <CardTitle className="text-xl">{media.length} posts and reels</CardTitle>
        </div>
        <Button size="icon" type="button" variant="outline" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          <span className="sr-only">Refresh content</span>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid max-h-[620px] gap-2 overflow-auto pr-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border border-border p-2"
                key={index}
              >
                <Skeleton className="size-[72px] rounded-lg" />
                <div className="space-y-2 py-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))
          ) : media.length === 0 ? (
            <EmptyState
              icon={Image}
              title="No Instagram content yet"
              text="Connect a Business or Creator account to load posts and reels here."
            />
          ) : (
            media.map((item) => (
              <button
                className={cn(
                  "grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-background p-2 text-left transition hover:border-primary/40 hover:bg-primary/5",
                  selectedMedia?.id === item.id &&
                    "border-primary/50 bg-primary/10 shadow-sm",
                )}
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
              >
                <MediaThumb item={item} className="size-[72px]" />
                <span className="min-w-0 py-0.5">
                  <Badge className="mb-2" variant="secondary">
                    {item.mediaType === "VIDEO" ? "Reel/video" : "Post"}
                  </Badge>
                  <strong className="line-clamp-2 block text-sm font-extrabold leading-snug">
                    {mediaTitle(item)}
                  </strong>
                  <small className="mt-1 block truncate text-xs font-semibold text-muted-foreground">
                    {mediaStats(item)}
                  </small>
                </span>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedMediaCard({
  onCreateRule,
  onSyncComments,
  selectedMedia,
}: {
  onCreateRule: () => void;
  onSyncComments: () => void;
  selectedMedia: InstagramMediaItem | null;
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-border/80 bg-card/92 shadow-sm">
      <CardContent className="p-4">
        {selectedMedia ? (
          <div className="grid gap-4 md:grid-cols-[112px_minmax(0,1fr)] md:items-center">
            <MediaThumb item={selectedMedia} className="size-28" />
            <div className="min-w-0">
              <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/10">
                Selected post/reel
              </Badge>
              <h2 className="line-clamp-2 text-xl font-black tracking-tight">
                {mediaLabel(selectedMedia)}
              </h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {mediaStats(selectedMedia)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={onCreateRule}>
                  <Plus className="size-4" />
                  New automation
                </Button>
                <Button type="button" variant="outline" onClick={onSyncComments}>
                  <RefreshCw className="size-4" />
                  Check comments
                </Button>
                {selectedMedia.permalink ? (
                  <Button asChild type="button" variant="ghost">
                    <a
                      href={selectedMedia.permalink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="size-4" />
                      Open
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Pick content to start"
            text="Choose a post or reel, then create a targeted comment automation."
            action={
              <Button type="button" onClick={onCreateRule} variant="outline">
                <Plus className="size-4" />
                Create global automation
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function AutomationPanel({
  automationScope,
  currentView,
  onCreateRule,
  onScopeChange,
  onSelectRule,
  onToggleRule,
  rules,
  selectedRuleId,
  visibleRules,
}: {
  automationScope: "selected" | "all" | "global";
  currentView: AppView;
  onCreateRule: () => void;
  onScopeChange: (scope: "selected" | "all" | "global") => void;
  onSelectRule: (rule: Rule) => void;
  onToggleRule: (rule: Rule) => void;
  rules: Rule[];
  selectedRuleId: string | null;
  visibleRules: Rule[];
}) {
  const tableMode = currentView === "automations";

  return (
    <Card className="min-w-0 border-border/80 bg-card/92 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardDescription className="font-bold uppercase tracking-[0.16em] text-primary">
            Automations
          </CardDescription>
          <CardTitle className="text-xl">
            {tableMode ? `${rules.length} total` : `${visibleRules.length} shown`}
          </CardTitle>
        </div>
        <Button className="shrink-0" type="button" onClick={onCreateRule}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New automation</span>
          <span className="sm:hidden">New</span>
        </Button>
      </CardHeader>
      <CardContent className="min-w-0">
        {tableMode ? (
          <AutomationCards
            rules={rules}
            onSelectRule={onSelectRule}
            onToggleRule={onToggleRule}
          />
        ) : (
          <>
            <Tabs
              className="mb-4"
              value={automationScope}
              onValueChange={(value) =>
                onScopeChange(value as "selected" | "all" | "global")
              }
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="selected">This post</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="global">Global</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid gap-2">
              {visibleRules.length === 0 ? (
                <EmptyState
                  icon={GalleryHorizontalEnd}
                  title="No automations here yet"
                  text="Create a keyword or any-word rule for this scope."
                />
              ) : (
                visibleRules.map((rule) => (
                  <div
                    className={cn(
                      "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-border bg-background p-3",
                      selectedRuleId === rule.id &&
                        "border-primary/50 bg-primary/10",
                    )}
                    key={rule.id}
                  >
                    <button
                      className="min-w-0 text-left"
                      type="button"
                      onClick={() => onSelectRule(rule)}
                    >
                      <span className="block truncate font-extrabold">
                        {rule.name}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {triggerLabel(rule)}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold text-primary">
                        {rule.postLabel || "All posts and reels"}
                      </span>
                    </button>
                    <Button
                      className="size-8"
                      size="icon"
                      type="button"
                      variant={rule.active ? "secondary" : "ghost"}
                      onClick={() => onToggleRule(rule)}
                      aria-label={rule.active ? "Pause rule" : "Activate rule"}
                    >
                      {rule.active ? (
                        <PlayCircle className="size-4" />
                      ) : (
                        <PauseCircle className="size-4" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationCards({
  onSelectRule,
  onToggleRule,
  rules,
}: {
  onSelectRule: (rule: Rule) => void;
  onToggleRule: (rule: Rule) => void;
  rules: Rule[];
}) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={GalleryHorizontalEnd}
        title="No automations created yet"
        text="Create your first rule to see status and actions here."
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rules.map((rule) => (
        <article
          className="grid min-w-0 gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:border-primary/35 hover:shadow-md"
          key={rule.id}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                Automation
              </p>
              <h3 className="mt-1 truncate text-lg font-black tracking-tight">
                {rule.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {triggerLabel(rule)}
              </p>
            </div>
            <RuleStatusBadge active={rule.active} />
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Post/Reel
              </span>
              <span className="mt-1 block truncate font-semibold">
                {rule.postLabel || "All posts and reels"}
              </span>
            </div>
            <Separator />
            <div className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                DM preview
              </span>
              <p className="mt-1 line-clamp-2 text-muted-foreground">
                {shortText(composeDm(rule), 140)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              className="sm:min-w-24"
              type="button"
              variant="outline"
              onClick={() => onSelectRule(rule)}
            >
              Edit
            </Button>
            <Button
              className="sm:min-w-28"
              type="button"
              variant={rule.active ? "secondary" : "default"}
              onClick={() => onToggleRule(rule)}
            >
              {rule.active ? (
                <>
                  <PauseCircle className="size-4" />
                  Pause
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function PreviewAndActivity({
  activity,
  matchedDm,
  matchedRule,
  onSampleChange,
  onTestComment,
  sampleComment,
}: {
  activity: Activity[];
  matchedDm: string;
  matchedRule: Rule | null;
  onSampleChange: (value: string) => void;
  onTestComment: () => void;
  sampleComment: string;
}) {
  return (
    <aside className="grid min-w-0 gap-4">
      <Card className="border-border/80 bg-card/92 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardDescription className="font-bold uppercase tracking-[0.16em] text-primary">
                Preview
              </CardDescription>
              <CardTitle>Test comment</CardTitle>
            </div>
            <Search className="size-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sample-comment">Sample comment</Label>
            <Textarea
              id="sample-comment"
              value={sampleComment}
              onChange={(event) => onSampleChange(event.target.value)}
              rows={3}
            />
          </div>
          <div className="min-h-36 rounded-xl border border-border bg-muted/45 p-4">
            {matchedRule ? (
              <>
                <Badge className="mb-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  Matched
                </Badge>
                <h3 className="font-black">{matchedRule.name}</h3>
                <div className="mt-3 flex gap-2 rounded-xl bg-background p-3 text-sm text-foreground shadow-sm">
                  <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="whitespace-pre-wrap">{matchedDm}</p>
                </div>
              </>
            ) : (
              <>
                <Badge variant="secondary">No match</Badge>
                <h3 className="mt-2 font-black">No DM would be sent</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a keyword rule or activate an “any word” rule.
                </p>
              </>
            )}
          </div>
          <Button className="w-full" type="button" variant="outline" onClick={onTestComment}>
            <Send className="size-4" />
            Add to log
          </Button>
        </CardContent>
      </Card>
      <ActivityCard activity={activity} compact />
    </aside>
  );
}

function ActivityView({ activity }: { activity: Activity[] }) {
  return (
    <div className="max-w-5xl">
      <ActivityCard activity={activity} />
    </div>
  );
}

function ActivityCard({
  activity,
  compact = false,
}: {
  activity: Activity[];
  compact?: boolean;
}) {
  return (
    <Card className="border-border/80 bg-card/92 shadow-sm">
      <CardHeader>
        <CardDescription className="font-bold uppercase tracking-[0.16em] text-primary">
          Activity
        </CardDescription>
        <CardTitle>{compact ? "Recent" : "Recent comment matches"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-3", compact && "max-h-[360px] overflow-auto pr-1")}>
          {activity.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No activity yet"
              text="Run a preview or sync comments to see matches here."
            />
          ) : (
            activity.map((entry) => (
              <article
                className="rounded-xl border border-border bg-background p-4"
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-black">
                      {entry.matchedRuleName}
                    </h3>
                    <time className="text-xs font-semibold text-muted-foreground">
                      {formatTime(entry.timestamp)}
                    </time>
                  </div>
                  <Badge variant={entry.status === "sent" ? "default" : "secondary"}>
                    {entry.source === "local_preview" ? "Preview" : "Instagram"} ·{" "}
                    {entry.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-3 rounded-lg bg-muted/55 p-3 text-sm font-semibold">
                  “{entry.comment}”
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{entry.dm}</p>
                {entry.error ? (
                  <p className="mt-2 text-sm font-semibold text-destructive">
                    {entry.error}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsView({
  connected,
  onDisconnect,
  status,
}: {
  connected: boolean;
  onDisconnect: () => void;
  status: InstagramStatus | null;
}) {
  const items = [
    {
      label: "Instagram",
      value: connected ? "Connected" : "Not connected",
      text: status?.instagramUserId
        ? `User ID: ${status.instagramUserId}`
        : "Connect a Business or Creator account to fetch content and send replies.",
    },
    {
      label: "Webhook",
      value: status?.webhookPath ?? "Not configured",
      text: status?.hasVerifyToken
        ? "Verify token is configured."
        : "Verify token is missing.",
    },
    {
      label: "Reply mode",
      value: status?.dryRun ? "Dry run" : "Live replies",
      text: status?.dryRun
        ? "Matching comments are logged without sending DMs."
        : "Matching comments can trigger real Instagram replies.",
    },
    {
      label: "Token",
      value: status?.tokenSource ?? "None",
      text: status?.expiresAt
        ? `Expires ${formatTime(status.expiresAt)}.`
        : "No token expiry available.",
    },
  ];

  return (
    <Card className="max-w-5xl border-border/80 bg-card/92 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardDescription className="font-bold uppercase tracking-[0.16em] text-primary">
            Connection
          </CardDescription>
          <CardTitle>Instagram account and webhooks</CardTitle>
        </div>
        {connected ? (
          <Button type="button" variant="destructive" onClick={onDisconnect}>
            <Unplug className="size-4" />
            Disconnect
          </Button>
        ) : (
          <Button asChild>
            <Link href="/login">
              <InstagramButtonIcon />
              Continue with Instagram
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              className="min-w-0 rounded-xl border border-border bg-background p-4"
              key={item.label}
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                {item.label}
              </p>
              <h3 className="mt-2 truncate text-lg font-black">{item.value}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationDialog({
  draft,
  formInvalid,
  isEditingRule,
  media,
  onDeleteRule,
  onOpenChange,
  onSaveRule,
  onSelectMediaTarget,
  onUpdateDraft,
  open,
  selectedRule,
}: {
  draft: DraftRule;
  formInvalid: boolean;
  isEditingRule: boolean;
  media: InstagramMediaItem[];
  onDeleteRule: (ruleId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSaveRule: (event: FormEvent<HTMLFormElement>) => void;
  onSelectMediaTarget: (mediaId: string) => void;
  onUpdateDraft: React.Dispatch<React.SetStateAction<DraftRule>>;
  open: boolean;
  selectedRule: Rule | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogDescription className="font-bold uppercase tracking-[0.16em] text-primary">
            Automation setup
          </DialogDescription>
          <DialogTitle>
            {isEditingRule ? "Edit automation" : "New automation"}
          </DialogTitle>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSaveRule}>
          <div className="grid gap-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              value={draft.name}
              onChange={(event) =>
                onUpdateDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
              placeholder="Send product link"
            />
          </div>

          <div className="grid gap-2">
            <Label>Trigger</Label>
            <Tabs
              value={draft.triggerType}
              onValueChange={(value) =>
                onUpdateDraft((currentDraft) => ({
                  ...currentDraft,
                  triggerType: value as "keyword" | "any",
                }))
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="keyword">Keyword</TabsTrigger>
                <TabsTrigger value="any">Any word</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {draft.triggerType === "keyword" ? (
            <div className="grid gap-2">
              <Label htmlFor="rule-keyword">Keyword</Label>
              <Input
                id="rule-keyword"
                value={draft.keyword}
                onChange={(event) =>
                  onUpdateDraft((currentDraft) => ({
                    ...currentDraft,
                    keyword: event.target.value,
                  }))
                }
                placeholder="LINK"
              />
            </div>
          ) : (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertDescription>
                Matches any comment when no keyword rule matches first.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="rule-media">Post or reel</Label>
            <select
              id="rule-media"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={draft.mediaId ?? ""}
              onChange={(event) => onSelectMediaTarget(event.target.value)}
            >
              <option value="">All posts and reels</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {mediaLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rule-message">DM message</Label>
            <Textarea
              id="rule-message"
              value={draft.message}
              onChange={(event) =>
                onUpdateDraft((currentDraft) => ({
                  ...currentDraft,
                  message: event.target.value,
                }))
              }
              placeholder="Thanks for commenting. Here are the details:"
              rows={5}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rule-link">Link</Label>
            <Input
              id="rule-link"
              value={draft.link}
              onChange={(event) =>
                onUpdateDraft((currentDraft) => ({
                  ...currentDraft,
                  link: event.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/35 p-3">
            <div>
              <Label htmlFor="rule-active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Turn this on when the rule is ready to match comments.
              </p>
            </div>
            <Switch
              id="rule-active"
              checked={draft.active}
              onCheckedChange={(checked) =>
                onUpdateDraft((currentDraft) => ({
                  ...currentDraft,
                  active: checked,
                }))
              }
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
            {selectedRule ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDeleteRule(selectedRule.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button disabled={formInvalid}>
                <Save className="size-4" />
                Save automation
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MediaThumb({
  className,
  item,
}: {
  className?: string;
  item: InstagramMediaItem;
}) {
  return item.thumbnailUrl || item.mediaUrl ? (
    <img
      alt=""
      className={cn("shrink-0 rounded-xl object-cover", className)}
      src={item.thumbnailUrl ?? item.mediaUrl}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,rgba(247,119,55,0.18),rgba(225,48,108,0.14))] text-primary",
        className,
      )}
    >
      <Image className="size-6" />
    </span>
  );
}

function EmptyState({
  action,
  icon: Icon,
  text,
  title,
}: {
  action?: React.ReactNode;
  icon: typeof Image;
  text: string;
  title: string;
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function RuleStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
      Active
    </Badge>
  ) : (
    <Badge variant="secondary">Paused</Badge>
  );
}

function triggerLabel(rule: Rule) {
  return rule.triggerType === "any" ? "Any word" : `Keyword: ${rule.keyword}`;
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
