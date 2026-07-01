import axios from "axios";

/**
 * Generic Google Sheets XLSX proxy.
 * GET /api/sheets?id=SPREADSHEET_ID
 * Returns raw XLSX bytes — client parses with XLSX library.
 * Runs server-side on Vercel, avoiding browser CORS restrictions.
 */
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing ?id= parameter" });

  const url =
    "https://docs.google.com/spreadsheets/d/" + id + "/export?format=xlsx";

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Cache-Control", "public, max-age=300"); // 5-min cache
    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    const status = error.response ? error.response.status : 0;
    return res
      .status(500)
      .json({ error: "Cannot fetch sheet (HTTP " + status + "): " + error.message });
  }
}
