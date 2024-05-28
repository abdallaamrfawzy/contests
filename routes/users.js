const express = require("express");
const router = express.Router();
const usersControllers = require("../controllers/userController/usersControllers");
const verifyToken = require("../utils/verifyToken");
const authValidator = require("../utils/authValidator");
const upload = require("../utils/multer")


router.route("/register")
    .post(upload.single('image'), authValidator.registerValidator, usersControllers.register)
router.route("/login")
    .post(authValidator.loginValidator, usersControllers.login)
router.route("/:id")
    .get(verifyToken, usersControllers.getUser);
router.route("/:id")
    .put(upload.single('image'), verifyToken, usersControllers.updateUser);

module.exports = router;