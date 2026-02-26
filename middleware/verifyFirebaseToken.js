const admin = require("../config/firebaseAdmin");

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = await admin.auth().verifyIdToken(token,true);

    req.user = decoded;
    next();

  } catch (error) {
    console.error("Firebase token verification error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};