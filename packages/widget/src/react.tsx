/**
 * React wrapper around the `<agekey-verify>` Web Component.
 *
 * Re-exports a single `<AgeKeyVerify>` component whose props mirror the
 * element's attributes. Event callbacks (`onApproved`, `onDenied`, ...)
 * are wired to `addEventListener` on the underlying element via `useEffect`.
 *
 * The Web Component itself is registered when `@agekey/widget` is imported,
 * so this file imports `'./index.ts'` for its side effect.
 */

import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

// Importing the entry registers the Web Component.
import './index.ts';
import type {
  AgeKeyVerifyEventDetail,
  AgeKeyVerifyElement,
} from './index.ts';

// ---------------------------------------------------------------------------
// JSX intrinsic element typing
// ---------------------------------------------------------------------------

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agekey-verify': AgeKeyVerifyIntrinsicAttributes;
    }
  }
}

/** Attributes accepted by the raw `<agekey-verify>` JSX element. */
type AgeKeyVerifyIntrinsicAttributes = {
  ref?: React.Ref<AgeKeyVerifyElement>;
  'application-id'?: string;
  'policy-slug'?: string;
  'policy-id'?: string;
  'session-id'?: string;
  'method-preference'?: string;
  locale?: string;
  'widget-host'?: string;
  'api-base'?: string;
  className?: string;
  style?: React.CSSProperties;
};

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

/** Callback invoked when a terminal verification event fires. */
export type AgeKeyVerifyEventHandler = (
  detail: AgeKeyVerifyEventDetail,
) => void;

export type AgeKeyVerifyProps = {
  applicationId?: string;
  policySlug?: string;
  policyId?: string;
  sessionId?: string;
  methodPreference?: string;
  locale?: string;
  /** Override the widget host URL (defaults to `https://widget.agekey.com.br`). */
  widgetHost?: string;
  /** AgeKey API base URL forwarded to the iframe host (for fallback POSTs). */
  apiBase?: string;
  className?: string;
  style?: React.CSSProperties;

  onApproved?: AgeKeyVerifyEventHandler;
  onDenied?: AgeKeyVerifyEventHandler;
  onNeedsReview?: AgeKeyVerifyEventHandler;
  onError?: AgeKeyVerifyEventHandler;
  onCancelled?: AgeKeyVerifyEventHandler;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * React component that mounts the `<agekey-verify>` Web Component and
 * exposes its terminal events as React props.
 */
export function AgeKeyVerify(props: AgeKeyVerifyProps): ReactElement {
  const {
    applicationId,
    policySlug,
    policyId,
    sessionId,
    methodPreference,
    locale,
    widgetHost,
    apiBase,
    className,
    style,
    onApproved,
    onDenied,
    onNeedsReview,
    onError,
    onCancelled,
  } = props;

  const ref = useRef<AgeKeyVerifyElement | null>(null);

  // Subscribe to all known terminal events. We re-subscribe whenever any
  // handler reference changes so the latest closure is invoked.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const subscriptions: Array<[string, EventListener]> = [];

    const wire = (
      name: string,
      handler: AgeKeyVerifyEventHandler | undefined,
    ): void => {
      if (!handler) return;
      const listener: EventListener = (event) => {
        const detail =
          (event as CustomEvent<AgeKeyVerifyEventDetail>).detail ?? {};
        handler(detail);
      };
      el.addEventListener(name, listener);
      subscriptions.push([name, listener]);
    };

    wire('agekey:approved', onApproved);
    wire('agekey:denied', onDenied);
    wire('agekey:needs_review', onNeedsReview);
    wire('agekey:error', onError);
    wire('agekey:cancelled', onCancelled);

    return () => {
      for (const [name, listener] of subscriptions) {
        el.removeEventListener(name, listener);
      }
    };
  }, [onApproved, onDenied, onNeedsReview, onError, onCancelled]);

  // Build attribute set, omitting undefined values so React doesn't render
  // empty `attr=""` placeholders that the element would treat as set.
  const attrs: AgeKeyVerifyIntrinsicAttributes = { ref };
  if (applicationId !== undefined) attrs['application-id'] = applicationId;
  if (policySlug !== undefined) attrs['policy-slug'] = policySlug;
  if (policyId !== undefined) attrs['policy-id'] = policyId;
  if (sessionId !== undefined) attrs['session-id'] = sessionId;
  if (methodPreference !== undefined) {
    attrs['method-preference'] = methodPreference;
  }
  if (locale !== undefined) attrs.locale = locale;
  if (widgetHost !== undefined) attrs['widget-host'] = widgetHost;
  if (apiBase !== undefined) attrs['api-base'] = apiBase;
  if (className !== undefined) attrs.className = className;
  if (style !== undefined) attrs.style = style;

  return <agekey-verify {...attrs} />;
}

export type { AgeKeyVerifyEventDetail } from './index.ts';
