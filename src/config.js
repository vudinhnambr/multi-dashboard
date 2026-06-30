// ============================================================
//  CẤU HÌNH NGUỒN DỮ LIỆU
//  Sheet phải được share "Anyone with the link -> Viewer".
//  Lấy ID từ link: .../spreadsheets/d/<GSHEET_ID>/edit...
// ============================================================

// ITR_Standardized (Records table)
export const GSHEET_ID = '1HGvO6E_ELurEimM5nZiMbgDKKiVG1TQL';

export const dataUrl = () =>
  `https://docs.google.com/spreadsheets/d/${GSHEET_ID}/export?format=xlsx`;

export const SHEET_NAME = 'Raw_Data';

export const USE_SAMPLE_FALLBACK = false;
