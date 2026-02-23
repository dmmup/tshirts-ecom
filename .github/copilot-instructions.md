# Copilot / AI agent quick guide

Bref, actionnable — comment on être immédiatement productif dans ce repo.

- **Architecture (grand angle)**: Frontend React + Vite (dossier `frontend/`), Backend Express (dossier `backend/`) qui sert des routes API et utilise le client Supabase en mode *service role*. La source de vérité DB et le stockage sont dans Supabase (migration fournie: `supabase/migrations/20240101_pdp_schema.sql`).

- **Points d'intégration clés**:
  - Supabase Storage bucket `designs` pour les fichiers uploadés.
  - Backend crée des signed upload/read URLs via `supabaseAdmin.storage.createSignedUploadUrl` / `createSignedUrl` (voir `backend/routes/products.js`).
  - Tables importantes: `products`, `product_variants`, `product_images`, `carts`, `cart_items`, `design_uploads` (voir migration SQL).

- **Flux upload (important — implémenté)**:
  1. Frontend appelle `POST /api/products/upload/sign` avec `{ filename, contentType, userId?, anonymousId? }` (`frontend/src/api/products.js::getSignedUploadUrl`).
  2. Backend retourne `{ signedUrl, token, storagePath }` (signed PUT URL).
  3. Frontend PUT vers `signedUrl` (stream XHR) puis appelle `POST /api/products/upload/confirm` avec `{ storagePath, filename, fileSize, mimeType, userId?, anonymousId? }`.
  4. Backend vérifie l'existence, insère un enregistrement d'audit et renvoie `{ success, storagePath, previewUrl, uploadId }`.

- **Conventions applicatives spécifiques**:
  - `anonymous_id` client: clef localStorage `pdp_anon_id` (générée par `getAnonymousId()` dans `ProductDetailPage.jsx`).
  - Variant selection: changer la couleur réinitialise la taille au premier disponible pour cette couleur (impl. dans `ProductDetailPage.jsx`).
  - Prix: si une `variant` est sélectionnée, afficher son `price_cents`, sinon afficher la plage (min–max) calculée depuis `product_variants`.

- **Endpoints API à connaître (exemples)**:
  - GET `/api/products/:slug` → retourne `{ product, variants, images }` (voir `backend/routes/products.js`).
  - POST `/api/products/upload/sign` body: `{ filename, contentType, userId?, anonymousId? }` → `{ signedUrl, token, storagePath }`.
  - POST `/api/products/upload/confirm` body: `{ storagePath, filename, fileSize, mimeType, userId?, anonymousId? }` → `{ previewUrl, uploadId }`.
  - POST `/api/cart/items` body: `{ variantId, quantity, config, userId?, anonymousId? }`.

- **Variables d'environnement (nom exact)**:
  - Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (voir `frontend/.env` note in README).
  - Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role MUST stay backend-only).

- **Démarrage local (rapide)**:
  - Backend: `cd backend && npm install && npm run dev` (dev = `node --watch server.js`).
  - Frontend: `cd frontend && npm install && npm run dev` (Vite). Use `VITE_API_URL=http://localhost:3001/api` if backend listens on 3001.
  - DB: run the migration in `supabase/migrations/20240101_pdp_schema.sql` via Supabase CLI (`supabase db push`) or SQL editor.

- **Fichiers et endroits à inspecter/éditer en priorité**:
  - UI / behavior: `frontend/src/pages/ProductDetailPage.jsx` (composants, uploader, logique variant)
  - API client: `frontend/src/api/products.js` (pipeline d'upload, addToCart)
  - Backend routes: `backend/routes/products.js` (auth-sensitive Supabase admin usage)
  - Schema / seeds: `supabase/migrations/20240101_pdp_schema.sql`

- **Patterns à respecter quand tu modifies**:
  - Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
  - Préférer pipeline signed-url (pas d'upload via serveur) — backend doit seulement signer/valider.
  - Respecter les formats JSON attendus par les endpoints ci‑dessus (les clients JS s'appuient sur ces shapes).

- Si tu as besoin d'ajouter de nouvelles colonnes ou tables, modifie la migration SQL et explique clairement les étapes à reproduire via Supabase CLI / Dashboard.

- Questions ou zones floues ? Dis-moi quelles sections clarifier ou si tu veux que j'ajoute exemples de payloads concrets ou snippets de tests rapides.
