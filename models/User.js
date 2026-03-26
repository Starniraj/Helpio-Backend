const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: String,
    phone: String,
    email: String,
    profession: String,

    // Location for nearby filtering
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
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
    totalHelps: { type: Number, default: 0 },
    helpGivenCount: { type: Number, default: 0 },
    helpReceivedCount: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },

    // Streak System (Snapchat style)
    streak: { type: Number, default: 0 },
    lastHelpDate: { type: Date, default: null },
    longestStreak: { type: Number, default: 0 },

    // Points / Karma
    karmaPoints: { type: Number, default: 0 },

    // Badges
    badges: {
      type: [String],
      default: [],
      // e.g. ['7day_streak', '30day_streak', 'top_helper_area', 'top_helper_city']
    },

    // Leaderboard Ranks
    rankArea: { type: Number, default: null },
    rankCity: { type: Number, default: null },
    rankIndia: { type: Number, default: null },

    // Active status for showing in offer help
    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Geospatial index for location-based queries (0-4km filter)
UserSchema.index({ location: "2dsphere" });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);