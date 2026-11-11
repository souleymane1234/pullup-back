# PULLUP — API

Marketplace d’influence (Côte d’Ivoire). Préfixe **`/api`**. Sessions cookie `pullup.sid`. Montants en **entiers FCFA**. Base **MySQL**.

Front : `VITE_API_URL=http://localhost:6000/api`, servi sur `http://localhost:6010`. Cookie : `withCredentials: true`.

## Installation

1. MySQL : créer la base `pullup`. # Redis : `redis-server` (commenté pour l'instant).
2. Copier `.env.example` vers `.env`. Renseigner `DATABASE_URL`, `SESSION_SECRET`, `DEMO_PASSWORD`.

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed                 # ou npx prisma db seed
npm run start:dev
```

Santé : `GET /api/health`  
Swagger : `GET /api/docs` (tag **Admin** pour le back-office)  
Spécification : `GET /api/docs/openapi.json`  
Métriques : `GET /api/metrics`

Le développement local n’utilise pas Docker. En production, une image multi-étapes est définie dans `Dockerfile`.

## Comptes de démonstration

Mot de passe commun : valeur de `DEMO_PASSWORD` (jamais écrite en dur).

| Rôle | E-mail |
|---|---|
| Admin | `admin@pullup.net` |
| Savane Cosmetics (pro) | `marketing@savane.ci` |
| Maquis Le Palmier (free) | `contact@lepalmier.ci` |
| Kalo Fintech (business) | `growth@kalo.ci` |
| Ama Kouassi | `amakouassi@mail.ci` |

Connexion démo : `POST /api/auth/demo` (`DEMO_MODE=true`).  
Réinitialiser : `npm run seed:reset` (refusé si `NODE_ENV=production`).

## Variables

Voir `.env.example`. En production : `NODE_ENV=production`, `DEMO_MODE=false`, secrets dans le gestionnaire de l’hébergeur. Domaine prévu : `api.pullup.ci` (même parent que le front pour les cookies). `SENTRY_DSN` active Sentry (erreurs et traces).

## Qualité

```bash
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run test:cov
npm run test:contract   # front/src/app/pages.test.jsx contre l’API si VITE_API_URL est défini
```

Couverture visée : **90 %** sur le domaine et la finance, **70 %** au global. CI : lint, Prettier, tests, `npm audit --audit-level=critical`.

## Production

```bash
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy   # jamais db push
NODE_ENV=production DEMO_MODE=false npm run start:prod
```

Hébergement proche de l’Afrique de l’Ouest, MySQL managé (sauvegardes quotidiennes, restauration testée chaque mois), Redis managé, HTTPS. CI/CD : lint → tests → build → migration → déploiement → santé (`GET /api/health`) → retour arrière si échec.

## Grand livre et schéma

Voir `docs/grand-livre.md` et `docs/schema.md`.

## Adaptations front (dépôt voisin)

À faire en parallèle dans `front` :

- `src/lib/http.js` : `withCredentials: true`.
- Inscriptions annonceur et influenceur : champ mot de passe ; pages « mot de passe oublié » et « réinitialisation ».
- Statut `awaiting_payment` dans `STATUS` (`src/domain/catalog.js`), écran « Confirmez le paiement sur votre téléphone » via `GET /campaigns/:id/payment`.
- Pièce jointe du brief : `POST /uploads/brief` (URL présignée).
- Matching : afficher les résultats `masked` renvoyés par le serveur.
- `completeOnboarding()` → `PUT /me/preferences`.
- Options : `{ key, pay, phone }` vers `/billing/boosts` ; formules : gérer `awaiting_payment` et `redirectUrl`.
- Photo admin : case « J’ai l’accord écrit de l’influenceur » (`consent: true`).
