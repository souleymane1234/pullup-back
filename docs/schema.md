# Schéma de la base (Prisma → MySQL)

Généré depuis `prisma/schema.prisma`. La production utilise **MySQL / MariaDB** (pas PostgreSQL).

```text
User ── Brand ── Campaign ── EscrowHold
  │         │         ├── CampaignEvent
  │         │         ├── CampaignMessage
  │         │         ├── UtmClick
  │         │         └── Review
  │         └── Subscription
  └── Influencer ── Wallet
              ├── Withdrawal ── Payout
              ├── BoostPurchase
              ├── Favorite
              └── ProfileViewDaily

Payment / LedgerEntry / WebhookEvent / AuditLog / FeatureFlag / CatalogItem / Notification
```

Commande locale : `npx prisma format` puis consulter `prisma/schema.prisma`.
Les migrations sont dans `prisma/migrations/` et s’appliquent avec `npx prisma migrate deploy` uniquement.
