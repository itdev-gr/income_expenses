# Company Ledger

A complete web application for tracking company income and expenses with a comprehensive dashboard, built with Astro (SSR) and Firebase.

## Features

- **Authentication**: Email/password login with role-based access (admin/staff)
- **Transaction Management**: Create, view, and delete income/expense transactions
- **Dashboard**: Real-time KPIs and charts showing:
  - Today, week, and month summaries
  - Daily trends chart (last 7/30/90 days)
  - Weekly and monthly summary tables
- **Categories**: Manage transaction categories (admin only)
- **Fast Reporting**: Pre-aggregated summary documents for efficient dashboard queries
- **Timezone Support**: All dates grouped by Europe/Athens timezone

## Tech Stack

- **Framework**: Astro with SSR (Server-Side Rendering)
- **Styling**: Tailwind CSS
- **Backend**: Firebase
  - Authentication (Firebase Auth)
  - Database (Cloud Firestore)
- **Charts**: Chart.js
- **Language**: TypeScript

## Prerequisites

- Node.js 18+ and npm
- A Firebase project with:
  - Authentication enabled (Email/Password provider)
  - Cloud Firestore database
  - A service account for Admin SDK

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable **Authentication** → **Sign-in method** → **Email/Password**
4. Enable **Firestore Database** (start in production mode)
5. Go to **Project Settings** → **Service Accounts**
6. Click **Generate New Private Key** to download the service account JSON

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase credentials:

   **From Service Account JSON:**
   - `FIREBASE_PROJECT_ID`: Your project ID
   - `FIREBASE_CLIENT_EMAIL`: The `client_email` field from the JSON
   - `FIREBASE_PRIVATE_KEY`: The `private_key` field from the JSON (keep the `\n` characters)

   **From Firebase Console → Project Settings → General:**
   - `PUBLIC_FIREBASE_API_KEY`: Your Web API Key
   - `PUBLIC_FIREBASE_AUTH_DOMAIN`: `your-project-id.firebaseapp.com`
   - `PUBLIC_FIREBASE_APP_ID`: Your App ID

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:4321`

### 5. Create Your First User

1. Go to Firebase Console → **Authentication** → **Users**
2. Click **Add User**
3. Enter an email and password
4. The user will be created with default role "staff" on first login

### 6. Seed Default Categories

1. Log in to the app
2. Go to **Categories** page (admin only)
3. Click **Seed Default Categories** to create default categories:
   - Sales, Services, Salary, Rent, Utilities, Fuel, Supplies, Other

## Promoting a User to Admin

To give a user admin privileges:

1. Go to Firebase Console → **Firestore Database**
2. Navigate to the `users` collection
3. Find the document with the user's UID (Firebase Auth UID)
4. Edit the document and set the `role` field to `"admin"`
5. Save the changes

The user will have admin access on their next login.

## Project Structure

```
src/
  pages/
    index.astro              # Redirects to dashboard or login
    login.astro              # Login page
    logout.ts                # Logout endpoint
    dashboard.astro          # Main dashboard
    transactions/
      index.astro            # Transaction list with filters
      new.astro              # Create new transaction
      [id]/delete.ts         # Delete transaction endpoint
    categories.astro         # Category management (admin only)
  components/
    Layout.astro             # Main layout wrapper
    Navbar.astro            # Navigation bar
    KPIGrid.astro           # KPI cards component
    LineChart.astro         # Chart component
    TransactionForm.astro   # Transaction entry form
    TransactionTable.astro  # Transaction list table
    Filters.astro            # Filter component
  lib/
    firebaseAdmin.ts        # Firebase Admin SDK setup
    firebaseClient.ts       # Firebase Client SDK setup
    auth.ts                 # Authentication helpers
    dates.ts                # Date/timezone utilities
    types.ts                # TypeScript type definitions
    firestore/
      transactions.ts       # Transaction CRUD operations
      categories.ts         # Category management
      summaries.ts          # Summary document management
```

## Firestore Data Model

### Collections

1. **transactions**: Individual transaction records
   - `ts`: Timestamp
   - `dateKey`: "YYYY-MM-DD" (Europe/Athens)
   - `weekKey`: "YYYY-WW" (ISO week)
   - `monthKey`: "YYYY-MM"
   - `type`: "income" | "expense"
   - `amountCents`: Amount in cents (integer)
   - `categoryId`: Reference to category
   - `note`: Optional note
   - `createdBy`: User UID
   - `createdAt`: Server timestamp

2. **categories**: Transaction categories
   - `name`: Category name
   - `active`: Boolean
   - `createdAt`: Timestamp

3. **stats_daily**: Daily summaries (doc ID = dateKey)
   - `incomeCents`, `expenseCents`, `netCents`
   - `countIncome`, `countExpense`
   - `updatedAt`: Timestamp

4. **stats_weekly**: Weekly summaries (doc ID = weekKey)
   - Same fields as daily

5. **stats_monthly**: Monthly summaries (doc ID = monthKey)
   - Same fields as daily

6. **users**: User roles (doc ID = Firebase Auth UID)
   - `role`: "admin" | "staff"
   - `createdAt`: Timestamp

## Firestore Security Rules (Recommended)

Add these rules in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own user doc
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only Admin SDK can write
    }
    
    // Authenticated users can read transactions
    match /transactions/{transactionId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Admin SDK can write
    }
    
    // Authenticated users can read categories
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Admin SDK can write
    }
    
    // Authenticated users can read summaries
    match /stats_daily/{dateKey} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    match /stats_weekly/{weekKey} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    match /stats_monthly/{monthKey} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

**Note**: Since we're using Admin SDK on the server, these rules are extra protection. All writes happen server-side via Admin SDK, which bypasses security rules.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

### Option 1: Firebase Hosting (Recommended)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. Initialize Firebase Hosting:
   ```bash
   firebase init hosting
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

**Note**: For SSR, you'll need to use Firebase Functions or another Node.js hosting solution. Firebase Hosting alone only serves static files. Consider using:
- Firebase Functions with Express
- Vercel
- Netlify
- Railway
- Or any Node.js hosting platform

### Option 2: Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

Vercel has built-in support for Astro SSR.

## Development Tips

- All dates are automatically converted to Europe/Athens timezone
- Summary documents are updated atomically when transactions are created/deleted
- The dashboard queries summary documents, not individual transactions, for fast performance
- Use the browser's developer tools to inspect Firestore queries

## Troubleshooting

### "Missing Firebase Admin environment variables"
- Make sure your `.env` file exists and has all required variables
- Check that `FIREBASE_PRIVATE_KEY` includes the `\n` characters

### "Failed to create session"
- Verify your Firebase Auth is enabled
- Check that the user exists in Firebase Authentication

### Dashboard shows no data
- Create some transactions first
- Check that summary documents are being created in Firestore

### Categories page shows "Forbidden"
- Make sure you've promoted your user to admin in Firestore

## License

MIT
