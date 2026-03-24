const admin = require("../config/firebaseAdmin");

module.exports = async (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];

    // if (!token) {
    //   return res.status(401).json({ message: "No token provided" });
    // }

    const decoded = await admin.auth().verifyIdToken(token,true);

    req.user = decoded;
    next();

    console.log("AUTH HEADER:", authHeader);

  } catch (error) {
    console.error("Firebase token verification error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};