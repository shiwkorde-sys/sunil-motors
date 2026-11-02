# Sunil Motors Garage - Inventory App

Mechanic view: /m (phone). Admin dashboard: /dashboard (desktop). Database: Supabase. Hosting: Netlify.

## Deploy (all free)
1. Supabase: New project -> SQL Editor -> paste all of supabase/schema.sql -> Run.
   Authentication -> Providers -> Email -> turn OFF "Confirm email".
   Project Settings -> API -> copy Project URL and anon public key.
2. GitHub: new repository -> upload everything in this folder (not node_modules, not .env).
3. Netlify: Add new site -> Import from GitHub -> add environment variables
   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY -> Deploy.
4. Open the link. Create account with YOUR email first (first account = admin).
   Dashboard -> Import -> parts_import.csv -> Import now.

## Notes
- Admin = the first account. Promote others in Dashboard -> Team. There is no shared password.
- Audio and voice search default to Hindi (switch with the Hindi/EN buttons at the top).
- Vehicle registration is optional at checkout. The mechanic name is required.
- Photo search is optional: supabase functions deploy identify-part, then supabase secrets set ANTHROPIC_API_KEY=...
- Re-importing a CSV overwrites quantity and compatible models for matching SKUs.
