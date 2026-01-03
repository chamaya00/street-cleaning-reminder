# SF Street Cleaning Reminder

A web app that helps users avoid street cleaning parking tickets in San Francisco's Marina district by sending SMS reminders before street cleaning windows.

## Features

- Map-based UI to select street blocks for notifications
- SMS reminders: night before (8pm), 1hr before, 30min before, 10min before
- Reply "1" to dismiss reminders, or use web UI
- Notification management UI with Active/Upcoming/All tabs

## Tech Stack

- **Frontend:** React + Next.js (TypeScript)
- **Hosting:** Vercel
- **Database:** Firebase Firestore
- **SMS:** Twilio
- **Maps:** Mapbox GL JS
- **Street Data:** SF DataSF API

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project with Firestore enabled
- Twilio account with a phone number
- Mapbox account with access token

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd sf-street-cleaning
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` from the template:

```bash
cp .env.local.example .env.local
```

4. Configure environment variables in `.env.local`:

```
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Firebase Admin (server-side only)
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Importing Street Cleaning Data

1. Generate sample block data for development:

```bash
npm run seed-blocks
```

2. Or import real data from SF DataSF API:

```bash
npm run import-blocks
```

3. Upload blocks to Firestore:

```bash
npm run upload-blocks
```

### Running the App

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Testing

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests exactly as CI does (with coverage)
npm run test:ci
```

### Before Pushing Code

**IMPORTANT: Always verify your tests work in a CI-like environment before pushing:**

```bash
# Simulate CI environment (clean install + test)
npm run verify-ci
```

This command:
1. Removes `node_modules` (clean slate)
2. Runs `npm ci` (exact dependency install from lock file)
3. Runs tests with coverage (exactly as CI does)

**Why this matters:** Tests can pass locally but fail in CI due to:
- Missing dependencies in `package.json`
- Cached packages in your local `node_modules`
- Different Node.js or OS environments

### Checking for Flaky Tests

```bash
# Run tests 5 times to detect randomness/flakiness
npm run test:flakiness
```

If tests fail inconsistently, they may have:
- Non-deterministic behavior (random values, timing issues)
- Shared state between tests
- Date/time dependencies

### Test Coverage

After running `npm run test:coverage`, view the detailed report:

```bash
# Open coverage report in browser
open coverage/lcov-report/index.html
```

**Coverage targets:**
- Line coverage: > 80% for business logic
- Branch coverage: > 80% for critical paths
- All public functions should be tested

### Writing Good Tests

See `.claude/testing-guidelines.md` for comprehensive testing best practices and guidelines that AI assistants and developers should follow.

## Project Structure

```
sf-street-cleaning/
├── app/                  # Next.js App Router pages
│   ├── api/             # API routes
│   ├── map/             # Map selection page
│   ├── notifications/   # Notification management pages
│   ├── page.tsx         # Landing page
│   └── layout.tsx       # Root layout
├── components/          # React components
│   ├── ui/             # Generic UI components
│   ├── map/            # Map-specific components
│   └── notifications/  # Notification components
├── lib/                 # Shared utilities
│   ├── firebase.ts     # Firebase client init
│   ├── firebase-admin.ts # Firebase Admin init
│   ├── types.ts        # TypeScript types
│   └── utils.ts        # Utility functions
├── scripts/             # Data import scripts
│   ├── import-blocks.ts
│   ├── seed-sample-blocks.ts
│   └── upload-blocks.ts
└── firestore.rules      # Firestore security rules
```

## Development Phases

- [x] Phase 1: Project Setup & Data Foundation
- [ ] Phase 2: Authentication & User Management
- [ ] Phase 3: Map UI & Block Selection
- [ ] Phase 4: Notification Management UI
- [ ] Phase 5: Notification Set Detail Page
- [ ] Phase 6: SMS Notification System
- [ ] Phase 7: Polish & Production Readiness

## License

Private project - all rights reserved.
