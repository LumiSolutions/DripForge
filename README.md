# DripForge Web

Next.js-Shop und Admin-Portal für [dripforge.ch](https://dripforge.ch).

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

Kopiere `.env.example` nach `.env.local` und trage die Werte ein:

```bash
cp .env.example .env.local
```

Nach Änderungen an `.env.local` den Dev-Server neu starten.

## Umgebungsvariablen (Überblick)

| Variable | Zweck |
|----------|--------|
| `COSMOSDB_ENDPOINT` | Azure Cosmos DB Endpoint |
| `COSMOSDB_KEY` | Cosmos DB Primary Key |
| `COSMOSDB_DATABASE` | Datenbankname (Standard: `dripforge`) |
| `THREE_D_GENERATOR_API_KEY` | API-Key für Text/Image-to-3D (Meshy o. ä.) |
| `THREE_D_GENERATOR_API_URL` | Optional — Standard: Meshy AI Text-to-3D |
| `ADMIN_SESSION_SECRET` | Admin-Session-Signatur |
| `ADMIN_2FA_ENCRYPTION_KEY` | Verschlüsselung der TOTP-Secrets |

Weitere Keys (Stripe, SMTP, …) siehe `.env.example`.

---

## 3D-KI-Generator (Azure)

Der KI-Konfigurator (`/konfigurator/ai`) nutzt standardmässig **Meshy AI** (`lib/ai/generate-3d-provider.ts`).  
Ohne API-Key wird ein **Demo-GLB** geladen — die technischen Vorgaben aus dem Admin werden trotzdem angewendet.

### Lokal testen

In `.env.local` (Projekt-Root):

```env
THREE_D_GENERATOR_API_KEY=msy_xxxxxxxxxxxxxxxx
# Optional — anderer Anbieter:
# THREE_D_GENERATOR_API_URL=https://api.meshy.ai/openapi/v2/text-to-3d
```

API-Key bei [Meshy AI](https://www.meshy.ai/) erstellen. Alternativ kann `THREE_D_GENERATOR_API_URL` auf Tripo3D oder Luma AI zeigen (Request-Body muss ggf. in Phase 2 angepasst werden).

Dev-Server neu starten. In der Browser-Konsole erscheint bei fehlendem Key ein Hinweis mit dem exakten Variablennamen.

### Azure App Settings (Live: dripforge.ch)

Je nach Hosting:

#### Azure Static Web Apps (empfohlen für dieses Repo)

1. [Azure Portal](https://portal.azure.com) → **Static Web Apps** → eure DripForge-Instanz  
2. **Settings** → **Environment variables** (bzw. **Configuration** → **Application settings**)  
3. **Add**:
   - **Name:** `THREE_D_GENERATOR_API_KEY`  
   - **Value:** euer Meshy- (oder Tripo3D-/Luma-) API-Key  
4. Optional **Add**:
   - **Name:** `THREE_D_GENERATOR_API_URL`  
   - **Value:** `https://api.meshy.ai/openapi/v2/text-to-3d` (oder URL des gewählten Anbieters)  
5. **Save** — die App wird neu deployed bzw. die API-Funktion lädt die Variablen beim nächsten Request.

Alternativ per Azure CLI:

```bash
az staticwebapp appsettings set \
  --name <static-web-app-name> \
  --resource-group <resource-group> \
  --setting-names THREE_D_GENERATOR_API_KEY="msy_xxx" THREE_D_GENERATOR_API_URL="https://api.meshy.ai/openapi/v2/text-to-3d"
```

#### Azure App Service

1. **App Service** → **Settings** → **Environment variables** → **App settings**  
2. Gleiche Namen/Werte wie oben hinzufügen  
3. **Save** → **Restart** der App

### Prüfen auf Live

- `GET https://dripforge.ch/api/generate-3d/status` → `"configured": true` wenn der Key gesetzt ist  
- KI-Konfigurator: keine gelbe Demo-Warnung mehr; echtes Modell nach Generierung

**Hinweis:** Secrets nie ins Git committen — nur in `.env.local` (lokal) und Azure App Settings (Live).

---

## KI-Credits (Loyalty)

Kundenkonten (`customer-accounts`, `docType: "user"`) haben `aiCredits`.  
Neuregistrierung: **1 Willkommens-Credit**.

**Gutschrift nach Shop-Bestellung** (nur eingeloggte Portal-Konten mit gleicher E-Mail):

| Bestellwert (CHF) | Credits |
|-------------------|---------|
| ab 20             | +1      |
| ab 50             | +3      |
| ab 100            | +8      |

Gutschrift erfolgt automatisch in `POST /api/orders` sowie über den Stripe-Webhook bei `checkout.session.completed` mit `metadata.purpose: "shop-order"` (oder `"shop-checkout"`).

Eine Generierung auf `/konfigurator/ai` verbraucht **1 Credit** (`POST /api/generate-3d`, Login erforderlich).

---

## Build & Deploy

```bash
npm run build
```

GitHub Actions / Azure SWA deployen automatisch von `main`.

## Admin & Cosmos DB

Admin-Daten (Produkte, Filamente, KI-Einstellungen, Texte) liegen in Azure Cosmos DB.  
Ohne Cosmos-Konfiguration greifen lokale JSON-Fallbacks unter `data/admin/` (nur für Entwicklung).

Cosmos-Container teilen sich bei RU-Limits den `settings`-Container (`docType`-basiert).

## Weitere Dokumentation

- [Next.js Docs](https://nextjs.org/docs)
- Meshy API: [docs.meshy.ai](https://docs.meshy.ai/)
