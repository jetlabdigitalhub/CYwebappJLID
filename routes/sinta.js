const express = require("express");
const ExcelJS = require("exceljs");
const { cleanQueries, scrapeQueries } = require("../sinta-scraper");

const router = express.Router();
const jobs = new Map();
const exportColumns = [
  ["journal_name", "Journal Name"], ["sinta_url", "SINTA URL"], ["affiliation", "Affiliation"],
  ["p_issn", "P-ISSN"], ["e_issn", "E-ISSN"], ["subject_area", "Subject Area"],
  ["sinta_rank", "SINTA Rank"], ["scopus", "Scopus"], ["garuda", "Garuda"], ["website", "Website"],
  ["editor_url", "Editor URL"], ["google_scholar", "Google Scholar"], ["impact", "Impact"],
  ["h5_index", "H5 Index"], ["citations_5yr", "Citations 5yr"], ["citations", "Citations"],
  ["matched_queries", "Matched Queries"], ["scraped_at", "Scraped At"]
];

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    results: job.results,
    rawRecords: job.rawRecords,
    duplicatesRemoved: Math.max(0, job.rawRecords - job.results.length),
    failures: job.failures,
    queries: job.queries,
    error: job.error || ""
  };
}

function safeFilePart(value) {
  return String(value || "multiple-queries").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "multiple-queries";
}

function fileName(queries) {
  const date = new Date().toISOString().slice(0, 10);
  const label = queries.length === 1 ? safeFilePart(queries[0]) : "multiple-queries";
  return `sinta-${label}-${date}.xlsx`;
}

router.get("/sinta", (req, res) => {
  res.render("sinta", { pageTitle: "SINTA Scraper" });
});

router.post("/api/sinta/scrape", (req, res) => {
  const queries = cleanQueries(req.body.queries || req.body.query);
  if (!queries.length) return res.status(400).json({ error: "Masukkan setidaknya satu query." });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    queries,
    status: "running",
    progress: { query: queries[0], queryIndex: 0, totalQueries: queries.length, page: 0, totalPages: 1, rawRecords: 0, status: "Menyiapkan scraping..." },
    results: [],
    rawRecords: 0,
    failures: [],
    createdAt: Date.now()
  };
  jobs.set(id, job);
  scrapeQueries({ queries, mode: req.body.mode, pages: req.body.pages, delay: req.body.delay }, (progress) => {
    job.progress = progress;
  }).then(({ results, rawRecords, failures }) => {
    job.results = results;
    job.rawRecords = rawRecords;
    job.failures = failures;
    job.status = "complete";
    job.progress = { ...job.progress, rawRecords, status: "Scraping selesai." };
  }).catch((error) => {
    job.status = "error";
    job.error = error.message;
  });
  res.status(202).json({ jobId: id });
});

router.get("/api/sinta/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Sesi scraping tidak ditemukan atau sudah kedaluwarsa." });
  res.json(publicJob(job));
});

router.post("/api/sinta/jobs/:id/export", async (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Sesi scraping tidak ditemukan atau sudah kedaluwarsa." });
  const requestedKeys = Array.isArray(req.body.keys) ? new Set(req.body.keys.map(String)) : null;
  const rows = requestedKeys ? job.results.filter((row) => requestedKeys.has(row.sinta_url || `${row.journal_name}|${row.p_issn}|${row.e_issn}`)) : job.results;
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("SINTA Journals", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = exportColumns.map(([key, header]) => ({ key, header, width: Math.max(14, Math.min(34, header.length + 8)) }));
    for (const row of rows) {
      const values = Object.fromEntries(exportColumns.map(([key]) => [key, Array.isArray(row[key]) ? row[key].join(", ") : row[key] || ""]));
      sheet.addRow(values);
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + exportColumns.length)}${rows.length + 1}` };
    for (const row of sheet.getRows(2, rows.length) || []) {
      for (const key of ["sinta_url", "website", "editor_url", "google_scholar"]) {
        const cell = row.getCell(key);
        if (cell.value) cell.value = { text: String(cell.value), hyperlink: String(cell.value) };
      }
    }
    res.attachment(fileName(job.queries));
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

setInterval(() => {
  const expiry = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) if (job.createdAt < expiry) jobs.delete(id);
}, 15 * 60 * 1000).unref();

module.exports = router;