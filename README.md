# Leoni-in Backend

This backend is being scaffolded to match the frontend mock API contract and the planned MySQL schema.

## Architecture
- Express API server
- MySQL database
- JWT auth
- modules for auth, users, news, documents, tickets, profile

## Planned setup
1. Install dependencies: npm install
2. Copy .env.example to .env and update values
3. Create MySQL database and run schema initialization
4. Start server: npm run dev

## Current mapping from frontend mock API
- Auth/login + 2FA password verification
- Employee and admin roles
- News feed
- Documents and document requests
- Support tickets and replies
- Profile retrieval and update

## Notes
This is intentionally aligned with the existing frontend mock API contract so the real backend can replace it later with minimal frontend changes.
