"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const ACTIVE_STATUSES = ["received", "cooking"];

function formatTime(createdAt) {
  try {
    return new Date(createdAt).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const busyIdsRef = useRef(new Set()); // กันกดปุ่มซ้ำระหว่างรอ update

  // 1) โหลดออเดอร์ตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setErrorMsg("");
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, session_id, table_number, items, status, created_at")
          .in("status", ACTIVE_STATUSES)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error(err);
        setErrorMsg("โหลดออเดอร์ไม่สำเร็จ: " + (err.message || ""));
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  // 2) Subscribe Supabase Realtime ฟัง INSERT / UPDATE บนตาราง orders
  useEffect(() => {
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new;
          if (!ACTIVE_STATUSES.includes(newOrder.status)) return;
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [...prev, newOrder];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new;
          setOrders((prev) => {
            if (!ACTIVE_STATUSES.includes(updated.status)) {
              // เช่นเปลี่ยนเป็น 'served' -> เอาการ์ดออกจากจอ
              return prev.filter((o) => o.id !== updated.id);
            }
            const exists = prev.some((o) => o.id === updated.id);
            if (!exists) {
              return [...prev, updated];
            }
            return prev.map((o) => (o.id === updated.id ? updated : o));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStatus(orderId, newStatus) {
    if (busyIdsRef.current.has(orderId)) return;
    busyIdsRef.current.add(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      if (newStatus === "served") {
        // เอาการ์ดออกจากจอทันที ไม่ต้องรอ realtime event
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("อัปเดตสถานะไม่สำเร็จ: " + (err.message || ""));
    } finally {
      busyIdsRef.current.delete(orderId);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>จอครัว</h1>
        <span style={styles.countBadge}>{orders.length} ออเดอร์</span>
      </header>

      {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

      {loading && <p style={styles.infoText}>กำลังโหลดออเดอร์...</p>}

      {!loading && orders.length === 0 && (
        <p style={styles.infoText}>ยังไม่มีออเดอร์ค้างอยู่</p>
      )}

      <div style={styles.grid}>
        {orders.map((order) => {
          const isCooking = order.status === "cooking";
          const items = Array.isArray(order.items) ? order.items : [];

          return (
            <div
              key={order.id}
              style={{
                ...styles.card,
                ...(isCooking ? styles.cardCooking : styles.cardReceived),
              }}
            >
              <div style={styles.cardTop}>
                <span style={styles.tableNumber}>โต๊ะ {order.table_number}</span>
                <span style={styles.orderTime}>{formatTime(order.created_at)}</span>
              </div>

              <ul style={styles.itemList}>
                {items.map((line, idx) => (
                  <li key={idx} style={styles.itemLine}>
                    {line.name} × {line.quantity}
                  </li>
                ))}
              </ul>

              <div style={styles.cardButtons}>
                {order.status === "received" && (
                  <button
                    style={styles.startButton}
                    onClick={() => updateStatus(order.id, "cooking")}
                  >
                    เริ่มทำ
                  </button>
                )}
                <button
                  style={styles.serveButton}
                  onClick={() => updateStatus(order.id, "served")}
                >
                  จัดเสิร์ฟแล้ว
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    fontFamily: "sans-serif",
    padding: "1.5rem",
    background: "#f3f4f6",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "2.2rem",
    margin: 0,
  },
  countBadge: {
    fontSize: "1.4rem",
    fontWeight: "bold",
    background: "#111827",
    color: "#fff",
    borderRadius: "999px",
    padding: "0.5rem 1.25rem",
  },
  errorBanner: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "1rem",
    borderRadius: "8px",
    marginBottom: "1rem",
    fontSize: "1.2rem",
  },
  infoText: {
    fontSize: "1.4rem",
    color: "#6b7280",
    textAlign: "center",
    padding: "2rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1.25rem",
  },
  card: {
    borderRadius: "16px",
    padding: "1.25rem",
    border: "4px solid transparent",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  cardReceived: {
    background: "#ffffff",
    borderColor: "#d1d5db",
  },
  cardCooking: {
    background: "#fef3c7",
    borderColor: "#f59e0b",
  },
  cardTop: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  tableNumber: {
    fontSize: "2.2rem",
    fontWeight: "bold",
  },
  orderTime: {
    fontSize: "1.2rem",
    color: "#4b5563",
  },
  itemList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  itemLine: {
    fontSize: "1.4rem",
  },
  cardButtons: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  startButton: {
    flex: 1,
    fontSize: "1.2rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "none",
    background: "#f59e0b",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
  serveButton: {
    flex: 1,
    fontSize: "1.2rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
