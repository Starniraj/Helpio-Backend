const mongoose = require("mongoose");

const HelpRequestSchema = new mongoose.Schema(
  {
    // User who posted the request
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    userProfession: { type: String, required: true },
    userRating: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },

    // Request Details
    category: {
      type: String,
      enum: ["Ride / Lift", "Delivery", "Vehicle Help", "Home Help", "Emergency", "Other"],
      required: true,
    },
    description: { type: String, required: true, trim: true },

    // Urgency
    urgency: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    // Payment
    isPaid: { type: Boolean, default: false },
    budget: { type: Number, default: 0 }, // 0 if free

    // Location (for 0-4km nearby filter)
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    city: { type: String, default: "" },
    area: { type: String, default: "" },

    // Status
    status: {
      type: String,
      enum: ["active", "accepted", "in_progress", "completed", "cancelled", "expired"],
      default: "active",
    },

    // Who accepted the request
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    acceptedAt: { type: Date, default: null },

    // Auto expire after 60 mins if not accepted
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// Geospatial index for location-based queries
HelpRequestSchema.index({ location: "2dsphere" });

// Index for fast querying of active requests
HelpRequestSchema.index({ status: 1, createdAt: -1 });
HelpRequestSchema.index({ userId: 1 });
HelpRequestSchema.index({ urgency: 1 });

module.exports =
  mongoose.models.HelpRequest ||
  mongoose.model("HelpRequest", HelpRequestSchema);