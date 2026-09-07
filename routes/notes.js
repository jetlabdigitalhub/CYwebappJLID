const express = require("express");
const notes = require("../config/notes");

const router = express.Router();

router.get("/catatan", (req, res) => {
  res.render("notes", {
    pageTitle: "Catatan Saya",
    notes
  });
});

module.exports = router;
