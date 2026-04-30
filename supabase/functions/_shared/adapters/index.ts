// Adapter registry — lookup VerificationAdapter by method.

import type {
  VerificationAdapter,
  SessionContext,
  AdapterCompleteInput,
  AdapterResult,
} from '../../../../packages/adapter-contracts/src/index.ts';
import type { VerificationMethod } from '../../../../packages/shared/src/types.ts';
import { fallbackAdapter } from './fallback.ts';
import { zkpAdapter } from './zkp.ts';
import { vcAdapter } from './vc.ts';
import { gatewayAdapter } from './gateway.ts';

const REGISTRY: Record<VerificationMethod, VerificationAdapter> = {
  zkp: zkpAdapter,
  vc: vcAdapter,
  gateway: gatewayAdapter,
  fallback: fallbackAdapter,
};

export function getAdapter(method: VerificationMethod): VerificationAdapter {
  const a = REGISTRY[method];
  if (!a) throw new Error(`Adapter not registered for method: ${method}`);
  return a;
}

export type {
  VerificationAdapter,
  SessionContext,
  AdapterCompleteInput,
  AdapterResult,
};
export { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
