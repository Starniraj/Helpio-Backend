const express = require("express");
const router = express.Router();
const HelpRequest = require("../models/HelpRequest");
const User = require("../models/User");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { Expo } = require("expo-server-sdk");
const expo = new Expo();

// Profession → Category mapping
const CATEGORY_PROFESSION_MAP = {
  "Ride / Lift": ["Driver", "Delivery Partner", "Student", "Freelancer", "Other"],
  "Delivery": ["Delivery Partner", "Driver", "Student", "Freelancer", "Other"],
  "Vehicle Help": ["Driver", "Engineer", "Freelancer", "Other"],
  "Home Help": ["Plumber", "Electrician", "Engineer", "Freelancer", "Other"],
  "Emergency": ["Student", "Teacher", "Engineer", "Plumber", "Electrician", "Driver", "Delivery Partner", "Freelancer", "Other"],
  "Other": ["Student", "Teacher", "Engineer", "Plumber", "Electrician", "Driver", "Delivery Partner", "Freelancer", "Other"],
};

// ─────────────────────────────────────────────
// Helper: Send push notification
// ─────────────────────────────────────────────
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([{ to: pushToken, sound: "default", title, body, data }]);
  } catch (err) {
    console.error("Push error:", err.message);
  }
}

// ─────────────────────────────────────────────
// PATCH /api/help/user/location — Update user location + push token
// ─────────────────────────────────────────────
router.patch("/user/location", verifyFirebaseToken, async (req, res) => {
  try {
    const { latitude, longitude, city, area, expoPushToken } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ message: "latitude and longitude required" });

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        location: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
        city: city || "",
        area: area || "",
        lastSeen: new Date(),
        isActive: true,
        ...(expoPushToken && { expoPushToken }), // save push token if provided
      },
    });

    res.json({ message: "Location updated" });
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/help — Post a new help request
// ─────────────────────────────────────────────
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const { category, description, urgency, isPaid, budget, latitude, longitude, city, area } = req.body;

    if (!req.user) return res.status(404).json({ message: "User not found. Please sync first." });
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
      location: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
      city: city || "",
      area: area || "",
    });

    // 🔔 PUSH NOTIFICATION — notify nearby active users
    // Only for HIGH urgency or paid requests
    if (urgency === "High" || isPaid) {
      const nearbyUsers = await User.find({
        _id: { $ne: req.user._id },
        isActive: true,
        expoPushToken: { $exists: true, $ne: null },
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
            $maxDistance: 4000, // 4km
          },
        },
      }).select("expoPushToken profession");

      // Filter by profession (unless HIGH urgency)
      const usersToNotify = urgency === "High"
        ? nearbyUsers
        : nearbyUsers.filter((u) => {
            const allowed = CATEGORY_PROFESSION_MAP[category] || [];
            return allowed.includes(u.profession);
          });

      const title = urgency === "High" ? "🚨 Urgent Help Needed Nearby!" : "💰 Paid Help Request Nearby!";
      const body = `${category}: ${description.substring(0, 60)}...`;

      for (const u of usersToNotify) {
        await sendPushNotification(u.expoPushToken, title, body, {
          screen: "offerHelp",
          requestId: helpRequest._id.toString(),
        });
      }
    }

    res.status(201).json({ message: "Help request posted successfully", request: helpRequest });
  } catch (err) {
    console.error("Post help error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/help/nearby — Get nearby active requests
// ─────────────────────────────────────────────
router.get("/nearby", verifyFirebaseToken, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;
    if (!latitude || !longitude) return res.status(400).json({ message: "latitude and longitude required" });
    if (!req.user) return res.status(404).json({ message: "User not found" });

    const userProfession = req.user.profession;
    const isStudent = userProfession === "Student";
    const radiusInMeters = parseFloat(radius) || 4000;

    // Expire old requests
    await HelpRequest.updateMany(
      { status: "active", expiresAt: { $lt: new Date() } },
      { $set: { status: "expired" } }
    );

    // Build profession/urgency filter
    let categoryFilter = {};
    if (!isStudent) {
      const allowedCategories = Object.entries(CATEGORY_PROFESSION_MAP)
        .filter(([_, professions]) => professions.includes(userProfession))
        .map(([category]) => category);

      categoryFilter = {
        $or: [
          { urgency: "High" }, // HIGH urgency visible to everyone
          { category: { $in: allowedCategories } },
        ],
      };
    }

    const requests = await HelpRequest.find({
      status: "active",
      userId: { $ne: req.user._id },          // not own requests
      declinedBy: { $ne: req.user._id },       // 🔥 exclude declined requests
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: radiusInMeters,
        },
      },
      ...categoryFilter,
    })
      .sort({ urgency: -1, createdAt: -1 })
      .limit(50);

    const formatted = requests.map((r) => {
      const [reqLng, reqLat] = r.location.coordinates;
      const distanceKm = getDistanceKm(parseFloat(latitude), parseFloat(longitude), reqLat, reqLng);
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
// GET /api/help/my-requests — Requester's own requests
// ─────────────────────────────────────────────
router.get("/my-requests", verifyFirebaseToken, async (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: "User not found" });

    const requests = await HelpRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const formatted = requests.map((r) => ({
      id: r._id.toString(),
      category: r.category,
      description: r.description,
      urgency: r.urgency,
      isPaid: r.isPaid,
      budget: r.budget,
      status: r.status,
      acceptedBy: r.acceptedBy?.toString() || null,
      createdAt: r.createdAt.getTime(),
    }));

    res.json({ requests: formatted });
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
    if (request.status !== "active") return res.status(400).json({ message: "Request is no longer active" });
    if (request.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot accept your own request" });
    }

    request.status = "accepted";
    request.acceptedBy = req.user._id;
    request.acceptedAt = new Date();
    await request.save();

    // 🔔 Notify REQUESTER that someone accepted
    const requester = await User.findById(request.userId).select("expoPushToken name");
    if (requester?.expoPushToken) {
      await sendPushNotification(
        requester.expoPushToken,
        "✅ Someone accepted your request!",
        `${req.user.name} is ready to help with your ${request.category} request.`,
        { screen: "chat", requestId: request._id.toString() }
      );
    }

    // Update streak + karma
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const helper = await User.findById(req.user._id);
    const lastHelp = helper.lastHelpDate ? new Date(helper.lastHelpDate) : null;
    const lastHelpDay = lastHelp ? new Date(lastHelp.setHours(0, 0, 0, 0)) : null;
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = helper.streak;
    if (!lastHelpDay) newStreak = 1;
    else if (lastHelpDay.getTime() === today.getTime()) newStreak = helper.streak;
    else if (lastHelpDay.getTime() === yesterday.getTime()) newStreak = helper.streak + 1;
    else newStreak = 1;

    const urgencyPoints = request.urgency === "High" ? 30 : request.urgency === "Medium" ? 20 : 10;
    const karmaEarned = urgencyPoints + (request.isPaid ? 5 : 0);

    const badges = helper.badges || [];
    if (newStreak >= 7 && !badges.includes("7day_streak")) badges.push("7day_streak");
    if (newStreak >= 30 && !badges.includes("30day_streak")) badges.push("30day_streak");

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { helpGivenCount: 1, totalHelps: 1, karmaPoints: karmaEarned, earnings: request.isPaid ? request.budget : 0 },
      $set: { streak: newStreak, lastHelpDate: new Date(), longestStreak: Math.max(helper.longestStreak || 0, newStreak), badges },
    });

    await User.findByIdAndUpdate(request.userId, { $inc: { helpReceivedCount: 1 } });

    res.json({ message: "Request accepted", request, karmaEarned, newStreak });
  } catch (err) {
    console.error("Accept error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/help/:id/complete — Mark completed
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
// GET /api/help/leaderboard
// ─────────────────────────────────────────────
router.get("/leaderboard", verifyFirebaseToken, async (req, res) => {
  try {
    const { type, city, area } = req.query;
    let filter = {};
    if (type === "area" && area) filter.area = area;
    else if (type === "city" && city) filter.city = city;

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
// Haversine distance formula
// ─────────────────────────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function deg2rad(deg) { return deg * (Math.PI / 180); }

module.exports = router;