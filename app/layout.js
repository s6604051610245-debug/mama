export const metadata = {
  title: "หม่าลงหม่าล่า",
  description: "ระบบสั่งอาหารร้านหมาล่าเสียบไม้ หม่าลงหม่าล่า",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
