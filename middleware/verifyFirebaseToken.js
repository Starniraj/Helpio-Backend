const admin = require("../config/firebaseAdmin");
const User = require("../models/User");

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    // Attach firebase user to request
    req.firebaseUser = decoded;

    // Also attach MongoDB user if exists
    const user = await User.findOne({ firebaseUid: decoded.uid });
    if (user) {
      req.user = user;
    }

    next();
  } catch (err) {
    console.error("Firebase token verification error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyFirebaseToken;