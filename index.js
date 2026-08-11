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

// Flexible Dynamic User Schema (strict: false)
// ফ্রন্টএন্ড থেকে নতুন যেকোনো ফিল্ড পাঠালেই তা অটোমেটিক ডাটাবেসে ক্রিয়েট ও সেভ হয়ে যাবে
const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true }
    },
    { 
        strict: false,       
        timestamps: true     
    }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

// 1. Dynamic Login / Register / Profile Init API
app.post('/api/user/login', async (req, res) => {
    try {
        const { email, ...userData } = req.body;
        if (!email) return res.status(400).json({ error: 'Email Required' });

        const cleanEmail = email.toLowerCase();
        let user = await User.findOne({ email: cleanEmail });

        if (!user) {
            // নতুন ইউজার হলে পাঠানো সমস্ত ফিল্ড সহ অটো ডাটাবেসে সেভ হবে
            user = new User({ email: cleanEmail, ...userData });
            await user.save();
        }

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Dynamic Update API (যেকোনো নতুন ফিল্ড প্রফাইলে ডায়নামিকালি ক্রিয়েট/আপডেট হবে)
app.post('/api/user/update', async (req, res) => {
    try {
        const { email, ...updateFields } = req.body;
        if (!email) return res.status(400).json({ error: 'Email Required' });

        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { $set: updateFields },
            { 
                new: true, 
                upsert: true, 
                strict: false, 
                setDefaultsOnInsert: true 
            }
        );

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await User.find({}, 'name coins exp email avatar bio')
            .sort({ coins: -1, exp: -1 })
            .limit(20);
        res.json({ success: true, leaderboard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;
