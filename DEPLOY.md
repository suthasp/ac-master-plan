# Deploy Guide: AC Master Plan → Vercel + Supabase

## Step 1 — Supabase Setup

1. เปิด [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. เลือก project ของคุณ → **SQL Editor**
3. Copy เนื้อหาจากไฟล์ `supabase_schema.sql` แล้ว **Run**
4. ไปที่ **Authentication → Users** → สร้าง user สำหรับ login:
   - คลิก "Add user" → ใส่ email + password
5. ไปที่ **Settings → API** → Copy:
   - `Project URL` → เป็น `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → เป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 2 — Local Test (optional)

```bash
cd ac-master-plan
cp .env.local.example .env.local
# แก้ไข .env.local ใส่ค่า Supabase จาก Step 1

npm install
npm run dev
# เปิด http://localhost:3000
```

---

## Step 3 — Push to GitHub

```bash
cd ac-master-plan
git init
git add .
git commit -m "Initial AC Master Plan app"

# สร้าง repo ใน GitHub แล้ว push
git remote add origin https://github.com/YOUR_USERNAME/ac-master-plan.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Deploy on Vercel

1. เปิด [https://vercel.com/new](https://vercel.com/new)
2. **Import** repo `ac-master-plan` จาก GitHub
3. Framework: **Next.js** (detected automatically)
4. Root Directory: `ac-master-plan` (ถ้า repo มี folder นี้) หรือ `.` ถ้า root
5. ไปที่ **Environment Variables** → เพิ่ม 2 ค่า:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` |

6. คลิก **Deploy** → รอ ~2 นาที

---

## Step 5 — Supabase Auth Redirect URL

หลัง deploy เสร็จ ไปที่ Supabase:

1. **Authentication → URL Configuration**
2. เพิ่ม Site URL: `https://your-app.vercel.app`
3. เพิ่ม Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## Cell Status Guide

| Click | Status | Color |
|-------|--------|-------|
| 1st   | P (Planned)  | ⬜ White |
| 2nd   | F (Finished) | 🟩 Green |
| 3rd   | D (Delayed)  | 🟥 Red   |
| 4th   | (empty) clear | ⬛ Black |

คลิก cell ใน week column เพื่อ cycle สถานะ ข้อมูลจะ save ไป Supabase อัตโนมัติ

---

## File Structure

```
ac-master-plan/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Redirect → /dashboard
│   │   ├── globals.css         # AG Grid + custom styles
│   │   ├── login/page.tsx      # Login page
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Server component (auth check)
│   │   │   └── DashboardClient.tsx
│   │   └── api/
│   │       ├── auth/callback/route.ts
│   │       ├── sites/route.ts  # CRUD sites
│   │       └── entries/route.ts # CRUD plan entries
│   ├── components/
│   │   └── PlanGrid.tsx        # Main AG Grid component
│   ├── lib/supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client
│   │   └── middleware.ts       # Auth middleware
│   └── middleware.ts           # Next.js middleware (protect routes)
├── supabase_schema.sql         # Run this in Supabase SQL Editor
├── .env.local.example          # Copy to .env.local
└── package.json
```
