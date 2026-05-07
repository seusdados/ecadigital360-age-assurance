// AgeKey Safety Signals — primitive types and enums.
//
// MVP v1 is METADATA-ONLY. No raw text, no image bytes, no video, no audio,
// no IP plaintext, no PII. Every column either holds a hash, an enum, an
// HMAC-derived opaque ref, a numeric counter or a timestamp.
//
// Reference: docs/modules/safety-signals/DATA_MODEL.md
//            docs/modules/safety-signals/TAXONOMY.md

import { z } from 'zod';

/** Event types accepted at ingest. Closed catalogue — additions go through
 *  a coordinated migration so SQL CHECK + TS Zod + UI labels stay in sync. */
export const SAFETY_EVENT_TYPES = [
  'interaction_started',
  'interaction_ended',
  'message_send_attempt',
  'message_sent',
  'message_blocked',
  'media_upload_attempt',
  'media_upload_blocked',
  'external_link_attempt',
  'external_link_blocked',
  'friend_request_attempt',
  'friend_request_accepted',
  'friend_request_blocked',
  'group_invite_attempt',
  'group_invite_accepted',
  'group_invite_blocked',
  'report_submitted',
  'user_blocked',
  'user_muted',
  'step_up_required',
  'step_up_completed',
  'step_up_failed',
  'moderation_action_received',
] as const;
export const SafetyEventTypeSchema = z.enum(SAFETY_EVENT_TYPES);
export type SafetyEventType = z.infer<typeof SafetyEventTypeSchema>;

/** Risk categories — same closed-catalogue discipline. */
export const SAFETY_RISK_CATEGORIES = [
  'adult_minor_contact',
  'unknown_minor_contact',
  'high_frequency_contact',
  'off_platform_migration',
  'media_exchange_risk',
  'cyberbullying_signal',
  'harassment_signal',
  'threat_signal',
  'grooming_pattern_signal',
  'social_engineering_signal',
  'financial_exploitation_signal',
  'credential_theft_signal',
  'group_pressure_signal',
  'new_account_contact_risk',
  'device_or_ip_anomaly',
  'policy_bypass_attempt',
  'repeat_reported_actor',
  'unsafe_link_signal',
  'unknown',
] as const;
export const SafetyRiskCategorySchema = z.enum(SAFETY_RISK_CATEGORIES);
export type SafetyRiskCategory = z.infer<typeof SafetyRiskCategorySchema>;

/** Channel through which the interaction takes place. */
export const SAFETY_CHANNEL_TYPES = [
  'direct_message',
  'group_chat',
  'public_post',
  'comment_thread',
  'voice_call',
  'video_call',
  'live_stream',
  'media_upload',
  'external_link',
  'unknown',
] as const;
export const SafetyChannelTypeSchema = z.enum(SAFETY_CHANNEL_TYPES);
export type SafetyChannelType = z.infer<typeof SafetyChannelTypeSchema>;

/** Relationship of the actor to the counterparty. Derived in the ingest
 *  edge function; never accepted from the client. */
export const SAFETY_RELATIONSHIP_TYPES = [
  'unknown_to_unknown',
  'minor_to_minor',
  'adult_to_adult',
  'adult_to_minor',
  'minor_to_adult',
  'unknown_to_minor',
  'minor_to_unknown',
] as const;
export const SafetyRelationshipTypeSchema = z.enum(SAFETY_RELATIONSHIP_TYPES);
export type SafetyRelationshipType = z.infer<
  typeof SafetyRelationshipTypeSchema
>;

/**
 * Coarse age state of the actor / counterparty as known by the relying
 * party. **NEVER** the exact age — only a state derived from a verified
 * AgeKey decision or a tenant-side declaration. Maps roughly to the
 * canonical `age_band` taxonomy.
 */
export const SAFETY_AGE_STATES = [
  'unknown',
  'minor',
  'minor_under_13',
  'minor_13_to_17',
  'adult',
  'adult_18_plus',
] as const;
export const SafetyAgeStateSchema = z.enum(SAFETY_AGE_STATES);
export type SafetyAgeState = z.infer<typeof SafetyAgeStateSchema>;

export const SAFETY_ALERT_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
  'closed',
  'dismissed',
] as const;
export const SafetyAlertStatusSchema = z.enum(SAFETY_ALERT_STATUSES);
export type SafetyAlertStatus = z.infer<typeof SafetyAlertStatusSchema>;

export const SAFETY_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export const SafetySeveritySchema = z.enum(SAFETY_SEVERITY);
export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;

export const SAFETY_DECISIONS = [
  'approved',
  'needs_review',
  'step_up_required',
  'rate_limited',
  'soft_blocked',
  'hard_blocked',
  'blocked_by_policy',
  'parental_consent_required',
  'error',
] as const;
export const SafetyDecisionSchema = z.enum(SAFETY_DECISIONS);
export type SafetyDecision = z.infer<typeof SafetyDecisionSchema>;

export const SAFETY_RULE_OPERATORS = [
  'all',
  'any',
  'eq',
  'neq',
  'in',
  'gte',
  'lte',
  'gt',
  'lt',
  'exists',
] as const;
export const SafetyRuleOperatorSchema = z.enum(SAFETY_RULE_OPERATORS);
export type SafetyRuleOperator = z.infer<typeof SafetyRuleOperatorSchema>;

export const SAFETY_DECISION_DOMAIN = 'safety_signal' as const;
export type SafetyDecisionDomain = typeof SAFETY_DECISION_DOMAIN;
