const { useState, useRef, useCallback, useEffect } = React;

// ─── HÀM HỖ TRỢ ──────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return "0";
  return Number(n).toLocaleString("vi-VN");
}

function parseSheet(ws) {
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const students = [];
  let sttCounter = 1;
  for (let r = 4; r < 34; r++) {
    const row = json[r];
    if (!row) continue;
    const name = row[38];
    const sessions = Number(row[39]) || 0;
    const pricePerSession = Number(row[40]) || 0;
    const fee = Number(row[41]) || 0;
    const cls = row[4] || "";
    if (!name || String(name).trim() === "") continue;
    students.push({
      stt: sttCounter++,
      name: String(name).trim(),
      cls: String(cls).trim(),
      sessions, pricePerSession, fee
    });
  }
  return students;
}

// ─── RECEIPT MARKUP ───────────────────────────────────────────────
function ReceiptMarkup({ student, bankInfo, qrCodeUrl, id }) {
  return (
    <div className="receipt" id={id || undefined}>
      <div className="receipt-header">
        <img src="images/logo2.png" alt="Logo" className="receipt-logo"
          onError={(e) => { e.target.style.display = 'none'; }} />
        <div className="receipt-addr">Số điện thoại: 0981.802.098 - Mrs.Trang</div>
        <div className="receipt-title">Thông Báo Học Phí</div>
      </div>
      <div className="receipt-info">
        <div className="info-item">
          <span className="info-label">Tên Học Sinh:</span>
          <span className="info-value">{student.name}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Lớp:</span>
          <span className="info-value">{student.cls || "—"}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Số Buổi Học:</span>
          <span className="info-value">{student.sessions || 0} buổi</span>
        </div>
        <div className="info-item">
          <span className="info-label">Học Phí 1 Buổi:</span>
          <span className="info-value">{fmt(student.pricePerSession)} VND</span>
        </div>
      </div>
      <div className="receipt-total">
        <div><div className="receipt-total-label">Tổng học phí</div></div>
        <div className="receipt-total-value">{fmt(student.fee)} VND</div>
      </div>
      {bankInfo && (
        <div className="receipt-bank">
          <div className="receipt-bank-title">Thông tin thanh toán</div>
          <div className="receipt-bank-row"><span>Ngân hàng</span><span>{bankInfo.bank || "—"}</span></div>
          <div className="receipt-bank-row"><span>Số TK</span><span>{bankInfo.account || "—"}</span></div>
          <div className="receipt-bank-row"><span>Chủ TK</span><span>{bankInfo.owner || "—"}</span></div>
        </div>
      )}
      {qrCodeUrl && (
        <div className="receipt-qr">
          <img src={qrCodeUrl} alt="QR Code" className="receipt-qr-image"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className="receipt-footer"></div>
    </div>
  );
}

// ─── OFF-SCREEN RENDER → CANVAS (tối ưu delay) ───────────────────
// Dùng MutationObserver để biết React render xong, sau đó chờ
// một frame để layout ổn định → nhanh hơn nhiều so với setTimeout cố định.
function renderReceiptToCanvas(student, bankInfo, qrCodeUrl) {
  return new Promise((resolve, reject) => {
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = "position:fixed;left:-9999px;top:0;width:1080px;pointer-events:none;z-index:-1;";
    document.body.appendChild(tempContainer);

    const root = ReactDOM.createRoot(tempContainer);
    root.render(React.createElement(ReceiptMarkup, { student, bankInfo, qrCodeUrl }));

    // Quan sát DOM: khi receipt xuất hiện → capture ngay
    const observer = new MutationObserver(() => {
      const el = tempContainer.querySelector('.receipt');
      if (!el) return;
      observer.disconnect();

      // Đợi 1 frame để CSS render xong, sau đó thêm 80ms cho ảnh QR
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.html2canvas(el, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: "#fff", logging: false
          })
          .then((canvas) => { root.unmount(); document.body.removeChild(tempContainer); resolve(canvas); })
          .catch((err) => { root.unmount(); document.body.removeChild(tempContainer); reject(err); });
        }, 80);
      });
    });

    observer.observe(tempContainer, { childList: true, subtree: true });

    // Fallback nếu observer không kích hoạt sau 3s
    setTimeout(() => {
      observer.disconnect();
      const el = tempContainer.querySelector('.receipt');
      if (el) {
        window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff", logging: false })
          .then((canvas) => { root.unmount(); document.body.removeChild(tempContainer); resolve(canvas); })
          .catch((err) => { root.unmount(); document.body.removeChild(tempContainer); reject(err); });
      } else {
        root.unmount(); document.body.removeChild(tempContainer);
        reject(new Error("Receipt not found"));
      }
    }, 3000);
  });
}

// ─── STAT CARD ────────────────────────────────────────────────────
function StatCard({ icon, iconBg, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── COPY ICON SVG ────────────────────────────────────────────────
function CopyIcon({ state }) {
  if (state === "copied") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  // loading → hidden by CSS spinner, show faint icon
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff77a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── COMPONENT CHÍNH ─────────────────────────────────────────────
function App() {
  const [sheets, setSheets] = useState({});
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [bankInfo] = useState({ bank: "Vietinbank", account: "0981802098", owner: "HOANG THU TRANG" });
  const qrCodeUrl = "images/qr1.png";
  const [paidStudents, setPaidStudents] = useState({});
  const [tab, setTab] = useState("all");
  const [toast, setToast] = useState(null);
  // copyState[key] = "idle" | "loading" | "copied"
  const [copyState, setCopyState] = useState({});

  // Auto-scale modal receipt
  useEffect(() => {
    if (!preview) return;
    const scaleReceipt = () => {
      const container = document.getElementById("receipt-display-container");
      const receipt = document.getElementById("receipt-print");
      if (!container || !receipt) return;
      const receiptWidth = 1080;
      const receiptHeight = receipt.offsetHeight || 1920;
      const availableHeight = window.innerHeight * 0.9 - 140;
      const availableWidth = window.innerWidth * 0.9 - 40;
      const scale = Math.min(availableWidth / receiptWidth, availableHeight / receiptHeight, 1);
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = "top center";
      container.parentElement.style.height = `${receiptHeight * scale}px`;
    };
    setTimeout(scaleReceipt, 50);
    window.addEventListener('resize', scaleReceipt);
    return () => window.removeEventListener('resize', scaleReceipt);
  }, [preview, selected]);

  // Upload file
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const name = wb.SheetNames[0];
      setSheets({ [name]: parseSheet(wb.Sheets[name]) });
      setSheetNames([name]);
      setActiveSheet(name);
      setSelected(null);
      setPaidStudents({});
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, []);

  const handleReset = useCallback(() => {
    setSheets({}); setSheetNames([]); setActiveSheet("");
    setSelected(null); setPreview(false); setPaidStudents({});
  }, []);

  const students = sheets[activeSheet] || [];
  const togglePaid = useCallback((key) => {
    setPaidStudents(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const filteredStudents = students.filter(s => {
    const key = `${s.name}-${s.fee}`;
    const isPaid = paidStudents[key] || false;
    if (tab === "paid") return isPaid;
    if (tab === "unpaid") return !isPaid;
    return true;
  });

  const totalFee = students.reduce((sum, s) => sum + s.fee, 0);
  const paidList = students.filter(s => paidStudents[`${s.name}-${s.fee}`]);
  const unpaidList = students.filter(s => !paidStudents[`${s.name}-${s.fee}`]);
  const collectedFee = paidList.reduce((sum, s) => sum + s.fee, 0);
  const uncollectedFee = unpaidList.reduce((sum, s) => sum + s.fee, 0);

  // Modal: Save
  const saveImage = useCallback(() => {
    const container = document.getElementById("receipt-display-container");
    const el = document.getElementById("receipt-print");
    if (!el || !container) return;
    const orig = container.style.transform;
    container.style.transform = "none";
    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" }).then((canvas) => {
      container.style.transform = orig;
      const link = document.createElement("a");
      link.download = `${selected?.name || "phieu"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }, [selected]);

  // Modal: Copy
  const copyImage = useCallback(() => {
    const container = document.getElementById("receipt-display-container");
    const el = document.getElementById("receipt-print");
    if (!el || !container) return;
    const orig = container.style.transform;
    container.style.transform = "none";
    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" }).then((canvas) => {
      container.style.transform = orig;
      canvas.toBlob((blob) => {
        navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })])
          .then(() => alert("✅ Đã copy ảnh phiếu về clipboard!"))
          .catch(() => alert("⚠️ Browser không hỗ trợ copy ảnh. Thử Download."));
      });
    });
  }, []);

  // Row: Copy 1 phiếu — nhanh hơn nhờ renderReceiptToCanvas được tối ưu
  const copyOneRow = useCallback(async (e, student) => {
    e.stopPropagation();
    const key = `${student.name}-${student.fee}`;
    const cur = copyState[key];
    if (cur === "loading" || cur === "copied") return;

    setCopyState(prev => ({ ...prev, [key]: "loading" }));
    try {
      const canvas = await renderReceiptToCanvas(student, bankInfo, qrCodeUrl);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      setCopyState(prev => ({ ...prev, [key]: "copied" }));
      setTimeout(() => setCopyState(prev => ({ ...prev, [key]: "idle" })), 2000);
    } catch (err) {
      setCopyState(prev => ({ ...prev, [key]: "idle" }));
      alert("⚠️ Không thể copy. Thử mở phiếu và copy từ modal.");
    }
  }, [bankInfo, qrCodeUrl, copyState]);

  // Download tất cả phiếu theo tab
  const downloadAll = useCallback(async () => {
    const list = filteredStudents;
    if (list.length === 0) return;
    setToast({ text: `Đang tạo 0 / ${list.length} phiếu...`, progress: 0 });
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        const canvas = await renderReceiptToCanvas(s, bankInfo, qrCodeUrl);
        const link = document.createElement("a");
        link.download = `${s.name}_${s.cls || "lop"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        await new Promise(r => setTimeout(r, 200));
      } catch (err) { console.warn("Lỗi:", s.name, err); }
      setToast({ text: `Đang tạo phiếu ${i + 1} / ${list.length}...`, progress: ((i + 1) / list.length) * 100 });
    }
    setToast({ text: `✅ Đã download ${list.length} phiếu!`, progress: 100 });
    setTimeout(() => setToast(null), 2000);
  }, [filteredStudents, bankInfo, qrCodeUrl]);

  const tabLabel = { all: "Tất cả", unpaid: "Chưa thu", paid: "Đã thu" };

  const PINK = "rgba(255,119,160,0.12)";
  const GREEN = "rgba(22,163,74,0.1)";
  const RED = "rgba(239,68,68,0.1)";
  const PURPLE = "rgba(139,92,246,0.1)";

  return (
    <>
      <div className="app">
        {/* Header */}
        <div className="header-bar">
          <div className="header-left">
            <div className="header-logo-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="header-title">Quản Lý Học Phí</span>
          </div>
          <div className="header-right">
            {sheetNames.length > 0 && (
              <button className="btn-header-reset" onClick={handleReset}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Làm mới
              </button>
            )}
          </div>
        </div>

        {/* Upload zone */}
        {sheetNames.length === 0 && (
          <div className="upload-section">
            <label className="upload-zone" htmlFor="file-input">
              <div className="upload-icon-wrap">
                <img src="images/excel-icon.png" alt="Excel" style={{ width: 80, height: 48 }}
                  onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerHTML='📊'; }} />
              </div>
              <div className="upload-title">Click để chọn file Excel</div>
              <div className="upload-sub">Hỗ trợ .xlsx, .xls</div>
              <input id="file-input" className="upload-input" type="file" accept=".xlsx,.xls" onChange={handleFile} />
            </label>
          </div>
        )}

        {sheetNames.length > 0 && (
          <label className="file-loaded-bar" htmlFor="file-input2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{sheetNames[0]} – Click để đổi file</span>
            <input id="file-input2" className="upload-input" type="file" accept=".xlsx,.xls" onChange={handleFile} />
          </label>
        )}

        {/* Stat cards */}
        {sheetNames.length > 0 && (
          <>
            <div className="stats-grid">
              <StatCard iconBg={PINK}
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff77a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                label="Tổng cần thu" value={`${fmt(totalFee)} đ`} sub={`${students.length} học sinh`} />
              <StatCard iconBg={GREEN}
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                label="Đã thu được" value={`${fmt(collectedFee)} đ`} sub={`${paidList.length} học sinh`} />
              <StatCard iconBg={RED}
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                label="Chưa thu" value={`${fmt(uncollectedFee)} đ`} sub={`${unpaidList.length} học sinh`} />
              <StatCard iconBg={PURPLE}
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                label="Sĩ số lớp" value={students.length} sub="Học sinh" />
            </div>

            {/* Table */}
            <div className="table-section">
              <div className="table-header-row">
                <div className="table-title">Danh sách học sinh ({filteredStudents.length})</div>
                <div className="table-actions">
                  <div className="tab-group">
                    {["all","unpaid","paid"].map(t => (
                      <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                        {tabLabel[t]}
                      </button>
                    ))}
                  </div>
                  <button className="btn-download-all" onClick={downloadAll} disabled={filteredStudents.length === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download tất cả ({filteredStudents.length})
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th className="center">STT</th>
                      <th>TRẠNG THÁI</th>
                      <th>HỌ VÀ TÊN</th>
                      <th className="center">SỐ BUỔI</th>
                      <th className="right">HỌC PHÍ / BUỔI</th>
                      <th className="right">TỔNG HỌC PHÍ</th>
                      <th className="center">COPY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr><td colSpan="6" className="empty-row">Không có học sinh nào</td></tr>
                    ) : filteredStudents.map((s, i) => {
                      const key = `${s.name}-${s.fee}`;
                      const isPaid = paidStudents[key] || false;
                      const cs = copyState[key] || "idle";
                      return (
                        <tr key={i} className="student-row" onClick={() => { setSelected(s); setPreview(true); }}>
                          <td className="center stt-cell">{i + 1}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <button className={`status-badge ${isPaid ? "paid" : "unpaid"}`} onClick={() => togglePaid(key)}>
                              <span className="status-dot"></span>
                              {isPaid ? "Đã thu" : "Chưa thu"}
                            </button>
                          </td>
                          <td className="name-cell">{s.name}</td>
                          <td className="center">{s.sessions}</td>
                          <td className="right price-cell">{fmt(s.pricePerSession)} đ</td>
                          <td className="right total-cell">{fmt(s.fee)} đ</td>
                          <td className="center" onClick={e => e.stopPropagation()}>
                            <button
                              className={`copy-btn ${cs === "loading" ? "loading" : cs === "copied" ? "copied" : ""}`}
                              onClick={(e) => copyOneRow(e, s)}
                              title={cs === "loading" ? "Đang xử lý..." : cs === "copied" ? "Đã copy!" : "Copy ảnh phiếu"}
                            >
                              {cs !== "loading" && <CopyIcon state={cs} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal preview */}
      {preview && selected && (
        <div className="modal-overlay" onClick={() => setPreview(false)}>
          <div className="modal-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Phiếu thông báo học phí – {selected.name}</h3>
              <button className="modal-close" onClick={() => setPreview(false)}>×</button>
            </div>
            <div style={{ background: "#fff8fb", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "flex-start", maxHeight: "calc(90vh - 140px)" }}>
              <div className="receipt-display-wrapper" id="receipt-display-container">
                <ReceiptMarkup student={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl} id="receipt-print" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-dark" onClick={copyImage}>📋 Copy</button>
              <button className="btn-dark" onClick={saveImage}>⬇️ Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-progress">
          <span>{toast.text}</span>
          {toast.progress < 100 && (
            <div className="toast-bar-wrap">
              <div className="toast-bar" style={{ width: `${toast.progress}%` }}></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);