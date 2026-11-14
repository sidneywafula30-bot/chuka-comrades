# Chuka Comrades (fresh start)

Step 1: Preloader + Landing page. React 19 + Vite + TypeScript, with Firebase (Google sign-in) and Supabase wired but empty.

## Run in VS Code
```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
npm run dev
```
Open http://localhost:5173. The app runs without keys; Google sign-in activates once Firebase keys are in `.env`.

## Connect Firebase + Supabase (free tiers)

Firebase handles **who the user is** (Google sign-in). Supabase handles **the data**. Supabase trusts Firebase through its *Third-Party Auth* feature, so there is one login and Row Level Security knows the user.

### 1. Firebase (Spark / free plan)
1. console.firebase.google.com -> Add project -> Add web app (</>). Copy the config values into `.env` (`VITE_FIREBASE_*`).
2. Build -> Authentication -> Get started -> enable **Google**.
3. Authentication -> Settings -> Authorized domains: add your deploy domain (`localhost` is already there).
4. Note your **Project ID** (Project settings -> General).

### 2. Supabase (free plan)
1. supabase.com/dashboard -> New project.
2. Project Settings -> API: copy the **Project URL** and **anon/publishable key** into `.env`. Never put the service-role key in the browser.
3. Authentication -> Sign In / Providers -> **Third-Party Auth** -> Add provider -> **Firebase** -> paste your Firebase Project ID.
4. SQL Editor -> paste and run `supabase/migrations/202611130001_profiles.sql`.

### 3. Test it
`npm run dev`, sign in with Google. Check Table Editor -> `profiles` for your row.

### Why no `role: authenticated` claim?
Supabase normally wants Firebase tokens to carry `role: authenticated`, which needs Firebase blocking functions (a paid Blaze plan). To stay free, tokens arrive as Supabase's `anon` role and every policy checks the verified Firebase user id instead: `(select public.requesting_uid())`. Use that same pattern, with `to anon, authenticated`, for every future table (Soko listings, gigs, etc.). If you later upgrade to Blaze and add the claim, you can switch policies to `to authenticated`.

### Troubleshooting
- `new row violates row-level security policy`: the Firebase Project ID in step 2.3 doesn't match, or the SQL wasn't run.
- Restart the dev server after any `.env` change.

## Structure
- `src/components/Preloader.tsx` crest, name, then YouTube + Google Maps + crest row
- `src/components/BrandLogos.tsx` YouTube and Google Maps logos
- `src/pages/Landing.tsx` landing page
- `src/lib/firebase.ts` Firebase sign-in; `src/lib/supabase.ts` Supabase client that sends the Firebase token
- `src/lib/profile.ts` saves the signed-in user to the `profiles` table
- `supabase/migrations/` SQL to run in the Supabase SQL Editor

## Official logos
`BrandLogos.tsx` ships SVG recreations. For the official artwork, download from the YouTube and Google Maps brand pages, save to `public/logos/youtube.svg` and `public/logos/google-maps.svg`, and set `USE_OFFICIAL_FILES = true`.

## GitHub Pages
Build with `VITE_BASE=/chuka-comrades/ npm run build`.

## CPL: player dashboard, stats approvals and transfers
New pages: `#/cpl/my-stats` (player dashboard), `#/cpl/transfers` (coach / player / chairman), `#/cpl/stats-approvals` (chairman). Backend steps are in the Apps Script README.

## Hostels: directory, room availability and admin desk
Open at `#/hostel` (the "Hostels & Roommates" card on the landing page). Photos, room counts and the admin desk run on a **separate** Apps Script, `HostelCode.gs`, delivered next to this zip with its own `HOSTEL-SETUP.md`.

1. Follow `HOSTEL-SETUP.md`, then put the web app `/exec` link in `.env` as `VITE_HOSTEL_API_URL` and restart `npm run dev`.
2. Sign in with the admin Google account (`sidneywafula30@gmail.com`). An **Admin desk** tab appears for that account only.
3. Admin desk: **Add hostel** (room types with rent and free rooms, what is provided, deposit and rules, Google Maps link, 1 to 3 photos), or change the free-room counts of a hostel in a few taps when a landlord texts.

Files: `src/pages/Hostel.tsx` (students), `src/pages/HostelAdmin.tsx` (admin), `src/lib/hostel.ts` (API client), `src/pages/Hostel.css`, `public/hostel-bg.jpeg` (hero background and the round image on the landing-page Hostels card).

## Roommate finder (admin-approved)
Open at `#/hostel` -> **Roommates** tab. Runs on **Supabase** (not the hostel Apps Script).

1. Supabase -> SQL Editor -> run `supabase/migrations/202611140001_roommates.sql` (once). It also makes `sidneywafula30@gmail.com` the roommate admin (table `app_admins`; add more admins with an `insert`).
2. Students sign in, create a post (first name, course, budget, area, lifestyle answers, private WhatsApp). It stays **pending** until the admin approves it in **Roommate requests** (that tab shows only for the admin).
3. Approved posts are shown only to signed-in students of the **same gender**, with a lifestyle match score. Phone numbers are never shown. A student taps **I'm interested**; if the poster accepts, both numbers are revealed to each other under **Requests**.
4. Editing an approved post sends it back to pending. Students can hide or delete their post. A **Report** button flags posts for the admin.

Files: `src/pages/Roommates.tsx`, `src/pages/RoommateAdmin.tsx`, `src/lib/roommate.ts`, styles at the end of `src/pages/Hostel.css`.

### HostelCode.gs change needed (new "provided" items)
In `HostelCode.gs` replace the `PROVIDED_KEYS` line with:
`const PROVIDED_KEYS = ['water', 'electricity', 'wifi', 'security', 'furnished', 'bed', 'chair', 'table', 'bin', 'bathroom', 'cooking', 'laundry', 'parking', 'study'];`
then Deploy > Manage deployments > Edit > New version.

## Chuka eFootball
Open at `#/efootball` (the "Chuka eFootball" card). Runs on its own Apps Script, `EfootballCode.gs` (separate zip); setup in `EFOOTBALL-SETUP.md` (in that zip). Put its `/exec` link in `.env` as `VITE_EFOOTBALL_API_URL`.

- **Players**: eFootball username, squad image (Drive), team strength, WhatsApp (private), course, platform, free times. Searchable list at `#/efootball/players`.
- **Weekly knockout**: up to 512 players, pools of 8 with a host who reports the winner: 64 pools, 8 pools, final. Admin sets logo, rules, times and gets a unique invite link (`#/efootball/join/<token>`).
- **League**: join any time, automatic weekly pairing, score confirmed by both players, player table and course table (courses imported from chuka.ac.ke).
- **YouTube search** on the eFootball home page, like the CPL one.

Files: `src/pages/Efootball.tsx` (shell + home), `EfProfile.tsx`, `EfPlayers.tsx`, `EfTournament.tsx`, `EfLeague.tsx`, `EfAdmin.tsx`, `src/lib/efootball.ts`, `src/pages/Efootball.css`.

## Chuka Soko (campus marketplace)
Open at `#/soko` (the "Chuka Soko" card on the landing page). Shared links look like `#/soko/<productId>` and `#/soko/store/<slug>`. It runs on its **own** Apps Script, `SokoCode.gs` (separate zip, with `SOKO-SETUP.md`), which keeps data in Google Sheets and photos in Google Drive.

1. Follow `SOKO-SETUP.md`, then put the web app `/exec` link in `.env` as `VITE_SOKO_API_URL` and restart `npm run dev`.
2. Buyers browse without signing in and chat with sellers on WhatsApp. Payment and delivery stay between buyer and seller.
3. Sellers sign in with Google and either **open a store** (one-time fee, admin approves) or **sell single items** (one-time commission, admin verifies the M-Pesa code, then the listing goes live).
4. The admin account (`sidneywafula30@gmail.com`, change it in the script's `ADMIN_EMAILS` property) gets an **Admin** button: approve or reject stores, verify commissions, log payments, feature or remove products, handle reports.

Files: `src/pages/Soko.tsx`, `src/pages/Soko.css`. No other shared file changed except `App.tsx` (route), `Landing.tsx` (card link) and `.env.example`.


## Chuka Skills v3: admin classes, Meet + calendar, course finder, WhatsApp groups
Server files are in `appscripts/skills/` (follow `SETUP.txt` there, in order).

- **Classes are created by the admin** (Skills > Admin or Classes > Create class). Add a Google Meet link with one tap, schedule sessions (added to the admin's Google Calendar), and students get an "Add to my calendar" button. Everyone else uses **Request a class on WhatsApp** (number from `VITE_ADMIN_WHATSAPP`, default 254184198432).
- **Find free online courses**: open topic search across 17 providers (`src/lib/courseProviders.ts`) with logos (`src/components/ProviderLogo.tsx`). To use official press-kit logos, follow `public/logos/providers/README.txt`.
- **YouTube search** returns a clear message and an "Open on YouTube" link when Google blocks or runs out of quota.
- **WhatsApp groups on the landing page**: run `supabase/migrations/202611150001_whatsapp_groups.sql` once. The admin (verified email in `app_admins`) sees **Manage groups** under the groups on the landing page to add, hide or delete invite links.
- Run `npm install` (adds `simple-icons`).
- Note: `src/App.tsx` imports `./pages/Media` and `./pages/Ozone`, which are not in this zip; add them from your other copy before `npm run build`.
