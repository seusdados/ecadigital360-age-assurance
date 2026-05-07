import { describe, expect, it } from 'vitest';
import {
  deriveRelationship,
  involvesMinor,
  isAdultToMinor,
  isUnknownToMinor,
} from '../src/safety/relationship.ts';

describe('Safety relationship derivation', () => {
  it('adult + minor -> adult_to_minor', () => {
    expect(deriveRelationship('adult', 'minor')).toBe('adult_to_minor');
  });
  it('unknown + minor -> unknown_to_minor', () => {
    expect(deriveRelationship('unknown', 'minor')).toBe('unknown_to_minor');
  });
  it('minor + minor -> minor_to_minor', () => {
    expect(deriveRelationship('minor', 'minor')).toBe('minor_to_minor');
  });
  it('adult + adult -> adult_to_adult', () => {
    expect(deriveRelationship('adult', 'adult')).toBe('adult_to_adult');
  });
  it('null counterparty -> self_actor', () => {
    expect(deriveRelationship('adult', null)).toBe('self_actor');
    expect(deriveRelationship('unknown', undefined)).toBe('self_actor');
  });
  it('outras combinações -> other', () => {
    expect(deriveRelationship('eligible_under_policy', 'adult')).toBe('other');
  });
});

describe('Safety relationship — predicates', () => {
  it('involvesMinor é true quando há minor', () => {
    expect(involvesMinor('adult_to_minor')).toBe(true);
    expect(involvesMinor('unknown_to_minor')).toBe(true);
    expect(involvesMinor('minor_to_minor')).toBe(true);
    expect(involvesMinor('adult_to_adult')).toBe(false);
  });
  it('isAdultToMinor é true só para adult_to_minor', () => {
    expect(isAdultToMinor('adult_to_minor')).toBe(true);
    expect(isAdultToMinor('unknown_to_minor')).toBe(false);
  });
  it('isUnknownToMinor é true só para unknown_to_minor', () => {
    expect(isUnknownToMinor('unknown_to_minor')).toBe(true);
    expect(isUnknownToMinor('adult_to_minor')).toBe(false);
  });
});
