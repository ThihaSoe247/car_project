const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: String,
    required: true,
  },
  {
    email: String,
    required: true,
    unique: true,
  },
  {
    password: String,
    required: true,
  },
  {
    role: {
      type: String,
      enum: ["Admin", "Staff", "Moderator"],
      default: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
