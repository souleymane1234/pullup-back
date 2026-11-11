# Prompt — Intégrer l’API PULLUP dans le front

> À coller dans un agent IA (ou à donner à un développeur) **ouvert sur le projet `front`**.

---

## Contexte

Tu travailles sur le front Vite/React de **PULLUP**, une marketplace d’influence en Côte d’Ivoire.

Le backend est **déjà entièrement implémenté** dans le projet voisin `../back` (NestJS + MySQL + Redis). Il tourne en local sur **`http://localhost:6000/api`**. **Ne crée aucun backend, ne modifie rien dans `../back`.** Ta mission est de faire fonctionner le front contre cette API réelle, à la place des données de démonstration locales.

Documentation de l’API : `http://localhost:3000/api/docs` (Swagger) et `../back/docs/openapi.json`.

## Ce qui existe déjà dans le front (ne pas réécrire)

- `src/lib/http.js` : client axios avec `withCredentials: true` et conversion des erreurs `{ message }` en `Error`.
- `src/services/remote.js` : `isRemote()` (vrai dès que `VITE_API_URL` est défini) et `request(method, url, payload)`.
- Chaque fichier de `src/services/*.service.js` a déjà une branche `if (isRemote()) return request(...)` qui appelle la bonne route.
- `STATUS.awaiting_payment` existe dans `src/domain/catalog.js`.
- Pages connexion, inscription (avec mot de passe), mot de passe oublié (`/mot-de-passe-oublie`) et réinitialisation (`/mot-de-passe`).
- Réservation : upload du brief via `POST /uploads/brief` et attente du paiement via `GET /campaigns/:id/payment`.
- Matching : affichage des résultats `masked`.
- Photo par l’admin avec la case de consentement (`consent: true`).
- `completeOnboarding()` → `PUT /me/preferences`.

Conserve le mode démo : sans `VITE_API_URL`, tout doit continuer à fonctionner avec `src/services/demo/*`.

## Règles de l’API à respecter

- Préfixe `/api`, authentification par cookie de session HttpOnly `pullup.sid` (jamais de jeton dans le `localStorage`).
- Toute erreur arrive sous la forme `{ "message": "…" }` en français : affiche ce message tel quel dans un toast.
- Codes : `401` non connecté (rediriger vers `/connexion`), `403` droits insuffisants, `404` introuvable, `409` action plus disponible (rafraîchir les données), `429` trop de requêtes.
- Montants en **entiers FCFA**, à formater avec `formatFcfa`.
- `GET /auth/session`, `PUT /me/preferences` et `POST /notifications/read` peuvent renvoyer `null`.
- `GET /campaigns/:id` renvoie `{ access: "ok", campaign }`, `{ access: "forbidden" }` ou `{ access: "missing" }`.
- Les campagnes ont la même forme que dans le mode démo (`id`, `ref`, `brandId`, `infId`, `offer`, `amount`, `fee`, `payout`, `status`, `brief`, `log`, `perf`, `proof`, `msgs`, …).

## Tâches

### 1. Brancher l’API

- Créer `front/.env.local` avec `VITE_API_URL=http://localhost:6000/api`.
- Mettre à jour `front/.env.example` : `VITE_API_URL=http://localhost:6000/api`.
- Vérifier que le back autorise l’origine du front (`FRONT_ORIGIN=http://localhost:6010` dans `../back/.env`). Ne change pas le back : si l’origine diffère, signale-le.

### 2. Formules annonceur (`src/services/wallet.service.js` → `setPlan`)

Aujourd’hui `setPlan(plan)` envoie seulement `{ plan }`. Pour une formule payante, l’API attend un moyen de paiement.

- Signature : `setPlan({ plan, pay, phone })` (garder la compatibilité avec `setPlan('free')`).
- Corps envoyé : `PUT /billing/plan` avec `{ plan, pay, phone }`.
- Réponses possibles :
  - `{ status: "active", message }` → toast + rafraîchir la session et l’espace annonceur ;
  - `{ status: "awaiting_payment", message, redirectUrl }` → ouvrir `redirectUrl` si présent, afficher « Confirmez le paiement sur votre téléphone », puis rafraîchir l’espace quelques secondes plus tard ;
  - `{ status: "cancelled", message }` (retour à `free`) → afficher le message (la formule reste active jusqu’à la fin de la période).
- Dans `PlansGrid` / `BrandSpacePage` / `usePickPlan` : pour `pro` (15 000) et `business` (75 000), demander le moyen de paiement (`om`, `mtn`, `moov`, `wave`, `card`) et le numéro, comme dans l’étape de paiement de la réservation.

### 3. Options influenceur (`purchaseBoost`)

- Toujours envoyer `{ key, pay, phone }` à `POST /billing/boosts` (`key` : `pro`, `certified`, `analytics`).
- Gérer `status: "awaiting_payment"` et `redirectUrl` comme pour les formules.
- Pour `certified` : afficher que la demande est transmise à l’équipe PULLUP (la certification est accordée par l’admin, pas automatiquement).

### 4. Back-office admin (`src/services/admin.service.js` + `src/features/admin`)

Seuls `GET /admin/dashboard`, la vérification, le refus, les flags, la photo et l’auto-validation sont branchés. Ajouter les services et les écrans pour :

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/admin/influencers/:id/suspend` | `{ reason }` (obligatoire) | `{ message }` |
| POST | `/admin/influencers/:id/certify` | – | `{ message }` |
| POST | `/admin/influencers/:id/reject` | `{ reason? }` | `{ message }` |
| PUT | `/admin/influencers/:id/scores` | `{ auth?, creat?, brief?, onTime?, aud?, net? }` | `{ message }` |
| GET | `/admin/finance/summary` | – | `{ escrow, commissionsMonth, pendingWithdrawals, gaps }` |
| GET | `/admin/finance/ledger.csv?from=&to=` | – | Fichier CSV (télécharger en `blob`, comme `downloadCampaignsCsv`) |
| GET | `/admin/withdrawals?status=` | `pending` / `sent` / `failed` | Liste |
| POST | `/admin/withdrawals/:id/retry` | – | `{ message }` |
| GET | `/admin/audit?actor=&target=` | – | Liste d’événements |
| POST | `/admin/brands/:id/credit` | `{ amount (entier > 0), reason }` | `{ message }` |
| GET | `/admin/catalog` | – | Catégories, villes, objectifs, types de demande |
| POST | `/admin/catalog` | `{ kind, key?, label, related?, reco? }` | `{ message, item }` |
| PUT | `/admin/catalog/:kind/:key` | `{ label?, related?, reco?, active? }` | `{ message, item }` |
| DELETE | `/admin/catalog/:kind/:key` | – | Masquer (`{ message, item }`) |

Écrans à prévoir dans la page admin :
- Profils : boutons Suspendre (avec motif), Certifier, Modifier les scores (`auth`, `brief`, `onTime` de 0 à 100 ; `creat` de 0 à 5).
- Finance : cartes séquestre / commissions du mois / retraits en attente / écarts, et export CSV du grand livre avec dates.
- Retraits : filtre par statut, bouton Relancer sur les retraits en échec.
- Audit : tableau filtrable par acteur et cible (remplace l’« audit » calculé localement).
- Annonceurs : bouton Créditer le solde (montant + motif).
- Catalogue : créer / modifier / masquer les thématiques, villes, objectifs et types de demande. Le front lit `GET /catalog` (public, éléments actifs) pour les listes d’inscription, matching et brief.

Après chaque action réussie : toast avec le `message` reçu et invalidation de la requête `admin-dashboard`. Ajouter les mêmes fonctions au mode démo pour que les écrans restent utilisables sans API.

### 5. Compte (`src/app/pages/AccountPage.jsx`)

- **Exporter mes données** : `GET /me/export` → télécharger le JSON.
- **Supprimer mon compte** : `DELETE /me` avec `{ password }`, confirmation obligatoire, puis déconnexion et retour à l’accueil.

### 6. Détails à vérifier

- `resetDemo()` lève une erreur en mode distant : masquer le bouton « Réinitialiser la démo » quand `isRemote()` est vrai.
- Connexion démo (`POST /auth/demo`) : ne fonctionne que si le back a `DEMO_MODE=true` ; en cas d’erreur, inviter à utiliser e-mail + mot de passe.
- Actions de campagne (`/campaigns/:id/:action`) : sur `409`, rafraîchir la campagne.
- Flags : si `v2` est coupé, les routes de réservation renvoient 404 ; si `v3` est coupé, le matching renvoie 404. Masquer les entrées correspondantes à partir de `GET /platform`.

## Comptes pour tester

Mot de passe commun : la valeur de `DEMO_PASSWORD` dans `../back/.env`.

| Rôle | E-mail |
|---|---|
| Admin | `admin@pullup.net` |
| Annonceur Pro | `marketing@savane.ci` |
| Annonceur Découverte | `contact@lepalmier.ci` |
| Annonceur Business | `growth@kalo.ci` |
| Influenceuse | `amakouassi@mail.ci` |

Pour repartir de données propres : dans `../back`, lancer `npm run seed`.

## Critères de fin

1. Avec `VITE_API_URL` défini, tout le parcours fonctionne contre l’API :
   - Savane réserve Ama, paie, Ama accepte, envoie la preuve, Savane valide, puis laisse un avis ;
   - Ama voit ses gains, demande un retrait et achète une option ;
   - l’admin vérifie, suspend, certifie, consulte la finance, l’audit et les retraits.
2. Sans `VITE_API_URL`, le mode démo fonctionne toujours.
3. `npm run lint` et `npm test` passent.
4. Le test de contrat passe : depuis `../back`, `VITE_API_URL=http://localhost:3000/api npm run test:contract` (rejoue `src/app/pages.test.jsx` contre l’API).
5. Aucun secret dans le front ; aucun changement dans `../back`.
