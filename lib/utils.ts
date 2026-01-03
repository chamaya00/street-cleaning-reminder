import { CleaningSchedule } from './types';

/**
 * Format a schedule for display
 */
export function formatSchedule(schedule: CleaningSchedule): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[schedule.dayOfWeek];

  const startTime = formatTime(schedule.startTime);
  const endTime = formatTime(schedule.endTime);

  let frequencyLabel = '';
  switch (schedule.frequency) {
    case 'weekly':
      frequencyLabel = 'weekly';
      break;
    case '1st':
      frequencyLabel = '1st of month';
      break;
    case '2nd':
      frequencyLabel = '2nd of month';
      break;
    case '3rd':
      frequencyLabel = '3rd of month';
      break;
    case '4th':
      frequencyLabel = '4th of month';
      break;
    case '1st_3rd':
      frequencyLabel = '1st & 3rd of month';
      break;
    case '2nd_4th':
      frequencyLabel = '2nd & 4th of month';
      break;
  }

  return `${dayName}s ${startTime}-${endTime}, ${frequencyLabel}`;
}

/**
 * Format time from 24h to 12h format
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return minutes === 0 ? `${displayHours}${period}` : `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

/**
 * Format block range for display
 * Examples:
 *   [2800, 2900, 3000] → "2800-3000"
 *   [2800, 3100] → "2800, 3100"
 *   [2800, 2900, 3100] → "2800-2900, 3100"
 */
export function formatBlockRange(blockNumbers: number[]): string {
  if (blockNumbers.length === 0) return '';
  if (blockNumbers.length === 1) return blockNumbers[0].toString();

  const sorted = [...blockNumbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    // Check if this block is contiguous (100 apart is typical block numbering)
    if (sorted[i] - rangeEnd === 100) {
      rangeEnd = sorted[i];
    } else {
      // End current range and start new one
      ranges.push(rangeStart === rangeEnd ? rangeStart.toString() : `${rangeStart}-${rangeEnd}`);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  // Don't forget the last range
  ranges.push(rangeStart === rangeEnd ? rangeStart.toString() : `${rangeStart}-${rangeEnd}`);

  return ranges.join(', ');
}

/**
 * Format blocks summary with side label
 */
export function formatBlocksSummary(blockNumbers: number[], side: 'N' | 'S' | 'both'): string {
  const range = formatBlockRange(blockNumbers);
  const sideLabel = side === 'both' ? 'both sides' : side === 'N' ? 'N side' : 'S side';
  return `${range} (${sideLabel})`;
}

/**
 * Generate a deterministic set key for notification set deduplication
 */
export function generateSetKey(
  userId: string,
  streetName: string,
  schedule: CleaningSchedule
): string {
  const scheduleKey = `${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}-${schedule.frequency}`;
  return `${userId}:${streetName}:${scheduleKey}`;
}

/**
 * Generate a random alphanumeric token
 */
export function generateToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate E.164 phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  return /^\+1\d{10}$/.test(phone);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and has 11 digits, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return as-is with + prefix if not already there
  return phone.startsWith('+') ? phone : `+${digits}`;
}
