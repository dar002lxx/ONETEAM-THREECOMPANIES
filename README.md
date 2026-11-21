# ONE TEAM · THREE COMPANIES

Workspace for SKS, Deed Motors, and JAPANSHOP.mn.

## Current release: browser-local preview

The current HTML contains the complete interface and demo interactions. It does **not** yet use Supabase authentication, shared database records, Realtime, or server media storage. Employee ID/password controls are demo UI, not server-side protection. Do not use this preview for confidential employee or customer data.

## GitHub Pages

After the website files are uploaded, open Settings → Pages and choose GitHub Actions as the publishing source. The deployment workflow publishes only the `public` directory.

## Backend setup pending

Connect the selected Supabase project and provide the intended administrator email before enabling production sign-in and shared data. Only the Supabase Project URL and publishable key may be used in browser configuration. Never commit a service-role key, secret key, or database password.
