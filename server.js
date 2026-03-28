const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const cors = require('cors');
const authRoutes = require("./routes/auth");

// Only load .env file in development — Render injects vars automatically in production
if (process.env.NODE_ENV !== 'production') {
  const env = process.env.NODE_ENV || 'dev';
  dotenv.config({ path: path.resolve(__dirname, `.env.${env}`) });
}

console.log(`Environment: ${process.env.NODE_ENV}`);
console.log("MongoDB URI:", process.env.MONGO_URI);

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

app.use("/api/auth", authRoutes);

const helpRoutes = require("./routes/help");
app.use("/api/help", helpRoutes);

const chatRoutes = require("./routes/chat");
app.use("/api/chat", chatRoutes);
// help routes already added earlier

//add rating routes

const ratingRoutes = require("./routes/rating");
app.use("/api/rating", ratingRoutes);
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();