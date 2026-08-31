# Leoni-in App Guide

## What The App Does

Leoni-in is an employee self-service mobile app with an Express/MySQL backend.
It supports:

- Employee and administrator accounts
- JWT-based login sessions
- Optional Gmail or SMS two-factor authentication
- Employee profiles and editable contact information
- News posts with headings, paragraphs, and images
- Company documents and employee document requests
- HR messages and reclamations
- Admin work queues for document requests and conversations
- Search, pending/open queues, completed queues, and refresh notifications
- Background push notifications on native Android and iOS builds

## User Roles

### Employee

Employees can:

- Sign in with their matricule and password
- Add or change their Gmail address and phone number
- Enable or disable their own 2FA preference
- Read news and company documents
- Create document requests
- Read their own requests and HR responses
- Contact HR or submit a reclamation
- Reply to their own conversations

Employees cannot see another employee's requests or conversations, answer as HR,
or change request/conversation statuses.

### Administrator / HR

Administrators can:

- Create news posts
- See all employee document requests
- Answer requests and set their status
- See all employee messages and reclamations
- Reply as HR and mark conversations as done
- Search by employee, matricule, subject, category, or message content

## Authentication And 2FA

The backend verifies the employee credentials and signs a JWT. The frontend
stores the session and sends the JWT as a Bearer token on protected requests.

2FA has two independent switches:

1. `TWO_FACTOR_ENABLED` controls whether the feature is available globally.
2. `employees.two_factor_enabled` stores whether an individual employee opted in.

Both must be enabled for an employee to receive a 2FA challenge. A Gmail address
or phone number alone does not activate 2FA.

Supported delivery channels are:

- Gmail SMTP using a Gmail App Password
- SMS using Twilio

If an employee opts in without a usable configured channel, login stops with a
configuration error instead of silently bypassing 2FA.

## Messages And Requests

Every request and conversation keeps its messages in MySQL. Each message has a
sender type and is displayed with the sender's name and matricule. Employee and
HR messages use separate alignment and styling in the detail screens.

Document requests use these statuses:

- `pending`
- `in_progress`
- `approved`
- `rejected`

Approved and rejected requests appear in the Done queue. Support conversations
use `open`, `in_progress`, and `resolved`; resolved conversations appear in Done.

## Notifications And Refreshing

The app refreshes lists when a screen becomes active and supports pull-to-refresh.
It also shows an in-app notification when a new request or reply is detected.

Native builds can register Expo push tokens. The backend sends push notifications
to employees and administrators when a request or conversation changes.

Push notifications require an Expo EAS project ID and a native Android/iOS build.
They are not available in Expo web or a basic browser preview.

## Main Project Areas

- `app/`: Expo Router screens
- `leoni-in_frontend/src/api/`: frontend API contract and clients
- `leoni-in_Backend/src/routes/`: authentication, profile, news, documents, support, and notifications
- `leoni-in_Backend/src/services/`: 2FA and push delivery
- `leoni-in_Backend/schema.sql`: MySQL schema and migrations