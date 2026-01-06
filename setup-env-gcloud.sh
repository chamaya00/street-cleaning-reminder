#!/bin/bash

echo "🔧 Quick Environment Setup for Google Cloud Shell"
echo "=================================================="
echo ""
echo "This script will help you create .env.local with your credentials."
echo ""

# Prompt for credentials
read -p "Enter your TWILIO_ACCOUNT_SID (starts with AC): " ACCOUNT_SID
read -p "Enter your TWILIO_AUTH_TOKEN: " AUTH_TOKEN
read -p "Enter your TWILIO_PHONE_NUMBER (format: +1XXXXXXXXXX): " PHONE_NUMBER

echo ""
echo "📝 Creating .env.local..."

# Create .env.local
cat > .env.local << ENV_EOF
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Firebase Admin (server-side only)
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# Twilio
TWILIO_ACCOUNT_SID=${ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${AUTH_TOKEN}
TWILIO_PHONE_NUMBER=${PHONE_NUMBER}

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# App URL (for SMS links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Phone number for integration tests (sends real SMS - costs money)
# TEST_PHONE_NUMBER=+1xxxxxxxxxx
ENV_EOF

echo "✅ .env.local created successfully!"
echo ""
echo "You can now run the test script:"
echo "  ./test-twilio-gcloud.sh"
echo ""
