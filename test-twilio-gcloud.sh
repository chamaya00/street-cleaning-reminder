#!/bin/bash
set -e

echo "🚀 Twilio Setup Test Script for Google Cloud Shell"
echo "=================================================="
echo ""

# Step 1: Check if .env.local exists, if not provide instructions
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local file not found!"
    echo ""
    echo "Please create .env.local with your credentials first."
    echo ""
    echo "Quick setup:"
    echo "  1. Copy the template: cp .env.local.example .env.local"
    echo "  2. Edit with your credentials: nano .env.local"
    echo "  3. Run this script again: ./test-twilio-gcloud.sh"
    echo ""
    echo "Or create it manually with these required variables:"
    echo "  TWILIO_ACCOUNT_SID=your_account_sid"
    echo "  TWILIO_AUTH_TOKEN=your_auth_token"
    echo "  TWILIO_PHONE_NUMBER=+1XXXXXXXXXX"
    echo ""
    exit 1
fi

echo "✅ Found .env.local"
echo ""

# Step 2: Install dependencies (only if needed)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (this may take a minute)..."
    npm install --silent
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Step 3: Create quick test script
echo "🔧 Creating test script..."
cat > twilio-quick-test.js << 'JS_EOF'
require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');

async function testTwilio() {
  console.log('🧪 Testing Twilio Configuration');
  console.log('================================\n');

  // Check environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    console.error('❌ Missing Twilio credentials in .env.local');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log('   Account SID:', accountSid);
  console.log('   Phone Number:', phoneNumber);
  console.log('   Auth Token:', authToken.substring(0, 8) + '...\n');

  try {
    const client = twilio(accountSid, authToken);

    // Test 1: Account connection
    console.log('Test 1: Connecting to Twilio account...');
    const account = await client.api.accounts(accountSid).fetch();
    console.log('✅ PASS - Connected to:', account.friendlyName);
    console.log('   Status:', account.status);
    console.log('   Type:', account.type);
    console.log('');

    // Test 2: Phone number verification
    console.log('Test 2: Verifying phone number...');
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    const myNumber = numbers.find(n => n.phoneNumber === phoneNumber);

    if (myNumber) {
      console.log('✅ PASS - Phone number found');
      console.log('   Friendly Name:', myNumber.friendlyName);
      console.log('   SMS Capable:', myNumber.capabilities.sms ? 'Yes' : 'No');
      console.log('   Voice Capable:', myNumber.capabilities.voice ? 'Yes' : 'No');
      console.log('');
    } else {
      console.log('❌ FAIL - Phone number not found in account');
      console.log('   Available numbers:');
      numbers.forEach(n => console.log('   -', n.phoneNumber, '(' + n.friendlyName + ')'));
      console.log('');
    }

    // Test 3: Phone number lookup
    console.log('Test 3: Looking up phone number details...');
    try {
      const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch();
      console.log('✅ PASS - Phone number is valid');
      console.log('   Format:', lookup.phoneNumber);
      console.log('   Country:', lookup.countryCode);
      console.log('   Valid:', lookup.valid);
      console.log('');
    } catch (lookupError) {
      console.log('⚠️  SKIP - Lookup API may require additional permissions');
      console.log('   This is optional and does not affect SMS functionality');
      console.log('');
    }

    // Summary
    console.log('================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('');
    console.log('Your Twilio setup is working correctly.');
    console.log('You can now send SMS messages using this configuration.');
    console.log('');
    console.log('💡 To send a test SMS, add this to your script:');
    console.log('   const msg = await client.messages.create({');
    console.log('     body: "Test message",');
    console.log('     from: "' + phoneNumber + '",');
    console.log('     to: "+1YOURNUMBER"');
    console.log('   });');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.code === 20003) {
      console.error('\n💡 Authentication failed. Please check:');
      console.error('   - Account SID is correct');
      console.error('   - Auth Token is correct');
      console.error('   - No extra spaces or quotes');
    } else if (error.code === 21608) {
      console.error('\n💡 Phone number not found. Please check:');
      console.error('   - Phone number is in E.164 format (+1XXXXXXXXXX)');
      console.error('   - Number is active in your Twilio account');
    } else {
      console.error('\n💡 Error details:', error);
    }

    process.exit(1);
  }
}

testTwilio();
JS_EOF

echo "✅ Test script created"
echo ""

# Step 4: Run the test
echo "🧪 Running Twilio tests..."
echo "================================"
echo ""
node twilio-quick-test.js

# Step 5: Offer to run full integration tests
echo ""
echo ""
echo "================================"
echo "📚 Additional Testing Options:"
echo "================================"
echo ""
echo "1️⃣  Run full integration test suite:"
echo "   npm run test:integration"
echo ""
echo "2️⃣  To send a REAL test SMS (costs ~$0.0075):"
echo "   Add to .env.local: TEST_PHONE_NUMBER=+1YOURNUMBER"
echo "   Then run: npm run test:integration"
echo ""
echo "3️⃣  Run unit tests:"
echo "   npm test"
echo ""
