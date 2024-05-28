const express = require("express");
const router = express.Router();

const userRoutes = require("./users.js");
const contestsRoutes = require("./Contests.js");
const topicsRoutes = require("./topics.js");



router.use("/users", userRoutes);
router.use("/contests", contestsRoutes);
router.use("/topics", topicsRoutes);

module.exports = router;
