const express = require("express");
const verifyToken = require("../utils/verifyToken");
const topicsControllers = require("../controllers/topicsController/topicsController");
const router = express.Router();
router.route("/")
    .post(verifyToken, topicsControllers.createTopic)
    .get(topicsControllers.getAllTopics)

router.route("/:id")
    .get(topicsControllers.getTopicById)
    .post(verifyToken, topicsControllers.addAnswer)

module.exports = router;