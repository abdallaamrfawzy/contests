const express = require("express");
const verifyToken = require("../utils/verifyToken");
const contestsControllers = require("../controllers/contestController/contestsController");
const router = express.Router();
router.route("/")
    .post(verifyToken, contestsControllers.createContest)
    .get(contestsControllers.getAllContests)

router.route("/:id")
    .get(contestsControllers.getContestById)
    .post(verifyToken, contestsControllers.addAnswer)

module.exports = router;