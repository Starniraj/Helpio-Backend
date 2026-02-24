const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },

    name: String,
    phone: String,
    email: String,
    profession: String,

    verificationLevel: {
      type: String,
      enum: ["basic", "trusted", "top_trusted"],
      default: "basic",
    },

    trustScore: { type: Number, default: 85 },
    totalHelps: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);