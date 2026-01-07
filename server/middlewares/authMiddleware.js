const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No authentication token provided."
        });
    }

    try {
        // Extract token from "Bearer <token>" format
        const tokenString = token.startsWith("Bearer ")
            ? token.slice(7, token.length).trim()
            : token;

        // Verify token
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({
            success: false,
            message: "Invalid or expired token. Please login again."
        });
    }
};

module.exports = authMiddleware;
