const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = process.env.DB_PATH || path.join(__dirname, "academic.db");
const database = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      task TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existingTasks = await get("SELECT COUNT(*) AS count FROM tasks");
  if (existingTasks.count === 0) {
    const seedTasks = [
      ["Metodologi Penelitian", "Membuat proposal penelitian", "2026-09-10", "pending"],
      ["Statistika Dasar", "Mengerjakan latihan analisis data", "2026-09-12", "pending"],
      ["Bahasa Inggris Akademik", "Menyusun ringkasan jurnal", "2026-09-15", "pending"],
      ["Seminar Proposal", "Menyiapkan bahan presentasi", "2026-09-18", "pending"],
      ["Manajemen Data", "Merapikan dataset tugas", "2026-09-20", "completed"]
    ];
    for (const task of seedTasks) {
      await run(
        "INSERT INTO tasks (subject, task, deadline, status) VALUES (?, ?, ?, ?)",
        task
      );
    }
  }
}

module.exports = { all, get, run, initializeDatabase, databasePath };
