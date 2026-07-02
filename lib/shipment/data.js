// Tải + parse dữ liệu từ Drive, cache trong RAM theo CACHE_TTL_SECONDS. Chuyển sang ESM.
import * as XLSX from "xlsx";
import { downloadDriveFile } from "./drive.js";
import { loadRingLookup, loadNcrLookup, loadPartsList } from "./lookup.js";

let cache = null; // { timestamp, ringLookup, ncrLookup, parts }

function getTtlMs() {
  const seconds = parseInt(process.env.CACHE_TTL_SECONDS || "300", 10);
  return (Number.isFinite(seconds) ? seconds : 300) * 1000;
}

function sheetToRows(workbook, preferredSheetName) {
  const sheet = workbook.Sheets[preferredSheetName] || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

export async function getLookups({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.timestamp < getTtlMs()) {
    return cache;
  }

  const partsFileId = process.env.DRIVE_PARTS_FILE_ID;
  const downloads = [
    downloadDriveFile(process.env.DRIVE_SN_FILE_ID),
    downloadDriveFile(process.env.DRIVE_NCR_FILE_ID),
  ];
  if (partsFileId) downloads.push(downloadDriveFile(partsFileId));

  const [snBuffer, ncrBuffer, partsBuffer] = await Promise.all(downloads);

  const snWorkbook = XLSX.read(snBuffer, { type: "buffer", cellDates: true });
  const ncrWorkbook = XLSX.read(ncrBuffer, { type: "buffer", cellDates: true });

  const ringLookup = loadRingLookup(sheetToRows(snWorkbook, "SN"));
  const ncrLookup = loadNcrLookup(sheetToRows(ncrWorkbook, "LIST"));

  let parts = [];
  if (partsBuffer) {
    const partsWorkbook = XLSX.read(partsBuffer, { type: "buffer" });
    parts = loadPartsList(sheetToRows(partsWorkbook, "Sheet2"));
  }

  cache = { timestamp: now, ringLookup, ncrLookup, parts };
  return cache;
}
