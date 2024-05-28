require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const bodyParser = require('body-parser');
const userRoute = require("./routes/users.js");
const connectDB = require("./config/database.js");
const router = require("./routes/index.js");

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors({ origin: "*" }));
app.use("/api", router);



connectDB();

app.listen(port, () => {
    console.log(`Server start on port ${port} `);
});