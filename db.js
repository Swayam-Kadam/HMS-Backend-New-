const mongoose = require('mongoose');
const mongoURI = process.env.MONGODB_URI;

const connectToMongo = async () => {
    if (!mongoURI) {
        console.error("MONGODB_URI is not set. Add it to your environment variables.");
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoURI);
        console.log("Connection Successful");
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
};

module.exports = connectToMongo
