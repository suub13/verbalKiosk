/**
 * Client service definition registry.
 *
 * Usage:
 *   getServiceDefinition('resident-copy')  → ClientServiceDefinition | undefined
 *
 * To add a new service:
 *   1. Create client/src/services/definitions/newService.ts
 *   2. registerServiceDefinition(newServiceDefinition) — one line here
 *   3. No other files need changing.
 */

import type { ClientServiceDefinition } from './types';
import { residentCopyDefinition } from './residentCopy';

const registry = new Map<string, ClientServiceDefinition>();

export function registerServiceDefinition(def: ClientServiceDefinition): void {
  registry.set(def.id, def);
}

export function getServiceDefinition(serviceId: string | null | undefined): ClientServiceDefinition | undefined {
  return serviceId ? registry.get(serviceId) : undefined;
}

// ── Register all service definitions ──────────────────────────────────────
registerServiceDefinition(residentCopyDefinition);
// Future services:
// registerServiceDefinition(healthInsuranceDefinition);
// registerServiceDefinition(taxCertificateDefinition);
