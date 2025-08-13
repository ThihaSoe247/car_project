const express = require("express");
const carRoutes = require("./routes/car-routes");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { cookie } = require("express-validator");

require("dotenv").config();

const app = express();

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log("MongoDB connected successfully");
  app.listen(process.env.PORT, () => {
    console.log("Server is running on port 4000");
  });
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

app.get("/", (req, res) => {
  return res.json({ hello: "World this is Car Showroom" });
});

app.use("/api", carRoutes);
