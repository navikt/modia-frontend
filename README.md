# Modia-frontend

> Modia-frontend er en ny backend-for-frontend app som erstatter http://github.com/navikt/modialogin.

> [!IMPORTANT]
>
> **Hvorfor enda en ny BFF?**
> Modialogin er en relativt stor app bygget før [wonderwall](https://github.com/nais/wonderwall) og [oasis](https://github.com/navikt/oasis) eksisterte.
> Å vedlikeholde en relativt stor (for sin oppgave) og kompleks app er ikke ønsket, og ved å skrive
> en ny app som tar i bruk mer moderne og strømlinjeformet funksjonalitet i NAV og Nais kan vi
> forenkle kodebasen og redusere det totale overflatearealet som kjører i produksjon

Modia-frontend har få avhengigheter (bun, Hono.js og unleash) og er laget for å være ultrakjapp,
kreve _lite_ resursser og enkel å bruke og vedlikeholde.

## Hvordan bruke

Bruk docker-imaget og legg ved de statiske filene du trenger. Appen konfigureres med
[miljøvariabler](https://github.com/navikt/modia-frontend#miljøvariabler)
og en valgfri [konfigurasjonsfil](https://github.com/navikt/modia-frontend#proxy-konfigurasjon).

```Dockerfile
FROM ghcr.io/navikt/modia-frontend:1.0

COPY dist ./static

# Valgfri konfigurasjonsfil
COPY proxy-config.json .
```

Appen er opinionated og krever at man følger noen konvensjoner:

- Proxy-endepunkter er kun tilgjengelig på `/proxy`
- Appen krever wonderwall for å fungere

I tillegg støtter den noen features for runtime-konfigurasjon med miljø og unleash. Se [HTML rewrite](https://github.com/navikt/modia-frotend#html-rewrites)
for mer info.

### Miljøvariabler

| Navn             | Påkrevd/Default verdi | Beskrivelse                                                                                                      |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| STATIC_FILES_DIR | JA                    | Relativ path til statiske filer som skal serves. **Må være i eller under WORKDIR i dockerfilen**. Eks `./static` |
| BASE_PATH        | Nei `"/"`             | Base path for appen. Eks `/min-app`. Alle ruter vil da legges under denne                                        |
| CONFIG           | Nei                   | Proxy/avansert konfigurasjon som streng. Se under for mer info                                                   |

### Proxy konfigurasjon

I config-filen `./proxy-config.json` kan man legge inn konfigurasjon for proxying og avansert konfig. I `proxy`
nøkkelen legges det vet et object med prefix og tilsvarende target url og scope som brukes for å
generere OBO-tokens.

Eks:

```json
{
  "proxy": {
    "test-api": {
      "url": "https://min-backend.example.com/api",
      "scope": "dev-gcp:mitt-team:min-app"
    }
  }
}
```

I eksemplet over vil requests til `/proxy/test-api/controller/endpoint?id=1234&name=test` proxies
til `https://min-backend.example.com/api/controller/endpoint?id=1234&name=test`.

### Andre konfigurasjonsnøkler

## CSP

CSP konfigureres i `contentSecurityPolicy`. Denne sendes rett til Hono.jss `secureHeaders`. For alle
støttede nøkler se [Setting Content-Security-Policy](https://hono.dev/middleware/builtin/secure-headers#setting-content-security-policy).

```json
{
  "proxy": { ... },
  "contentSecurityPolicy": {
    "scriptSrc": ["'self'", "'unsafe-inline'"]
  }
}
```

### HTML rewrites

#### Aktivering og deaktivering av kode i miljø

Ved bruk av en `<slot>` i head tagen i html dokumentet kan du (de)aktivere kode basert på miljø.

Eks:

```html
<slot environment="prod">
  <script src="https://cdn.nav.no/min-prod-kode.js" />
</slot>

<slot environment="local">
  <script src="http://localhost:8000/min-lokal-kode.js" />
</slot>

<slot not-environment="prod">
  <script src="https://cdn.nav.no/min-developlment-kode.js" />
</slot>
```

Avhengig av miljø vil innholdet i den `slot`en som matcher miljøet bli lagt til i HTML-dokumentet

### Unleash

Dersom Unleash er aktivert, kan du legge ved en `<script unleash>` tag i `head` som laster inn
unleash toggles i dokumentet. I `toggles` attributten legger du ved en kommaseparert liste med
toggles som skal injectes. OBS: punktum erstattes med understrek (`app.feature-1` => `app_feature-1`)

Eks:

```html
<script unleash toggles="ny-feature-1,bruk-kul-ny-ting">
  window.useFeature = unleash && unleash["ny-feature-1"];
</script>
```

Resultat:

```html
<script unleash toggles="ny-feature-1,bruk-kul-ny-ting">
  // Kode injectes før eventuell eksisterende kode i script tagen
  const unleash = { "ny-feature-1": true, "bruk-kul-ny-ting": false };
  window.useFeature = unleash && unleash["ny-feature-1"];
</script>
```

> [!NOTE]
>
> Dersom unleash klienten ikke er konfigurert, vil **hele** script tagen fjernes fra dokumentet.
> Anta derfor at `window.useFeature` i tilfellet over kan være `undefined`.

### Miljøvariabler

Dersom det eksisterer `<script` tag med `env-vars` og `prefix` attributtene vil det injects
miljøvariabler fra serveren inn i `window.__ENV__` som har prefix satt.

Eks:

```html
<script env-vars prefix="PUBLIC_"></script>
```

Resultat:

```html
<script env-vars prefix="PUBLIC_">
  window.__ENV__ = {
    PUBLIC_MY_URL: "https://some.url.from.env",
    PUBLIC_ENV: "test",
  };
</script>
```

## Utvikling

Installer avhengigheter

```sh
bun install
```

Kjør dev-server:

```sh
bun run dev
```

Åpne http://localhost:3000

## Push nytt bilde

Build workflowen kjører på ny tag. Lag en ny git tag og push denne, så vil et nytt docker bilde
bygges og pushes.

## For NAV-ansatte

Spørsmål rettes til #team-personoversikt
