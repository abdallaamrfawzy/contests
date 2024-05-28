const mongoose = require('mongoose');
const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@contests.udjyyua.mongodb.net/?retryWrites=true&w=majority&appName=Contests`

const connectDB = async () => {
  try {
    await mongoose.connect(url);
    console.log('Database Connected');
  } catch (error) {
    console.log(error);
  }
};

module.exports = connectDB;