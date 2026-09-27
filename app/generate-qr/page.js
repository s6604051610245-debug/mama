"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const initialForm = { tableNumber: "", adultCount: "", childCount: "" };

function minutesSince(createdAt) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);
  return Math.floor(diffMs / 60000);
}

export default function GenerateQrPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // กล่องเตือน: มี session เปิดค้างอยู่ที่โต๊ะนี้
  const [existingSession, setExistingSession] = useState(null); // { id, table_number, adult_count, child_count, created_at }

  // กล่องยืนยันปิดโต๊ะเดิม
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  // ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ
  const [qrResult, setQrResult] = useState(null); // { tableNumber, adultCount, childCount, url }
  const [copied, setCopied] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetAll() {
    setForm(initialForm);
    setExistingSession(null);
    setShowConfirm(false);
    setQrResult(null);
    setError("");
    setCopied(false);
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setError("");

    const tableNumber = parseInt(form.tableNumber, 10);
    const adultCount = parseInt(form.adultCount, 10) || 0;
    const childCount = parseInt(form.childCount, 10) || 0;

    if (!form.tableNumber || Number.isNaN(tableNumber)) {
      setError("กรุณากรอกเลขโต๊ะให้ถูกต้อง");
      return;
    }

    setLoading(true);
    try {
      // 1) เช็คว่ามี session เปิดอยู่ที่โต๊ะนี้หรือไม่
      const { data: existingRows, error: checkError } = await supabase
        .from("sessions")
        .select("id, table_number, adult_count, child_count, created_at")
        .eq("table_number", tableNumber)
        .eq("status", "open")
        .limit(1);

      if (checkError) throw checkError;

      if (existingRows && existingRows.length > 0) {
        // มี session เปิดค้างอยู่ -> แสดงกล่องเตือนแทนการสร้างใหม่
        setExistingSession(existingRows[0]);
        setLoading(false);
        return;
      }

      // 2) ไม่มี session เปิดอยู่ -> insert แถวใหม่
      const { data: inserted, error: insertError } = await supabase
        .from("sessions")
        .insert({
          table_number: tableNumber,
          adult_count: adultCount,
          child_count: childCount,
          status: "open",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const orderUrl = `${origin}/order/${tableNumber}`;

      setQrResult({
        tableNumber,
        adultCount,
        childCount,
        url: orderUrl,
      });
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาด: " + (err.message || "ไม่ทราบสาเหตุ"));
    } finally {
      setLoading(false);
    }
  }

  function openConfirmDialog() {
    setShowConfirm(true);
  }

  function cancelConfirmDialog() {
    setShowConfirm(false);
  }

  async function confirmCloseOldSession() {
    if (!existingSession) return;
    setClosing(true);
    setError("");
    try {
      // กันกดซ้ำซ้อน: update เฉพาะแถวที่ status ยังเป็น 'open' อยู่จริง
      const { data, error: updateError } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", existingSession.id)
        .eq("status", "open")
        .select();

      if (updateError) throw updateError;

      if (!data || data.length === 0) {
        // แถวนี้ถูกปิดไปแล้วโดยคนอื่น/คลิกอื่นก่อนหน้า
        setError("โต๊ะนี้ถูกปิดไปแล้ว กรุณาลองกด \"เปิดโต๊ะ\" ใหม่อีกครั้ง");
      }

      // ปิดสำเร็จ (หรือถูกปิดไปแล้วก็ตาม) -> เอากล่องเตือนออก กลับไปที่ฟอร์มเดิม
      setShowConfirm(false);
      setExistingSession(null);
    } catch (err) {
      console.error(err);
      setError("ปิดโต๊ะเดิมไม่สำเร็จ: " + (err.message || "ไม่ทราบสาเหตุ"));
    } finally {
      setClosing(false);
    }
  }

  async function handleCopyLink() {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  const qrImageSrc = qrResult
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        qrResult.url
      )}`
    : "";

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>เปิดโต๊ะลูกค้า</h1>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* กล่องเตือน: มี session เปิดค้างอยู่ */}
      {existingSession && !qrResult && (
        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <p style={styles.warningDetail}>
            โต๊ะ {existingSession.table_number} · ผู้ใหญ่ {existingSession.adult_count} · เด็ก{" "}
            {existingSession.child_count}
          </p>
          <button style={styles.dangerButton} onClick={openConfirmDialog}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {/* กล่องยืนยันปิดโต๊ะเดิม */}
      {showConfirm && existingSession && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันปิดโต๊ะเดิม?</h2>
            <p style={styles.confirmLine}>โต๊ะ {existingSession.table_number}</p>
            <p style={styles.confirmLine}>
              ผู้ใหญ่ {existingSession.adult_count} · เด็ก {existingSession.child_count}
            </p>
            <p style={styles.confirmLine}>
              เปิดมาแล้ว {minutesSince(existingSession.created_at)} นาที
            </p>
            <div style={styles.confirmButtonRow}>
              <button style={styles.secondaryButton} onClick={cancelConfirmDialog} disabled={closing}>
                ยกเลิก
              </button>
              <button style={styles.dangerButton} onClick={confirmCloseOldSession} disabled={closing}>
                {closing ? "กำลังปิด..." : "ยืนยันปิดโต๊ะเดิม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ฟอร์มเปิดโต๊ะ */}
      {!qrResult && (
        <form style={styles.form} onSubmit={handleOpenTable}>
          <label style={styles.label}>
            เลขโต๊ะ
            <input
              style={styles.input}
              type="number"
              inputMode="numeric"
              value={form.tableNumber}
              onChange={(e) => handleChange("tableNumber", e.target.value)}
              disabled={!!existingSession}
              required
            />
          </label>

          <label style={styles.label}>
            จำนวนผู้ใหญ่
            <input
              style={styles.input}
              type="number"
              inputMode="numeric"
              min="0"
              value={form.adultCount}
              onChange={(e) => handleChange("adultCount", e.target.value)}
              disabled={!!existingSession}
            />
          </label>

          <label style={styles.label}>
            จำนวนเด็ก
            <input
              style={styles.input}
              type="number"
              inputMode="numeric"
              min="0"
              value={form.childCount}
              onChange={(e) => handleChange("childCount", e.target.value)}
              disabled={!!existingSession}
            />
          </label>

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={loading || !!existingSession}
          >
            {loading ? "กำลังเปิดโต๊ะ..." : "เปิดโต๊ะ"}
          </button>
        </form>
      )}

      {/* ผลลัพธ์ QR */}
      {qrResult && (
        <div style={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImageSrc} alt="QR โต๊ะ" style={styles.qrImage} />
          <p style={styles.qrSummary}>
            โต๊ะ {qrResult.tableNumber} · ผู้ใหญ่ {qrResult.adultCount} · เด็ก {qrResult.childCount}
          </p>
          <div style={styles.linkRow}>
            <span style={styles.linkText}>{qrResult.url}</span>
            <button style={styles.copyButton} onClick={handleCopyLink}>
              {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </button>
          </div>
          <button style={styles.primaryButton} onClick={resetAll}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "2rem 1.5rem",
    fontFamily: "sans-serif",
    maxWidth: "480px",
    margin: "0 auto",
  },
  title: {
    fontSize: "2rem",
    marginBottom: "1.5rem",
    textAlign: "center",
  },
  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "1rem",
    borderRadius: "8px",
    marginBottom: "1rem",
    fontSize: "1.1rem",
  },
  warningBox: {
    background: "#fff7ed",
    border: "3px solid #ea580c",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  warningText: {
    color: "#c2410c",
    fontSize: "1.3rem",
    fontWeight: "bold",
    margin: "0 0 0.75rem 0",
  },
  warningDetail: {
    fontSize: "1.1rem",
    margin: "0 0 1rem 0",
    color: "#7c2d12",
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
    border: "3px solid #dc2626",
    borderRadius: "12px",
    padding: "2rem",
    maxWidth: "360px",
    width: "100%",
  },
  confirmTitle: {
    fontSize: "1.5rem",
    color: "#dc2626",
    marginTop: 0,
    marginBottom: "1rem",
  },
  confirmLine: {
    fontSize: "1.2rem",
    margin: "0.4rem 0",
  },
  confirmButtonRow: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: "1.2rem",
    gap: "0.5rem",
  },
  input: {
    fontSize: "1.5rem",
    padding: "0.75rem",
    borderRadius: "8px",
    border: "2px solid #d1d5db",
  },
  primaryButton: {
    fontSize: "1.4rem",
    padding: "1rem",
    borderRadius: "10px",
    border: "none",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  secondaryButton: {
    flex: 1,
    fontSize: "1.2rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "2px solid #6b7280",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
  },
  dangerButton: {
    flex: 1,
    fontSize: "1.2rem",
    padding: "0.9rem",
    borderRadius: "10px",
    border: "none",
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
  },
  qrBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    textAlign: "center",
  },
  qrImage: {
    width: "260px",
    height: "260px",
  },
  qrSummary: {
    fontSize: "1.3rem",
    fontWeight: "bold",
    margin: 0,
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap",
    justifyContent: "center",
    background: "#f3f4f6",
    borderRadius: "8px",
    padding: "0.75rem",
    width: "100%",
  },
  linkText: {
    fontSize: "0.95rem",
    color: "#374151",
    wordBreak: "break-all",
  },
  copyButton: {
    fontSize: "0.9rem",
    padding: "0.4rem 0.8rem",
    borderRadius: "6px",
    border: "1px solid #9ca3af",
    background: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
