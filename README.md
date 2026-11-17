# CEO Power Company — Reseller Portal

A private, login-only B2B wholesale ordering portal for authorized resellers of **CEO Power Company** (est. 2014, Head Office: 20 Oguta Road, Onitsha, Anambra State, Nigeria; Tagline: *"Power Without Limits"*; Main site: [ceopowercompany.org](https://ceopowercompany.org)).

Resellers log in, browse solar products at wholesale trade prices, add items to a cart, and dispatch verified purchase orders directly to CEO Power Company sales desk via WhatsApp (+2347066449882). There is no online payment and no public registration: only the administrator creates reseller accounts.

---

## 🛠 Tech Stack

- **Frontend**: React 18/19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Routing**: React Router v6 (`BrowserRouter`)
- **State & Data**: TanStack Query, Zustand (persisted per user in `localStorage`)
- **Forms & Validation**: `react-hook-form` + `zod`
- **Media Optimization**: `browser-image-compression` (WebP max 1600px, 5MB limit)
- **Backend / Database**: Supabase (PostgreSQL, Auth, Storage bucket `product-images`, Row Level Security, Edge Functions)
- **Deployment**: Static SPA deployable to Vercel, Netlify, or Cloudflare Pages with zero 404 routing errors.

---

## 🚀 Supabase Setup Guide

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon / public key** from `Project Settings` > `API`.
3. Note your **service_role key** (keep secret; only used by Edge Functions).

### 2. Apply Database Schema & Migrations
1. Open the Supabase **SQL Editor** in your dashboard.
2. Open `supabase/migrations/20240101000000_init_schema.sql` and run the entire script. This creates:
   - `profiles` table with role checking (`admin` or `reseller`) and status (`active` or `suspended`)
   - `categories` table with sort order
   - `products` table with specs JSONB, MOQ, and stock status
   - `order_requests` table with automatic `CEO-YYMM-0001` sequential reference numbers
   - `settings` table
   - Row Level Security (RLS) policies on all tables
   - `product-images` storage bucket with public read and admin write permissions

### 3. Seed Initial Data & Seed the Admin Account
1. In the Supabase SQL Editor, run `supabase/seed.sql`.
2. This seeds:
   - Official company settings and default WhatsApp number (`2347066449882`)
   - 5 core product categories (Solar Panels, Inverters, Lithium Batteries, Charge Controllers, Solar Accessories)
   - Real Tier-1 solar equipment (ZN Shine, LONGi, Tongwei, Deye, Felicity, Sunsynk, Growatt, Pylontech, SRNE, Staubli, etc.)
   - One Administrator profile with username `xtrimdesign` and password `Le123456789`.

### 4. Configure Supabase Authentication
1. Go to **Authentication** > **Providers** > **Email**:
   - Ensure Email provider is enabled.
   - **DISABLE** "Allow new users to sign up" (public self-registration must be off; only the admin creates reseller accounts).
   - Disable email confirmations or set auto-confirm since portal usernames are mapped to internal emails `<username>@portal.ceopower.local`.
2. Go to **Authentication** > **URL Configuration**:
   - Set **Site URL** to your production domain (e.g., `https://resellers.ceopowercompany.org` or your Vercel/Netlify app URL).
   - Add your domains to **Redirect URLs**.

### 5. Deploy the Admin Edge Function
The `admin-users` Edge Function safely creates, edits, suspends, and resets reseller accounts using the Supabase Service Role key without exposing it to the client:
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to your account
supabase login

# Link your project
supabase link --project-ref your-supabase-project-id

# Deploy the function
supabase functions deploy admin-users
```

---

## 💻 Local Development

1. Clone or download the repository.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Populate your `.env` file:
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ADMIN_USERNAME="xtrimdesign"
   ADMIN_PASSWORD="Le123456789"
   ```
   *(Note: If Supabase credentials are left empty or during local offline testing, the portal automatically activates a high-fidelity local database engine stored in `localStorage` with seeded products and credentials so you can test end-to-end immediately).*
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run unit tests for core logic:
   ```bash
   npx tsx --test src/tests/portalLogic.test.ts
   ```
6. Start dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

---

## 🔑 Default Accounts (Seed)

| Role | Username | Password | Notes |
|---|---|---|---|
| **Admin** | `xtrimdesign` | `Le123456789` | Full access to products, prices, stock, categories, resellers, settings |
| **Reseller** | `solarplus_onitsha` | `Partner2024!` | Trade catalog, wholesale prices, cart, WhatsApp dispatch |

---

## 🚢 Production Deployment

### Deploying to Vercel
1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New** > **Project** and import this repository.
3. In **Build & Output Settings**, Vite defaults are pre-configured:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. The included `vercel.json` provides SPA routing rewrites to ensure hard refreshing any route (`/catalog`, `/cart`, `/admin/products`) resolves without 404s.

### Deploying to Netlify
1. In the [Netlify Dashboard](https://app.netlify.com), click **Add new site** > **Import an existing project**.
2. Netlify will detect `netlify.toml` with:
   - Build Command: `npm run build`
   - Publish directory: `dist`
   - Redirect rule: `/* -> /index.html 200`
3. In **Site Settings** > **Environment variables**, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy the site.

---

## 📱 WhatsApp Order Message Format

When a reseller confirms their cart, the portal verifies live catalog prices and stock against the database, records a database row in `order_requests`, and launches WhatsApp with the verified format:

```
NEW RESELLER ORDER - CEO-2611-0001
Reseller: Emeka Okafor (SolarPlus Systems Nig. Ltd)
Phone: 08031234567 | Onitsha, Anambra

1. ZN Shine 600W Solar Panel
   Qty: 10 x ₦155,000 = ₦1,550,000
2. Deye 5kVA Hybrid Inverter 48V
   Qty: 2 x ₦1,250,000 = ₦2,500,000

TOTAL: ₦4,050,000
Note: Urgent installation project at GRA Onitsha.
Sent from CEO Power Reseller Portal
```

---

## 🏢 Contact & Support

**CEO Power Company**  
Head Office: 20 Oguta Road, Onitsha, Anambra State, Nigeria  
WhatsApp Order Desk: +234 706 644 9882  
Email: info@ceopowercompany.org  
Website: [ceopowercompany.org](https://ceopowercompany.org)
