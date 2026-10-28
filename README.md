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

## How a rep activates a plate
1. **Scan** the plate QR with the in-app scanner (or type the number).
2. **Set the link:** search the shop, or paste a Google review link, then tap Set link. The plate is now *pending*.
3. **Test:** scan the real plate QR with the phone camera (or tap Test plate link). The correct shop's review page must open.
4. **Confirm:** come back and tap Confirm. The server only accepts this if it actually saw a scan of that plate after the link was set.
5. The plate is now final. The rep has **no way** to change, clear or re-activate it. Only the admin can.

If the rep picked the wrong shop, they can change the link until they confirm (step 4).

## If you remove a rep
Reps > **Switch off**. They are logged out and blocked on their very next request, even if their phone is still logged in.
Everything they confirmed stays exactly as it is. Check **Plates** for rows marked *(pending check)* that belong to them
and either finish them yourself (Edit) or clear them.

## Upgrading from the first version
If you already ran the first `schema.sql`, run `supabase/migration-002-confirm-flow.sql` once in the SQL Editor.
Plates already activated are treated as confirmed. A fresh install only needs `schema.sql`.

## Security model
- Reps can only set a **free** plate, change it while it is still pending, and confirm it after a real scan. Nothing else.
- After confirming, the rep cannot change, remove or re-activate the plate. There is no time window to exploit.
- Reps cannot generate QR codes; the generator is behind the admin login.
- Reps cannot write to the database directly. All changes go through functions that check the rules.
- Two reps saving the same plate at the same moment: the first wins, the second sees "already activated".
- Only Google review or Google Maps links are accepted (checked in the database, not only in the screen).
- A switched-off rep loses all access immediately, including to plates they only set but did not confirm.
- Only the admin can edit, clear, lock or restore plates. Every change is in History with a one-click restore.

<!-- deploy v2 -->
