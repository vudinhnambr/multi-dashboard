// ============================================================
//  CẤU HÌNH NGUỒN DỮ LIỆU
//  File của bạn là Google SHEETS (link dạng /spreadsheets/d/...).
//  Dashboard tải về bản .xlsx qua endpoint export chính thức của
//  Google Sheets — ổn định hơn link Drive và không dính trang
//  xác nhận virus.
//
//  Đổi nguồn: chỉ cần thay GSHEET_ID bên dưới.
//  Lấy ID từ link: .../spreadsheets/d/<GSHEET_ID>/edit...
//  Sheet phải được share "Anyone with the link -> Viewer".
// ============================================================

export const GSHEET_ID = '19S8uVe6yPyWz_R_jvtImqkiXZvKmy2iC';

// Endpoint export .xlsx của Google Sheets.
export const dataUrl = () =>
  `https://docs.google.com/spreadsheets/d/${GSHEET_ID}/export?format=xlsx`;

// Tên sheet chứa raw data trong file.
export const SHEET_NAME = 'Raw_Data';

// true = dùng dữ liệu mẫu đóng gói kèm (khi chưa cấu hình ID thật).
// Đã có ID thật ở trên nên để false để đọc dữ liệu trực tiếp.
export const USE_SAMPLE_FALLBACK = false;
