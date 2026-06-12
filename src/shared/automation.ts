export type TriggerType = "keyword" | "any";

export type Rule = {
  id: string;
  name: string;
  triggerType: TriggerType;
  keyword: string;
  postLabel: string;
  mediaId?: string;
  mediaPermalink?: string;
  mediaType?: string;
  message: string;
  link: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityStatus =
  | "preview"
  | "sent"
  | "failed"
  | "no_match"
  | "dry_run";

export type Activity = {
  id: string;
  externalId?: string;
  comment: string;
  matchedRuleName: string;
  dm: string;
  timestamp: string;
  status: ActivityStatus;
  source:
    | "local_preview"
    | "instagram_webhook"
    | "instagram_comment"
    | "instagram_comment_sync"
    | "instagram_comment_poll"
    | "instagram_mention"
    | "instagram_message";
  error?: string;
  diagnosticId?: string;
  deliveryAttempts?: string[];
};

export type DraftRule = Omit<Rule, "id" | "createdAt" | "updatedAt">;

export const emptyDraft: DraftRule = {
  name: "",
  triggerType: "keyword",
  keyword: "",
  postLabel: "",
  message: "",
  link: "",
  active: true,
};

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function composeDm(rule: Rule) {
  return [rule.message.trim(), rule.link.trim()].filter(Boolean).join("\n\n");
}

export function findMatchingRule(comment: string, rules: Rule[], mediaId?: string) {
  const text = normalizeText(comment);
  if (!text) {
    return null;
  }

  const activeRules = rules.filter((rule) => {
    if (!rule.active) {
      return false;
    }

    return !rule.mediaId || rule.mediaId === mediaId;
  });
  const keywordMatch = activeRules.find((rule) => {
    if (rule.triggerType !== "keyword") {
      return false;
    }
    const keyword = normalizeText(rule.keyword);
    return keyword.length > 0 && text.includes(keyword);
  });

  if (keywordMatch) {
    return keywordMatch;
  }

  return activeRules.find((rule) => rule.triggerType === "any") ?? null;
}

export function ruleToDraft(rule: Rule): DraftRule {
  return {
    name: rule.name,
    triggerType: rule.triggerType,
    keyword: rule.keyword,
    postLabel: rule.postLabel,
    mediaId: rule.mediaId,
    mediaPermalink: rule.mediaPermalink,
    mediaType: rule.mediaType,
    message: rule.message,
    link: rule.link,
    active: rule.active,
  };
}

export function cleanDraftRule(draft: DraftRule): DraftRule {
  return {
    ...draft,
    name: draft.name.trim(),
    keyword: draft.keyword.trim(),
    postLabel: draft.postLabel.trim(),
    mediaId: draft.mediaId?.trim(),
    mediaPermalink: draft.mediaPermalink?.trim(),
    mediaType: draft.mediaType?.trim(),
    message: draft.message.trim(),
    link: draft.link.trim(),
  };
}
