# Prompt — Implémenter l’API PULLUP

> Copier-coller ce document tel quel à un développeur ou à un agent IA.

---

## Rôle

Tu es développeur backend senior. Tu implémentes l’API REST de **PULLUP**, une marketplace d’influence en Côte d’Ivoire qui met en relation des **annonceurs** (marques) et des **influenceurs**. Le front Vite/React existe déjà et fonctionne en mode démo : ton API doit respecter **exactement** son contrat, sans modifier ses attentes.

## Stack imposée

- NestJS (TypeScript strict, ESM)
- Prisma + **MySQL / MariaDB**
- Redis : sessions, cache, limitation de débit
- Validation Zod, mots de passe argon2id
- Paiements mobile money via CinetPay, avec un fournisseur `fake` pour le développement
- Tests Vitest (unitaires + intégration)

## Conventions globales (obligatoires)

1. Toutes les routes sont préfixées par **`/api`**.
2. Authentification par **cookie de session HttpOnly** nommé `pullup.sid` (7 jours, `SameSite=Lax`, `Secure` en production). Pas de JWT.
3. CORS limité à `FRONT_ORIGIN`, avec `credentials: true`. Les requêtes qui modifient des données vérifient l’en-tête `Origin` (protection CSRF).
4. Toute erreur renvoie `{ "message": "…" }` en **français**, lisible par un utilisateur final.
5. Codes HTTP : `400` validation, `401` non connecté, `403` droits insuffisants, `404` introuvable, `409` action plus disponible, `429` trop de requêtes, `503` dépendance indisponible.
6. Les `POST` d’action renvoient **200** (pas 201).
7. Tous les montants sont des **entiers en FCFA**. Jamais de flottant.
8. Trois rôles : `brand`, `influencer`, `admin`.
9. Deux options activables (feature flags) : `v2` (réservation et paiement) et `v3` (matching). Une route protégée par un flag coupé renvoie 404.
10. Chaque action sensible est inscrite dans un journal d’audit (acteur, action, cible, avant/après, IP).

## Constantes métier

| Constante | Valeur |
|---|---|
| Commission plateforme | 15 % (90 000 → 13 500 de frais, 76 500 nets) |
| Tarif minimum | 5 000 FCFA |
| Paiement maximum | 2 000 000 FCFA |
| Brief | 160 mots maximum, pièce jointe 9 Mo maximum |
| Auto-validation | 72 h après publication |
| Moyens de paiement | `om`, `mtn`, `moov`, `wave`, `card` |
| Opérateurs de retrait | `om`, `mtn`, `moov`, `wave` |
| Réseaux | `ig`, `tt`, `fb`, `sc` |
| Objectifs | `notoriete`, `engagement`, `trafic`, `conversion` (l’admin peut en ajouter) |
| Catégories / villes / types de demande | Gérés par l’admin (`GET /catalog`, `POST /admin/catalog`) |

**Formules annonceur**

| Clé | Libellé | Prix / mois | Campagnes / mois | Matching complet | Prédictions + UTM | Export CSV |
|---|---|---|---|---|---|---|
| `free` | Découverte | 0 | 3 | non | non | non |
| `pro` | Pro | 15 000 | 5 | oui | oui | non |
| `business` | Business | 75 000 | illimité | oui | oui | oui |

**Options influenceur**

| Clé | Libellé | Prix |
|---|---|---|
| `pro` | Influenceur Pro | 5 000 |
| `certified` | Certifié | 10 000 |
| `analytics` | Analytics avancées | 15 000 |

---

## 1. Système

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/health` | public | `{ live, ready, db, redis }` ; 503 si MySQL ou Redis est indisponible |
| GET | `/docs` | public | Interface Swagger |
| GET | `/docs/openapi.json` | public | Spécification OpenAPI |
| GET | `/metrics` | public | Métriques Prometheus (`text/plain`) |

## 2. Authentification et compte

| Méthode | Route | Accès | Corps / réponse |
|---|---|---|---|
| GET | `/auth/session` | public | Session courante ou `null` |
| POST | `/auth/login` | public | `{ email, password }` → `{ message, session }` + cookie |
| POST | `/auth/logout` | connecté | `{ message: "Déconnecté." }` |
| POST | `/auth/signup/brand` | public | `{ company, contact, email, password }` |
| POST | `/auth/signup/influencer` | public | `{ name, handle, email, password, phone?, city, bio?, photo?, nets, cats, accepts:{pub,partenariat,dedicace}, price }` |
| GET | `/auth/handle?handle=` | public | `{ available: boolean }` |
| POST | `/auth/demo` | public | `{ role, id }` — uniquement si `DEMO_MODE=true` |
| POST | `/auth/password/forgot` | public | `{ email }` — réponse identique que le compte existe ou non |
| POST | `/auth/password/reset` | public | `{ token, password }` |
| GET | `/me/export` | connecté | Export RGPD des données du compte |
| DELETE | `/me` | connecté | `{ password }` — anonymise le compte |

Règles :
- Mot de passe : 8 caractères minimum.
- Limiter les tentatives de connexion par e-mail et par IP.
- Un influenceur inscrit est `pending` jusqu’à vérification par l’admin.
- Prix minimum à l’inscription : 5 000 FCFA.

## 3. Plateforme

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/platform` | public | Flags, session éventuelle, compteurs |
| GET | `/catalog` | public | Thématiques, villes, objectifs, types de demande (éléments **actifs**) |
| GET | `/notifications` | connecté | Notifications de l’utilisateur |
| POST | `/notifications/read` | connecté | Tout marquer comme lu → `null` |
| PUT | `/me/preferences` | connecté | `{ onboarded: true }` → `null` |

## 4. Influenceurs

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/influencers` | public | Liste paginée : `cursor`, `limit` (≤ 48), `s`, `cat`, `net`, `badge`, `budget`, `sort` (`score`, `plus`, `moins`, `prix`, `eng`) |
| GET | `/influencers/directory` | public | Annuaire complet |
| GET | `/influencers/carousel?filter=reco` | public | Sélection de l’accueil |
| GET | `/influencers/:handle` | public | Fiche publique |
| POST | `/influencers/:id/visits` | public | Compter une visite (dédoublonnée par IP / agent) |
| POST | `/influencers/:id/favorite` | public (annonceur connecté) | Ajouter / retirer des favoris |
| POST | `/influencers/:id/requests` | public | `{ from, contact, msg (10–1000), type, turnstileToken? }` |
| PUT | `/influencers/:id/vitrine` | propriétaire | `{ bio, cats, days, rates:[{id?,net,fmt,price}] }` |
| PUT | `/influencers/:id/photo` | propriétaire ou admin | `{ photo, consent? }` — l’admin doit envoyer `consent: true` |

Chaque influenceur renvoyé par `presentInfluencer` (liste, carrousel, annuaire, vitrine, espace, admin) contient encore `net`, `aud`, `auth`, `creat`, `brief`, `onTime`, `done`, plus **`pullupScore`** (nombre / 5) et **`stats`** (réseaux, audience, âges, genre, barres, légende) déjà calculés : le front n’a plus à les dériver. Score PULLUP Ama Kouassi = 4,6. Seuls les profils vérifiés et actifs sont listés.

## 5. Matching (flag `v3`)

| Méthode | Route | Accès |
|---|---|---|
| POST | `/matching` | public |

Corps : `{ theme, objective, net ("any" ou réseau), budget, age?, gender? ("all"/"f"/"m"), city?, desc? }`.

Réponse : liste classée avec `note` (3 à 5), `why[]`, `bestNet`, `reco`, `price`, `inBudget`, `reach`, `interactions`, `cpm`. Les profils dans le budget passent en premier.

Droits :
- Visiteur et formule `free` : `reach`, `interactions` et `cpm` à `null` ; à partir du 4e résultat, profil **masqué** (`masked: true`, `price: null`, `influencer: { id: "masked-4", name: "Profil réservé" }`, sans handle ni photo).
- `pro` et `business` : résultats complets.

## 6. Campagnes

### Réservation (flag `v2`)

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/booking/:handle` | public | Offres et solde de l’annonceur connecté |
| POST | `/uploads/brief` | brand | `{ filename, mime, size }` → URL présignée S3 |
| POST | `/campaigns` | brand | Créer et payer une campagne |
| GET | `/campaigns/:id/payment` | parties ou admin | `{ status }` |

Corps de création :

```json
{
  "infId": "i1",
  "rateId": "i1r1",
  "pay": "om",
  "phone": "0700000000",
  "brief": { "title": "…", "objective": "notoriete", "theme": "beaute", "text": "…", "link": "https://…", "date": "…", "file": "…" }
}
```

Règles :
- Vérifier le quota mensuel de la formule.
- Brief : titre obligatoire, consignes suffisantes, lien en `https://`, 160 mots maximum.
- Le **solde annonceur est utilisé en priorité**, le reste est encaissé via mobile money.
- Référence unique `PU-AAMM-NNN`, générée sans collision même sous concurrence.
- Réponse : `{ id, status: "paid", message }` si payé immédiatement, sinon `{ id, status: "awaiting_payment", message: "Confirmez le paiement sur votre téléphone.", redirectUrl }`.

### Lecture et cycle de vie

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/campaigns` | connecté | Campagnes de l’utilisateur (toutes pour l’admin) |
| GET | `/campaigns/:id` | connecté | `{ access: "ok", campaign }`, `{ access: "forbidden" }` ou `{ access: "missing" }` |
| POST | `/campaigns/:id/:action` | selon l’action | Transition d’état |
| POST | `/campaigns/:id/messages` | parties ou admin | `{ text }` |
| POST | `/campaigns/:id/review` | brand | `{ stars (1–5), text? }` — un seul avis par campagne |
| POST | `/admin/campaigns/auto-validate` | admin | Valider les campagnes publiées depuis 72 h |
| GET | `/r/:ref` | public | Clic tracké, redirection 302 vers le lien UTM |

Machine à états :

| Action | Rôle | Depuis | Effet |
|---|---|---|---|
| `accept` | influencer | `paid` | → `accepted` |
| `decline` | influencer | `paid` | Remboursement vers le solde annonceur |
| `proof` | influencer | `accepted` | `{ url (http/https), note? }` → `published` |
| `cancel` | brand | `paid`, `accepted` | Remboursement |
| `validate` | brand, admin | `published` | → `completed`, fonds libérés |
| `dispute` | brand | `published` | `{ reason }` → `dispute` |
| `release` | admin | `dispute` | Fonds libérés à l’influenceur |
| `refund` | admin | `dispute` | Remboursement à l’annonceur |

Action inconnue → 404 ; mauvais rôle → 403 ; mauvais statut → 409 « Cette action n’est plus disponible. ». Protéger contre le double-clic (verrou + mise à jour conditionnelle).

Lien UTM : `<lien>?utm_source=pullup&utm_medium=<réseau>&utm_campaign=<ref en minuscules>&utm_content=<handle>`.

Tâches planifiées : rappel à 48 h sans réponse, remboursement des campagnes non acceptées, rappel à la date de publication, auto-validation à 72 h.

## 7. Grand livre et paiements

- Comptabilité en **double écriture** : chaque mouvement = un débit et un crédit de même montant, même `tx_id`.
- Comptes : `brand_balance`, `escrow`, `influencer_wallet`, `platform_revenue`, `external_psp`.
- Table `ledger_entries` **immuable** (triggers interdisant `UPDATE` et `DELETE`).
- Un solde ne passe jamais sous zéro (`SELECT … FOR UPDATE`).

| Méthode | Route | Accès |
|---|---|---|
| POST | `/payments/webhook/:provider` | public, signé |

Webhooks : vérification de signature HMAC sur le corps brut, **idempotence** (un même événement traité une seule fois), réponse 200 même en doublon. Rapprochement périodique avec le PSP ; un écart déclenche une alerte.

## 8. Espaces personnels

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/me/brand-space` | brand | Campagnes, solde, favoris, formule |
| GET | `/me/influencer-space` | influencer | Campagnes, portefeuille (`wallet.available` lu dans la table portefeuille), mouvements, demandes, avis |
| PUT | `/me/brand` | brand | `{ name, contact, sector }` |
| GET | `/me/campaigns.csv` | brand Business | Export CSV des campagnes |

## 9. Facturation et portefeuille

| Méthode | Route | Accès | Corps |
|---|---|---|---|
| PUT | `/billing/plan` | brand | `{ plan, pay?, phone? }` |
| POST | `/billing/boosts` | influencer | `{ key, pay?, phone? }` |
| POST | `/wallet/withdrawals` | influencer | `{ amount, operator, phone, code? }` |

Réponses formule et option : `{ message, status: "active" }` ou `{ message, status: "awaiting_payment", redirectUrl }`. Revenir à `free` annule à la fin de la période (`status: "cancelled"`).

Règles :
- Activation idempotente (mise à jour conditionnelle `pending → active`).
- L’option `certified` **notifie l’admin** ; elle ne certifie pas le profil automatiquement.
- Retraits : plafonds journaliers (`WITHDRAW_DAILY_COUNT`, `WITHDRAW_DAILY_FCFA`), KYC au-delà de `WITHDRAW_KYC_FCFA`, débit du portefeuille puis envoi au PSP ; en cas d’échec, recrédit **une seule fois**.

## 10. Back-office admin

Toutes ces routes exigent le rôle **`admin`** : 401 si non connecté, 403 sinon. Chaque action est auditée.

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/admin/dashboard` | – | `{ campaigns, influencers, brands, flags }` |
| POST | `/admin/influencers/:id/verify` | – | `{ message: "<nom> est maintenant vérifié." }` |
| POST | `/admin/influencers/:id/reject` | `{ reason? }` | `{ message: "Profil refusé." }` |
| POST | `/admin/influencers/:id/suspend` | `{ reason }` (obligatoire) | `{ message: "Profil masqué." }` |
| POST | `/admin/influencers/:id/certify` | – | `{ message: "<nom> est maintenant certifié." }` + notification |
| PUT | `/admin/influencers/:id/scores` | `{ auth?, creat?, brief?, onTime?, aud?, net? }` | `{ message: "Statistiques mises à jour." }` |
| GET | `/admin/finance/summary` | – | `{ escrow, commissionsMonth, pendingWithdrawals, gaps }` |
| GET | `/admin/finance/ledger.csv?from=&to=` | – | Fichier `pullup-grand-livre.csv` |
| GET | `/admin/withdrawals?status=` | `pending`, `sent`, `failed` | Liste des retraits |
| POST | `/admin/withdrawals/:id/retry` | – | `{ message: "Retrait relancé." }` |
| GET | `/admin/audit?actor=&target=` | – | Événements d’audit |
| POST | `/admin/brands/:id/credit` | `{ amount (entier > 0), reason }` | `{ message: "<montant> crédités." }` |
| PUT | `/admin/flags/:key` | `{ value: boolean }` | Flag mis à jour |
| POST | `/admin/campaigns/auto-validate` | – | Campagnes validées |
| GET | `/admin/catalog` | – | Catégories, villes, objectifs, types de demande (y compris masqués) |
| POST | `/admin/catalog` | `{ kind, key?, label, related?, reco?, sortOrder? }` | `{ message, item }` — `kind` : `category`, `city`, `objective`, `contact_type` |
| PUT | `/admin/catalog/:kind/:key` | `{ label?, related?, reco?, sortOrder?, active? }` | `{ message, item }` |
| DELETE | `/admin/catalog/:kind/:key` | – | Masque l’élément (`active: false`). Au moins un actif par type. |

Bornes des scores : `auth`, `brief`, `onTime` entiers de 0 à 100 ; `creat` de 0 à 5. `aud` = `{ f, ages: [13-17, 18-24, 25-34, 35+], cities: [[ville, %]] }` ; `net` = `{ ig|tt|fb|sc: [abonnés, engagement %] }` (remplace tous les réseaux). Seul l’admin écrit ces données. Après modification, le Score PULLUP et `stats` sont recalculés et le cache des listes est vidé.

---

## Données de démonstration (`npm run seed`)

- Mot de passe commun lu dans `DEMO_PASSWORD`, jamais écrit en dur. Seed refusé si `NODE_ENV=production`.
- **Admin** : `admin@pullup.net`.
- **3 annonceurs** : Savane Cosmetics (`marketing@savane.ci`, pro, solde 35 000), Maquis Le Palmier (`contact@lepalmier.ci`, free), Kalo Fintech (`growth@kalo.ci`, business).
- **16 influenceurs** vérifiés (`<handle>@mail.ci`), certifiés : i1, i3, i8, i10.
- **5 campagnes** : PU-2410-137 `paid`, PU-2409-131 `published`, PU-2409-118 `completed` (avis 5/5), PU-2410-139 `accepted`, PU-2409-125 `dispute`.
- Portefeuille d’Ama Kouassi : 142 500 FCFA. Flags `v2` et `v3` activés.

## Critères d’acceptation

1. Le front fonctionne contre l’API avec `VITE_API_URL=http://localhost:3000/api` et `withCredentials: true`.
2. Une matrice **rôles × routes** générée vérifie chaque route pour visiteur, brand, influencer et admin.
3. Tests unitaires du domaine avec les **mêmes valeurs que le front** : Score PULLUP, badge, engagement, matching, commission, UTM, formatage FCFA.
4. Tests d’intégration : authentification, machine à états, libération et remboursement, retraits, webhooks (idempotence et signature).
5. Couverture : 90 % sur le domaine et la finance, 70 % au global.
6. Logs JSON avec identifiant de requête, utilisateur et durée ; e-mails et téléphones masqués.
7. Swagger sur `/api/docs`, routes admin regroupées sous le tag **Admin**, exemples issus du seed.
8. Migrations appliquées avec `prisma migrate deploy`, jamais `db push` en production.
