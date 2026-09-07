const express = require("express");
const { all, get, run } = require("../database/db");

const router = express.Router();
const validStatuses = new Set(["pending", "completed"]);

function cleanTaskInput(body) {
  return {
    subject: String(body.subject || "").trim(),
    task: String(body.task || "").trim(),
    deadline: String(body.deadline || "").trim(),
    status: validStatuses.has(body.status) ? body.status : "pending"
  };
}

function validateTask(task) {
  if (!task.subject || !task.task || !task.deadline) {
    return "Mata kuliah, tugas, dan deadline wajib diisi.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.deadline)) {
    return "Format deadline tidak valid.";
  }
  return null;
}

function getTaskId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/tugas", async (req, res, next) => {
  try {
    const filter = ["pending", "completed"].includes(req.query.status) ? req.query.status : "all";
    const query = filter === "all"
      ? "SELECT * FROM tasks ORDER BY status = 'completed', deadline ASC, id DESC"
      : "SELECT * FROM tasks WHERE status = ? ORDER BY deadline ASC, id DESC";
    const tasks = await all(query, filter === "all" ? [] : [filter]);

    res.render("tasks/index", {
      pageTitle: "Tugas",
      tasks,
      filter,
      message: req.query.message || "",
      error: ""
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tugas/tambah", (req, res) => {
  res.render("tasks/form", {
    pageTitle: "Tambah Tugas",
    formTitle: "Tambah Tugas",
    formAction: "/tugas/tambah",
    task: { subject: "", task: "", deadline: "", status: "pending" },
    error: ""
  });
});

router.post("/tugas/tambah", async (req, res, next) => {
  const task = cleanTaskInput(req.body);
  const error = validateTask(task);
  if (error) {
    res.status(400).render("tasks/form", {
      pageTitle: "Tambah Tugas",
      formTitle: "Tambah Tugas",
      formAction: "/tugas/tambah",
      task,
      error
    });
    return;
  }

  try {
    await run(
      "INSERT INTO tasks (subject, task, deadline, status) VALUES (?, ?, ?, ?)",
      [task.subject, task.task, task.deadline, task.status]
    );
    res.redirect("/tugas?message=Tugas berhasil ditambahkan.");
  } catch (error) {
    next(error);
  }
});

router.get("/tugas/:id/edit", async (req, res, next) => {
  const id = getTaskId(req.params.id);
  if (!id) return res.status(404).render("404", { pageTitle: "Halaman Tidak Ditemukan" });

  try {
    const task = await get("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!task) return res.status(404).render("404", { pageTitle: "Halaman Tidak Ditemukan" });
    res.render("tasks/form", {
      pageTitle: "Edit Tugas",
      formTitle: "Edit Tugas",
      formAction: `/tugas/${id}/edit`,
      task,
      error: ""
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tugas/:id/edit", async (req, res, next) => {
  const id = getTaskId(req.params.id);
  const task = cleanTaskInput(req.body);
  const error = validateTask(task);
  if (!id) return res.status(404).render("404", { pageTitle: "Halaman Tidak Ditemukan" });
  if (error) {
    res.status(400).render("tasks/form", {
      pageTitle: "Edit Tugas",
      formTitle: "Edit Tugas",
      formAction: `/tugas/${id}/edit`,
      task: { ...task, id },
      error
    });
    return;
  }

  try {
    const result = await run(
      "UPDATE tasks SET subject = ?, task = ?, deadline = ?, status = ? WHERE id = ?",
      [task.subject, task.task, task.deadline, task.status, id]
    );
    if (!result.changes) return res.status(404).render("404", { pageTitle: "Halaman Tidak Ditemukan" });
    res.redirect("/tugas?message=Tugas berhasil diperbarui.");
  } catch (error) {
    next(error);
  }
});

router.post("/tugas/:id/toggle", async (req, res, next) => {
  const id = getTaskId(req.params.id);
  if (!id) return res.redirect("/tugas?message=Tugas tidak ditemukan.");

  try {
    const task = await get("SELECT status FROM tasks WHERE id = ?", [id]);
    if (!task) return res.redirect("/tugas?message=Tugas tidak ditemukan.");
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    await run("UPDATE tasks SET status = ? WHERE id = ?", [nextStatus, id]);
    res.redirect("/tugas?message=Status tugas diperbarui.");
  } catch (error) {
    next(error);
  }
});

router.post("/tugas/:id/delete", async (req, res, next) => {
  const id = getTaskId(req.params.id);
  if (!id) return res.redirect("/tugas?message=Tugas tidak ditemukan.");

  try {
    await run("DELETE FROM tasks WHERE id = ?", [id]);
    res.redirect("/tugas?message=Tugas berhasil dihapus.");
  } catch (error) {
    next(error);
  }
});

module.exports = router;
