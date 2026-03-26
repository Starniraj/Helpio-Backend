const express = require("express");
const router = express.Router();
const HelpRequest = require("../models/HelpRequest");
const User = require("../models/User");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

// Profession → Category mapping (matches your types.ts)
const CATEGORY_PROFESSION_MAP = {
  "Ride / Lift": ["Driver", "Delivery Partner", "Student", "Freelancer", "Other"],
  Delivery: ["Delivery Partner", "Driver", "Student", "Freelancer", "Other"],
  "Vehicle Help": ["Driver", "Engineer", "Freelancer", "Other"],
  "Home Help": ["Plumber", "Electrician", "Engineer", "Freelancer", "Other"],
  Emergency: ["Student", "Teacher", "Engineer", "Plumber", "Electrician", "Driver", "Delivery Partner", "Freelancer", "Other"],
  Other: ["Student", "Teacher", "Engineer", "Plumber", "Electrician", "Driver", "Delivery Partner", "Freelancer", "Other"],
};

// ─────────────────────────────────────────────
// POST /api/help — Post a new help request
// ─────────────────────────────────────────────
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const { category, description, urgency, isPaid, budget, latitude, longitude, city, area } = req.body;

    if (!req.user) {
      return res.status(404).json({ message: "User not found. Please sync first." });
    }

    if (!category || !description || !latitude || !longitude) {
      return res.status(400).json({ message: "category, description, latitude, longitude are required" });
    }

    const helpRequest = await HelpRequest.create({
      userId: req.user._id,
      userName: req.user.name,
      userProfession: req.user.profession,
      userRating: req.user.rating,
      isVerified: req.user.isVerified,
      category,
      description,
      urgency: urgency || "Medium",
      isPaid: isPaid || false,
      budget: isPaid ? budget || 0 : 0,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)], // MongoDB uses [lng, lat]
      },
      city: city || "",
      area: area || "",
    });

    res.status(201).json({
      message: "Help request posted successfully",
      request: helpRequest,
    });
  } catch (err) {
    console.error("Post help error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/help/nearby — Get nearby active requests
// Query params: latitude, longitude, radius (optional, default 4km)
// ─────────────────────────────────────────────
router.get("/nearby", verifyFirebaseToken, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userProfession = req.user.profession;
    const isStudent = userProfession === "Student";
    const radiusInMeters = parseFloat(radius) || 4000; // default 4km

    // First expire old requests (older than 60 mins)
    await HelpRequest.updateMany(
      { status: "active", expiresAt: { $lt: new Date() } },
      { $set: { status: "expired" } }
    );

    // Build filter based on profession and urgency rules:
    // Rule 1: HIGH urgency → everyone sees it
    // Rule 2: Student → sees everything
    // Rule 3: Others → only matching profession category
    let categoryFilter = {};

    if (!isStudent) {
      // Get categories this profession can help with
      const allowedCategories = Object.entries(CATEGORY_PROFESSION_MAP)
        .filter(([_, professions]) => professions.includes(userProfession))
        .map(([category]) => category);

      categoryFilter = {
        $or: [
          { urgency: "High" }, // HIGH urgency visible to everyone
          { category: { $in: allowedCategories } }, // matching profession categories
        ],
      };
    }
    // If student → no category filter (sees all)

    const requests = await HelpRequest.find({
      status: "active",
      userId: { $ne: req.user._id }, // don't show own requests
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: radiusInMeters,
        },
      },
      ...categoryFilter,
    })
      .sort({ urgency: -1, createdAt: -1 }) // HIGH urgency first, then newest
      .limit(50);

    // Calculate distance for each request and format response
    const formatted = requests.map((r) => {
      const [reqLng, reqLat] = r.location.coordinates;
      const distanceKm = getDistanceKm(
        parseFloat(latitude),
        parseFloat(longitude),
        reqLat,
        reqLng
      );

      return {
        id: r._id.toString(),
        userId: r.userId.toString(),
        userName: r.userName,
        userProfession: r.userProfession,
        userRating: r.userRating,
        isVerified: r.isVerified,
        category: r.category,
        description: r.description,
        urgency: r.urgency,
        isPaid: r.isPaid,
        budget: r.budget,
        status: r.status,
        distance: parseFloat(distanceKm.toFixed(1)),
        city: r.city,
        area: r.area,
        createdAt: r.createdAt.getTime(),
        expiresAt: r.expiresAt.getTime(),
      };
    });

    res.json({ requests: formatted, total: formatted.length });
  } catch (err) {
    console.error("Get nearby error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/help/my-requests — Get current user's requests
// ─────────────────────────────────────────────
router.get("/my-requests", verifyFirebaseToken, async (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: "User not found" });

    const requests = await HelpRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ requests });
  } catch (err) {
    console.error("My requests error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/help/:id/accept — Accept a help request
// ─────────────────────────────────────────────
router.patch("/:id/accept", verifyFirebaseToken, async (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: "User not found" });

    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "active") {
      return res.status(400).json({ message: "Request is no longer active" });
    }
    if (request.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot accept your own request" });
    }

    // Update request status
    request.status = "accepted";
    request.acceptedBy = req.user._id;
    request.acceptedAt = new Date();
    await request.save();

    // Update helper stats + streak + karma
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const helper = await User.findById(req.user._id);
    const lastHelp = helper.lastHelpDate ? new Date(helper.lastHelpDate) : null;
    const lastHelpDay = lastHelp ? new Date(lastHelp.setHours(0, 0, 0, 0)) : null;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = helper.streak;

    if (!lastHelpDay) {
      // First help ever
      newStreak = 1;
    } else if (lastHelpDay.getTime() === today.getTime()) {
      // Already helped today — don't increment streak
      newStreak = helper.streak;
    } else if (lastHelpDay.getTime() === yesterday.getTime()) {
      // Helped yesterday — continue streak
      newStreak = helper.streak + 1;
    } else {
      // Missed a day — reset streak
      newStreak = 1;
    }

    // Karma points: High urgency = 30pts, Medium = 20pts, Low = 10pts, Paid = +5pts bonus
    const urgencyPoints = request.urgency === "High" ? 30 : request.urgency === "Medium" ? 20 : 10;
    const paidBonus = request.isPaid ? 5 : 0;
    const karmaEarned = urgencyPoints + paidBonus;

    // Check for streak badges
    const badges = helper.badges || [];
    if (newStreak >= 7 && !badges.includes("7day_streak")) badges.push("7day_streak");
    if (newStreak >= 30 && !badges.includes("30day_streak")) badges.push("30day_streak");

    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        helpGivenCount: 1,
        totalHelps: 1,
        karmaPoints: karmaEarned,
        earnings: request.isPaid ? request.budget : 0,
      },
      $set: {
        streak: newStreak,
        lastHelpDate: new Date(),
        longestStreak: Math.max(helper.longestStreak || 0, newStreak),
        badges,
      },
    });

    // Update requester stats
    await User.findByIdAndUpdate(request.userId, {
      $inc: { helpReceivedCount: 1 },
    });

    res.json({
      message: "Request accepted successfully",
      request,
      karmaEarned,
      newStreak,
    });
  } catch (err) {
    console.error("Accept error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/help/:id/complete — Mark as completed
// ─────────────────────────────────────────────
router.patch("/:id/complete", verifyFirebaseToken, async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = "completed";
    await request.save();

    res.json({ message: "Request completed", request });
  } catch (err) {
    console.error("Complete error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/help/leaderboard — Area/City/India leaderboard
// Query: type = area | city | india, city, area
// ─────────────────────────────────────────────
router.get("/leaderboard", verifyFirebaseToken, async (req, res) => {
  try {
    const { type, city, area } = req.query;

    let filter = {};
    if (type === "area" && area) filter.area = area;
    else if (type === "city" && city) filter.city = city;
    // india = no filter

    const leaders = await User.find(filter)
      .sort({ karmaPoints: -1, helpGivenCount: -1 })
      .limit(20)
      .select("name profession karmaPoints helpGivenCount streak badges city area rating isVerified");

    res.json({ leaderboard: leaders, type });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/help/user/location — Update user location
// Called when app opens or user moves
// ─────────────────────────────────────────────
router.patch("/user/location", verifyFirebaseToken, async (req, res) => {
  try {
    const { latitude, longitude, city, area } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        location: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        city: city || "",
        area: area || "",
        lastSeen: new Date(),
        isActive: true,
      },
    });

    res.json({ message: "Location updated" });
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// Haversine formula — calculate distance in km
// ─────────────────────────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = router;