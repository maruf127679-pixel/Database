const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection Handler
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = mongoose.connection.readyState;
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Dynamic Schema
const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const User = mongoose.models.User || mongoose.model('User', userSchema);

// 1. User Register/Login (Fixed Logic)
app.post('/api/user/login', async (req, res) => {
    try {
        // userId এর বদলে name দিয়ে লগিন হবে
        const { name, password, ...otherData } = req.body;

        if (!name || !password) {
            return res.status(400).json({ error: 'Username and Password Required' });
        }

        // ডাটাবেসে নাম দিয়ে ইউজার খুঁজুন
        let user = await User.findOne({ name });

        if (user) {
            if (user.password === password) {
                return res.json({ success: true, message: 'লগিন সফল হয়েছে!', user });
            } else {
                return res.status(400).json({ error: 'পাসওয়ার্ড ভুল হয়েছে!' });
            }
        } else {
            // নতুন ইউজারের ক্ষেত্রে Backend থেকে একটি নতুন userId তৈরি হবে
            const newUserId = 'USER-' + Math.floor(100000 + Math.random() * 900000);
            
            user = new User({ 
                userId: newUserId, 
                name, 
                password, 
                coins: 500, 
                exp: 0, 
                ...otherData 
            });
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
        const { userId, ...updateData } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId Required' });

        const user = await User.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: false, strict: false }
        );

        if (!user) {
            return res.status(404).json({ error: 'User Not Found' });
        }

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