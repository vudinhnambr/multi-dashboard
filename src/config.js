// ============================================================
//  CAU HINH NGUON DU LIEU
//  Sheet phai duoc share "Anyone with the link -> Viewer".
//  Lay ID tu link: .../spreadsheets/d/<ID>/edit...
// ============================================================

// File gop: 1. Mass Product , Test Inspection
// Sheet "4. ITR & Shipment" -> CMM Records table (06 - Records)
export const GSHEET_ID  = "1-X-ax3MhVtpN3tMsAhIsntjWYx5or0i8";
export const SHEET_NAME = "4. ITR & Shipment";

// Avoid template literal - esbuild misparses /export?format= as regex
export const dataUrl = () =>
  "https://docs.google.com/spreadsheets/d/" + GSHEET_ID + "/export?format=xlsx";

export const USE_SAMPLE_FALLBACK = false;
