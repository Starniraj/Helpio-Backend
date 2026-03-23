const express = require("express");
const router = express.Router();
const User = require("../models/User");
const veryifyFirebaseToken = require("../middleware/verifyFirebaseToken");

// sync user after firebase verification
router.post("/sync", veryifyFirebaseToken, async (req, res) => {
  try {
    const { firebaseUid, name, phone, email, profession } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    if (!firebaseUid) {
      return res.status(400).json({ message: "firebaseUid required" });
    }

    // check user already exists with email, if exists update info, else create new user
      const user = await User.findOneAndUpdate({firebaseUid},
        {$set:{name, phone, email, profession}},{upsert: true,new:true});

    console.log("User updated:", user.email);

    res.json(user);
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;