# Taprizz Plates

One permanent link per plate: `https://r.taprizz.in/qr/1`, `/qr/2`, ... The same link goes in the
printed QR and the locked NFC tag. A rep assigns a shop to the plate once; after that the link
redirects to that shop's Google review page. The plate and tag never change.

## Setup (about 20 minutes)

### 1. Supabase
1. Create a Supabase project (use a paid plan: free projects pause after about a week of inactivity, which would break every redirect).
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it.
3. **Authentication > Users > Add user**: your admin email and a strong password, tick "Auto confirm". Copy the user's UUID.
4. In the SQL Editor run (replace the UUID and name):
   ```sql
   insert into profiles (id, full_name, role) values ('PASTE-ADMIN-UUID', 'Saksham', 'admin');
   ```
5. **Authentication > Sign In / Providers**: switch off "Allow new users to sign up" so nobody can register on their own. You and your reps are created from the panel, which still works.
6. **Project Settings > API**: copy the Project URL, the `anon` key and the `service_role` key.

### 2. Google Places key
Google Cloud Console > enable **Places API (New)** > create an API key. Restrict it to the Places API.
It is used only on the server (shop search), never in the browser.

### 3. Vercel
1. Import this folder as a Vercel project.
2. Add environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secret, server only)
   - `GOOGLE_PLACES_API_KEY` (secret, server only)
   - `NEXT_PUBLIC_SHORT_DOMAIN` = `r.taprizz.in`
3. Add the domain `r.taprizz.in` to the project and create the DNS record Vercel shows you.
4. Turn on auto-renew for `taprizz.in` and register it for several years. If the domain expires, every plate stops working.

### 4. First use
1. Log in at `https://r.taprizz.in/login` with the admin email and password.
2. **Plates > Add plate numbers**: create 1 to 6000 (or whatever you will print).
3. **Reps**: add each salesman with a phone number and a 6-digit PIN. They log in with the phone number and PIN.
4. **QR generator**: upload your 11 x 11 cm template, drag the red box over the QR spot and the blue box over the number spot, choose a range, and download the PNG ZIPs.
5. **Plates > Export CSV**: gives `number, short_link` for your NFC supplier. Ask for pre-encoded, locked tags.

## Backups
**Plates > Export CSV** downloads every plate with its shop and review link. Do this weekly and keep the file.
The History page can restore a plate's previous link in one click.

## Security model
- Reps can only activate a **free** plate and fix their own mistake within 1 hour. Nothing else.
- Reps cannot generate QR codes; the generator is behind the admin login.
- Reps cannot write to the database directly. All changes go through functions that check the rules.
- Two reps saving the same plate at the same moment: the first wins, the second sees "already activated".
- Only Google review or Google Maps links are accepted (checked in the database, not only in the screen).
- Switching a rep off logs them out and blocks them on their very next request.
- Only the admin can edit, clear, lock or restore plates.
