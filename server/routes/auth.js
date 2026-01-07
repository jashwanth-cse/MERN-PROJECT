const express = require("express");
const { registerUser, loginUser } = require("../controllers/authController");

const router = express.Router();

// POST /api/auth/register - Register new user
router.post("/register", registerUser);

// POST /api/auth/login - Login existing user
router.post("/login", loginUser);

module.exports = router;
