# HTTPS Setup Guide

**Domain**: `aloeve.club`
**Approach**: Cloudflare (free) as DNS + CDN proxy with a Cloudflare Origin Certificate on nginx.

## Why Cloudflare?

- **Free** — no paid cert or CDN subscription needed.
- **Portable** — moving to Azure Container Apps or any other host only requires updating one DNS A/CNAME record. No cert re-issuance.
- **No cert renewal** — Cloudflare Origin Certificates are valid for 15 years.
- **DDoS protection and CDN** — static assets cached at the edge.

### Traffic flow

```
Browser ──TLS──► Cloudflare ──TLS──► Azure VM :443 ──► nginx ──► backend
         (Cloudflare's cert)  (Origin cert, covered below)
```

---

## Step 1 — Add domain to Cloudflare

1. Create a free account at **cloudflare.com**.
2. Click **"Add a site"** → enter `aloeve.club` → choose the **Free** plan.
3. Cloudflare scans your existing GoDaddy DNS records (import them or skip).
4. Cloudflare gives you two nameservers, e.g.:
   ```
   aria.ns.cloudflare.com
   brad.ns.cloudflare.com
   ```
5. In **GoDaddy** → Domain Settings → Nameservers → **"Change"** → **Custom** → enter Cloudflare's nameservers.
6. Propagation typically takes 10–30 minutes (up to 48 h worst case).

---

## Step 2 — Add DNS records in Cloudflare

Go to **DNS → Records** in Cloudflare.

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `<Azure VM public IP>` | ✅ Proxied (orange cloud) |
| A | `www` | `<Azure VM public IP>` | ✅ Proxied |

The **orange cloud (Proxied)** is important — it means Cloudflare terminates TLS for browsers and hides your real IP.

> To find your Azure VM's public IP: Azure Portal → your VM → Overview → Public IP address.

---

## Step 3 — Set SSL/TLS mode to Full (strict)

In Cloudflare: **SSL/TLS → Overview** → select **Full (strict)**.

| Mode | Meaning |
|------|---------|
| Flexible | Browser↔CF is HTTPS, CF↔server is HTTP. Avoid — shows green padlock but no end-to-end encryption. |
| Full | Both legs encrypted, but CF doesn't validate server cert. |
| **Full (strict)** ✅ | Both legs encrypted, CF validates server cert (Origin Certificate). Use this. |

---

## Step 4 — Generate Cloudflare Origin Certificate

In Cloudflare: **SSL/TLS → Origin Server → Create Certificate**.

Settings:
- **Private key type**: RSA (2048)
- **Hostnames**: `aloeve.club`, `*.aloeve.club`
- **Certificate validity**: **15 years**

Click **Create**. Cloudflare shows you two values — copy them both now (the key is never shown again):

| File | Content |
|------|---------|
| `origin.pem` | The **Origin Certificate** (PEM format) |
| `origin.key` | The **Private Key** (PEM format) |

---

## Step 5 — Place the certificate on the Azure VM

SSH into the VM and run:

```bash
sudo mkdir -p /etc/ssl/aloeve

# Paste each value when the editor opens
sudo nano /etc/ssl/aloeve/origin.pem   # paste certificate, save
sudo nano /etc/ssl/aloeve/origin.key   # paste private key, save

# Lock down permissions
sudo chmod 644 /etc/ssl/aloeve/origin.pem
sudo chmod 600 /etc/ssl/aloeve/origin.key
sudo chown root:root /etc/ssl/aloeve/origin.key
```

The docker-compose volume mount (`/etc/ssl/aloeve:/etc/ssl/aloeve:ro`) makes these files available inside the nginx container at the same path.

---

## Step 6 — Open ports 80 and 443 in Azure

Azure Portal → your VM → **Networking → Add inbound port rule**:

| Port | Protocol | Name |
|------|----------|------|
| 80 | TCP | HTTP-redirect |
| 443 | TCP | HTTPS |

**Remove or restrict port 8080** from public access — traffic should now flow through nginx on 443 only. If you need direct backend access for debugging, temporarily open port 5000, restrict it to your own IP in the NSG rule, and close it when done.

---

## Step 7 — Rebuild and start the stack

```bash
cd ~/path/to/aloevera-harmony-meet

docker compose down
docker compose up --build -d
docker compose logs -f   # watch for errors
```

Then visit `https://aloeve.club` — you should see the app with a valid padlock.

---

## Step 8 — Verify

```bash
# From your local machine (not the VM)
curl -I https://aloeve.club/health

# Expected:
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains
```

In Cloudflare dashboard: **SSL/TLS → Overview** should show "Your SSL/TLS encryption mode is Full (strict)".

---

## Optional — Redirect www to non-www

In Cloudflare: **Rules → Page Rules** (or **Redirect Rules** on the newer UI):

- URL pattern: `www.aloeve.club/*`
- Setting: **Forwarding URL** (301 Permanent)
- Destination: `https://aloeve.club/$1`

This is handled at the Cloudflare edge — no nginx change needed.

---

## Migrating to a new host (Azure Container Apps etc.)

When you move off the Azure VM:

1. Deploy the new environment (Container Apps / ACI / etc.).
2. Get its public IP or hostname.
3. In Cloudflare **DNS → Records**: update the `@` A record to the new IP (or change to a CNAME if the new host gives you a domain).
4. Copy `/etc/ssl/aloeve/origin.pem` and `/etc/ssl/aloeve/origin.key` to the new host (or configure the new host's TLS with the same cert).
5. No cert re-issuance needed — the origin cert is still valid.

If the new host doesn't run nginx (e.g., Container Apps with built-in TLS termination and a custom domain), you can switch Cloudflare to **Full** mode instead of **Full (strict)** temporarily while you configure the new host's custom domain certificate. Cloudflare's managed certificate handles the browser-facing TLS regardless.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | Origin cert not installed or nginx not reloaded |
| `526 Invalid SSL certificate` | Cloudflare in Full (strict) but cert missing or expired |
| `525 SSL handshake failed` | Port 443 not open in Azure NSG |
| `521 Web server is down` | Docker not running or port 443 not mapped |
| App loads but shows old IP | DNS still propagating — wait or flush DNS cache |
| Padlock shows "Not secure" | Cloudflare SSL mode is Flexible, not Full (strict) |
