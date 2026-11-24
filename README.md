# ONE TEAM · THREE COMPANIES

Workspace for SKS, Deed Motors and JAPANSHOP.mn.

Website: https://dar002lxx.github.io/ONETEAM-THREECOMPANIES/

## Online features

Supabase Auth protects login with email or worker ID and password. The administrator enrollment is stored only in the private server directory. On the login screen, choose **Анхны админ эрхээ идэвхжүүлэх**, set a password and confirm the verification email. Return to the website and sign in. Default demo passwords do not grant online access.

Administrators create worker accounts and change worker IDs/passwords from the administration screen. Workers change their own passwords from the profile menu. Contact email in the profile is separate from the authentication email.

The employee directory, profile pictures/details, shared channels, direct messages, images, files and voice recordings are stored in Supabase. Realtime subscriptions update messages in other signed-in browsers. The database checks sender identity and limits direct messages and files to their participants. File references must belong to the sender; the storage bucket is private.

## Shared workspace data

Posts, private image/video media, likes, comments, tasks, boards, daily reports, employee shifts, office settings, attendance requests, milestones, personal notes, feedback and audit records now use server storage with Realtime updates. Theme, language, current view, seen-notification markers and unsubmitted drafts remain device preferences.

Workspace records use per-row optimistic versions. Changes from another device cannot silently overwrite a stale edit: the local draft is retained, and the UI offers a server-versus-local resolution. Pending metadata edits are kept in a per-account browser outbox and retried after reconnecting. The status bar distinguishes syncing, connected and failed states. Posts only report publication success after the server accepts the post and uploads.

The initial transition preserves the previous local workspace as a per-account downloadable backup. Actual locally authored posts and their media are imported when their author next signs in on the browser that holds them. Owned user-created tasks and reports are imported. Sample records are not promoted to shared business data. Legacy device-time attendance stays in the backup and can be submitted through the attendance-correction approval flow.

## Attendance

Check-in/out is executed in one database transaction using server timestamps, an employee lock and a unique open-session constraint. The requested action is explicit, so a stale second check-in cannot immediately check the employee out. Dates use Asia/Ulaanbaatar. Records are visible to their owner and administrators; precise punch coordinates follow the same rule.

Administrators configure each company's office coordinates, radius and optional mandatory GPS check. With mandatory GPS enabled, a fresh browser location is requested for the punch; the server computes distance and requires the accuracy circle to lie within the office radius. GPS is a device-supplied estimate, not a tamper-proof identity proof. Google Maps is embedded for visual navigation. Wi-Fi, QR scanners, biometric hardware and payroll integrations are not claimed.

Attendance requests, cancellations and administrator approvals are server-backed. Approving a correction creates the attendance record atomically and rejects overlapping or invalid times. Approved leave/overtime requests do not fabricate clock-in/out timestamps.

## Development

Run `npm ci`, `npm test` and `npm run check`. GitHub Actions validates and deploys the `public/` folder.

The frontend includes a pinned Supabase JS 2.89.0 UMD build with its MIT license. Only a publishable key appears in client code. Service credentials remain in the Edge Function environment.

Backend sources are in `backend/`. For a fresh project, apply schema.sql, accounts.sql, attachment-validation.sql, full-sync.sql, full-sync-hardening.sql, full-sync-grants.sql and full-sync-private-data.sql in that order, then enroll the administrator privately in private.directory. The Edge Function name is `workspace-accounts`; it validates user tokens and database roles internally, including when gateway JWT validation is off. Private directory enrollments control signup; client metadata never grants administrator access.

## Verification

DOM integration tests check fail-closed login, administrator onboarding, server roster mapping, group/DM routing, voice upload paths, worker creation forms and logout clearing. Database tests in security-test.sql run in a rollback transaction and verify private message/file isolation, sender spoofing denial, role escalation denial, profile ownership and service-only RPC permissions.

test-full-sync.cjs runs two independent browser DOM contexts against a shared transport to verify posts/media, simultaneous likes, comments, task changes, server attendance and conflict retention. full-sync-test.sql additionally verifies real hosted database policies, stale writes, duplicate punches, mandatory GPS, private attendance and request approval inside a rollback transaction. No persistent test users or messages are created. The private directory intentionally has RLS with no client policies; its access is server-only.


Existing project advisory: leaked-password protection is not enabled. Configuration guidance: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
