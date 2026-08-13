const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ==========================================
// Middleware
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// MongoDB Connection
// ==========================================
let cachedConnection = null;

const connectDB = async () => {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI environment variable is not configured");
    }

    try {
        cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });

        console.log("✅ MongoDB Connected");

        return cachedConnection;
    } catch (err) {
        cachedConnection = null;
        console.error("❌ MongoDB Connection Error:", err.message);
        throw err;
    }
};

// ==========================================
// MongoDB Middleware
// ==========================================
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "Database connection failed",
            message: err.message
        });
    }
});

// ==========================================
// User Schema
// ==========================================
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        coins: {
            type: Number,
            default: 500
        },

        exp: {
            type: Number,
            default: 0
        },

        userId: {
            type: String,
            unique: true,
            sparse: true
        }
    },
    {
        strict: false,
        timestamps: true
    }
);

const User =
    mongoose.models.User ||
    mongoose.model("User", userSchema);

// ==========================================
// Home
// ==========================================
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Database API is running 🚀",
        status: "online",
        author: "Maruf Hossain",
        version: "1.0.0"
    });
});

// ==========================================
// Health Check
// ==========================================
app.get("/health", async (req, res) => {
    res.status(200).json({
        success: true,
        status: "healthy",
        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected",
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// 1. User Register / Login
// ==========================================
app.post("/api/user/login", async (req, res) => {
    try {
        const {
            name,
            password,
            ...otherData
        } = req.body;

        if (!name || !password) {
            return res.status(400).json({
                success: false,
                error: "Username and Password Required"
            });
        }

        let user = await User.findOne({ name });

        // ------------------------------------------
        // Existing User
        // ------------------------------------------
        if (user) {
            if (user.password === password) {
                return res.status(200).json({
                    success: true,
                    message: "লগিন সফল হয়েছে!",
                    user
                });
            }

            return res.status(400).json({
                success: false,
                error: "পাসওয়ার্ড ভুল হয়েছে!"
            });
        }

        // ------------------------------------------
        // New User
        // ------------------------------------------
        const newUserId =
            "USER-" +
            Math.floor(100000 + Math.random() * 900000);

        user = new User({
            userId: newUserId,
            name,
            password,
            coins:
                otherData.coins !== undefined
                    ? Number(otherData.coins)
                    : 500,
            exp:
                otherData.exp !== undefined
                    ? Number(otherData.exp)
                    : 0,
            ...otherData
        });

        await user.save();

        return res.status(201).json({
            success: true,
            message: "নতুন একাউন্ট তৈরি হয়েছে!",
            user
        });

    } catch (err) {
        console.error("Login Error:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==========================================
// 2. Auto Update Data
// ==========================================
app.post("/api/user/update", async (req, res) => {
    try {
        const {
            name,
            coins,
            exp
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: "Username Required"
            });
        }

        const updateData = {};

        if (coins !== undefined) {
            updateData.coins = Number(coins);
        }

        if (exp !== undefined) {
            updateData.exp = Number(exp);
        }

        const user = await User.findOneAndUpdate(
            { name },
            {
                $set: updateData
            },
            {
                new: true,
                upsert: false
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User Not Found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User data updated successfully",
            user
        });

    } catch (err) {
        console.error("Update Error:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==========================================
// 3. Leaderboard API
// ==========================================
app.get("/api/leaderboard", async (req, res) => {
    try {
        const leaderboard = await User.find({
            name: {
                $exists: true,
                $ne: ""
            }
        })
            .sort({
                coins: -1,
                exp: -1
            })
            .limit(20)
            .select("-password");

        return res.status(200).json({
            success: true,
            count: leaderboard.length,
            leaderboard
        });

    } catch (err) {
        console.error("Leaderboard Error:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==========================================
// 404
// ==========================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route Not Found",
        path: req.originalUrl
    });
});

// ==========================================
// Error Handler
// ==========================================
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err);

    res.status(500).json({
        success: false,
        error: "Internal Server Error"
    });
});

// ==========================================
// Vercel Export
// ==========================================
module.exports = app;

// ==========================================
// Local / Render Support
// ==========================================
// Vercel-এ এই অংশটি server start করবে না.
// Render বা local-এ চালালে করবে.
if (process.env.VERCEL !== "1") {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}