import axios from "axios";
import * as XLSX from "xlsx";

export default async function handler(req, res) {
  const authKey = req.headers["x-auth-key"];
  if (authKey !== "CSBearing") {
    return res.status(401).json({ error: "Mật mã không đúng." });
  }

  let sourceUrl = process.env.NCR_XLSX_URL ? process.env.NCR_XLSX_URL.trim() : null;
  
  if (!sourceUrl) {
    return res.status(500).json({ error: "Thiếu biến NCR_XLSX_URL trên Vercel." });
  }

  try {
    const fileId = extractId(sourceUrl);
    if (!fileId) {
      return res.status(400).json({ error: "Không tìm thấy ID trong Link Google Drive." });
    }

    // TẠO LINK TẢI CHO GOOGLE SHEETS (Dùng export?format=xlsx)
    // Đây là cách tốt nhất cho link bạn vừa gửi
    const downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
    
    console.log("Đang tải dữ liệu từ ID:", fileId);

    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const workbook = XLSX.read(response.data, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    return res.status(200).json({
      sheetName,
      rowCount: rows.length,
      refreshedAt: new Date().toISOString(),
      rows
    });
  } catch (error) {
    const status = error.response ? error.response.status : "Unknown";
    return res.status(500).json({ 
      error: `Lỗi ${status}: Không thể đọc file. Hãy đảm bảo file đã được Share 'Bất kỳ ai có liên kết'.` 
    });
  }
}

function extractId(url) {
  // Bóc tách ID từ cả link drive.google.com và docs.google.com
  const match = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
}
