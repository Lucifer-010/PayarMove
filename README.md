# PayarMove 🚗 💳 ⛓️
**Institutional Cross-Border Mobility Payments, Hourly Rentals & Soroban Escrow on Stellar**

| Target | Public URL / Host | Destination / Port | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | [https://payarmove.com](https://payarmove.com) | Dokploy / Traefik Port 443 → Frontend:3000 | Production Ready |
| **Frontend Canonical** | [https://www.payarmove.com](https://www.payarmove.com) | Dokploy / Traefik Port 443 | Production Ready |
| **Backend REST API** | [https://api.payarmove.com](https://api.payarmove.com) | Dokploy / Traefik Port 443 → Gunicorn:8000 | Production Ready |
| **Interactive Swagger**| [https://api.payarmove.com/api/v1/docs/](https://api.payarmove.com/api/v1/docs/) | OpenAPI 3.0 UI | Live |
| **Interactive ReDoc**  | [https://api.payarmove.com/api/v1/redoc/](https://api.payarmove.com/api/v1/redoc/) | ReDoc UI | Live |
| **OpenAPI Schema**     | [https://api.payarmove.com/api/v1/schema/](https://api.payarmove.com/api/v1/schema/) | YAML / JSON | Live |

PayarMove is a decentralized peer-to-peer vehicle rental infrastructure platform engineered for emerging markets. PayarMove eliminates cross-border remittance friction, settlement delays, and currency volatility by enabling renters to **rent by the hour and pay in Stellar USDC**, holding funds in a **custom Soroban WebAssembly Smart Contract escrow**, and autonomously disbursing atomic payouts to vehicle owners and the platform treasury.

---

## 🌟 Key Features

1. **Rent by the Hour & Custom Trip Calculator**:
   - Flexible hourly trip booking (presets for 4 hrs, 8 hrs, 24 hrs, 48 hrs, 3 days, 1 week, or custom hour selection).
   - Dynamic real-time calculation: $\text{Rental Fee} = \text{Hourly Rate} \times \text{Duration (Hours)}$.
   - Independent security deposit locking via smart contract escrow.
2. **Dual-Mode Authentication & IAM**:
   - **Web2**: Email & password authentication with secure JWT access and refresh token lifecycle.
   - **Web3 Wallet Connect**: Native Stellar **SEP-0010** challenge-response authentication. Users sign a cryptographically bound challenge transaction using **Freighter**, **Lobstr**, or **xBull** to authenticate without password risk.
3. **Tiered KYC & Compliance Subsystem**:
   - Tier 0: Unverified visitor.
   - Tier 1: Verified contact details.
   - Tier 2: Verified National ID / Passport, Driver's License, or Vehicle Ownership Logbook.
   - Role & Tier-based access control protecting rental bookings and vehicle listings.
4. **Decentralized Escrow via Soroban Smart Contract**:
   - Rust-compiled smart contract deployed to Stellar Testnet (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`).
   - Locks 100% of the payment (Rental amount + Security deposit).
   - **Atomic Settlement**: Automatically routes 90% of the rental fee to the host, 10% platform fee to the PayarMove treasury, and refunds 100% of the security deposit to the renter upon vehicle inspection.
   - **Dispute Resolution Engine**: Multi-sig arbitration allowing deposit splits in case of vehicle damage claims.
5. **OpenAPI 3.0 & Swagger UI (`drf-spectacular`)**:
   - Interactive Swagger UI: `https://api.payarmove.com/api/v1/docs/`
   - Interactive ReDoc: `https://api.payarmove.com/api/v1/redoc/`
   - Complete technical documentation in [**`API_DOCS.md`**](./API_DOCS.md).
6. **Containerized Production Topology (Dokploy PaaS)**:
   - Production multi-container topology with **Docker Compose**: Django 5 / Gunicorn + WhiteNoise, PostgreSQL 16, Redis 7, Celery Worker, Celery Beat, Soroban Event Indexer, and Vite React Frontend SPA (`serve`).
   - Reverse proxy, SSL (Let's Encrypt), and domain ingress are automatically orchestrated by **Dokploy (Traefik)** without needing a custom Nginx container.

---

## 🏛️ System Architecture

```
                                  +------------------------------+
                                  |   Renter / Host / Admin UI   |
                                  |      https://payarmove.com   |
                                  +---------------+--------------+
                                                  |
                                                  | HTTPS / SSL (Let's Encrypt)
                                                  v
                                      +-----------------------+
                                      |   Dokploy / Traefik   |
                                      |     (Port 80 / 443)   |
                                      +---+---------------+---+
                                          |               |
                         +----------------+               +----------------+
                         | (payarmove.com)                                 | (api.payarmove.com)
                         v                                                 v
           +---------------------------+                     +---------------------------+
           |    Frontend Node SPA      |                     |   Django 5 Gunicorn API   |
           |    (Port 3000 / serve)    |                     |  (Port 8000 / WhiteNoise) |
           +---------------------------+                     +-------------+-------------+
                                                                           |
                                                      +--------------------+--------------------+
                                                      |                                         |
                                                      v                                         v
                                        +---------------------------+             +---------------------------+
                                        |       PostgreSQL 16       |             |          Redis 7          |
                                        |  Users, KYC, Rentals, DB  |             | Celery Broker & Sessions  |
                                        +---------------------------+             +-------------+-------------+
                                                                                                |
                                                                                  +-------------+-------------+
                                                                                  |                           |
                                                                                  v                           v
                                                                      +--------------------+     +--------------------+
                                                                      |   Celery Worker    |     |  Soroban Indexer   |
                                                                      | (Horizon / Tasks)  |     | (Event Streaming)  |
                                                                      +---------+----------+     +---------+----------+
                                                                                |                          |
                                                                                +------------+-------------+
                                                                                             |
                                                                                             v
                                                                              +------------------------------+
                                                                              |  Stellar Testnet / Soroban   |
                                                                              |  - Escrow Smart Contract     |
                                                                              |  - Circle USDC (SAC)         |
                                                                              +------------------------------+
```

---


## 🚀 Production Deployment on Dokploy (https://dokploy.com/)

Dokploy is a modern self-hosted PaaS with built-in Traefik reverse proxy, automated Let's Encrypt SSL certificates, Docker Compose orchestration, and zero Nginx configuration required.

### 1. DNS Records Setup
In your domain registrar / DNS provider (Cloudflare, Namecheap, GoDaddy, etc.), create the following **A Records** pointing to your Dokploy server IP:

| Type | Name / Host | Target IPv4 | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (`payarmove.com`) | `<YOUR_VPS_IP>` | Auto / 300 | DNS Only (or Proxied) |
| **A** | `www` (`www.payarmove.com`) | `<YOUR_VPS_IP>` | Auto / 300 | DNS Only (or Proxied) |
| **A** | `api` (`api.payarmove.com`) | `<YOUR_VPS_IP>` | Auto / 300 | DNS Only (or Proxied) |

---

### 2. Create Service in Dokploy
1. Open your **Dokploy Dashboard**.
2. Select your **Project** (or create one).
3. Click **Create Service** and choose **Compose**.
4. Set Compose Type to **Docker Compose** and give it a name (e.g. `payarmove`).

---

### 3. Connect Git Repository
1. In the service's **General** / **Source** tab, select **Provider Type**: **GitHub** or **Git**.
2. Select your repository: `Lucifer-010/PayarMove` and branch: `main`.
3. Set **Compose Path**: `./docker-compose.prod.yml` (or `./docker-compose.yml`).

---

### 4. Configure Production Environment Variables
Navigate to the **Environment** tab in Dokploy and paste your production environment variables:

```ini
# Django Core Settings
DJANGO_SECRET_KEY=<YOUR_DJANGO_SECRET_KEY>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.payarmove.com,payarmove.com,www.payarmove.com,localhost,127.0.0.1,web

# Security & CORS Origins
CORS_ALLOWED_ORIGINS=https://payarmove.com,https://www.payarmove.com,https://api.payarmove.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://payarmove.com,https://www.payarmove.com,https://api.payarmove.com

# Domain routing
FRONTEND_DOMAIN=payarmove.com
API_DOMAIN=api.payarmove.com
FRONTEND_URL=https://payarmove.com
BACKEND_URL=https://api.payarmove.com
VITE_API_BASE_URL=https://api.payarmove.com/api/v1
VITE_FRONTEND_URL=https://payarmove.com

# Database Configuration
POSTGRES_DB=payarmove_db
POSTGRES_USER=payarmove_user
POSTGRES_PASSWORD=<YOUR_DATABASE_PASSWORD>
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis & Celery
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Stellar & Soroban Credentials
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
STELLAR_USDC_CODE=USDC
SOROBAN_ESCROW_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# Platform Treasury Keypair
STELLAR_SERVER_PUBLIC_KEY=<YOUR_STELLAR_TREASURY_PUBLIC_KEY>
STELLAR_SERVER_SECRET_KEY=<YOUR_STELLAR_TREASURY_SECRET_KEY>
```

---

### 5. Domain Ingress & SSL (Let's Encrypt)
Traefik labels are already embedded into `docker-compose.prod.yml` and `docker-compose.yml`. As soon as your DNS A-records are pointing to your server, Dokploy automatically generates SSL certificates and routes traffic:
- **`payarmove.com` & `www.payarmove.com`** $\rightarrow$ `frontend` service (Port 3000)
- **`api.payarmove.com`** $\rightarrow$ `web` service (Port 8000)

*(Optional)* You can also manage domains via Dokploy's **Domains** tab by adding:
- Domain `payarmove.com` pointing to service `frontend` port `3000`
- Domain `api.payarmove.com` pointing to service `web` port `8000`

---

### 6. Deploy Service
Click the **Deploy** button on Dokploy.
Dokploy will automatically:
1. Build the production frontend SPA container (`serve`) and Django backend container.
2. Start PostgreSQL 16 and Redis 7 with automatic health checks.
3. Apply database migrations (`python manage.py migrate --noinput`).
4. Collect and compress static files using **WhiteNoise**.
5. Launch Gunicorn WSGI workers, Celery worker, Celery beat, and Soroban event indexer.
6. Connect to `dokploy-network` and enable automatic HTTPS via Traefik.

---

### 7. Create Platform Superuser
Open the container terminal in Dokploy (or run via SSH):
```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```
Follow the interactive prompts:
- **Email**: `<YOUR_ADMIN_EMAIL>`
- **Username**: `<YOUR_ADMIN_USERNAME>`
- **Password**: `<YOUR_SECURE_PASSWORD>`

You can now sign in at **[https://payarmove.com/?view=admin-signin](https://payarmove.com/?view=admin-signin)** or the Django Admin at **[https://api.payarmove.com/admin/](https://api.payarmove.com/admin/)**.

---

## 💻 Local Development Guide

### Option 1: Running with Docker Compose (Local)

1. **Launch all local containers with hot-reloading**:
   ```bash
   docker compose -f docker-compose.dev.yml up --build -d
   ```


2. **Access local services**:
   - **Frontend**: [http://localhost:5173](http://localhost:5173)
   - **Backend API & Swagger**: [http://localhost:8000/api/v1/docs/](http://localhost:8000/api/v1/docs/)
   - **Django Admin**: [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

### Option 2: Running Locally with Python Virtual Environment

1. **Backend setup**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver 0.0.0.0:8000
   ```

2. **Frontend setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🔐 API Reference Overview

Full interactive endpoint documentation is provided in [**`API_DOCS.md`**](./API_DOCS.md).

| Domain | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/signup/` | Register Email, Password & Role (`RENTER`/`HOST`) |
| **Auth** | `POST` | `/api/v1/auth/signin/` | Authenticate credentials $\rightarrow$ JWT Tokens |
| **Auth** | `POST` | `/api/v1/auth/wallet/challenge/` | Request SEP-0010 Challenge XDR for Freighter |
| **Auth** | `POST` | `/api/v1/auth/wallet/verify/` | Submit signed XDR $\rightarrow$ Verified wallet & JWT Tokens |
| **Auth** | `GET` | `/api/v1/auth/me/` | Current user profile and linked wallets |
| **KYC** | `POST` | `/api/v1/kyc/submit/` | Submit ID / Driver's license documentation |
| **KYC** | `GET` | `/api/v1/kyc/status/` | Query KYC verification status and tier level |
| **KYC** | `POST` | `/api/v1/kyc/admin/applications/{id}/review/` | Admin approves or rejects KYC record |
| **Rentals** | `GET` | `/api/v1/rentals/vehicles/` | Browse available mobility vehicles |
| **Rentals** | `POST` | `/api/v1/rentals/vehicles/` | Host lists vehicle for rental |
| **Rentals** | `POST` | `/api/v1/rentals/rentals/` | Create rental booking with custom duration hours |
| **Escrow** | `POST` | `/api/v1/escrow/prepare/{rental_id}/` | Generate Soroban invocation parameters & XDR |
| **Escrow** | `GET` | `/api/v1/escrow/{rental_id}/` | Check on-chain escrow state & balances |
| **Escrow** | `POST` | `/api/v1/escrow/{rental_id}/submit-deposit/` | Submit Freighter on-chain deposit tx hash |
| **Escrow** | `POST` | `/api/v1/escrow/{rental_id}/settle/` | Complete rental $\rightarrow$ 90% Host / 10% Platform / 100% Deposit refund |
| **Payouts**| `GET` | `/api/v1/payouts/` | Host payout ledger & earnings breakdown |
| **Dashboard**| `GET` | `/api/v1/dashboard/admin/summary/` | Admin volume, confirmed, pending, host payouts |
| **Dashboard**| `GET` | `/api/v1/dashboard/host/summary/` | Host earnings and rental booking counts |

---

## 📦 Soroban Escrow Smart Contract

The smart contract code resides in `contracts/payarmove_escrow/`.

### Building and Testing the Contract:
```bash
cd contracts/payarmove_escrow
cargo test
cargo build --target wasm32-unknown-unknown --release
```

### Deployed Testnet Contract Address:
- **Contract ID**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Network**: Stellar Testnet (`https://horizon-testnet.stellar.org` & `https://soroban-testnet.stellar.org`)
- **Stellar Expert Explorer**: [https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC)

---

## 🛡️ License & Security
Copyright &copy; 2026 PayarMove. All rights reserved.

To report security vulnerabilities or sensitive issues, please contact the security team directly at `<SECURITY_CONTACT_EMAIL>`.
