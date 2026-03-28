const express = require("express");
const router = express.Router();
const User = require("../models/User");
const HelpActivity = require("../models/HelpActivity");
const HelpRequest = require("../models/HelpRequest");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { sendPushNotification } = require("./chat");

// ─────────────────────────────────────────────
// POST /api/rating/:requestId — Submit rating after help completed
// ─────────────────────────────────────────────
router.post("/:requestId", verifyFirebaseToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const { requestId } = req.params;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Find the request
    const request = await HelpRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Only requester can rate the helper
    if (request.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the requester can rate the helper" });
    }

    if (!request.acceptedBy) {
      return res.status(400).json({ message: "No helper to rate" });
    }

    // Save rating in HelpActivity
    await HelpActivity.findOneAndUpdate(
      { requestId: request._id },
      { $set: { rating, review: review || "" } }
    );

    // Update helper's average rating in User model
    const helper = await User.findById(request.acceptedBy);
    if (helper) {
      // Calculate new average rating
      const totalRatings = helper.totalRatings || 0;
      const currentRating = helper.rating || 0;
      const newTotalRatings = totalRatings + 1;
      const newRating = ((currentRating * totalRatings) + rating) / newTotalRatings;

      await User.findByIdAndUpdate(request.acceptedBy, {
        $set: {
          rating: parseFloat(newRating.toFixed(1)),
          totalRatings: newTotalRatings,
        },
      });

      // 🔔 Notify helper about rating
      if (helper.expoPushToken) {
        const stars = "⭐".repeat(rating);
        await sendPushNotification(
          helper.expoPushToken,
          `${stars} You got a ${rating}-star rating!`,
          review
            ? `"${review.substring(0, 60)}"`
            : `${request.userName} rated your help ${rating}/5`,
          { screen: "profile" }
        );
      }
    }

    res.json({ message: "Rating submitted successfully", rating });
  } catch (err) {
    console.error("Rating error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/rating/user/:userId — Get all ratings for a user
// ─────────────────────────────────────────────
router.get("/user/:userId", verifyFirebaseToken, async (req, res) => {
  try {
    const activities = await HelpActivity.find({
      helperId: req.params.userId,
      rating: { $exists: true, $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("rating review requesterName category createdAt");

    res.json({ ratings: activities });
  } catch (err) {
    console.error("Get ratings error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;