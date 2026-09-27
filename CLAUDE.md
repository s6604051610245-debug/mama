# CLAUDE.md — บันทึกอ้างอิงสำหรับโปรเจกต์ "หม่าลงหม่าล่า"

โปรเจกต์นี้เป็นระบบสั่งอาหารร้านหมาล่าเสียบไม้ ชื่อร้าน **หม่าลงหม่าล่า**
สร้างด้วย Next.js (App Router, JavaScript) เชื่อมต่อฐานข้อมูลผ่าน Supabase
และ deploy บน Vercel

## ⚠️ ข้อควรจำสำคัญ: Dynamic Route params เป็น Promise

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด (Next.js 15+) ซึ่ง `params` (และ `searchParams`)
ใน Dynamic Route ของ App Router **ไม่ใช่ object ธรรมดาอีกต่อไป แต่เป็น Promise**
ดังนั้นเวลาจะสร้างหน้าที่มี dynamic segment (เช่น `/order/[tableId]/page.js`)
**ต้อง unwrap ด้วย `use()` จาก React เสมอ** (ในฝั่ง Client Component)
หรือ `await` โดยตรง (ในฝั่ง Server Component)

ตัวอย่าง Client Component:

```jsx
"use client";
import { use } from "react";

export default function OrderPage({ params }) {
  const { tableId } = use(params);
  // ใช้ tableId ต่อได้เลย
}
```

ตัวอย่าง Server Component (async):

```jsx
export default async function OrderPage({ params }) {
  const { tableId } = await params;
  // ใช้ tableId ต่อได้เลย
}
```

**ห้ามเขียนแบบเดิม** เช่น `export default function Page({ params }) { const { tableId } = params; }`
เพราะ `params` เป็น Promise จะทำให้ code พังหรือ warning ตอน build/runtime
กฎนี้ใช้กับทุกหน้าที่จะสร้างในขั้นตอนถัดไป (เช่น หน้าสั่งอาหารของลูกค้าตามโต๊ะ)

## โครงสร้างฐานข้อมูล (Supabase) — มีอยู่แล้ว ไม่ต้องสร้างใหม่

ตารางเหล่านี้มีอยู่แล้วใน Supabase ของโปรเจกต์นี้ ใช้เป็นข้อมูลอ้างอิงเวลาจะเขียน query
หรือสร้างหน้าใหม่ในขั้นตอนถัดไป **ไม่ต้องรัน SQL สร้างตารางเหล่านี้ซ้ำ**

### `sessions`
| column        | type      | note                          |
|---------------|-----------|-------------------------------|
| id            | -         | primary key                   |
| table_number  | -         | หมายเลขโต๊ะ                   |
| adult_count   | -         | จำนวนผู้ใหญ่                  |
| child_count   | -         | จำนวนเด็ก                     |
| status        | -         | สถานะของ session              |
| created_at    | -         | เวลาสร้าง                     |

### `menu_categories`
| column     | type | note              |
|------------|------|-------------------|
| id         | -    | primary key       |
| name       | -    | ชื่อหมวดหมู่เมนู  |
| sort_order | -    | ลำดับการแสดงผล    |

### `menu_items`
| column      | type | note                              |
|-------------|------|------------------------------------|
| id          | -    | primary key                        |
| category_id | -    | FK ไปยัง `menu_categories.id`      |
| name        | -    | ชื่อเมนู                          |

### `orders`
| column       | type   | note                                   |
|--------------|--------|----------------------------------------|
| id           | -      | primary key                            |
| session_id   | -      | FK ไปยัง `sessions.id`                 |
| table_number | -      | หมายเลขโต๊ะ                            |
| items        | jsonb  | รายการอาหารที่สั่ง (เก็บเป็น JSON)     |
| status       | -      | สถานะออเดอร์                          |
| created_at   | -      | เวลาสร้าง                              |

> หมายเหตุ: ไม่ทราบ type ที่แน่นอนของแต่ละ column จากบทสนทนา — ให้ตรวจสอบ
> ที่ Supabase Table Editor จริงก่อนเขียน query ที่พึ่งพา type เฉพาะเจาะจง
> (เช่น การ cast หรือ validation)

## Environment Variables ที่ต้องตั้งค่า

ตั้งค่าใน `.env.local` (dev) และใน Vercel Project Settings > Environment Variables (production):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

ดูตัวอย่างได้ที่ `.env.local.example`

## Supabase Client

ใช้ `lib/supabaseClient.js` ที่ export `supabase` client ออกมา
import ใช้งานได้เลยแบบนี้:

```js
import { supabase } from "@/lib/supabaseClient";
```

> หมายเหตุ: หากต้องการใช้ path alias `@/` ให้ตรวจสอบว่ามี `jsconfig.json`
> พร้อม `baseUrl` และ `paths` ตั้งค่าไว้ (Next.js สร้างให้อัตโนมัติเมื่อรัน
> `create-next-app` แต่โครงนี้สร้างขึ้นด้วยมือ จึงยังไม่มีไฟล์นี้ —
> ถ้าต้องการใช้ `@/` ให้เพิ่ม `jsconfig.json` เอง หรือ import แบบ relative
> path เช่น `../../lib/supabaseClient` แทนไปก่อน)

## หน้าที่สร้างไว้แล้ว (สำหรับทดสอบ deploy)

- `/` — หน้าแรก แสดงชื่อร้าน + ลิงก์ไป `/generate-qr` และ `/kitchen`
- `/generate-qr` — placeholder
- `/kitchen` — placeholder

หน้าจริงของทั้งสองจุดนี้ รวมถึงหน้าสั่งอาหารตามโต๊ะ (dynamic route) จะสร้างในขั้นตอนถัดไป
