const express = require("express");
const schedule = require("../config/schedule");
const { all } = require("../database/db");

const router = express.Router();
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

router.get("/", async (req, res, next) => {
  try {
    const today = new Date();
    const todayName = dayNames[today.getDay()];
    const todaySchedule = schedule.filter((item) => item.day === todayName);
    const tasks = await all(
      "SELECT * FROM tasks ORDER BY status = 'completed', deadline ASC, id DESC LIMIT 4"
    );

    res.render("dashboard", {
      pageTitle: "Dashboard",
      today,
      todayName,
      todaySchedule,
      tasks
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
