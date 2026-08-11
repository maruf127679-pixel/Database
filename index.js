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

// 1. User Register/Login (Fixed: Duplicate Name issue)
app.post('/api/user/login', async (req, res) => {
    try {
        // ভিডিও অনুযায়ী ফ্রন্টএন্ড থেকে username এবং password পাঠানো হচ্ছে ধরে নিচ্ছি। 
        // (যদি ফ্রন্টএন্ডে আপনি username এর বদলে userId পাঠিয়ে থাকেন, তাহলে নিচের লাইনে username এর জায়গায় userId লিখবেন)
        const { username, password, ...otherData } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and Password Required' });
        }

        // চেক করুন এই নামের কোনো ইউজার আগে থেকেই আছে কি না
        let user = await User.findOne({ username });

        if (user) {
            // ইউজার থাকলে পাসওয়ার্ড মিলিয়ে দেখুন (Login Logic)
            if (user.password === password) {
                return res.json({ success: true, message: 'লগিন সফল হয়েছে!', user });
            } else {
                // পাসওয়ার্ড না মিললে বুঝতে হবে অন্য কেউ এই সেম নাম দিয়ে একাউন্ট খোলার চেষ্টা করছে
                return res.status(400).json({ error: 'এই নামটি আগেই ব্যবহৃত হচ্ছে অথবা পাসওয়ার্ড ভুল!' });
            }
        } else {
            // যদি ইউজার না থাকে, তবে নতুন ক্রিয়েট করুন (Register Logic)
            user = new User({ username, password, ...otherData });
            await user.save();
            return res.json({ success: true, message: 'নতুন একাউন্ট তৈরি হয়েছে!', user });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Auto Update Data
app.post('/api/user/update', async (req, res) => {
    try {
        const { username, ...updateData } = req.body; // userId এর জায়গায় username ব্যবহার করা হলো
        if (!username) return res.status(400).json({ error: 'username Required' });

        const user = await User.findOneAndUpdate(
            { username },
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
        const leaderboard = await User.find({ username: { $exists: true } }) // userId এর জায়গায় username
            .sort({ coins: -1, exp: -1 })
            .limit(20);
        res.json({ success: true, leaderboard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;