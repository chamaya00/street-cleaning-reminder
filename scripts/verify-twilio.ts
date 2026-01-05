/**
 * Simple script to verify Twilio credentials
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import twilio from 'twilio';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function verifyTwilio() {
  console.log('\n🔍 Verifying Twilio Configuration...\n');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  // Check if credentials are set
  if (!accountSid || !authToken || !phoneNumber) {
    console.error('❌ Missing Twilio credentials in .env.local');
    console.error('Required variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    process.exit(1);
  }

  console.log('✅ Twilio credentials found in .env.local');
  console.log(`   Account SID: ${accountSid}`);
  console.log(`   Phone Number: ${phoneNumber}`);

  // Validate format
  console.log('\n📋 Validating credential formats...');

  if (!accountSid.match(/^AC[a-f0-9]{32}$/i)) {
    console.error('❌ Account SID format is invalid');
    process.exit(1);
  }
  console.log('✅ Account SID format is valid');

  if (!authToken.match(/^[a-f0-9]{32}$/i)) {
    console.error('❌ Auth Token format is invalid');
    process.exit(1);
  }
  console.log('✅ Auth Token format is valid');

  if (!phoneNumber.match(/^\+1\d{10}$/)) {
    console.error('❌ Phone number format is invalid (should be E.164 format: +1XXXXXXXXXX)');
    process.exit(1);
  }
  console.log('✅ Phone number format is valid');

  // Test connection
  console.log('\n🔌 Testing connection to Twilio...');
  const client = twilio(accountSid, authToken);

  try {
    const account = await client.api.accounts(accountSid).fetch();
    console.log('✅ Successfully connected to Twilio API');
    console.log(`   Account Name: ${account.friendlyName}`);
    console.log(`   Account Status: ${account.status}`);
  } catch (error) {
    console.error('❌ Failed to connect to Twilio API');
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Verify phone number
  console.log('\n📞 Verifying phone number...');
  try {
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    const configuredNumber = incomingNumbers.find(
      (num) => num.phoneNumber === phoneNumber
    );

    if (!configuredNumber) {
      console.error('❌ Phone number not found in your Twilio account');
      console.error('   Available numbers:');
      incomingNumbers.forEach((num) => {
        console.error(`     - ${num.phoneNumber} (${num.friendlyName})`);
      });
      process.exit(1);
    }

    console.log('✅ Phone number is configured in your account');
    console.log(`   Friendly Name: ${configuredNumber.friendlyName}`);
    console.log(`   SMS Capable: ${configuredNumber.capabilities.sms ? 'Yes' : 'No'}`);

    if (!configuredNumber.capabilities.sms) {
      console.error('❌ WARNING: This phone number cannot send SMS messages!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to verify phone number');
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  console.log('\n✅ All Twilio checks passed!\n');
  console.log('Your Twilio account is properly configured and ready to send SMS messages.');
  console.log('\nNote: You\'re on a free trial account. Twilio trial accounts have these limitations:');
  console.log('  - Can only send SMS to verified phone numbers');
  console.log('  - Messages will include a trial notice');
  console.log('  - Limited free credits available\n');
}

verifyTwilio().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
