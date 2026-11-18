# PayarMove Pay API Documentation 🚗 💳 ⛓️

**Production Base URL**: `https://api.payarmove.com/api/v1`  
**VPS Direct Host**: `http://<YOUR_VPS_IP>:8000/api/v1`  
**Local Development**: `http://localhost:8000/api/v1`  

---

## 📑 Interactive Documentation
- **Swagger UI**: [https://api.payarmove.com/api/v1/docs/](https://api.payarmove.com/api/v1/docs/)
- **ReDoc Interactive Reference**: [https://api.payarmove.com/api/v1/redoc/](https://api.payarmove.com/api/v1/redoc/)
- **OpenAPI 3.0 Schema**: [https://api.payarmove.com/api/v1/schema/](https://api.payarmove.com/api/v1/schema/)

---

## 🌐 Hosting & Network Architecture

| Component | Public Domain | Destination / Port | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | `https://payarmove.com` | Dokploy / Traefik port 443 → Frontend port 3000 | React + Vite Single Page Application |
| **Frontend Alias** | `https://www.payarmove.com` | Dokploy / Traefik port 443 | Canonical alias for `payarmove.com` |
| **Backend REST API** | `https://api.payarmove.com` | Dokploy / Traefik port 443 → Gunicorn port 8000 | Django 5 + DRF + Celery |
| **Static & Media** | `https://api.payarmove.com/media/` | Gunicorn / WhiteNoise | Uploaded vehicle photos & KYC files |
| **Stellar Network** | Testnet | Horizon & Soroban RPC | `https://soroban-testnet.stellar.org` |


---

## 🔐 Authentication & Authorization

All authenticated requests require a JWT Bearer token in the `Authorization` header:
```http
Authorization: Bearer <your_access_token>
```

### 1. Web2 Email & Password Auth

#### **Sign Up**
`POST /api/v1/auth/signup/`
```json
{
  "email": "renter@example.com",
  "username": "jane_doe",
  "password": "SecurePassword123!",
  "role": "RENTER"
}
```
*Roles*: `RENTER`, `HOST`

**Response (`201 Created`)**:
```json
{
  "user": {
    "id": "e89f81a7-...",
    "email": "renter@example.com",
    "username": "jane_doe",
    "role": "RENTER",
    "kyc_tier": 0
  },
  "tokens": {
    "access": "eyJhbGciOiJIUzI1Ni...",
    "refresh": "eyJhbGciOiJIUzI1Ni..."
  }
}
```

#### **Sign In**
`POST /api/v1/auth/signin/`
```json
{
  "email": "admin@payarmove.com",
  "password": "AdminPassword123!"
}
```

#### **Token Refresh**
`POST /api/v1/auth/token/refresh/`
```json
{
  "refresh": "eyJhbGciOiJIUzI1Ni..."
}
```

---

### 2. Web3 Native Stellar Wallet Auth (SEP-0010)

#### **Step 1: Request Challenge XDR**
`POST /api/v1/auth/wallet/challenge/`
```json
{
  "public_key": "GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT"
}
```

**Response (`200 OK`)**:
```json
{
  "network_passphrase": "Test SDF Network ; September 2015",
  "transaction": "AAAAAgAAAACw..."
}
```

#### **Step 2: Submit Signed Challenge XDR**
`POST /api/v1/auth/wallet/verify/`
```json
{
  "signed_xdr": "AAAAAgAAAACw...[signed_by_freighter]"
}
```

**Response (`200 OK`)**:
```json
{
  "user": {
    "id": "4b5d6f8e-...",
    "wallet_address": "GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT",
    "role": "RENTER",
    "is_new_user": false
  },
  "tokens": {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi..."
  }
}
```

#### **Step 3: Complete Wallet Profile (New Users)**
`POST /api/v1/auth/wallet/profile/`
```json
{
  "name": "Alex Mercer",
  "email": "alex@example.com",
  "phone": "+254 700 123 456",
  "role": "HOST"
}
```

---

### 3. User Profile & Account Management

#### **Get Current User**
`GET /api/v1/auth/me/`
*Headers*: `Authorization: Bearer <token>`

#### **Update User Profile**
`PATCH /api/v1/auth/me/`
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "+254 711 222 333"
}
```

#### **Upload Avatar**
`POST /api/v1/auth/avatar/`
*Content-Type*: `multipart/form-data`
*Body*: `avatar`: `[binary image file]`

---

## 🪪 KYC Compliance Subsystem

| Tier Level | Name | Capabilities | Requirements |
| :---: | :--- | :--- | :--- |
| **0** | Unverified | Browse vehicles, view catalog | Anonymous or newly registered |
| **1** | Contact Verified | Rent vehicles up to 200 USDC/day | Email & phone verified |
| **2** | ID & License Verified | High-value luxury rentals & Host listing | National ID / Passport + Driver's License |

#### **Query KYC Status**
`GET /api/v1/kyc/status/`
*Response*:
```json
{
  "kyc_tier": 2,
  "status": "APPROVED",
  "documents": [
    {"type": "GOVERNMENT_ID", "status": "APPROVED"},
    {"type": "DRIVERS_LICENSE", "status": "APPROVED"}
  ]
}
```

#### **Submit KYC Documents**
`POST /api/v1/kyc/submit/`
*Content-Type*: `multipart/form-data`
*Fields*:
- `document_type`: `PASSPORT` | `NATIONAL_ID` | `DRIVERS_LICENSE`
- `document_number`: `A12345678`
- `document_file`: `[binary file]`

#### **Admin KYC Review**
`POST /api/v1/kyc/admin/applications/{id}/review/`
*Permissions*: `IsAdminUser`
```json
{
  "action": "APPROVE",
  "notes": "Driver license and photo verified successfully"
}
```

---

## 🚘 Vehicle Fleet & Rentals Management

#### **List Available Vehicles**
`GET /api/v1/rentals/vehicles/?city=Nairobi&category=SUV&available=true`

**Response (`200 OK`)**:
```json
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "c7a8b9d0-...",
      "make": "Mercedes-Benz",
      "model": "G63 AMG",
      "year": 2024,
      "daily_rate_usdc": "350.00",
      "security_deposit_usdc": "500.00",
      "city": "Nairobi",
      "pickup_location": "Westlands, Nairobi",
      "image_url": "https://api.payarmove.com/media/vehicles/g63.jpg",
      "host": {
        "id": "...",
        "name": "Verified Host Kenya",
        "rating": 4.95
      }
    }
  ]
}
```

#### **Host List a New Vehicle**
`POST /api/v1/rentals/vehicles/`
*Content-Type*: `multipart/form-data`
```json
{
  "make": "BMW",
  "model": "X5 xDrive40i",
  "year": 2023,
  "category": "SUV",
  "daily_rate_usdc": "220.00",
  "security_deposit_usdc": "400.00",
  "city": "Nairobi",
  "pickup_location": "Kilimani, Nairobi",
  "seats": 5,
  "transmission": "AUTOMATIC",
  "fuel_type": "PETROL"
}
```

#### **Create Rental Booking**
`POST /api/v1/rentals/rentals/`
```json
{
  "vehicle_id": "c7a8b9d0-...",
  "start_date": "2026-10-20T10:00:00Z",
  "end_date": "2026-10-23T10:00:00Z"
}
```

**Response (`201 Created`)**:
```json
{
  "rental_id": "PM-8921",
  "status": "CREATED",
  "total_rental_usdc": "1050.00",
  "security_deposit_usdc": "500.00",
  "total_amount_usdc": "1550.00",
  "platform_fee_usdc": "105.00",
  "host_payout_usdc": "945.00"
}
```

#### **Host Mark Delivered**
`POST /api/v1/rentals/rentals/{id}/deliver/`
*Transitions status to `ACTIVE`.*

#### **Host Mark Returned**
`POST /api/v1/rentals/rentals/{id}/return/`
*Transitions status to `COMPLETED` and initiates on-chain escrow release.*

---

## ⛓️ Decentralized Soroban Smart Contract Escrow

**Deployed Escrow Contract ID**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`  
**Testnet SAC USDC Token**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

### Escrow State Lifecycle

```
CREATED ---> AWAITING_PAYMENT ---> VERIFYING ---> HELD (ACTIVE) ---> SETTLED (COMPLETED)
                                                      |
                                                      +---> DISPUTED
```

#### **Prepare Soroban Invocation Parameters**
`POST /api/v1/escrow/prepare/{rental_id}/`

Returns raw Soroban contract call arguments for the user's Freighter wallet to sign.

#### **Check On-Chain Escrow State**
`GET /api/v1/escrow/{rental_id}/`

**Response (`200 OK`)**:
```json
{
  "rental_id": "PM-8921",
  "escrow_contract": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "amount_held_usdc": "1550.00",
  "renter_wallet": "GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT",
  "host_wallet": "GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK",
  "state": "HELD",
  "on_chain_tx_hash": "e89f81a7b5d1a2c3..."
}
```

#### **Submit On-Chain Deposit Transaction**
`POST /api/v1/escrow/{rental_id}/submit-deposit/`
```json
{
  "tx_hash": "e89f81a7b5d1a2c3b4e5f6..."
}
```

#### **Complete Rental Settlement**
`POST /api/v1/escrow/{rental_id}/settle/`
- Releases **90%** of rental amount to Host wallet.
- Releases **10%** platform fee to Treasury wallet.
- Refunds **100%** of security deposit to Renter wallet.

---

## 💰 Host Payouts Ledger

#### **Get Host Payout History**
`GET /api/v1/payouts/`
*Headers*: `Authorization: Bearer <host_token>`

**Response (`200 OK`)**:
```json
{
  "total_earned_usdc": "4520.00",
  "available_balance_usdc": "836.00",
  "pending_payouts_usdc": "0.00",
  "payouts": [
    {
      "id": "PO-1092",
      "rental_id": "PM-8921",
      "vehicle": "Mercedes-Benz G63 AMG",
      "amount_usdc": "836.00",
      "status": "COMPLETED",
      "stellar_tx_hash": "f901c2b3a4...",
      "created_at": "2026-10-14T10:00:00Z"
    }
  ]
}
```

---

## 📊 Analytics & Admin Dashboards

#### **Host Summary Dashboard**
`GET /api/v1/dashboard/host/summary/`
- Active rentals count
- Lifetime earnings in USDC
- Fleet utilization rate

#### **Platform Admin Overview Dashboard**
`GET /api/v1/dashboard/admin/summary/`
*Permissions*: `IsAdminUser`

**Response (`200 OK`)**:
```json
{
  "total_volume_usdc": "142850.00",
  "confirmed_usdc": "135200.00",
  "platform_fees_collected_usdc": "14285.00",
  "owed_to_hosts_usdc": "4250.00",
  "total_host_payouts_usdc": "120950.00",
  "security_deposits_held_usdc": "12500.00",
  "active_rentals_count": 8,
  "pending_kyc_reviews_count": 3
}
```

---

## 🏢 PayarMove MVP 2: Property Rentals & Stellar Reconciliation APIs

### 1. Landlord & Tenant Dashboards

#### **Landlord Dashboard Overview**
`GET /api/v1/dashboard/landlord/` (or `/api/v1/dashboard/landlord/summary/`)  
*Permissions*: `HOST`, `LANDLORD`, `ADMIN`  
Returns rent due, collected, outstanding balance, active tenants, collection overview by tenant/unit, overdue obligations, and Stellar reconciliation summary.

#### **Tenant Dashboard Overview**
`GET /api/v1/dashboard/tenant/` (or `/api/v1/dashboard/tenant/summary/`)  
*Permissions*: Authenticated Tenant  
Returns current obligation, monthly rent, outstanding balance, payment schedule, verified transactions, and downloadable receipts.

---

### 2. Properties & Rental Units
- `GET /api/v1/rentals/properties/` - List managed properties
- `POST /api/v1/rentals/properties/` - Create rental property record
- `GET /api/v1/rentals/properties/{id}/units/` - List units in property
- `GET /api/v1/rentals/units/` - List rental units

---

### 3. Tenant Assignments & Rental Schedules
- `POST /api/v1/rentals/assignments/` - Assign tenant to unit with rent amount and frequency
- `GET /api/v1/rentals/schedules/` - List recurring rental schedules
- `POST /api/v1/rentals/schedules/{id}/generate_obligations/` - Generate upcoming recurring obligations

---

### 4. Rent Obligations & Payment Requests
- `GET /api/v1/rentals/obligations/` - List obligations (supports `?status=OVERDUE`, `?is_overdue=true`)
- `POST /api/v1/rentals/obligations/{id}/create_payment_request/` - Generate unique payment request (supports partial payments)
- `GET /api/v1/rentals/payment-requests/{id}/` - Returns Stellar SEP-0007 `stellar_uri` and payment details

---

### 5. Stellar Payment Verification & Reconciliation
- `POST /api/v1/rentals/reconciliations/verify-transaction/`  
  Payload:
  ```json
  {
    "tx_hash": "7c8b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742e11a",
    "obligation_reference": "OBL-2026-XXXXXX"
  }
  ```
  Performs real-time cryptographic verification on Stellar Testnet, updates balances, prevents duplicate operation credits, and generates receipts.
- `GET /api/v1/rentals/reconciliations/unmatched/` - View flagged unmatched / excess transfers
- `POST /api/v1/rentals/reconciliations/resolve-unmatched/` - Assign unmatched payment to obligation
- `POST /api/v1/rentals/reconciliations/sync-wallets/` - Synchronize all registered receiving wallets

---

### 6. Downloadable Payment Receipts & Calculator
- `GET /api/v1/rentals/receipts/` - List verified payment receipts
- `GET /api/v1/rentals/receipts/{id}/download/?format=pdf` - Download official PDF receipt
- `POST /api/v1/rentals/calculator/` - Interactive Rent Payment Calculator (simulates partial payments and overdue statuses)

---

## ⚠️ HTTP Error Codes & Envelopes

All errors return JSON in this standard envelope:
```json
{
  "error": "Short error title or identifier",
  "detail": "Detailed explanation of the issue and resolution advice.",
  "status_code": 400
}
```

| HTTP Code | Description | Typical Cause |
| :---: | :--- | :--- |
| `200` | OK | Successful query or mutation |
| `201` | Created | Resource created (user, vehicle, booking) |
| `400` | Bad Request | Validation error or invalid payload format |
| `401` | Unauthorized | Missing or expired JWT access token |
| `403` | Forbidden | Insufficient permissions or KYC Tier requirement |
| `404` | Not Found | Rental ID or Vehicle ID does not exist |
| `409` | Conflict | Booking time conflict or duplicate wallet registration |
| `500` | Server Error | Internal server or Soroban RPC network error |
