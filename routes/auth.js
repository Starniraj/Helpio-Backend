const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

// ─────────────────────────────────────────────
// POST /api/auth/sync — Create or update user after Firebase login
// ─────────────────────────────────────────────
router.post("/sync", verifyFirebaseToken, async (req, res) => {
  try {
    const { firebaseUid, name, phone, email, profession } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });
    if (!firebaseUid) return res.status(400).json({ message: "firebaseUid required" });

    // ✅ Always update name, phone, profession on every login
    // This fixes the bug where second login shows old name
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      {
        $set: {
          name,
          phone,
          email,
          profession,
        },
      },
      { upsert: true, new: true }
    );

    console.log("User synced:", user.email, "| Name:", user.name);
    res.json(user);
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/profile — Get current user's fresh profile from DB
// Called on every app open to get latest data
// ─────────────────────────────────────────────
router.get("/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.firebaseUser.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;