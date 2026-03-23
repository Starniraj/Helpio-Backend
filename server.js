const express  = require('express');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const cors = require('cors');
const authRoutes = require("./routes/auth");


// Load .env file based on NODE_ENV
const env = process.env.NODE_ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, `.env.${env}`) });

console.log(`Environment: ${env}`);

console.log("MongoDB URI:", process.env.MONGO_URI);

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

app.use("/api/auth", authRoutes);


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