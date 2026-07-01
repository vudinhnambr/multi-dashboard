// ============================================================
//  CAU HINH NGUON DU LIEU
//  Sheet phai duoc share "Anyone with the link -> Viewer".
//  Lay ID tu link: .../spreadsheets/d/<ID>/edit...
// ============================================================

// File gop: 1. Mass Product , Test Inspection
// Sheet "4. ITR & Shipment" -> CMM Records table (06 - Records)
export const GSHEET_ID  = "11pT3Oi21Q5qmXZ6Jhn09ZR2q-G9C7EJj";
export const SHEET_NAME = "4. ITR & Shipment";

// Route through Vercel API proxy to avoid browser CORS restrictions
export const dataUrl = () => "/api/sheets?id=" + GSHEET_ID;

export const USE_SAMPLE_FALLBACK = false;
