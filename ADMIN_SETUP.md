# Admin Setup Guide

## 🔑 How to Give Yourself Admin Rights

After registering your account, you need to manually set your role to `admin` in the database.

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click on **Table Editor** in the left sidebar
3. Select the **users** table
4. Find your user row (search by email)
5. Click on the row to edit
6. Change the `role` column from `user` to `admin`
7. Click **Save**

### Option 2: Using SQL Editor in Supabase

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Run this query (replace with your email):

```sql
UPDATE users 
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Option 3: Using psql Command Line

If you have `psql` installed:

```bash
psql "postgresql://postgres.vrutowfygjodifolelyd:bYpx%HMVW8yTsFG@aws-1-us-east-2.pooler.supabase.com:6543/postgres"
```

Then run:

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

---

## 🧪 Testing Your Admin Account

Once you've set your role to `admin`, you should have access to:

### Admin Features:
- ✅ **Moderation Panel** - `/admin` route
- ✅ **Review flagged opinions** - Approve/hide content
- ✅ **Manage users** - Suspend, ban, or reinstate users
- ✅ **Manage topics** - Hide, archive, or restore topics
- ✅ **Delete content** - Remove opinions and topics
- ✅ **Manage banned phrases** - Add/remove content filters
- ✅ **Update user roles** - Make other users moderators or admins

### Testing Steps:

1. **Register an account**:
   - Click "Sign In" button
   - Switch to "Create Account"
   - Fill in: email, password, first name, last name
   - Submit

2. **Promote to Admin** (using one of the methods above)

3. **Verify Admin Access**:
   - Refresh the page
   - You should see admin options in the sidebar
   - Try accessing `/admin` route
   - Test creating topics and opinions

4. **Create Test Content**:
   - Create a topic
   - Add opinions to the topic
   - Try moderator features

---

## 👥 User Roles

### User (default)
- Create topics
- Post opinions
- Vote on opinions
- Start debates
- Flag content

### Moderator
- All user features
- Review flagged content
- Approve/hide opinions
- Suspend users

### Admin
- All moderator features
- Ban users permanently
- Delete topics and opinions
- Manage banned phrases
- Change user roles
- Access full admin panel

---

## 🔒 Security Notes

- **Only promote trusted users** to moderator or admin
- **Admins can demote other admins** - be careful who you promote
- **The first user should be the primary admin** - register your main account first
- **Keep your admin credentials secure** - use a strong password

---

## 🐛 Troubleshooting

### Can't log in after registration
- Check that your DATABASE_URL is correct in `.env`
- Verify the `users` table exists in Supabase (check Table Editor)
- Check browser console for errors

### Admin features not showing
- Verify your role was updated in the database
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache and cookies
- Check the `/api/auth/user` endpoint returns `role: "admin"`

### Database connection errors
- Verify your `.env` file has correct DATABASE_URL
- Check Supabase project is not paused (free tier pauses after inactivity)
- Test connection with `psql` command

---

## 📝 Quick Reference

**Register URL**: http://localhost:5000 (click "Sign In" button)

**Check your role**:
```bash
curl http://localhost:5000/api/auth/user -b cookies.txt
```

**Admin SQL Update**:
```sql
UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL';
```

---

**Once you're set up as admin, you can start creating topics and testing the full platform!** 🚀

