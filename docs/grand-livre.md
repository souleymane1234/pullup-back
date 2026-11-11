# Grand livre PULLUP

Chaque mouvement d’argent est une écriture **double** : un débit et un crédit du même montant, même `tx_id`.

## Comptes

| Compte | Identifiant | Rôle |
|---|---|---|
| `brand_balance` | `brands.id` | Solde annonceur |
| `escrow` | `campaigns.id` | Fonds bloqués d’une campagne |
| `influencer_wallet` | `influencers.id` | Gains disponibles |
| `platform_revenue` | `pullup` | Commissions, formules, options |
| `external_psp` | `psp` | Mobile money / carte |

## Règles

- Montants **entiers FCFA**.
- Un portefeuille ou un solde marque ne peut pas passer sous zéro (`SELECT … FOR UPDATE`).
- Campagne en cours (`paid`, `accepted`, `published`, `dispute`) : séquestre ouvert.
- Campagne `completed` : libération (portefeuille + commission).
- Campagne remboursée : séquestre → solde marque.
- Retrait : portefeuille → PSP ; échec : recrédite **une seule fois**.

## Seed

Le seed recrée cinq campagnes. Quatre séquestres restent ouverts ; `PU-2409-118` est libérée. Le portefeuille d’Ama affiche 142 500 FCFA (trois mouvements de démo).
