# Leoni-in Backend

This backend is being scaffolded to match the frontend mock API contract and the planned MySQL schema.

## Architecture
- Express API server
- MySQL database
- JWT auth
- modules for auth, users, news, documents, tickets, profile

## Documentation

- [APP_GUIDE.md](APP_GUIDE.md): how the app works, roles, authentication, requests, messaging, and notifications
- [INFRASTRUCTURE_MIGRATION.md](INFRASTRUCTURE_MIGRATION.md): how to connect the app to a client's infrastructure and build the APK

## Local setup

1. Install dependencies: `npm install`
2. Copy the environment values into a local `.env` file
3. Create a MySQL database and run schema initialization
4. Start the server: `npm run dev`

## Current mapping from frontend mock API
- Auth/login + 2FA password verification
- Employee and admin roles
- News feed
- Documents and document requests
- Support tickets and replies
- Profile retrieval and update

## Notes
This is intentionally aligned with the existing frontend mock API contract so the real backend can replace it later with minimal frontend changes.
