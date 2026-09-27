"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { supabase } from "../../../lib/supabaseClient";

const BILL_PRICE_ADULT = 289;
const BILL_PRICE_CHILD = 145;
const MAX_CART_LINES = 10;
const MAX_QTY_PER_ADD = 5;

export default function OrderPage({ params }) {
  // ⚠️ Next.js เวอร์ชันนี้ params เป็น Promise เสมอ ต้อง unwrap ด้วย use()
  const { tableNumber } = use(params);

  // --- สถานะการเช็ค session ---
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null); // { id, table_number, adult_count, child_count }
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false); // ปิดโต๊ะแล้ว (เรียกเก็บเงินสำเร็จ)

  // --- เมนู ---
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  // --- ตะกร้า ---
  const [cart, setCart] = useState([]); // [{ name, quantity }]
  const [qtyPicker, setQtyPicker] = useState({}); // { [itemName]: 1..5 } ค่าที่เลือกไว้ก่อนกด +
  const [submitting, setSubmitting] = useState(false);
  const [orderSentMessage, setOrderSentMessage] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  // --- เรียกเก็บเงิน ---
  const [showBillConfirm, setShowBillConfirm] = useState(false);
  const [billing, setBilling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 1) เช็ค session เปิดของโต๊ะนี้
  useEffect(() => {
    async function checkSession() {
      setCheckingSession(true);
      setSessionNotFound(false);
      try {
        const tableNum = Number(tableNumber);
        const { data, error } = await supabase
          .from("sessions")
          .select("id, table_number, adult_count, child_count, status")
          .eq("table_number", tableNum)
          .eq("status", "open")
          .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
          setSessionNotFound(true);
          setSession(null);
        } else {
          setSession(data[0]);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("เกิดข้อผิดพลาดในการเช็คโต๊ะ: " + (err.message || ""));
        setSessionNotFound(true);
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [tableNumber]);

  // 2) ดึงเมนู (เฉพาะตอนมี session เปิดอยู่)
  useEffect(() => {
    if (!session) return;

    async function loadMenu() {
      setMenuLoading(true);
      setMenuError("");
      try {
        const { data: cats, error: catError } = await supabase
          .from("menu_categories")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true });

        if (catError) throw catError;

        const { data: items, error: itemError } = await supabase
          .from("menu_items")
          .select("id, category_id, name");

        if (itemError) throw itemError;

        const grouped = {};
        (items || []).forEach((item) => {
          if (!grouped[item.category_id]) grouped[item.category_id] = [];
          grouped[item.category_id].push(item);
        });

        setCategories(cats || []);
        setItemsByCategory(grouped);
        if (cats && cats.length > 0) {
          setActiveCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error(err);
        setMenuError("โหลดเมนูไม่สำเร็จ: " + (err.message || ""));
      } finally {
        setMenuLoading(false);
      }
    }

    loadMenu();
  }, [session]);

  function getQty(itemName) {
    return qtyPicker[itemName] || 1;
  }

  function setQty(itemName, qty) {
    setQtyPicker((prev) => ({ ...prev, [itemName]: qty }));
  }

  function addToCart(itemName) {
    if (cart.length >= MAX_CART_LINES) {
      setErrorMsg(`ตะกร้าเต็มแล้ว (สูงสุด ${MAX_CART_LINES} รายการต่อการสั่ง 1 ครั้ง) กรุณาส่งออเดอร์ก่อน`);
      return;
    }
    const quantity = getQty(itemName);
    setCart((prev) => [...prev, { name: itemName, quantity }]);
    setErrorMsg("");
  }

  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  const cartTotalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);

  async function handleSubmitOrder() {
    if (!session || cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.from("orders").insert({
        session_id: session.id,
        table_number: Number(tableNumber),
        items: cart,
        status: "received",
      });

      if (error) throw error;

      setCart([]);
      setCartOpen(false);
      setOrderSentMessage("ส่งออเดอร์แล้ว");
      setTimeout(() => setOrderSentMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg("ส่งออเดอร์ไม่สำเร็จ: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmBill() {
    if (!session) return;
    setBilling(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", session.id)
        .eq("status", "open");

      if (error) throw error;

      setShowBillConfirm(false);
      setSessionClosed(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("ปิดโต๊ะไม่สำเร็จ: " + (err.message || ""));
      setBilling(false);
      return;
    }
    setBilling(false);
  }

  // ----- หน้าจอ: กำลังเช็ค session -----
  if (checkingSession) {
    return (
      <main style={styles.fullscreenCenter}>
        <p style={styles.bigText}>กำลังตรวจสอบโต๊ะ...</p>
      </main>
    );
  }

  // ----- หน้าจอ: ไม่เจอ session เปิดอยู่ -----
  if (sessionNotFound) {
    return (
      <main style={styles.fullscreenCenter}>
        <p style={{ ...styles.bigText, color: "#b91c1c" }}>
          โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน
        </p>
      </main>
    );
  }

  // ----- หน้าจอ: ปิดโต๊ะแล้ว (จ่ายเงินเสร็จ) -----
  if (sessionClosed) {
    return (
      <main style={styles.fullscreenCenter}>
        <p style={{ ...styles.bigText, color: "#15803d" }}>ขอบคุณที่ใช้บริการ</p>
      </main>
    );
  }

  const billTotal =
    (session?.adult_count || 0) * BILL_PRICE_ADULT + (session?.child_count || 0) * BILL_PRICE_CHILD;

  return (
    <main style={styles.page}>
      {/* หัวหน้า: เลขโต๊ะ + ปุ่มเรียกเก็บเงิน */}
      <header style={styles.header}>
        <span style={styles.tableBadge}>โต๊ะ {tableNumber}</span>
        <button style={styles.billButton} onClick={() => setShowBillConfirm(true)}>
          เรียกเก็บเงิน
        </button>
      </header>

      {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}
      {orderSentMessage && <div style={styles.successBanner}>{orderSentMessage}</div>}

      {/* แท็บหมวดหมู่ */}
      {menuLoading && <p style={styles.infoText}>กำลังโหลดเมนู...</p>}
      {menuError && <p style={{ ...styles.infoText, color: "#b91c1c" }}>{menuError}</p>}

      {!menuLoading && categories.length > 0 && (
        <>
          <div style={styles.tabRow}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                style={{
                  ...styles.tabButton,
                  ...(activeCategoryId === cat.id ? styles.tabButtonActive : {}),
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* รายการเมนูของหมวดที่เลือก */}
          <div style={styles.menuList}>
            {(itemsByCategory[activeCategoryId] || []).map((item) => (
              <div key={item.id} style={styles.menuItemRow}>
                <span style={styles.menuItemName}>{item.name}</span>
                <div style={styles.menuItemControls}>
                  <select
                    style={styles.qtySelect}
                    value={getQty(item.name)}
                    onChange={(e) => setQty(item.name, parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: MAX_QTY_PER_ADD }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button style={styles.addButton} onClick={() => addToCart(item.name)}>
                    +
                  </button>
                </div>
              </div>
            ))}
            {(itemsByCategory[activeCategoryId] || []).length === 0 && (
              <p style={styles.infoText}>ไม่มีเมนูในหมวดนี้</p>
            )}
          </div>
        </>
      )}

      {/* เว้นที่ด้านล่างไม่ให้เนื้อหาโดนตะกร้าลอยบัง */}
      <div style={{ height: "120px" }} />

      {/* ตะกร้าลอย */}
      {cart.length > 0 && (
        <div style={styles.floatingCartWrap}>
          {cartOpen && (
            <div style={styles.cartPanel}>
              {cart.map((line, index) => (
                <div key={index} style={styles.cartLine}>
                  <span>
                    {line.name} × {line.quantity}
                  </span>
                  <button style={styles.removeLineButton} onClick={() => removeFromCart(index)}>
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={styles.floatingCartBar}>
            <button style={styles.cartToggleButton} onClick={() => setCartOpen((v) => !v)}>
              ตะกร้า ({cart.length} รายการ / {cartTotalQuantity} ชิ้น)
            </button>
            <button
              style={styles.submitOrderButton}
              onClick={handleSubmitOrder}
              disabled={submitting}
            >
              {submitting ? "กำลังส่ง..." : "ส่งออเดอร์"}
            </button>
          </div>
        </div>
      )}

      {/* กล่องยืนยันเรียกเก็บเงิน */}
      {showBillConfirm && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันเรียกเก็บเงิน</h2>
            <p style={styles.confirmLine}>
              ผู้ใหญ่ {session?.adult_count || 0} × {BILL_PRICE_ADULT} บาท
            </p>
            <p style={styles.confirmLine}>
              เด็ก {session?.child_count || 0} × {BILL_PRICE_CHILD} บาท
            </p>
            <p style={styles.totalLine}>ยอดที่ต้องจ่าย: {billTotal.toLocaleString()} บาท</p>
            <div style={styles.confirmButtonRow}>
              <button
                style={styles.secondaryButton}
                onClick={() => setShowBillConfirm(false)}
                disabled={billing}
              >
                ยกเลิก
              </button>
              <button style={styles.dangerButton} onClick={handleConfirmBill} disabled={billing}>
                {billing ? "กำลังปิด..." : "ยืนยันเรียกเก็บเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles = {
  fullscreenCenter: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    textAlign: "center",
    fontFamily: "sans-serif",
  },
  bigText: {
    fontSize: "1.6rem",
    fontWeight: "bold",
  },
  page: {
    minHeight: "100vh",
    fontFamily: "sans-serif",
    maxWidth: "520px",
    margin: "0 auto",
    padding: "0 1rem",
    paddingTop: "1rem",
  },
  header: {
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 0",
    borderBottom: "2px solid #f3f4f6",
  },
  tableBadge: {
    fontSize: "1.4rem",
    fontWeight: "bold",
  },
  billButton: {
    fontSize: "1.1rem",
    padding: "0.6rem 1rem",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
  },
  errorBanner: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "0.9rem",
    borderRadius: "8px",
    margin: "0.75rem 0",
    fontSize: "1.05rem",
  },
  successBanner: {
    background: "#dcfce7",
    color: "#166534",
    padding: "0.9rem",
    borderRadius: "8px",
    margin: "0.75rem 0",
    fontSize: "1.1rem",
    fontWeight: "bold",
    textAlign: "center",
  },
  infoText: {
    fontSize: "1.1rem",
    color: "#6b7280",
    padding: "1rem 0",
  },
  tabRow: {
    display: "flex",
    gap: "0.5rem",
    overflowX: "auto",
    padding: "0.75rem 0",
    borderBottom: "2px solid #f3f4f6",
  },
  tabButton: {
    flexShrink: 0,
    fontSize: "1.1rem",
    padding: "0.6rem 1rem",
    borderRadius: "999px",
    border: "2px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  },
  tabButtonActive: {
    background: "#b91c1c",
    borderColor: "#b91c1c",
    color: "#fff",
    fontWeight: "bold",
  },
  menuList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    padding: "1rem 0",
  },
  menuItemRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  menuItemName: {
    fontSize: "1.2rem",
    flex: 1,
  },
  menuItemControls: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  qtySelect: {
    fontSize: "1.1rem",
    padding: "0.5rem",
    borderRadius: "8px",
    border: "2px solid #d1d5db",
  },
  addButton: {
    fontSize: "1.4rem",
    width: "3rem",
    height: "3rem",
    borderRadius: "10px",
    border: "none",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    lineHeight: 1,
  },
  floatingCartWrap: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  cartPanel: {
    width: "100%",
    maxWidth: "520px",
    background: "#fff",
    borderTop: "2px solid #e5e7eb",
    maxHeight: "40vh",
    overflowY: "auto",
    padding: "0.75rem 1rem",
  },
  cartLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "1.05rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid #f3f4f6",
  },
  removeLineButton: {
    fontSize: "0.95rem",
    color: "#b91c1c",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0.25rem 0.5rem",
  },
  floatingCartBar: {
    width: "100%",
    maxWidth: "520px",
    display: "flex",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    background: "#111827",
  },
  cartToggleButton: {
    flex: 1,
    fontSize: "1.05rem",
    padding: "1rem 0.5rem",
    borderRadius: "10px",
    border: "none",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  submitOrderButton: {
    flex: 1,
    fontSize: "1.1rem",
    padding: "1rem 0.5rem",
    borderRadius: "10px",
    border: "none",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    zIndex: 50,
  },
  confirmBox: {
    background: "#fff",
    border: "3px solid #111827",
    borderRadius: "12px",
    padding: "2rem",
    maxWidth: "360px",
    width: "100%",
  },
  confirmTitle: {
    fontSize: "1.5rem",
    marginTop: 0,
    marginBottom: "1rem",
  },
  confirmLine: {
    fontSize: "1.15rem",
    margin: "0.4rem 0",
  },
  totalLine: {
    fontSize: "1.4rem",
    fontWeight: "bold",
    marginTop: "1rem",
    color: "#b91c1c",
  },
  confirmButtonRow: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
  secondaryButton: {
    flex: 1,
    fontSize: "1.1rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "2px solid #6b7280",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  },
  dangerButton: {
    flex: 1,
    fontSize: "1.1rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
  },
};
