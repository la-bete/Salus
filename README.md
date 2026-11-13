# Salus

Salus is a full-stack authentication app: sign up and sign in with email and password, or with Google, Facebook or Twitter, then manage the account from a small dashboard. Beyond the login screen it covers the parts that usually get skipped: server-side sessions, an opt-in "remember me" cookie, single-use emailed password-reset links, password change, and one set of validation rules shared by the browser and the API.

Live demo: [salus.labete.dev](https://salus.labete.dev)

## Tech stack

- Node.js
- Express
- Passport
- MongoDB
- Mongoose
- Nodemailer
- React
- SCSS
- Webpack

## Features

- Email sign-up and sign-in, with passwords hashed using bcrypt.
- OAuth sign-in with Google and Facebook (and Twitter, see [Limitations](#limitations)).
- "Remember me" on email sign-in, backed by a persistent token cookie.
- Forgot password: a reset link is emailed, valid for a limited time and usable once.
- Change password for signed-in email users, checked against the old password.
- Server-rendered shell with a single-page React UI (login, sign-up, forgot password, change password and dashboard views).

## How it works

**Layout.** `server/` is an Express app that serves the API and an EJS shell page. `ui/` is a React app bundled by webpack into `ui/public/`, which Express serves as static files. `shared/validators.mjs` is imported by both.

**Sign-in.** Passport handles every method. Email sign-in uses `passport-local`; Google, Facebook and Twitter use their Passport strategies under `/auth/:provider` and `/auth/:provider/redirect`. An OAuth user is looked up by provider and provider id, and created on first sign-in. An email address can only be registered with one method, so signing in with a password for an account created through Google is refused with a message saying so.

**Sessions and cookies.** `express-session` keeps the Passport session in its default in-memory store, behind a cookie that expires after 30 minutes and is renewed on every request. When "remember me" is ticked, the server also generates a random token, stores its SHA-256 hash on the user and sets the raw token as an HTTP-only cookie (7 days by default). `passport-remember-me` uses that cookie to restore the session after it has expired, issuing a fresh token each time. Logging out clears both cookies.

**Password reset.** `POST /reset-password` generates a random token, stores its SHA-256 hash and an expiry (6 hours by default) on the user, and emails a link containing the raw token, built with Mailgen and sent through Nodemailer over SMTP. Opening the link checks the token, immediately marks it expired so it cannot be reused, and records the email in the session; the new password is then posted to `/reset-change-password`, which clears both the stored token and the session entry so the reset cannot be repeated. Because only hashes are stored, a database leak does not expose usable remember-me or reset tokens.

**Shared validation.** `shared/validators.mjs` defines the rules for name, email, password and confirm-password. The React forms use it for inline errors as the user types, and an Express middleware (`server/middlewares/validator.js`) runs the same functions on the request body, so the client and server cannot drift apart. The server middleware also replaces `req.body` with the validated, trimmed values.

**Page data.** The EJS shell passes the signed-in user and any error message to the React app through an inline script. Values are serialised with `JSON.stringify` and `<`, `>`, `&`, U+2028 and U+2029 are escaped, so user-controlled text such as an OAuth display name cannot break out of the script.

**Errors.** Expected failures are raised as `KnownError` with an HTTP status. The error handler returns JSON to API calls and re-renders the page with the message for browser navigations (for example an expired reset link); unexpected errors are logged and reported as a generic server error.

## Running locally

Requirements: Node.js 14 (see [Limitations](#limitations)), a MongoDB instance, SMTP credentials for the reset email, and OAuth app credentials for whichever providers you want to test.

```bash
# install dependencies and build the UI (production bundle)
npm run build

# configure the server
cp server/.env.example server/.env   # then fill in the values

# start the server
npm start
```

For development, `npm run start:dev` builds the UI in development mode (with source maps) and starts the server under nodemon. The UI is built once, not watched; re-run `npm run build:dev` inside `ui/` after changing front-end code.

| Script | Where | What it does |
| --- | --- | --- |
| `npm run build` | root | Installs and builds the UI for production, then installs server dependencies |
| `npm start` | root | Starts the server (`node app.js` in `server/`) |
| `npm run start:dev` | root | Development UI build, then the server under nodemon |
| `npm run build:dev` / `build:prod` | `ui/` | Webpack build in development or production mode |
| `npm run dev` | `server/` | Server under nodemon |

The server loads `.env` from its working directory, which is `server/` when started through the scripts above.

### Environment variables

All of these are read by the server. `server/.env.example` lists them with placeholder values.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | yes | | Port the server listens on |
| `MONGODB_URI` | yes | | MongoDB connection string |
| `SESSION_SECRET` | yes | | Secret used to sign the session cookie |
| `COOKIE_NAME` | yes | | Name of the session cookie |
| `SITE_URL` | yes | | Public base URL, used for OAuth callbacks and links in the reset email. The server refuses to start without it |
| `APP_NAME` | yes | | Shown as the page title and in the email footer |
| `TRUST_PROXY_SETTING` | no | `0` | Number of proxy hops Express should trust (set to `1` behind a single reverse proxy) |
| `REMEMBER_ME_COOKIE_NAME` | yes | | Name of the remember-me cookie |
| `REMEMBER_ME_COOKIE_LENGTH` | no | `20` | Length of the remember-me token |
| `REMEMBER_ME_COOKIE_EXPIRY` | no | `7` | Remember-me cookie lifetime, in days |
| `RESET_TOKEN_LENGTH` | no | `40` | Length of the password-reset token |
| `RESET_TOKEN_EXPIRY` | no | `6` | Reset link lifetime, in hours |
| `MAILER_HOST` | yes | | SMTP host (the connection uses port 465) |
| `MAILER_USERNAME` | yes | | SMTP username |
| `MAILER_PASSWORD` | yes | | SMTP password |
| `MAILER_ADDRESS` | yes | | "From" address for outgoing email |
| `PASSWORD_RESET_MAIL_THEME` | no | `cerberus` | Mailgen theme for the reset email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google | | Google OAuth client; callback is `${SITE_URL}/auth/google/redirect` |
| `FB_APP_ID` / `FB_APP_SECRET` | for Facebook | | Facebook app; callback is `${SITE_URL}/auth/facebook/redirect` |
| `TWITTER_KEY` / `TWITTER_SECRET` | for Twitter | | Twitter OAuth 1.0a consumer key and secret; callback is `${SITE_URL}/auth/twitter/redirect`, with `localhost` replaced by `127.0.0.1` |
| `LOG_KNOWN_ERRORS` | no | off | When set, expected (`KnownError`) errors are also logged |

## Limitations

- **Dated stack.** The root `package.json` pins `"node": "<= 14.0.0"`, and the dependencies are from that era: React 17, Mongoose 5, Passport 0.4, webpack 5 with Babel 7. It has not been checked against current Node.js or MongoDB releases.
- **Twitter sign-in is unverified and likely broken.** It uses `passport-twitter`, which speaks OAuth 1.0a against the old Twitter API. X has changed its API access and pricing since this was written, and the flow has not been tested against it.
- **OAuth accounts get placeholder emails.** OAuth users are stored with an address of the form `<provider-id>@<provider>.com`, not their real email. This keeps the unique email index satisfied but means the stored address is not usable for contact. Password reset and change password are limited to email accounts by design.
- **In-memory sessions.** No session store is configured, so sessions are lost on restart and cannot be shared across instances (remember-me cookies survive, since their tokens live in MongoDB). `express-session` warns against its memory store in production.
- **No tests.** There is no automated test suite; the `test` scripts are npm placeholders.
- **No front-end watch mode.** UI changes need a manual rebuild during development.

## Next steps

- Add tests: unit tests for `shared/validators.mjs`, and integration tests for sign-up, login, remember-me, reset and change-password against a test database.
- Upgrade to a current Node.js LTS and bring Express, Mongoose, Passport and React up to date.
- Replace `passport-twitter` with an OAuth 2.0 flow for X, or remove Twitter sign-in.
- Store the provider's verified email for OAuth users where the provider supplies one.
- Move sessions to a persistent store such as `connect-mongo`.
- Add a watch mode for the UI build.
