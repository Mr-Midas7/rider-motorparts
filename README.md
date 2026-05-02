# 🏍️ Rider Motorparts — Appointment Scheduling System

A professional, modern web-based motorcycle appointment scheduling system with a parts & accessories showcase, built with vanilla HTML/CSS/JS and Supabase as the backend database. Deployable to Vercel and Netlify.

---

## ✨ Features

- **4-Step Booking Form** — Customer info → Motorcycle → Service → Schedule
- **Service Showcase** — Filter by Repair, Upgrade, Accessories, Maintenance
- **Parts & Products Catalog** — Showcases motorparts with pricing and stock
- **Booking Lookup** — Track appointment status by reference or email
- **Testimonials** — Customer reviews from Supabase
- **Yellow Industrial Theme** — Bold, high-contrast dark design
- **Fully Responsive** — Mobile-first design
- **Supabase Backend** — Real-time data, RLS policies, auto booking refs
- **Deploy-Ready** — Works on Vercel and Netlify out of the box

---

## 🚀 Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a **New Project**
3. Once created, go to **SQL Editor**
4. Paste and run the entire contents of `supabase/schema.sql`
5. Go to **Project Settings → API**
6. Copy your **Project URL** and **anon/public** key

### 2. Configure the App

Open `js/config.js` and replace the placeholder values:

```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
```

### 3. Run Locally

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## 🌐 Deploy to Vercel

1. Push your project to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Under **Environment Variables**, add:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**

> **Note:** The `vercel.json` is already configured for static site deployment.

---

## 🌐 Deploy to Netlify

1. Push your project to GitHub
2. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Under **Build settings**:
   - Build command: *(leave empty)*
   - Publish directory: `.`
4. Under **Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` *(for serverless functions)*
5. Click **Deploy site**

> The `netlify.toml` and `netlify/functions/book-appointment.js` are pre-configured.

---

## 📁 Project Structure

```
rider-motorparts/
├── index.html                          # Main HTML
├── css/
│   └── style.css                       # All styles (CSS variables, responsive)
├── js/
│   ├── config.js                       # Supabase config
│   └── app.js                          # All app logic
├── netlify/
│   └── functions/
│       └── book-appointment.js         # Serverless booking function
├── supabase/
│   └── schema.sql                      # Full DB schema + seed data
├── netlify.toml                        # Netlify deployment config
├── vercel.json                         # Vercel deployment config
├── package.json
└── .env.example                        # Environment variable template
```

---

## 🗄️ Database Tables

| Table | Description |
|-------|-------------|
| `appointments` | Booking records with auto-generated reference codes |
| `services` | Available services (repair, upgrade, accessories, maintenance) |
| `products` | Parts and accessories showcase |
| `testimonials` | Customer reviews |

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary | `#FFD000` (Yellow) |
| Background | `#0A0A0A` (Deep Black) |
| Surface | `#181818` |
| Text | `#F0F0F0` |
| Font Display | Bebas Neue |
| Font Body | Barlow |
| Font Condensed | Barlow Condensed |

---

## 📞 Contact Info (Placeholder)

Update in `index.html` footer:
- Address: 123 Riders Ave., Quezon City, Metro Manila
- Phone: (02) 8888-RIDE
- Email: hello@ridermotorparts.ph
- Hours: Mon–Sat: 8AM–6PM | Sun: 9AM–3PM

---

## 📄 License

MIT — Built for Rider Motorparts 🏍️
