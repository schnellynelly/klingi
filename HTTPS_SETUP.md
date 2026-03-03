# HTTPS Setup Guide for Klingi

## Why HTTPS?

Modern browsers require **HTTPS/TLS** for security-sensitive features:
- 🎤 Microphone access (getUserMedia API)
- 📹 Camera access
- 📍 Geolocation
- 💳 Payment APIs

**HTTP is only allowed for:**
- localhost (127.0.0.1)
- 127.0.0.x addresses
- Local networks with special exceptions

---

## Option 1: HTTPS for Development (Recommended for Testing)

### Method A: ngrok (Easiest, Temporary)

**ngrok** creates a secure HTTPS tunnel to your local server instantly.

#### Install ngrok
1. Download from https://ngrok.com/download
2. Extract to a folder
3. Create account at https://ngrok.com (free)
4. Add authtoken: `ngrok config add-authtoken YOUR_TOKEN`

#### Run ngrok
```bash
# Terminal 1: Start your backend
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Start ngrok tunnel
ngrok http 8000
```

#### Access
- ngrok gives you: `https://xxxxx.ngrok.io`
- Open that URL in browser
- Microphone will work! ✅
- Valid for 2 hours (free tier)

**Perfect for:**
- Testing two-way audio
- Mobile testing
- Demo to others

---

### Method B: Self-Signed Certificate (Local Development)

For localhost HTTPS without a public certificate.

#### Generate Certificate (one-time)
```bash
# Windows (with OpenSSL installed):
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Linux/macOS:
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

**When prompted:**
```
Country Name: US
State: [Your State]
Locality: [Your City]
Organization: Klingi
Common Name: localhost
```

#### Run with HTTPS
```bash
cd backend
python -m uvicorn app.main:app --ssl-keyfile=key.pem --ssl-certfile=cert.pem --host 0.0.0.0 --port 8000
```

#### Access
- Open: `https://localhost:8000`
- Browser shows warning (expected for self-signed cert)
- Click "Advanced" → "Proceed to localhost"
- Microphone works! ✅

**Files created:**
- `cert.pem` - Public certificate
- `key.pem` - Private key (keep safe!)

---

## Option 2: HTTPS for Production

### Method A: Let's Encrypt (Recommended, Free)

**Let's Encrypt** provides free SSL certificates trusted by all browsers.

#### Using Certbot
```bash
# Install certbot
pip install certbot

# Generate certificate (requires domain + DNS access)
certbot certonly --standalone -d your-domain.com

# Certificates saved to:
# /etc/letsencrypt/live/your-domain.com/
```

#### Run with production certificate
```bash
cd backend
python -m uvicorn app.main:app \
  --ssl-keyfile=/etc/letsencrypt/live/your-domain.com/privkey.pem \
  --ssl-certfile=/etc/letsencrypt/live/your-domain.com/fullchain.pem \
  --host 0.0.0.0 --port 443
```

**Auto-renewal:**
```bash
# Certbot auto-renews certificates
certbot renew --quiet --no-eff-email
# Add to cron for automatic renewal
```

---

### Method B: Cloud Hosting (AWS, Heroku, Linode)

All major cloud providers offer free SSL:

**AWS:**
- Use Certificate Manager (free)
- ALB/NLB handles HTTPS
- Domain required

**Heroku:**
```bash
heroku create my-klingi-app
git push heroku main
# Auto HTTPS on https://my-klingi-app.herokuapp.com
```

**Linode:**
- $5-10/month VPS
- Free Certbot SSL
- Full control

---

## Testing Microphone Access

### Step 1: Verify HTTPS
```javascript
// Check in browser console
console.log(location.protocol); // Should be "https:"
```

### Step 2: Test Microphone
```javascript
// In browser console
navigator.mediaDevices.getUserMedia({audio:true})
  .then(stream => console.log('✓ Microphone access granted!'))
  .catch(err => console.error('✗ Error:', err.message));
```

### Step 3: In Klingi
1. Go to Home page
2. Click **Talk** button (🎤)
3. Allow microphone when prompted
4. Should see "Accessing microphone..." → "Recording"

---

## Common Issues

### "Microphone API not available"
**Cause:** Not using HTTPS
**Solution:** 
- Use ngrok for testing
- Set up self-signed cert for localhost
- Use production domain with Let's Encrypt

### "No microphone found"
**Cause:** No audio device on system
**Solution:**
- Check system has microphone
- Try different device
- Check browser audio settings

### "Microphone access denied"
**Cause:** Browser permission denied
**Solution:**
1. Click padlock in address bar
2. Find "Microphone"
3. Change to "Allow"
4. Reload page
5. Try again

### "DOMException: Permission denied"
**Cause:** Multiple issues
**Solution:**
1. Verify HTTPS
2. Check browser permissions
3. Try incognito/private mode
4. Restart browser

---

## Quick Start Commands

### For Testing (localhost)
```bash
# Terminal 1: Backend
cd backend && python -m uvicorn app.main:app --ssl-keyfile=key.pem --ssl-certfile=cert.pem

# Terminal 2: Open browser
https://localhost:8000
```

### For Demo (ngrok)
```bash
# Terminal 1: Backend
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Tunnel
ngrok http 8000
# Get: https://xxxxx.ngrok.io
```

### For Production (your domain)
```bash
cd backend
python -m uvicorn app.main:app \
  --ssl-keyfile=/etc/letsencrypt/live/yourdomain.com/privkey.pem \
  --ssl-certfile=/etc/letsencrypt/live/yourdomain.com/fullchain.pem \
  --host 0.0.0.0 \
  --port 443
```

---

## Recommended Setup Path

1. **Start:** Use ngrok for quick testing
2. **Develop:** Self-signed cert on localhost
3. **Deploy:** Production domain with Let's Encrypt
4. **Scale:** Cloud provider (AWS/Heroku/Linode)

---

## Troubleshooting Commands

```bash
# Check if port is in use
netstat -an | grep 8000

# Test certificate
openssl x509 -in cert.pem -text -noout

# Validate Let's Encrypt cert
certbot certificates

# Test HTTPS connection
curl -v --insecure https://localhost:8000

# Check microphone in JavaScript
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log(devices.filter(d => d.kind === 'audioinput'));
});
```

---

## Certificate Files

Keep these files safe:

| File | Purpose | Keep Safe |
|------|---------|-----------|
| cert.pem | Public certificate | No (can be shared) |
| key.pem | Private key | **YES** ⚠️ |
| fullchain.pem | Cert chain (production) | No |
| privkey.pem | Private key (production) | **YES** ⚠️ |

**Never commit private keys to git!**

Add to `.gitignore`:
```
*.pem
*.key
cert/
certs/
```

---

## Additional Resources

- ngrok Docs: https://ngrok.com/docs
- Let's Encrypt: https://letsencrypt.org
- Certbot: https://certbot.eff.org
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

---

**Your microphone will work once HTTPS is enabled! 🎤✅**
