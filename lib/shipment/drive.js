// Đọc file trên Google Drive bằng service account (read-only). Chuyển từ CommonJS sang ESM.
// Key service account nằm trong env GOOGLE_SERVICE_ACCOUNT_KEY_B64 (JSON đã base64 hoá).
import googleapis from "googleapis";
const { google } = googleapis;

function getCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY_B64 environment variable.");
  }
  let json;
  try {
    json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (err) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_B64 is not valid base64-encoded JSON: " + err.message
    );
  }
  if (!json.client_email || !json.private_key) {
    throw new Error("Decoded service account JSON is missing client_email/private_key.");
  }
  return json;
}

function getAuth() {
  const { client_email, private_key } = getCredentials();
  return new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Tải file Drive về dạng buffer .xlsx — tự nhận diện Google Sheet (export) hay .xlsx thật (tải trực tiếp).
export async function downloadDriveFile(fileId) {
  if (!fileId) throw new Error("Missing Drive file id.");
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const meta = await drive.files.get({ fileId, fields: "mimeType,name" });
  const mimeType = meta.data.mimeType;

  if (mimeType === GOOGLE_SHEET_MIME) {
    const res = await drive.files.export(
      { fileId, mimeType: XLSX_MIME },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data);
  }

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}
