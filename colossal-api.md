# Colossal POS — surface UEAT / POSIPAPI

Reverse-engineer live contre `pouletfritideal03.colossalepos.com` (2026-08-18).  
Script : `bun run pos:fetchmenu`.

Colossal expose une API **PHP** sous `POS-Backend/api/ueat/`. C’est la même surface que UEAT utilise pour pousser des commandes en ligne vers la caisse. Ce n’est **pas** une API pour lire les tickets déjà ouverts en caisse.

## Connexion

| Élément | Valeur |
|---|---|
| Base | `https://{tenant}.colossalepos.com` |
| Préfixe | `/api/ueat` |
| Auth | `Authorization: Bearer <COLOSSAL_API_KEY>` |
| Site | query `locationId` (healthcheck / fetchmenu) **et** `location.id` dans le JSON (validation / sendorder) |

Sans `locationId`, PHP crash :

```
UEatConfig::$locationId of type string  (config.php:34)
```

Sans Bearer (ou mauvaise clé), `healthcheck` / `fetchmenu` → **401**.

Variables locales (jamais `PUBLIC_`) :

```
COLOSSAL_API_KEY=
COLOSSAL_BASE_URL=https://pouletfritideal03.colossalepos.com
COLOSSAL_LOCATION_ID=
```

## Endpoints

| Rôle | Méthode | Chemin | Observé |
|---|---|---|---|
| Santé | `GET` | `/api/ueat/healthcheck?locationId=` | OK |
| Menu | `GET` ou `POST` | `/api/ueat/fetchmenu?locationId=` | OK (~80 KB JSON) |
| Pré-validation | `POST` | `/api/ueat/ordervalidation` | OK si body `location.id` |
| Envoi commande | `POST` | `/api/ueat/sendorder` | Même body (crée un ticket caisse) |

Pas d’endpoint « liste des commandes caisse » ni webhook de statut dans cette surface.

### `GET /api/ueat/healthcheck`

Avec Bearer + `locationId` :

```json
{ "location": { "id": "20737" }, "status": "Ok" }
```

Sans / mauvaise clé : HTTP **401**

```json
{ "location": { "id": "20737" }, "status": "Error" }
```

`status` est `"Ok"` ou `"Error"`. L’id renvoyé = le `locationId` demandé.

### `GET|POST /api/ueat/fetchmenu`

GET et POST (body vide) renvoient le même JSON. GET sans Bearer → 401.

Racine :

```json
{ "items": [ /* 433 lignes, ids uniques */ ] }
```

Chaque item :

| Champ | Type | Valeurs vues |
|---|---|---|
| `id` | string numérique | `"100"`, `"401"`… identifiant **POS** |
| `name` | string | libellé caisse ; parfois `"NULL"` (2 cas) |
| `availability` | string | `"Available"` (399) / `"Unavailable"` (34) |
| `group` | string | catégorie POS (26 groupes). Attention espaces : `"SALADES "`, `"CAFÉ "` |
| `itemType` | string | `"Item"` (282) = produit ; `"Option"` (151) = extra / remarque |
| `prices` | array | toujours **2** entrées |

Prix :

```json
{ "price": 10, "service": "Delivery" }
{ "price": 10, "service": "Takeout" }
```

- `price` = dollars CAD (pas des cents). `10` = 10,00 $ ; `12.95` = 12,95 $.
- `service` : `"Delivery"` (livraison) ou `"Takeout"` (emporter). Souvent le même montant.
- Aucun autre champ (pas de description, photo, allergènes, lien parent/enfant).

**Liste plate.** Les `Option` (extras, sauces, remarques) ne sont **pas** rattachées à un `Item`. Groupes typiques d’options : `REMARQUES`, `EXTRAS`, `SAUCES/MAYOS`, `NOTE CUISINE`.

Groupes vus (après trim) : POUTINES, EXTRAS, REMARQUES, BREUVAGES, FRITES, SANDWICHS, POULET FRIT, BOLS, ENTRÉES, DESSERTS, MENU DU JOUR, MENU ENFANT, SALADES, SAUCES/MAYOS, FRAIS LIVRAISON, etc.

Mapping resto-pi suggéré :

| Colossal | resto-pi |
|---|---|
| `group` (trim) | `categories.name` |
| `itemType: Item` | `products` + 2 `product_variants` (Delivery / Takeout) |
| `itemType: Option` | `product_extras` / extras globaux (pas de lien item) |
| `id` | `product_variants.sku` ou `external_pos_id` |
| `price * 100` | `price_cents` |
| `Available` | `isActive: true` |
| absent du prochain fetch | `isActive: false` |

### `POST /api/ueat/ordervalidation` et `/sendorder`

Ils **ne lisent pas** `?locationId=`. Le site doit être dans le JSON :

```json
{ "location": { "id": "20737" }, "order": { /* … */ } }
```

`ordervalidation` avec ce envelope (live) :

```json
{ "isSuccessful": true, "errorMessage": "" }
```

`sendorder` utilise le **même** body et crée un ticket en caisse. Ne pas l’appeler pour un test.

#### Body `order` (exemple UEAT réel)

| Champ | Rôle |
|---|---|
| `location.id` | même id que `COLOSSAL_LOCATION_ID` (string) |
| `order.company` | `{ id: number, name, phoneNumber }` — succursale |
| `order.customer` | `firstName`, `lastName`, `phoneNumber`, `email`, `allergies`, `company`, `fidelityNumber` |
| `order.deliveryAddress` | `civicNumber`, `streetName`, `apartment`, `city`, `postalCode` |
| `order.fees` | `shipingFees` (faute d’orthographe UEAT), `serviceFees`, `allergyFees`, `bagFees[]` |
| `order.id` | id commande côté marketplace / resto-pi |
| `order.items[]` | lignes ; `externalId` = **id item fetchmenu** |
| `order.items[].options[]` | extras ; `externalId` = **id Option fetchmenu** |
| `order.orderType` | `"delivery"` \| `"takeout"` (probable) |
| `order.channel` | `"web"` |
| `order.preparationType` | `"preOrder"` ou `"asap"` |
| `order.totals` | `subTotal`, `total`, `taxes[]` (`TPS` Federal 5 %, `TVQ` State 9.975 %), `tips`, `isOrderPaid` |
| datetimes | ISO-8601 ; `paidDateTime` peut être `0001-01-01T00:00:00` si non payé |

Ligne item (prix en **dollars**, pas cents) :

```json
{
  "externalId": "427",
  "name": "Poutine saucisses - Petite",
  "quantity": 1,
  "unitPrice": 12.5,
  "regularUnitPrice": 12.5,
  "hasFederalTax": true,
  "hasStateTax": true,
  "extras": [],
  "options": [
    {
      "externalId": "107",
      "name": "Sauce BBQ",
      "quantity": 1,
      "unitPrice": 0,
      "regularUnitPrice": 0,
      "hasFederalTax": true,
      "hasStateTax": true,
      "extras": [],
      "options": [],
      "orderItemId": 447582474,
      "orderItemNote": ""
    }
  ],
  "orderItemId": 447582473,
  "orderItemNote": ""
}
```

`externalId` doit matcher `items[].id` de `fetchmenu`. Les options sont des `itemType: "Option"`. `orderItemId` est un id interne UEAT (entier) ; on peut générer le nôtre à l’envoi.

Taxes QC typiques : TPS 5 % + TVQ 9,975 % sur le sous-total (+ frais livraison).

Script validation (sans ticket caisse) : `bun run pos:validate`.

## Ce que cette API ne fait pas

- Pas de poll des commandes nées en caisse.
- Pas de MAJ de statut cuisine vers resto-pi.
- Pas de graphe extras ↔ produits.
- HTTP 200 même en fatal PHP (IIS). Se fier au `Content-Type: application/json` + parse, pas au status.

## Test local

```bash
bun run pos:fetchmenu    # menu JSON
bun run pos:validate     # POST ordervalidation (pas de ticket caisse)
```

Ne log pas la clé. Ne pas lancer `sendorder` en test.
