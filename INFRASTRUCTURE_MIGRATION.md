# Infrastructure Migration Guide

This guide explains how to connect Leoni-in to a client's database, backend
hosting, email/SMS providers, and Expo project.

## 1. Backend Hosting

Deploy `leoni-in_Backend` as a Node.js web service.

Recommended commands:

```text
Build command: npm install
Start command: npm start
```

The service must expose the configured `PORT` and provide:

```text
GET /health
```

The health endpoint should report `db: "connected"` when the database is ready.

## 2. Database

Create or select the client's MySQL database. Run the complete
`leoni-in_Backend/schema.sql` file against it.

The schema creates the employee, news, document request, support message, and
push-token tables. It also adds the `email` and `two_factor_enabled` columns to
older employee tables when needed.

Do not put database credentials in source control. Add them only to the hosting
provider's secret environment-variable section.

Required database variables:

```env
DB_HOST=client-database-host
DB_PORT=3306
DB_USER=client-database-user
DB_PASSWORD=client-database-password
DB_NAME=client-database-name
DB_SSL=true
```

## 3. Backend Environment Variables

Start with 2FA disabled while testing the deployment:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=generate-a-long-random-secret
JWT_EXPIRES_IN=7d
TWO_FACTOR_ENABLED=false
TWO_FACTOR_TEST_MODE=false
```

After providers have been tested, enable the feature:

```env
TWO_FACTOR_ENABLED=true
TWO_FACTOR_EMAIL_PROVIDER=gmail
TWO_FACTOR_SMS_PROVIDER=twilio
```

## 4. Gmail 2FA

Use a company Gmail account, enable Google two-step verification, and create a
Google App Password. Do not use the normal Gmail account password.

Add these backend-only variables:

```env
GMAIL_USER=company-mailbox@gmail.com
GMAIL_APP_PASSWORD=google-app-password
```

Employees must have a valid email stored in `employees.email` before they can
enable 2FA through the app.

## 5. SMS 2FA

Create a Twilio account, obtain a phone number capable of sending SMS, and add:

```env
TWILIO_ACCOUNT_SID=twilio-account-sid
TWILIO_AUTH_TOKEN=twilio-auth-token
TWILIO_FROM_NUMBER=twilio-sender-number
```

Employee phone numbers must be stored in international format, for example
`+216...`. Never put Twilio credentials in the frontend.

## 6. Frontend Configuration

In `leoni-in_frontend/.env`, point the app to the deployed backend:

```env
EXPO_PUBLIC_API_URL=https://client-backend.example.com
```

The frontend does not contain database, Gmail, Twilio, or JWT secrets.

## 7. Push Notifications

Create or link an Expo EAS project and add its project ID to `app.json`:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "client-expo-project-id"
      }
    }
  }
}
```

Then create a native build. Push notifications do not work in Expo web or an
ordinary browser preview. The first app launch must allow notification access.

## 8. Build The APK

Install and authenticate with EAS:

```powershell
cd leoni-in_frontend
npm install
npx eas login
npx eas build:configure
npx eas build --platform android --profile preview
```

Use an APK profile in `eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

The client does not need to provide credentials to create a test APK. For final
ownership, create or transfer the Expo/EAS project to the client's account.

## 9. Verification Checklist

1. `GET /health` reports a connected database.
2. An employee can log in with 2FA disabled.
3. An employee can update email and phone information.
4. Enabling 2FA with Gmail sends an email code.
5. Enabling 2FA with SMS sends a Twilio code.
6. Wrong and expired codes are rejected.
7. Employees see only their own requests and conversations.
8. Admins see all requests and conversations.
9. Admin replies display the correct sender identity.
10. Approved/rejected requests move to Done.
11. Resolved conversations move to Done.
12. New requests and replies refresh and produce notifications.
13. A native APK receives a push notification after registering a device.

## 10. Security Before Handoff

- Rotate every secret that was pasted into chat, screenshots, `.env` files, or git history.
- Use a new strong `JWT_SECRET` for the client's deployment.
- Set `TWO_FACTOR_TEST_MODE=false` in production.
- Do not commit `.env` files.
- Use separate provider accounts and credentials for development and production.