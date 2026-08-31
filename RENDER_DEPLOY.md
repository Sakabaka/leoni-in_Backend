# Render Deployment Guide

## Prerequisites
- GitHub account (Render integrates with GitHub)
- Backend code pushed to a GitHub repo
- MySQL database URL from your provider (PlanetScale, Render DB, etc.)

## Step-by-step Deployment

### 1. Push backend to GitHub
```bash
git init
git add .
git commit -m "Initial backend setup"
git remote add origin https://github.com/yourusername/leoni-in-backend.git
git branch -M main
git push -u origin main
```

### 2. Create Render Account
- Go to https://render.com
- Sign up with GitHub (easiest)

### 3. Create Web Service on Render
- Dashboard → New +
- Select "Web Service"
- Connect your GitHub repo (leoni-in-backend)
- Name: `leoni-in-backend` (or any name)
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `node src/server.js`
- Instance Type: Free (for testing)

### 4. Add Environment Variables
In the Render dashboard for your service:
- Go to "Environment" tab
- Add these variables:

```
PORT=3000
DB_HOST=<your_mysql_host>
DB_PORT=3306
DB_USER=<your_mysql_user>
DB_PASSWORD=<your_mysql_password>
DB_NAME=leoni_in
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
NODE_ENV=production
TWO_FACTOR_ENABLED=false
TWO_FACTOR_EMAIL_PROVIDER=gmail
TWO_FACTOR_SMS_PROVIDER=twilio
GMAIL_USER=<company_gmail_address>
GMAIL_APP_PASSWORD=<gmail_app_password>
TWILIO_ACCOUNT_SID=<twilio_account_sid>
TWILIO_AUTH_TOKEN=<twilio_auth_token>
TWILIO_FROM_NUMBER=<twilio_phone_number>
```

For background push notifications, create or link an Expo EAS project and add
its project ID to the frontend app configuration:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "<expo-project-id>"
      }
    }
  }
}
```

Build a native Android/iOS app after adding this value. Push notifications do
not work in Expo web or on a device without a native development/production build.

**For PlanetScale:** Your connection string looks like:
```
mysql://user:password@host/dbname
```
Parse it and use individual fields above.

**For Render Database:** Render provides the connection string directly.

### 5. Deploy
- Click "Create Web Service"
- Render auto-deploys on git push to main
- Monitor logs in the Render dashboard

### 6. Database Setup
After deployment:
1. Connect to your database with your MySQL client
2. Run the SQL commands from `schema.sql`
3. Or use the init script if you add a deploy hook

### 7. Test the API
Once deployed, your backend will be at:
```
https://leoni-in-backend.onrender.com
```

Test the health endpoint:
```bash
curl https://leoni-in-backend.onrender.com/health
```

Should return:
```json
{
  "ok": true,
  "service": "leoni-in-backend",
  "db": "connected"
}
```

## Setting up Automatic Database Initialization

To run `schema.sql` automatically on deployment, add a `Procfile` to your repo:

```
web: npm run db:init && node src/server.js
```

And update `package.json` scripts:
```json
"db:init": "mysql --host=$DB_HOST --port=$DB_PORT --user=$DB_USER --password=$DB_PASSWORD $DB_NAME < schema.sql"
```

Or use Node script instead (recommended):
```bash
npm run db:setup
```

## Frontend Configuration

Once your backend is live, update the frontend to point to it.

In `src/api/index.ts`:
```typescript
import { RestApiClient } from './RestApiClient';

export const apiClient = __DEV__
  ? new MockApiClient()
  : new RestApiClient('https://leoni-in-backend.onrender.com');
```

## Troubleshooting

**App won't start:**
- Check logs in Render dashboard
- Verify environment variables are set
- Ensure database connection string is correct

**Database connection fails:**
- Verify DB_HOST, DB_USER, DB_PASSWORD
- Check if database exists
- Run schema.sql manually if needed

**Slow deployment:**
- Free tier Render instances spin down after 15 min inactivity
- Upgrade to paid for always-on service
- Or use a load balancer to keep it warm

## Cost Estimate

- **Render Web Service (Free):** $0 (spins down after inactivity)
- **Render Database (Free):** $0 (limited, not ideal for production)
- **PlanetScale MySQL (Free):** $0 (5GB, very generous)
- **Render Web Service (Starter):** $7/month (always running)

For production, budget ~$10-15/month for always-on service + database.
