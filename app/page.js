import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>หม่าลงหม่าล่า</h1>
      <p style={{ color: "#666" }}>ระบบสั่งอาหารร้านหมาล่าเสียบไม้</p>

      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/generate-qr"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            background: "#b91c1c",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          สร้าง QR โต๊ะ
        </Link>
        <Link
          href="/kitchen"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            background: "#111827",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          หน้าครัว
        </Link>
      </div>
    </main>
  );
}
