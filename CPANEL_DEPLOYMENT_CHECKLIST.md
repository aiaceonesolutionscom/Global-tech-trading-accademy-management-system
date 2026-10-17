# cPanel LiteSpeed / Passenger Deployment Checklist
**Project:** Global Tech International Academy Management System  
**Framework:** Next.js 15 (App Router, Standalone Build) + Prisma ORM  
**Reference Guide:** `D:\Office work\cpanel-nextjs-deployment-guide.md`

---

## 🚀 Pre-Configured Files In This Project
All required configuration files have already been prepared and verified in the codebase:

1. **`server.js` (Root Directory)**
   - Contains the **LiteSpeed `LSNODE_SOCKET`** monkey-patch shim.
   - Automatically detects whether the server is running on **LiteSpeed** (`LSNODE_SOCKET`) or **Apache + Passenger** (`PORT`), ensuring 503 / generic cPanel placeholder errors never happen.

2. **`next.config.ts`**
   - `output: "standalone"` (prunes unnecessary files to conserve inode limits).
   - `experimental: { cpus: 1 }` (prevents shared-hosting `EAGAIN` worker process limits).
   - `poweredByHeader: false` (hides framework identity for security).
   - Strict HTTP security headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

3. **`package.json`**
   - `"build:cpanel": "next build --webpack"` (avoids Turbopack symlink breakage with cPanel's `nodevenv`).
   - `"postbuild"` (automatically copies `.next/static` and `public` into `.next/standalone`).

---

## 📋 Step-by-Step Deployment Instructions

### 1. Setup Node.js App in cPanel
1. Open cPanel and navigate to **"Setup Node.js App"** (CloudLinux Node Selector).
2. Click **Create Application**:
   - **Node.js version:** Select `20.x` or `22.x` (LTS recommended).
   - **Application mode:** `Production`.
   - **Application root:** Enter your app folder name (e.g. `academy` or `global-trading-management`).
   - **Application URL:** Select your domain or subdomain.
   - **Application startup file:** Set strictly to `server.js`.
3. Click **Create**.

---

### 2. Upload / Clone Project Code
- Either use Git (`git clone <repo-url> .`) via SSH/Terminal inside the app directory, OR upload a `.zip` via cPanel File Manager and extract it into the app root folder.
- Ensure the project files (`server.js`, `package.json`, `next.config.ts`, `prisma/`, `src/`) are directly inside the Application Root.

---

### 3. Activate Virtual Environment & Install Dependencies
1. In cPanel's "Setup Node.js App" page, copy the command shown at the top banner:
   ```bash
   source /home/<username>/nodevenv/<app-root>/<version>/bin/activate && cd /home/<username>/<app-root>
   ```
2. Open cPanel **Terminal** (or SSH) and paste that command.
3. Install dependencies with devDependencies included (required for build tools):
   ```bash
   npm install --include=dev
   ```

---

### 4. Create `.env` on Server
Inside your application root, create a `.env` file (via File Manager or Terminal `nano .env`):
```env
# Database connection
# If using PostgreSQL on cPanel:
# postgresql://<user>:<password>@127.0.0.1:5432/<dbname>
# Note: Special characters in password must be percent-encoded (@ -> %40, # -> %23, $ -> %24)
DATABASE_URL="file:./prisma/dev.db"

# Session & Authentication Secrets
# Generate random base64 string using: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_SECRET="REPLACE_WITH_GENERATED_RANDOM_SECRET"
SESSION_SECRET="REPLACE_WITH_GENERATED_RANDOM_SECRET"

# Initial Admin Password (Optional, fallback is GTIA#Master@2025!)
ADMIN_PASSWORD="YourStrongAdminPassword123!"

# Node Environment
NODE_ENV="production"
PORT=3000
```

---

### 5. Setup Database Schema
Generate Prisma client and push the schema:
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

---

### 6. Build the Application
Run the cPanel-optimized build command:
```bash
RAYON_NUM_THREADS=1 npm run build:cpanel
```
*(The `postbuild` script will automatically copy static assets into `.next/standalone/`).*

---

### 7. Restart Application
- In cPanel → "Setup Node.js App", click **"Restart"**.
- Or run in terminal:
  ```bash
  mkdir -p tmp && touch tmp/restart.txt
  ```

---

## 🔍 Verification & Troubleshooting
1. **Domain Test:**
   Visit your site in the browser or check via curl:
   ```bash
   curl -sI https://yourdomain.com
   ```
2. **If site returns 503 or placeholder:**
   - Confirm Application startup file in cPanel is strictly set to `server.js`.
   - Check `stderr.log` in your app root folder for any runtime crashes.
3. **If build throws `EAGAIN` (Resource temporarily unavailable):**
   - Ensure you ran with `RAYON_NUM_THREADS=1`.
   - Ensure `experimental: { cpus: 1 }` is active in `next.config.ts`.

