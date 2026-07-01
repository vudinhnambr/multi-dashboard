import axios from "axios";

/**
 * Generic Google Sheets XLSX proxy — avoids browser CORS.
 * GET /api/sheets?id=SPREADSHEET_ID
 * Returns raw XLSX bytes; client parses with XLSX library.
 */
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing ?id= parameter" });

  const url =
    "https://docs.google.com/spreadsheets/d/" + id + "/export?format=xlsx";

  let response;
  try {
    response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 10,
      validateStatus: () => true,          // never throw on HTTP status
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Network error fetching sheet: " + err.message,
      id,
    });
  }

  const ct = response.headers["content-type"] || "";
  const httpStatus = response.status;

  // Google redirected to HTML login / confirmation page
  if (ct.includes("text/html")) {
    return res.status(403).json({
      error:
        "Google returned HTML (status " +
        httpStatus +
        "). File may require sign-in or is not shared publicly.",
      id,
      hint: "Share the file: Anyone with the link -> Viewer",
    });
  }

  if (httpStatus !== 200) {
    return res.status(502).json({
      error: "Google returned HTTP " + httpStatus + " for sheet " + id,
      contentType: ct,
    });
  }

  // Success — stream XLSX bytes to client
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Cache-Control", "public, max-age=300"); // 5-min cache
  const buf = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(new Uint8Array(response.data));
  return res.status(200).end(buf);
}
