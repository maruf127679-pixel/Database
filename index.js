const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serverless MongoDB Connection Handler
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        const db = await mongoose.connect(process.env.MONGODB_URI);
        isConnected = db.connections[0].readyState;
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Dynamic Schema (যেকোনো নতুন Field বা Data অটোমেটিক হ্যান্ডেল করবে)
const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const User = mongoose.models.User || mongoose.model('User', userSchema);

// 1. User Register/Login (Auto Create)
app.post('/api/user/login', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId Required' });

        let user = await User.findOne({ userId });
        if (!user) {
            user = new User(req.body);
            await user.save();
        }
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Auto Update Data
app.post('/api/user/update', async (req, res) => {
    try {
        const { userId, ...updateData } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId Required' });

        const user = await User.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true, strict: false }
        );

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await User.find({ userId: { $exists: true } })
            .sort({ coins: -1, exp: -1 })
            .limit(20);
        res.json({ success: true, leaderboard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;