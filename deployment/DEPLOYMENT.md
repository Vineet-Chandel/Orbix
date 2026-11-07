# AWS EC2 Production Deployment Checklist

This guide documents the standardized deployment process for updating the Orbix application on the production AWS EC2 instance.

---

## Architecture Overview

* **Frontend:** React 19 + TypeScript + Vite (`/var/www/html` or `/var/www/orbix/dist`)
* **Backend:** Express 5 + TypeScript + Node.js (Managed via PM2 on port 3000)
* **Reverse Proxy:** Nginx (Listens on port 80/443; forwards `/api/*` to `127.0.0.1:3000`)
* **Database:** Supabase PostgreSQL
* **Cache:** Redis via `ioredis`

---

## Standard Deployment Steps

### 1. SSH into the Production Instance
```bash
ssh -i /path/to/orbix-key.pem ubuntu@ip-172-31-12-102
```

### 2. Pull Latest Code on `main` Branch
```bash
cd ~/Orbix
git checkout main
git pull origin main
```

### 3. Backend Dependency Check & PM2 Reload
```bash
cd ~/Orbix/Backend
npm install --production=false
# Restart backend application process via PM2
pm2 reload index || pm2 restart index || pm2 start "npm start" --name "orbix-backend"
pm2 save
```

### 4. Build Production Frontend
```bash
cd ~/Orbix/Frontend
npm install
npm run build
```

### 5. Deploy Frontend Dist to Nginx Web Root
```bash
# Sync built distribution files to web root
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
# Or if using /var/www/orbix:
# sudo cp -r dist/* /var/www/orbix/dist/
```

### 6. Verify Nginx Configuration
```bash
# Verify nginx syntax
sudo nginx -t

# If nginx.conf was updated from repository:
# sudo cp ~/Orbix/deployment/nginx.conf /etc/nginx/sites-available/orbix
# sudo ln -sf /etc/nginx/sites-available/orbix /etc/nginx/sites-enabled/
# sudo nginx -t

# Reload Nginx without downtime
sudo systemctl reload nginx
```

---

## Health & Verification Checklist

1. **Verify Backend API Health:**
   ```bash
   curl -i http://127.0.0.1:3000/
   # Expected: HTTP 200 OK "Hello World!"
   ```

2. **Verify Standardized `/api/auth` Route:**
   ```bash
   curl -i -X POST http://127.0.0.1:3000/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{}'
   # Expected: HTTP 400 Bad Request (Validation failed)
   ```

3. **Verify Protected Profile Route:**
   ```bash
   curl -i http://127.0.0.1:3000/api/profile/me
   # Expected: HTTP 401 Unauthorized
   ```

4. **Verify Non-API Routes are Not Exposed:**
   ```bash
   curl -i http://127.0.0.1:3000/profile/me
   # Expected: HTTP 404 Not Found
   ```

5. **Verify Nginx Proxy Forwarding:**
   ```bash
   curl -i http://localhost/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{}'
   # Expected: HTTP 400 Bad Request from Express
   ```

6. **Verify Frontend SPA Refresh:**
   ```bash
   curl -i http://localhost/auth/signin
   # Expected: HTTP 200 OK with HTML content
   ```
