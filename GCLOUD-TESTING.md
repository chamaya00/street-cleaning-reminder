# Testing Twilio from Google Cloud Shell 📱

Easy one-paste solutions for testing your Twilio setup from Google Cloud Shell, optimized for mobile access.

## Quick Start (One Command)

### Option 1: Interactive Setup
Paste this to set up credentials and run tests:
```bash
cd ~/street-cleaning-reminder 2>/dev/null || git clone https://github.com/chamaya00/street-cleaning-reminder.git ~/street-cleaning-reminder && cd ~/street-cleaning-reminder && git checkout claude/test-twilio-gcloud-HJ5R7 && git pull && ./setup-env-gcloud.sh && ./test-twilio-gcloud.sh
```

### Option 2: Manual Setup (if you have .env.local ready)
If you already created `.env.local`:
```bash
cd ~/street-cleaning-reminder && git pull && ./test-twilio-gcloud.sh
```

## What Gets Tested

✅ Twilio account connection
✅ Account status and type
✅ Phone number configuration
✅ SMS capabilities
✅ Phone number validation

**Note:** No actual SMS messages are sent (to avoid costs).

## Step-by-Step Instructions

### Step 1: Clone the Repository
```bash
git clone https://github.com/chamaya00/street-cleaning-reminder.git
cd street-cleaning-reminder
git checkout claude/test-twilio-gcloud-HJ5R7
```

### Step 2: Set Up Credentials
```bash
./setup-env-gcloud.sh
```
Enter your Twilio credentials when prompted:
- Account SID (starts with `AC`)
- Auth Token (32 character hex string)
- Phone Number (format: `+1XXXXXXXXXX`)

### Step 3: Run Tests
```bash
./test-twilio-gcloud.sh
```

## Finding Your Twilio Credentials

1. **Account SID & Auth Token**
   Go to: https://console.twilio.com/
   Look in the "Account Info" section

2. **Phone Number**
   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active
   Copy your active SMS-capable number

## Expected Output

```
🧪 Testing Twilio Configuration
================================

Test 1: Connecting to Twilio account...
✅ PASS - Connected to: Your Account Name
   Status: active

Test 2: Verifying phone number...
✅ PASS - Phone number found
   SMS Capable: Yes

Test 3: Looking up phone number details...
✅ PASS - Phone number is valid

================================
✅ ALL TESTS PASSED!
```

## Troubleshooting

**"Authentication failed"**
- Double-check Account SID and Auth Token
- Ensure no extra spaces when copying

**"Phone number not found"**
- Verify format is +1XXXXXXXXXX
- Check number is active in Twilio Console

**"Module not found"**
- Run: `npm install`
- Then try the test script again

## Optional: Send Real Test SMS

To send an actual SMS (costs ~$0.0075):

1. Add to `.env.local`:
   ```
   TEST_PHONE_NUMBER=+1YOURNUMBER
   ```

2. Run integration tests:
   ```bash
   npm run test:integration
   ```

## Security Note

`.env.local` is gitignored and will not be committed. Your credentials stay local to Google Cloud Shell.
