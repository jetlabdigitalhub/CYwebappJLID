require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const { initializeDatabase } = require("./database/db");
const dashboardRoutes = require("./routes/dashboard");
const scheduleRoutes = require("./routes/schedule");
const taskRoutes = require("./routes/tasks");
const notesRoutes = require("./routes/notes");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.locals.formatDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
};

app.use(dashboardRoutes);
app.use(scheduleRoutes);
app.use(taskRoutes);
app.use(notesRoutes);

app.use((req, res) => {
  res.status(404).render("404", { pageTitle: "Halaman Tidak Ditemukan" });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).render("error", {
    pageTitle: "Terjadi Kesalahan",
    errorMessage: "Maaf, terjadi kesalahan saat memproses halaman ini."
  });
});

initializeDatabase()
  .then(() => {
    const server = app.listen(PORT, HOST, () => {
      console.log(`Academic Dashboard berjalan di http://${HOST}:${PORT}`);
    });
    server.on("error", (error) => {
      console.error("Server gagal dijalankan:", error);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error("Database gagal diinisialisasi:", error);
    process.exit(1);
  });

module.exports = app;
