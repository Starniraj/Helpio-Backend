const router = require("express").Router();
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { syncUser } = require("../controllers/auth.controller");

router.post("/sync", verifyFirebaseToken, syncUser);

module.exports = router;