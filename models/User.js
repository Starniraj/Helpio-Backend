const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: String,
    phone: String,
    email: String,
    profession: String,

    // Location
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    city: { type: String, default: "" },
    area: { type: String, default: "" },

    // Trust & Verification
    verificationLevel: {
      type: String,
      enum: ["basic", "trusted", "top_trusted"],
      default: "basic",
    },
    trustScore: { type: Number, default: 85 },
    isVerified: { type: Boolean, default: false },

    // Stats
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },   // ✅ NEW — count of ratings received
    totalHelps: { type: Number, default: 0 },
    helpGivenCount: { type: Number, default: 0 },
    helpReceivedCount: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },

    // Streak
    streak: { type: Number, default: 0 },
    lastHelpDate: { type: Date, default: null },
    longestStreak: { type: Number, default: 0 },

    // Karma
    karmaPoints: { type: Number, default: 0 },

    // Badges
    badges: { type: [String], default: [] },

    // Leaderboard Ranks
    rankArea: { type: Number, default: null },
    rankCity: { type: Number, default: null },
    rankIndia: { type: Number, default: null },

    // Active status
    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },

    // Push notification token
    expoPushToken: { type: String, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);