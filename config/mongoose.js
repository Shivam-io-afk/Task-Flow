const mongoose = require('mongoose');

const db = async () => {
    if (!process.env.CONNECT) {
        throw new Error('CONNECT is missing from the environment');
    }

    await mongoose.connect(process.env.CONNECT, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');
    return mongoose.connection;
};

module.exports = db;

