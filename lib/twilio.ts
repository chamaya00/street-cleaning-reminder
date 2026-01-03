import twilio from 'twilio';

// Types for Twilio responses
export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Get Twilio client (lazy initialization)
let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

function getTwilioPhoneNumber(): string {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!phoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER is not configured.');
  }
  return phoneNumber;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSMS(to: string, body: string): Promise<SendSMSResult> {
  try {
    const client = getTwilioClient();
    const from = getTwilioPhoneNumber();

    const message = await client.messages.create({
      body,
      from,
      to,
    });

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error sending SMS';
    console.error('Twilio SMS error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send a verification code via SMS
 */
export async function sendVerificationCode(phone: string, code: string): Promise<SendSMSResult> {
  const body = `Your SF Street Cleaning Reminder verification code is: ${code}. This code expires in 5 minutes.`;
  return sendSMS(phone, body);
}

/**
 * Send a street cleaning reminder notification
 */
export async function sendReminderNotification(
  phone: string,
  streetName: string,
  blocksSummary: string,
  cleaningTime: string,
  stage: 'night_before' | '1hr' | '30min' | '10min',
  alertsUrl: string
): Promise<SendSMSResult> {
  let body: string;

  switch (stage) {
    case 'night_before':
      body = `Reminder: ${streetName} ${blocksSummary} has street cleaning tomorrow ${cleaningTime}. Reply 1 to dismiss. ${alertsUrl}`;
      break;
    case '1hr':
      body = `${streetName} ${blocksSummary} cleaning in 1 hr (${cleaningTime}). Reply 1 to dismiss. ${alertsUrl}`;
      break;
    case '30min':
      body = `${streetName} ${blocksSummary} cleaning in 30 min. Reply 1 to dismiss. ${alertsUrl}`;
      break;
    case '10min':
      body = `FINAL: ${streetName} ${blocksSummary} cleaning in 10 min! Reply 1 to dismiss. ${alertsUrl}`;
      break;
  }

  return sendSMS(phone, body);
}

// For testing purposes - allows injecting a mock client
export function setTwilioClientForTesting(client: twilio.Twilio | null): void {
  twilioClient = client;
}
