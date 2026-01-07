const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register User
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: name, email, and password"
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists"
            });
        }

        // Hash password with bcrypt (salt rounds: 12)
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });

        // Generate JWT token
        const token = jwt.sign(
            {
                id: newUser._id,
                email: newUser.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" } // Token valid for 7 days
        );

        res.status(201).json({
            success: true,
            message: "Account created successfully! Welcome to AV Utility Platform.",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        });

    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({
            success: false,
            message: "User registration failed. Please try again.",
            error: err.message
        });
    }
};

// Login User
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password"
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email"
            });
        }

        // Compare hashed password with provided password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid password. Please try again."
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful! Welcome back to your processing suite.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            success: false,
            message: "Login failed. Please try again.",
            error: err.message
        });
    }
};

module.exports = { registerUser, loginUser };
