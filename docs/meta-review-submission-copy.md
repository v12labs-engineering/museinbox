# MuseInbox Meta App Review Copy

Production URL: `https://museinbox.vercel.app`

Requested permissions:

- `instagram_business_basic`
- `instagram_business_manage_comments`

Current candidate files:

- `artifacts/meta-review/2026-07-11/instagram_business_basic.mp4`
- `artifacts/meta-review/2026-07-11/instagram_business_manage_comments.mp4`

Meta's [Private Replies guide](https://developers.facebook.com/documentation/instagram-platform/private-replies) lists these two permissions for Private Replies with Instagram Login.

Do not request `instagram_business_manage_messages`. MuseInbox's current release sends a comment-triggered Private Reply and does not read or manage Instagram inbox conversations.

## Fields safe to complete now

- Website platform URL: `https://museinbox.vercel.app`
- Privacy Policy URL: `https://museinbox.vercel.app/privacy`
- `instagram_business_basic` use-case description: use the paste-ready block below.
- `instagram_business_manage_comments` use-case description: use the separate paste-ready block below; Meta says not to copy the same description across permissions.
- Website verification instructions: use the paste-ready block below.
- Credentials: leave blank when optional, or use the **Not applicable** text below. Do not enter developer-account passwords.
- Screencasts: wait for the evidence issue below to be remediated, then update the filenames and timecodes before uploading.

## Evidence audit before upload

The comments candidate shows the active rule, a new matching comment from `sourcefound200`, a latest `Instagram · sent` Activity result, and a Private Reply present in the commenter's native Instagram inbox. It does **not** conclusively prove that the visible inbox message was produced by the newly recorded comment: the reply text has no run-specific nonce, the thread preview says `1h`, and the conversation separator shows `Sun 18:12` while the Activity row is from 11 Jul at 15:11.

The basic candidate proves the connected username, owned media, and the two required scope names inside MuseInbox. However, its `0:00-0:13` Instagram screen is a generic **continue sharing information** reauthorization prompt. It does not visibly enumerate or grant `instagram_business_basic` and `instagram_business_manage_comments`, and it does not show the user starting from MuseInbox's **Connect Instagram** button.

Meta's current [Instagram App Review guide](https://developers.facebook.com/documentation/instagram-platform/app-review) requires a permission-specific end-to-end screencast. Meta's [submission tutorial](https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review/submission-guide) says the recording should show the login button, complete login flow, and the app user granting each requested permission. Treat both candidates as evidence-backed but not strict-guideline-complete until a replacement or remediated recording visibly shows that grant flow. Do not tell Meta that the current consent segment displays the two permission names.

Additional review risks visible in the candidates:

- The consent prompt names the Meta app `MuseInbox V12 Labs-IG`, while the product UI says `MuseInbox`. Confirm the intended public display name before submission.
- The basic candidate shows the connected username but not the numeric Instagram professional account ID. Meta's [`instagram_business_basic` permission reference](https://developers.facebook.com/docs/permissions#instagram_business_basic) asks the screencast to demonstrate basic profile metadata such as username and ID.
- The comments candidate contains an earlier duplicate keyword comment and an earlier `Instagram · sent` Activity row. The submitted timecodes must identify the new `sourcefound200` comment and the newest, top Activity row.
- Because the comments candidate reuses reply text already present in the thread, do not describe `0:22-0:29` as conclusive fresh-delivery proof. A replacement should use a unique keyword and unique reply nonce visible in the rule, posted comment, Activity, and inbox.
- Both candidates are 1920 pixels wide. They meet the 1080-or-better quality guidance, but Meta's submission tutorial recommends recording at a monitor width of 1440 or less for legibility.

## instagram_business_basic

MuseInbox uses `instagram_business_basic` so an Instagram Business or Creator account owner can connect their own professional account through Instagram Login.

After authorization, MuseInbox reads the professional account ID and username. It retrieves that account's owned posts and reels so the owner can choose media for an automation.

MuseInbox shows the connected username in Settings and owned media in Dashboard. The account identity associates rules, comment processing, Private Replies, and Activity with the correct account.

This permission is also required by Meta's Private Replies flow when using Instagram Login.

### Paste into the permission use-case field

> MuseInbox uses `instagram_business_basic` during Business Login for Instagram to retrieve the connected professional account's ID, username, and owned posts and reels. The account owner sees the connected username in Settings and their owned media in Dashboard, then selects a post or reel for a comment-triggered automation. Without this permission, MuseInbox cannot identify the connected professional account or load its owned media.

### Reviewer test path

1. Open `https://museinbox.vercel.app` in a logged-out browser.
2. Choose **Connect Instagram**. MuseInbox has no separate username or password.
3. Use a Meta reviewer-owned Instagram Business or Creator test account and approve the two requested permissions. No developer credentials are required or provided.
4. After the redirect, open **Settings** and confirm the connected professional username.
5. Open **Dashboard** and confirm that the account's owned posts or reels appear. Create test media in Instagram first if the account has none.

### Screencast timecodes

- `0:00-0:13`: Instagram reauthorization for `momlife.with.pranu`; the prompt is generic and does **not** visibly list the named scopes.
- `0:20-0:34`: 25 owned posts and reels in MuseInbox Dashboard.
- `0:35-0:45`: connected username and required permissions in Settings.

## instagram_business_manage_comments

MuseInbox uses `instagram_business_manage_comments` to receive and read comments on posts and reels owned by the connected professional account.

The owner creates an active rule for selected media and controls its keyword, Private Reply text, optional public reply, and destination link.

When a new comment matches, MuseInbox sends the configured Private Reply using the source comment ID. It records the result in Activity and stores the processed comment ID to prevent duplicate sends.

MuseInbox does not use this permission for bulk or unsolicited messaging. This behavior follows Meta's [Private Replies guide](https://developers.facebook.com/documentation/instagram-platform/private-replies).

### Paste into the permission use-case field

> MuseInbox uses `instagram_business_manage_comments` to receive and read comments on posts and reels owned by the connected professional account. It compares each new comment with an active keyword rule created by that account owner. When a comment matches, MuseInbox sends one configured Private Reply using the source comment ID, records the result in Activity, and avoids reprocessing the same comment ID. This is Meta's documented Private Replies flow. MuseInbox does not read or manage Instagram inbox conversations.

### Developer screencast evidence

These accounts and content are used only in the submitted developer recording. They are not credentials and are not required for the reviewer-owned test path.

- Professional account: `momlife.with.pranu`
- Commenter and recipient: `sourcefound200`
- Test reel: `https://www.instagram.com/reel/DZZ-cgRpg8i/`
- Active rule: `Meta review test`
- Exact comment: `MUSEREVIEW2026`
- Required result: the Private Reply appears in `sourcefound200`'s native Instagram Inbox or Requests, and MuseInbox Activity records the rule as sent.

### Reviewer test path

1. Connect a Meta reviewer-owned Instagram Business or Creator account in MuseInbox. This is the professional sender account.
2. In Instagram, make sure that account owns a post or reel. Create test media if needed.
3. In MuseInbox Dashboard, select that media and create an active rule with the exact keyword `MUSEREVIEW2026` and a recognizable Private Reply.
4. From a separate Meta reviewer-owned Instagram account, comment `MUSEREVIEW2026` on the selected media.
5. Return to MuseInbox and open **Activity**. Confirm that the new comment matched the rule and the Private Reply is marked sent.
6. Return to the commenting account and open its native Instagram Inbox or Requests. Confirm that the configured Private Reply was actually delivered.

An Activity attempt without a delivered message in the commenting account's native inbox is not a successful end-to-end test.

### Screencast timecodes

- `0:00-0:05`: active rule and exact keyword.
- `0:08-0:15`: `sourcefound200` enters the keyword and the new comment appears.
- `0:16-0:21`: MuseInbox Activity records `Instagram · sent`.
- `0:22-0:29`: the Private Reply is visible in `sourcefound200`'s native Instagram inbox.

## Website reviewer instructions

Website: `https://museinbox.vercel.app`

Paste this into the website verification instructions:

> MuseInbox is a web app that uses Business Login for Instagram and has no separate MuseInbox username or password. Open `https://museinbox.vercel.app` and choose **Connect Instagram**. Sign in with a Meta reviewer-owned Instagram Business or Creator test account and approve `instagram_business_basic` and `instagram_business_manage_comments`. After the redirect, open **Settings** to confirm the connected username, then open **Dashboard** to confirm that the account's owned posts or reels load. To test comment-triggered Private Replies, select owned media and create an active keyword rule with `MUSEREVIEW2026` and a recognizable Private Reply. From a second Meta reviewer-owned Instagram account, comment `MUSEREVIEW2026` on that media. Return to MuseInbox, refresh **Activity**, and confirm the latest match is `Instagram · sent`. Finally, open the commenting account's native Instagram Inbox or Requests and confirm the configured Private Reply was delivered. The message appears in Inbox when the commenter follows the professional account, or in Requests when they do not.

Credentials field, if Meta requires text:

> Not applicable. MuseInbox uses Business Login for Instagram and has no separate app credentials. Meta reviewers can test with their own Instagram test accounts.

Meta's submission tutorial says reviewers use their own test accounts and explicitly says not to include personal Meta account credentials. Do not provide passwords for `momlife.with.pranu` or `sourcefound200`; those handles identify developer-recording evidence only.

The current recordings show connected identity and owned media, a new matching comment, Activity, and a matching reply present in the recipient's native Instagram inbox. The old comments candidate does not conclusively tie that inbox message to the newly posted comment. Do not claim that the current basic candidate visibly lists the requested permissions on Instagram's consent prompt.

## Data handling and owner-only confirmations

- Vercel: cloud hosting and serverless compute; United States (`iad1`, Northern Virginia). Vercel may route edge requests globally.
- Supabase: cloud database and storage; South Korea (Northeast Asia, Seoul), confirmed from the authenticated Supabase project listing on 2026-07-11.
- Exact responsible legal person or entity and country: **must be confirmed by the app owner**.
- Whether the release serves unrelated client businesses and should be classified as **Clients**, **Tech Provider**, or **SaaS Platform**: **must be confirmed by the app owner**.
- Whether the app manages more than one Meta Business Portfolio: **must be confirmed by the app owner**.
- The exhaustive list of processor and remote-access countries, including any Vercel edge or support access: **must be confirmed by the app owner**.
- National-security, public-authority-request, and existing-policy answers: **must be confirmed by the app owner; do not infer or fabricate them**.
- Allowed-usage attestations, Platform Terms certification, and the final **Submit for Review** action: **owner-only confirmations**.

These items are not permission use-case copy. Do not paste an assumed value merely to clear a required checkbox.
