import { Timestamp } from 'firebase/firestore';
import type { Polygon, LineString, MultiLineString } from 'geojson';

// Firestore document types

export interface User {
  phone: string;              // E.164 format: "+14155551234"
  phoneVerified: boolean;
  alertToken: string;         // For /notifications?t=xxx URL access
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CleaningSchedule {
  dayOfWeek: number;          // 0=Sun, 1=Mon, ... 6=Sat
  startTime: string;          // "08:00"
  endTime: string;            // "10:00"
  frequency: 'weekly' | '1st' | '2nd' | '3rd' | '4th' | '1st_3rd' | '2nd_4th';
}

export interface Block {
  streetName: string;         // "Chestnut St"
  blockNumber: number;        // 2800
  cnn: string;                // SF street segment ID
  geometry: Polygon | LineString | MultiLineString;  // For map display (LineString for street centerlines)
  northSchedule: CleaningSchedule | null;
  southSchedule: CleaningSchedule | null;
}

export interface Subscription {
  userId: string;
  blockId: string;
  createdAt: Timestamp;
  active: boolean;
}

export interface NotificationSetBlock {
  blockId: string;
  blockNumber: number;
  side: 'N' | 'S';
}

export interface NotificationSet {
  userId: string;
  setKey: string;             // Deterministic hash for deduping
  streetName: string;
  schedule: CleaningSchedule;
  blocks: NotificationSetBlock[];
  blocksSummary: string;      // "2800-3000 (N side)" or "2800, 2900, 3100 (N side)"
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NotificationStage = 'night_before' | '1hr' | '30min' | '10min';

export interface SentNotification {
  userId: string;
  notificationSetId: string;
  notificationSetKey: string;
  streetName: string;
  blocksSummary: string;
  cleaningDate: Timestamp;    // Date of cleaning
  cleaningStart: Timestamp;   // Actual start time
  cleaningEnd: Timestamp;
  stage: NotificationStage;
  sentAt: Timestamp;
  acknowledged: boolean;
  acknowledgedAt: Timestamp | null;
}

// API request/response types

export interface SendCodeRequest {
  phone: string;
}

export interface SendCodeResponse {
  success: boolean;
  message?: string;
}

export interface VerifyCodeRequest {
  phone: string;
  code: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  alertToken?: string;
  message?: string;
}

export interface BlockWithId extends Block {
  id: string;
}

export interface GetBlocksResponse {
  blocks: BlockWithId[];
}

export interface UpdateSubscriptionsRequest {
  blockIds: string[];
}

export interface UpdateSubscriptionsResponse {
  success: boolean;
  subscriptions: string[];
  notificationSets: NotificationSet[];
}

export interface NotificationSetWithStatus extends NotificationSet {
  id: string;
  isActive: boolean;
  nextReminderAt: Date | null;
  nextReminderStage: NotificationStage | null;
}

export interface GetNotificationsResponse {
  notificationSets: NotificationSetWithStatus[];
  activeAlerts: SentNotification[];
}

export interface DismissRequest {
  notificationSetId: string;
  cleaningDate: string;  // ISO date string
}

export interface DismissResponse {
  success: boolean;
}

// Verification code storage (temporary)
export interface VerificationCode {
  phone: string;
  code: string;
  expiresAt: Timestamp;
  attempts: number;
}
