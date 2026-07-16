const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const funeralRoutes = require('./routes/funeralRoutes');
const donationRoutes = require('./routes/donationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const messagingRoutes = require('./routes/messagingRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/funerals', funeralRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/settings', settingsRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'FDMS Server is running!', version: '1.0.0' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});