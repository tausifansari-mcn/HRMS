# Failed to Fetch Error - Diagnosis & Fix

**Date:** June 15, 2026  
**Status:** 🔍 DIAGNOSING

---

## 🔍 Initial Findings

### **Backend Status:** ✅ WORKING
```
URL: http://localhost:5055
Status: Running and responding
CORS: Configured correctly
Allows: http://localhost:8081
```

**Test Result:**
```bash
curl -X POST http://localhost:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8081" \
  -d '{"identifier":"test","password":"test"}'

Response:
< HTTP/1.1 401 Unauthorized
< Access-Control-Allow-Origin: http://localhost:8081
< Access-Control-Allow-Credentials: true
{"error":"Invalid credentials"}
```

✅ Backend is responding  
✅ CORS headers are correct  
✅ API is accessible

---

### **Frontend Status:** ✅ RUNNING
```
URL: http://localhost:8081
Port: 8081 (changed from 8080)
Status: Vite server running
```

---

## 🎯 Most Likely Causes

### **1. API URL Mismatch** ⚠️ MOST LIKELY

**Issue:** Frontend might be calling wrong port

**Check:**
```typescript
// File: src/lib/hrmsApi.ts (line 3)
return import.meta.env.DEV ? "http://localhost:5055" : "";
```

**Expected:** `http://localhost:5055`  
**Actual:** Need to verify in browser console

---

### **2. Browser Cache** ⚠️ COMMON

**Issue:** Old API URL cached in browser

**Solution:**
1. Open browser DevTools (F12)
2. Go to Application → Storage
3. Clear:
   - Local Storage
   - Session Storage
   - Cache
4. Hard refresh: Ctrl + Shift + R

---

### **3. Service Worker** ⚠️ POSSIBLE

**Issue:** Old service worker intercepting requests

**Solution:**
1. Open DevTools → Application → Service Workers
2. Click "Unregister" for all workers
3. Hard refresh

---

### **4. Network Request Blocked**

**Issue:** Browser extension blocking requests

**Solution:**
1. Open Incognito/Private window
2. Test login there
3. If works → disable extensions one by one

---

## 🧪 Diagnostic Tests

### **Test 1: Check API URL in Browser Console**

1. Open http://localhost:8081
2. Press F12 → Console
3. Run:
```javascript
// Check API base URL
console.log(import.meta.env.VITE_HRMS_API_URL);
console.log(import.meta.env.DEV);

// Manual test
fetch('http://localhost:5055/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({identifier: 'test', password: 'test'})
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected Output:**
```
undefined  // VITE_HRMS_API_URL not set
true       // DEV mode is true
{error: "Invalid credentials"}  // API responds
```

---

### **Test 2: Check Network Tab**

1. Open http://localhost:8081
2. Press F12 → Network
3. Try to login
4. Look for request to `/api/auth/login`

**Check:**
- ✅ Request URL: `http://localhost:5055/api/auth/login`
- ✅ Status: 401 (Unauthorized - expected for wrong credentials)
- ✅ Response Headers: `Access-Control-Allow-Origin` present
- ❌ Status: Failed / CORS error / Timeout
- ❌ Request URL: Wrong port

---

### **Test 3: Direct API Test**

Open browser console and run:
```javascript
// Test fetch directly
fetch('http://localhost:5055/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    identifier: 'admin@shivu.ai',
    password: 'admin123'
  })
})
.then(r => r.text())
.then(console.log)
.catch(err => console.error('FETCH ERROR:', err));
```

**If this works** → Issue is in frontend code  
**If this fails** → Issue is browser/network level

---

## 🔧 Quick Fixes

### **Fix 1: Clear All Browser Data**

```bash
# Restart both servers cleanly
pkill -9 -f "tsx|vite"
cd /home/shuvam/hrms-audit/backend && npm run dev > /tmp/backend.log 2>&1 &
cd /home/shuvam/hrms-audit && npm run dev > /tmp/frontend.log 2>&1 &

# Then in browser:
# 1. Clear all site data
# 2. Hard refresh (Ctrl + Shift + R)
# 3. Try login again
```

---

### **Fix 2: Set Explicit API URL**

Create `.env` file if not exists:

```bash
cd /home/shuvam/hrms-audit
cat > .env << 'EOF'
VITE_HRMS_API_URL=http://localhost:5055
EOF
```

Then restart frontend:
```bash
pkill -f vite
npm run dev > /tmp/frontend.log 2>&1 &
```

---

### **Fix 3: Check for Port Conflicts**

```bash
# Check what's on port 5055
lsof -i :5055

# Check what's on port 8081
lsof -i :8081

# If wrong process, kill it
kill -9 <PID>
```

---

## 📊 Error Patterns

### **"Failed to fetch" = Network Error**

**Possible Causes:**
1. Backend not running
2. Wrong port/URL
3. CORS issue
4. Firewall blocking
5. SSL/HTTPS mismatch

### **"401 Unauthorized" = API Working, Wrong Credentials**

This is **EXPECTED** for wrong credentials!  
This means API is working correctly.

### **"CORS Error" = Access-Control-Allow-Origin Missing**

Backend needs CORS headers.  
**Already fixed** - backend sends correct headers.

---

## 🎯 Most Likely Solution

Based on symptoms, most likely cause is:

### **Browser Cache with Old API URL**

**Quick Fix:**
1. Open http://localhost:8081
2. Press F12
3. Right-click refresh button → Empty Cache and Hard Reload
4. Try login with credentials:
   - Email: `admin@shivu.ai`
   - Password: `admin123`

---

## 📝 Verification Steps

### **Step 1: Verify Servers**
```bash
curl http://localhost:5055/ | jq
# Should return: {"success":true,"service":"MCN HRMS Backend API"}

curl http://localhost:8081/
# Should return HTML (Vite page)
```

### **Step 2: Verify Login Endpoint**
```bash
curl -X POST http://localhost:5055/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@shivu.ai","password":"admin123"}' | jq
```

**Expected Response:**
```json
{
  "data": {
    "accessToken": "jwt_token...",
    "refreshToken": "refresh_token...",
    "user": {
      "id": "...",
      "email": "admin@shivu.ai",
      "isBlocked": false,
      "mustChangePassword": false
    }
  }
}
```

**OR if user doesn't exist:**
```json
{
  "error": "Invalid credentials"
}
```

Both are valid - means API is working!

---

## 🚀 Resolution Checklist

- [ ] Backend running on port 5055
- [ ] Frontend running on port 8081 (or 8080)
- [ ] CORS headers present in response
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows request going to correct URL
- [ ] Clear browser cache and hard reload
- [ ] Test in incognito window
- [ ] Disable browser extensions
- [ ] Test direct fetch in console

---

## 📞 Need Help?

**If still failing after all fixes:**

1. **Capture Screenshot:**
   - Browser console (F12 → Console)
   - Network tab (F12 → Network → Failed request)
   - Response preview

2. **Share Error Details:**
   - Exact error message
   - Request URL from Network tab
   - Response status code
   - Console errors

3. **Provide Logs:**
```bash
# Backend logs
tail -50 /tmp/backend.log

# Check for errors
tail -100 /tmp/backend.log | grep -i "error"

# Frontend console
# (Screenshot of browser console)
```

---

**Status:** 🔍 **DIAGNOSIS IN PROGRESS**  
**Next:** Test in browser console  
**Expected:** Clear cache will fix it

**Created:** June 15, 2026 1:15 PM
