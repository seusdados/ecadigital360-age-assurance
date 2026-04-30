/**
 * @agekey/widget — embeddable Web Component for AgeKey age verification.
 *
 * Hosts the verification UI inside a sandboxed iframe pointing at the
 * AgeKey-controlled widget host. The host page (see `iframe-host.html`)
 * drives the user through a 6-stage flow and posts terminal events back
 * to the parent via `postMessage`. This element re-emits those events as
 * `CustomEvent`s on itself so consumers can listen via `addEventListener`.
 *
 * Usage (vanilla):
 *   <agekey-verify
 *     application-id="..."
 *     policy-slug="..."
 *     locale="pt-BR"
 *   ></agekey-verify>
 *
 *   const el = document.querySelector('agekey-verify');
 *   el.addEventListener('agekey:approved', e => console.log(e.detail));
 */

import type { SessionCompleteResponse } from '@agekey/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Detail payload re-emitted on every terminal `agekey:*` CustomEvent.
 *
 * Mirrors {@link SessionCompleteResponse} from `@agekey/shared` for the
 * approved/denied/needs_review terminals; for `error` and `cancelled` only
 * partial data is present.
 */
export type AgeKeyVerifyEventDetail = Partial<SessionCompleteResponse> & {
  /** Optional error code (set for the `error` event). */
  error_code?: string;
  /** Optional human-readable error message. */
  error_message?: string;
};

/** Event names dispatched by `<agekey-verify>` on itself. */
export type AgeKeyVerifyEventType =
  | 'agekey:approved'
  | 'agekey:denied'
  | 'agekey:needs_review'
  | 'agekey:error'
  | 'agekey:cancelled';

/** Outbound message shape sent to the iframe host once it loads. */
type WidgetSessionParams = {
  type: 'agekey:init';
  applicationId: string | null;
  policySlug: string | null;
  policyId: string | null;
  sessionId: string | null;
  methodPreference: string | null;
  locale: string;
  apiBase: string | null;
  parentOrigin: string;
};

/** Inbound message shape received from the iframe host. */
type WidgetInboundMessage = {
  type: 'agekey:event';
  event: 'approved' | 'denied' | 'needs_review' | 'error' | 'cancelled';
  detail?: AgeKeyVerifyEventDetail;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default widget host (production CDN). Override per-instance via attribute or globally. */
export const DEFAULT_WIDGET_HOST = 'https://widget.agekey.com.br';

/**
 * Globally configurable widget host. Consumers can set
 * `window.__AGEKEY_WIDGET_HOST__ = 'https://staging-widget.agekey.com.br'`
 * before the script loads to override the default for every instance.
 */
declare global {
  interface Window {
    __AGEKEY_WIDGET_HOST__?: string;
  }
}

/** Default per-instance origin allowlist for postMessage validation. */
function defaultAllowedOrigins(host: string): readonly string[] {
  try {
    const url = new URL(host);
    return [url.origin];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Web Component
// ---------------------------------------------------------------------------

/** Custom element implementing the AgeKey widget. */
export class AgeKeyVerifyElement extends HTMLElement {
  static readonly observedAttributes = [
    'application-id',
    'policy-slug',
    'policy-id',
    'session-id',
    'method-preference',
    'locale',
    'widget-host',
    'api-base',
  ];

  private iframe: HTMLIFrameElement | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private allowedOrigins: readonly string[] = [];
  private resolvedHost = DEFAULT_WIDGET_HOST;

  connectedCallback(): void {
    this.resolvedHost = this.resolveHost();
    this.allowedOrigins = defaultAllowedOrigins(this.resolvedHost);
    this.render();
    this.attachMessageListener();
  }

  disconnectedCallback(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
  }

  attributeChangedCallback(): void {
    // If already mounted and an attribute changes, re-render so the iframe
    // picks up the new params on the next load.
    if (this.isConnected && this.iframe) {
      this.disconnectedCallback();
      this.connectedCallback();
    }
  }

  /**
   * Resolve the widget host, in order of precedence:
   *   1. `widget-host` attribute on the element
   *   2. `window.__AGEKEY_WIDGET_HOST__` global override
   *   3. {@link DEFAULT_WIDGET_HOST}
   */
  private resolveHost(): string {
    const attrHost = this.getAttribute('widget-host');
    if (attrHost) return attrHost;
    if (typeof window !== 'undefined' && window.__AGEKEY_WIDGET_HOST__) {
      return window.__AGEKEY_WIDGET_HOST__;
    }
    return DEFAULT_WIDGET_HOST;
  }

  /** Build the iframe and inject it into the element. */
  private render(): void {
    // Style the host so the iframe fills it.
    if (!this.style.display) this.style.display = 'block';

    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'AgeKey age verification');
    iframe.setAttribute(
      'allow',
      'publickey-credentials-get *; digital-credentials-get *',
    );
    // Sandboxed but with scripts + same-origin allowed for the widget host
    // page to drive its own UI. `allow-popups` for any external IdP redirects.
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups',
    );
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.minHeight = '480px';
    iframe.style.colorScheme = 'normal';

    iframe.src = this.resolvedHost;

    iframe.addEventListener('load', () => {
      this.postSessionParams(iframe);
    });

    // Replace any previously rendered children.
    while (this.firstChild) this.removeChild(this.firstChild);
    this.appendChild(iframe);
    this.iframe = iframe;
  }

  /** Send the init payload to the iframe via postMessage. */
  private postSessionParams(iframe: HTMLIFrameElement): void {
    if (!iframe.contentWindow) return;
    const targetOrigin = this.allowedOrigins[0] ?? '*';
    const params: WidgetSessionParams = {
      type: 'agekey:init',
      applicationId: this.getAttribute('application-id'),
      policySlug: this.getAttribute('policy-slug'),
      policyId: this.getAttribute('policy-id'),
      sessionId: this.getAttribute('session-id'),
      methodPreference: this.getAttribute('method-preference'),
      locale: this.getAttribute('locale') ?? 'pt-BR',
      apiBase: this.getAttribute('api-base'),
      parentOrigin: window.location.origin,
    };
    iframe.contentWindow.postMessage(params, targetOrigin);
  }

  /** Subscribe to postMessage events from the iframe. */
  private attachMessageListener(): void {
    const handler = (event: MessageEvent): void => {
      // Origin allowlist check: refuse anything not from the widget host.
      if (!this.allowedOrigins.includes(event.origin)) return;
      if (!this.iframe || event.source !== this.iframe.contentWindow) return;

      const data = event.data as unknown;
      if (!isInboundMessage(data)) return;

      const detail: AgeKeyVerifyEventDetail = data.detail ?? {};
      const eventName: AgeKeyVerifyEventType = `agekey:${data.event}`;
      this.dispatchEvent(
        new CustomEvent<AgeKeyVerifyEventDetail>(eventName, {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    };
    this.messageHandler = handler;
    window.addEventListener('message', handler);
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isInboundMessage(data: unknown): data is WidgetInboundMessage {
  if (typeof data !== 'object' || data === null) return false;
  const maybe = data as { type?: unknown; event?: unknown };
  if (maybe.type !== 'agekey:event') return false;
  if (typeof maybe.event !== 'string') return false;
  const valid = ['approved', 'denied', 'needs_review', 'error', 'cancelled'];
  return valid.includes(maybe.event);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the `<agekey-verify>` custom element. Idempotent — safe to call
 * multiple times. Auto-invoked when this module loads in a browser context.
 */
export function register(): void {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') {
    return;
  }
  if (!customElements.get('agekey-verify')) {
    customElements.define('agekey-verify', AgeKeyVerifyElement);
  }
}

// Auto-register on import in browser environments.
register();
