const mongoose = require("mongoose");

const HelpActivitySchema = new mongoose.Schema(
  {
    // Who helped
    helperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    helperName: { type: String, required: true },
    helperProfession: { type: String, required: true },

    // Who was helped
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requesterName: { type: String, required: true },

    // What help was given
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "HelpRequest", required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    urgency: { type: String, enum: ["Low", "Medium", "High"], required: true },

    // Payment
    isPaid: { type: Boolean, default: false },
    budget: { type: Number, default: 0 },

    // Location where help happened
    city: { type: String, default: "" },
    area: { type: String, default: "" },

    // Points earned for this help
    karmaEarned: { type: Number, default: 0 },

    // Streak at time of help
    streakAtTime: { type: Number, default: 0 },

    // Status of this activity
    status: {
      type: String,
      enum: ["accepted", "completed", "declined"],
      default: "accepted",
    },

    // Rating given by requester after completion
    rating: { type: Number, default: null },
    review: { type: String, default: "" },

    // When help was accepted and completed
    acceptedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for fast queries
HelpActivitySchema.index({ helperId: 1, createdAt: -1 });   // helper history
HelpActivitySchema.index({ requesterId: 1, createdAt: -1 }); // requester history
HelpActivitySchema.index({ city: 1, karmaEarned: -1 });      // city leaderboard
HelpActivitySchema.index({ area: 1, karmaEarned: -1 });      // area leaderboard

module.exports =
  mongoose.models.HelpActivity ||
  mongoose.model("HelpActivity", HelpActivitySchema);