const cheerio = require("cheerio");

const SINTA_URL = "https://sinta.kemdiktisaintek.go.id/journals/";
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;

function cleanQueries(input) {
  const values = Array.isArray(input) ? input : String(input || "").split(/\r?\n/);
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 30);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, SINTA_URL).toString();
  } catch {
    return "";
  }
}

function firstText(card, selectors) {
  for (const selector of selectors) {
    const value = cleanText(card.find(selector).first().text());
    if (value) return value;
  }
  return "";
}

function firstHref(card, selectors, contains) {
  for (const selector of selectors) {
    const link = card.find(selector).first();
    const href = link.attr("href");
    if (href && (!contains || href.toLowerCase().includes(contains))) return absoluteUrl(href);
  }
  return "";
}

function labeledValue(text, labels) {
  const pattern = labels.join("|");
  const match = text.match(new RegExp(`(?:${pattern})\\s*[:\\-]?\\s*([^|\\n]+)`, "i"));
  return match ? cleanText(match[1]) : "";
}

function yesNo(text) {
  if (/\b(yes|ya|terindeks|indexed)\b/i.test(text)) return "Yes";
  if (/\b(no|tidak|belum)\b/i.test(text)) return "No";
  return cleanText(text);
}

function parseJournal(card, $) {
  const cardText = cleanText(card.text());
  const links = card.find("a");
  const journalLink = links.filter((_, element) => /journal|journals/i.test($(element).attr("href") || "")).first();
  const journalName = firstText(card, [".journal-name", ".journal-title", ".title", "h2", "h3", "h4"]) || cleanText(journalLink.text());
  const sintaUrl = absoluteUrl(journalLink.attr("href"));
  const affiliation = firstText(card, [".affil-name", ".affiliation", ".affil-abbrev", ".affil-loc"]);
  const affiliationUrl = firstHref(card, [".affil-name a", ".affil-abbrev a", ".affil-loc a"]);
  const statText = cleanText(card.find(".journal-list-stat, .profile-id, .stat-prev, .pr-num, .pr-txt").text());
  const combinedText = `${cardText} ${statText}`;
  const issnValues = [...combinedText.matchAll(/(?:P-?ISSN|E-?ISSN|ISSN)\s*[:\-]?\s*([0-9X]{4}[ -]?[0-9X]{4})/gi)].map((match) => match[1]);
  const subjectArea = firstText(card, [".subject-area", ".subject", ".journal-subject", "[class*=subject]"]) || labeledValue(cardText, ["Subject Area", "Subject"]);
  const website = firstHref(card, ["a"], "http");
  const editorUrl = firstHref(card, ["a"], "editor");
  const googleScholar = firstHref(card, ["a"], "scholar");

  return {
    journal_name: journalName,
    sinta_url: sintaUrl,
    affiliation,
    affiliation_url: affiliationUrl,
    p_issn: labeledValue(combinedText, ["P-ISSN", "P ISSN"]) || issnValues[0] || "",
    e_issn: labeledValue(combinedText, ["E-ISSN", "E ISSN"]) || issnValues[1] || "",
    subject_area: subjectArea,
    sinta_rank: firstText(card, [".sinta-rank", ".rank", ".score"] ) || labeledValue(combinedText, ["SINTA Rank", "SINTA"]),
    scopus: yesNo(labeledValue(combinedText, ["Scopus"]) || firstText(card, [".scopus"])),
    garuda: yesNo(labeledValue(combinedText, ["Garuda"]) || firstText(card, [".garuda"])),
    website,
    editor_url: editorUrl,
    google_scholar: googleScholar,
    impact: labeledValue(combinedText, ["Impact"]),
    h5_index: labeledValue(combinedText, ["H5 Index", "H5"]),
    citations_5yr: labeledValue(combinedText, ["Citations 5yr", "Citations 5 year"]),
    citations: labeledValue(combinedText, ["Citations"]),
    matched_queries: [],
    scraped_at: new Date().toISOString()
  };
}

function parsePagination($) {
  const text = cleanText($(".pagination-text").text()) || cleanText($.root().text());
  const match = text.match(/page\s+\d+\s+of\s+(\d+)/i) || text.match(/of\s+(\d+)\s+pages?/i);
  return match ? Math.max(1, Number.parseInt(match[1], 10)) : 1;
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const journals = $(".list-item").map((_, element) => parseJournal($(element), $)).get()
    .filter((journal) => journal.journal_name || journal.sinta_url);
  return { journals, totalPages: parsePagination($) };
}

function resultKey(journal) {
  if (journal.sinta_url) return `url:${journal.sinta_url}`;
  return `fallback:${journal.journal_name}|${journal.p_issn}|${journal.e_issn}`.toLowerCase();
}

function mergeJournal(existing, incoming, query) {
  const merged = existing || { ...incoming, matched_queries: [] };
  for (const [key, value] of Object.entries(incoming)) {
    if (key !== "matched_queries" && value && !merged[key]) merged[key] = value;
  }
  if (!merged.matched_queries.includes(query)) merged.matched_queries.push(query);
  return merged;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchPage(url, delay) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    if (delay && attempt === 0) await wait(delay);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: SINTA_URL
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (!/text\/html/i.test(response.headers.get("content-type") || "") || !/<html[\s>]/i.test(html)) {
        throw new Error("Respons SINTA bukan HTML yang valid");
      }
      return html;
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("Request timeout setelah 30 detik") : error;
      if (attempt < MAX_RETRIES - 1) await wait(500 * (2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function scrapeQueries(options, onProgress) {
  const queries = cleanQueries(options.queries);
  const delay = Math.max(0, Math.min(Number(options.delay) || 1000, 30000));
  const mode = ["test", "all", "custom"].includes(options.mode) ? options.mode : "test";
  const customPages = Math.max(1, Math.min(Number.parseInt(options.pages, 10) || 1, 500));
  const records = new Map();
  const failures = [];
  let rawRecords = 0;

  for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    const query = queries[queryIndex];
    try {
      const firstUrl = new URL(SINTA_URL);
      firstUrl.searchParams.set("page", "1");
      firstUrl.searchParams.set("q", query);
      const firstPage = parsePage(await fetchPage(firstUrl.toString(), 0));
      const totalPages = mode === "test" ? 1 : mode === "custom" ? Math.min(customPages, firstPage.totalPages) : firstPage.totalPages;
      const pages = [firstPage];
      onProgress({ query, queryIndex, totalQueries: queries.length, page: 1, totalPages, rawRecords, status: "Scraping..." });

      for (let page = 2; page <= totalPages; page += 1) {
        const pageUrl = new URL(SINTA_URL);
        pageUrl.searchParams.set("page", String(page));
        pageUrl.searchParams.set("q", query);
        pages.push(parsePage(await fetchPage(pageUrl.toString(), delay)));
        onProgress({ query, queryIndex, totalQueries: queries.length, page, totalPages, rawRecords, status: "Scraping..." });
      }

      for (const page of pages) {
        rawRecords += page.journals.length;
        for (const journal of page.journals) {
          const key = resultKey(journal);
          records.set(key, mergeJournal(records.get(key), journal, query));
        }
      }
      onProgress({ query, queryIndex, totalQueries: queries.length, page: totalPages, totalPages, rawRecords, status: "Scraping..." });
    } catch (error) {
      failures.push({ query, reason: error.message });
      onProgress({ query, queryIndex, totalQueries: queries.length, page: 0, totalPages: 1, rawRecords, status: `Gagal: ${error.message}` });
    }
  }

  return { results: [...records.values()], rawRecords, failures };
}

module.exports = { SINTA_URL, cleanQueries, parsePage, scrapeQueries };