# @agekey/widget

Embeddable AgeKey age verification widget — a vanilla Web Component
(`<agekey-verify>`) plus an optional React wrapper (`<AgeKeyVerify>`).

The widget renders inside a sandboxed iframe pointed at an AgeKey-controlled
host page (`https://widget.agekey.com.br` by default). The host page drives
the user through a 6-stage flow (intro → consent → method → loading →
success | error) and posts terminal events back to the parent via
`postMessage`. The Web Component re-emits those events as `CustomEvent`s on
itself.

Strict TypeScript, no `any`, WCAG 2.1 AA, pt-BR/en-US/es-ES out of the box.

---

## Installation

```bash
pnpm add @agekey/widget
```

For React consumers:

```bash
pnpm add @agekey/widget react
```

---

## Usage

### Vanilla HTML

```html
<script type="module" src="https://cdn.agekey.com.br/widget.js"></script>

<agekey-verify
  application-id="01926cb0-..."
  policy-slug="dev-18-plus"
  locale="pt-BR"
  style="display:block; width:100%; max-width:480px; height:560px;"
></agekey-verify>

<script>
  const widget = document.querySelector('agekey-verify');
  widget.addEventListener('agekey:approved', (e) => {
    console.log('approved', e.detail);
    // e.detail follows SessionCompleteResponse — { session_id, decision,
    // reason_code, method, assurance_level, token: { jwt, ... } }
  });
  widget.addEventListener('agekey:denied', (e) => console.warn(e.detail));
  widget.addEventListener('agekey:needs_review', (e) => console.info(e.detail));
  widget.addEventListener('agekey:error', (e) => console.error(e.detail));
  widget.addEventListener('agekey:cancelled', () => console.log('cancelled'));
</script>
```

### React

```tsx
import { AgeKeyVerify } from '@agekey/widget/react';

export function VerifyPage() {
  return (
    <AgeKeyVerify
      applicationId="01926cb0-..."
      policySlug="dev-18-plus"
      locale="pt-BR"
      style={{ width: '100%', maxWidth: 480, height: 560 }}
      onApproved={(detail) => console.log('approved', detail)}
      onDenied={(detail) => console.warn(detail)}
      onNeedsReview={(detail) => console.info(detail)}
      onError={(detail) => console.error(detail)}
      onCancelled={() => console.log('cancelled')}
    />
  );
}
```

---

## Attributes / Props

| Attribute (HTML)    | Prop (React)        | Description                                                                                                                       |
| ------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `application-id`    | `applicationId`     | AgeKey application UUID associated with the API key.                                                                              |
| `policy-slug`       | `policySlug`        | Slug of the policy to enforce (e.g. `dev-18-plus`). Mutually exclusive with `policy-id`.                                          |
| `policy-id`         | `policyId`          | Policy UUID. Mutually exclusive with `policy-slug`.                                                                               |
| `session-id`        | `sessionId`         | Pre-created session ID. If absent the host page may create one via `apiBase`.                                                     |
| `method-preference` | `methodPreference`  | Force a specific method (`zkp` \| `vc` \| `gateway` \| `fallback`). Default: auto-detect.                                          |
| `locale`            | `locale`            | BCP-47 language tag. Defaults to `pt-BR`. Supported: `pt-BR`, `en-US`, `es-ES`.                                                   |
| `widget-host`       | `widgetHost`        | Override the widget host URL. Default: `https://widget.agekey.com.br`. Can also be set globally via `window.__AGEKEY_WIDGET_HOST__`. |
| `api-base`          | `apiBase`           | AgeKey Edge Functions base (e.g. `https://<project>.supabase.co/functions/v1`). Forwarded to the host so it can complete sessions. |

The Web Component element re-emits these `CustomEvent`s on itself:

| Event name             | Payload (`event.detail`)                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `agekey:approved`      | `Partial<SessionCompleteResponse>` — `{ session_id, decision: 'approved', token: { jwt, ... }, ... }`                       |
| `agekey:denied`        | `Partial<SessionCompleteResponse>` — `{ decision: 'denied', reason_code, ... }`                                             |
| `agekey:needs_review`  | `Partial<SessionCompleteResponse>` — `{ decision: 'needs_review', reason_code, ... }`                                       |
| `agekey:error`         | `{ error_code, error_message }`                                                                                             |
| `agekey:cancelled`     | `{}`                                                                                                                        |

---

## postMessage protocol

The widget host page (`iframe-host.html`) exchanges two types of message
with the embedding page:

### Outbound (parent → iframe), once on iframe `load`

```ts
{
  type: 'agekey:init',
  applicationId: string | null,
  policySlug: string | null,
  policyId: string | null,
  sessionId: string | null,
  methodPreference: 'zkp' | 'vc' | 'gateway' | 'fallback' | null,
  locale: string,            // BCP-47, defaults to 'pt-BR'
  apiBase: string | null,    // Edge Functions base URL
  parentOrigin: string,      // window.location.origin of the embedder
}
```

The parent uses `iframe.contentWindow.postMessage(payload, widgetHostOrigin)`
with an explicit target origin — never `'*'` once the host is known.

### Inbound (iframe → parent), one per terminal stage

```ts
{
  type: 'agekey:event',
  event: 'approved' | 'denied' | 'needs_review' | 'error' | 'cancelled',
  detail: AgeKeyVerifyEventDetail,
}
```

### Origin validation

The Web Component refuses any `MessageEvent` whose `origin` is not in its
internal allowlist (built from the resolved `widget-host`). The host page
also rejects any inbound message that did not come from `window.parent`,
and only sends outbound messages to the `parentOrigin` it received in the
init payload. This prevents:

- Frame-busting attacks where a third-party iframe fakes terminal events.
- Leaking session data if the host is loaded inside an unexpected parent.

If you self-host the widget on a different origin, set `widget-host` (or
`window.__AGEKEY_WIDGET_HOST__` globally) so the allowlist is correctly
derived.

---

## Accessibility

- Semantic HTML: each stage is a `<section>` with a labelled heading.
- `aria-live="polite"` region announces loading and error transitions to
  screen readers.
- Focus is moved to the active stage's heading on transition.
- Focus rings are visible (`:focus-visible`) and 3px-wide.
- 44×44 px minimum target size on all buttons.
- High-contrast palette with light + dark scheme via `prefers-color-scheme`.
- Spinner animation is slowed when `prefers-reduced-motion: reduce`.
- Full keyboard navigation: `Tab` reaches every interactive control; `Enter`
  / `Space` activate buttons; checkboxes use native semantics.

---

## Internationalization

The widget host ships with three locale bundles: `pt-BR` (canonical),
`en-US`, and `es-ES`. The `locale` attribute selects the bundle; unknown
locales fall back to the primary-language match (`en-*` → `en-US`,
`es-*` → `es-ES`, anything else → `pt-BR`).

The same bundle is also exported from `@agekey/widget` as a
`messages` map for consumers who want to reuse the strings outside of
the iframe (e.g. for server-rendered fallback UI).
