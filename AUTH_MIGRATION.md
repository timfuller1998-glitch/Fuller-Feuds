# Authentication Migration - Replit to Local Auth

## What Changed

The application has been migrated from Replit OAuth to local email/password authentication.

## Files Modified

### Core Auth System
- **Created**: `server/auth.ts` - New local authentication with email/password
- **Updated**: `server/index.ts` - Now imports from `./auth` instead of `./replitAuth`
- **Updated**: `server/middleware/auth.ts` - Updated to work with Passport.js user object
- **Updated**: `server/middleware/permissions.ts` - Simplified user role attachment
- **Updated**: `shared/schema.ts` - Added `passwordHash` field to users table
- **Updated**: `server/repositories/userRepository.ts` - Added `findById` and `findByEmail` methods

### Old Files (Can be deleted after testing)
- `server/replitAuth.ts` - No longer used

## Required Dependencies

Install the missing dependency:

```bash
npm install bcryptjs @types/bcryptjs
```

## Database Migration

The users table now has a `passwordHash` field. Run the migration:

```bash
npm run db:push
```

## Environment Variables Required

Minimum `.env` configuration:

```env
DATABASE_URL=your_supabase_connection_string
SESSION_SECRET=your_random_secret_key_here
```

## New API Endpoints

### Register
```bash
POST /api/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Login
```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

### Logout
```bash
POST /api/logout
```

### Get Current User
```bash
GET /api/auth/user
```

## Testing

1. Set up your `.env` file with `DATABASE_URL` and `SESSION_SECRET`
2. Install dependencies: `npm install bcryptjs @types/bcryptjs`
3. Run migrations: `npm run db:push`
4. Start the server: `npm run dev`
5. Test registration: `curl -X POST http://localhost:5000/api/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test123","firstName":"Test","lastName":"User"}'`
6. Test login: `curl -X POST http://localhost:5000/api/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test123"}'`

## Frontend Updates Needed

The frontend will need to be updated to:
1. Use the new `/api/register` and `/api/login` endpoints instead of Replit OAuth
2. Update the auth context to handle email/password authentication
3. Add registration and login forms

## Session Storage

Sessions are stored in PostgreSQL using `connect-pg-simple`. The `sessions` table will be automatically created on first run.

## Security Notes

- Passwords are hashed using bcrypt with salt rounds of 10
- Sessions are stored server-side in PostgreSQL
- Cookies are httpOnly and secure in production
- Session TTL is 7 days by default

