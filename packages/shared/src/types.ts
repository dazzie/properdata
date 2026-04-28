/**
 * Shared types used across @properdata packages.
 *
 * Database row types live in @properdata/db (auto-derived from the Drizzle schema).
 * This file is for cross-cutting types that don't belong to any single package.
 */

// -----------------------------------------------------------------------------
// Geometry helpers
// -----------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  southWest: LatLng;
  northEast: LatLng;
}

// -----------------------------------------------------------------------------
// Persona definitions (matches docs/02-personas.md)
// -----------------------------------------------------------------------------

export const PERSONAS = [
  'dublin_escapee',
  'spreadsheet_investor',
  'anxious_seller',
  'reluctant_landlord',
  'professional',
  'returning_emigrant',
  'renovation_opportunist',
  'land_owner',
  'local_authority',
  'mortgage_broker',
] as const;

export type Persona = (typeof PERSONAS)[number];

// -----------------------------------------------------------------------------
// Property attributes (input to most analysis agents)
// -----------------------------------------------------------------------------

export interface PropertyAttributes {
  address?: string;
  eircode?: string;
  county: string;
  town?: string;
  location?: LatLng;
  propertyType?: 'detached' | 'semi_detached' | 'terraced' | 'apartment' | 'duplex' | 'bungalow' | 'unknown';
  bedrooms?: number;
  floorAreaSqm?: number;
  yearBuilt?: number;
  berRating?: string;
  isVacant?: boolean;
  vacantSinceYear?: number;
  isDerelict?: boolean;
  purchasePrice?: number;
}

// -----------------------------------------------------------------------------
// Buyer context (input to grant calculator)
// -----------------------------------------------------------------------------

export interface BuyerContext {
  buyerType: 'first_time_buyer' | 'former_owner_occupier' | 'non_occupier';
  intendedUse: 'owner_occupier' | 'rental' | 'mixed';
  combinedIncome?: number;
  isReturningEmigrant?: boolean;
  hasExistingProperties?: number;
  isLandlordPlanningRetrofit?: boolean;
}

// -----------------------------------------------------------------------------
// Subscriber events (for downstream agent triggering)
// -----------------------------------------------------------------------------

export type SubscriberEventType =
  | 'subscribed'
  | 'upgraded'
  | 'downgraded'
  | 'cancelled'
  | 'town_added_to_watchlist'
  | 'town_removed_from_watchlist'
  | 'analysis_requested'
  | 'newsletter_opened'
  | 'newsletter_clicked';

export interface SubscriberEvent {
  type: SubscriberEventType;
  subscriberId: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}
