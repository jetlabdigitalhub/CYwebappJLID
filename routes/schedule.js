const express = require("express");
const schedule = require("../config/schedule");

const router = express.Router();
const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

router.get("/jadwal", (req, res) => {
  const todayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][new Date().getDay()];
  const groupedSchedule = dayOrder
    .map((day) => ({ day, items: schedule.filter((item) => item.day === day) }))
    .filter((group) => group.items.length > 0);

  res.render("schedule", {
    pageTitle: "Jadwal",
    groupedSchedule,
    todayName
  });
});

module.exports = router;
