# หม่าลงหม่าล่า

ระบบสั่งอาหารร้านหมาล่าเสียบไม้ สร้างด้วย Next.js (App Router, JavaScript)
เชื่อมต่อฐานข้อมูลผ่าน Supabase และ deploy บน Vercel

> ดูบันทึกอ้างอิงเกี่ยวกับโครงสร้างฐานข้อมูลและข้อควรระวังเรื่อง
> Dynamic Route `params` ที่เป็น Promise ได้ที่ [`CLAUDE.md`](./CLAUDE.md)

## เริ่มต้นใช้งาน (Local Development)

1. ติดตั้ง dependencies:

   ```bash
   npm install
   ```

2. คัดลอกไฟล์ env ตัวอย่างแล้วใส่ค่าจริงจาก Supabase:

   ```bash
   cp .env.local.example .env.local
   ```

   แล้วเปิด `.env.local` ใส่ค่า:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
   ```

3. รัน dev server:

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000)

## Deploy บน Vercel

1. Push โปรเจกต์ขึ้น GitHub
2. Import repo เข้า Vercel
3. ตั้งค่า Environment Variables ใน Vercel Project Settings ให้ตรงกับ `.env.local`
4. Deploy — Vercel จะรัน `npm run build` และ `npm run start` ให้อัตโนมัติ

## โครงสร้างไฟล์หลัก

```
app/
  layout.js
  page.js              → หน้าแรก
  generate-qr/page.js  → placeholder
  kitchen/page.js      → placeholder
lib/
  supabaseClient.js    → Supabase client
next.config.js
.gitignore
.env.local.example
CLAUDE.md              → บันทึกอ้างอิงฐานข้อมูล + ข้อควรระวัง Next.js
```
