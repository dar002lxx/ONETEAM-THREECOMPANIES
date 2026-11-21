# ONE TEAM · THREE COMPANIES

Workspace for SKS, Deed Motors and JAPANSHOP.mn.

Website: https://dar002lxx.github.io/ONETEAM-THREECOMPANIES/

## Online features

Supabase Auth protects login with email or worker ID and password. The administrator enrollment is stored only in the private server directory. On the login screen, choose **Анхны админ эрхээ идэвхжүүлэх**, set a password and confirm the verification email. Return to the website and sign in. Default demo passwords do not grant online access.

Administrators create worker accounts and change worker IDs/passwords from the administration screen. Workers change their own passwords from the profile menu. Contact email in the profile is separate from the authentication email.

The employee directory, profile pictures/details, shared channels, direct messages, images, files and voice recordings are stored in Supabase. Realtime subscriptions update messages in other signed-in browsers. The database checks sender identity and limits direct messages and files to their participants. File references must belong to the sender; the storage bucket is private.

## Remaining local features

Tasks, schedules, attendance, reports, posts and milestones still use browser storage. They are not yet shared between devices. The website labels this explicitly. Do not confuse local role controls with server authorization for those modules.

## Development

Run `npm ci`, `npm test` and `npm run check`. GitHub Actions validates and deploys the `public/` folder.

The frontend includes a pinned Supabase JS 2.89.0 UMD build with its MIT license. Only a publishable key appears in client code. Service credentials remain in the Edge Function environment.

Backend sources are in `backend/`. Apply schema.sql, accounts.sql and attachment-validation.sql in order to a fresh project, then enroll the administrator privately in private.directory. The Edge Function name is `workspace-accounts`; it validates user tokens and database roles internally, including when gateway JWT validation is off. Private directory enrollments control signup; client metadata never grants administrator access.

## Verification

DOM integration tests check fail-closed login, administrator onboarding, server roster mapping, group/DM routing, voice upload paths, worker creation forms and logout clearing. Database tests in security-test.sql run in a rollback transaction and verify private message/file isolation, sender spoofing denial, role escalation denial, profile ownership and service-only RPC permissions.

Full two-device authenticated testing requires the administrator to complete email verification. No persistent test accounts were created. The private directory intentionally has RLS with no client policies; its access is server-only.

