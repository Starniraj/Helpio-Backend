// const admin = require('firebase-admin');
// const path = require('path');

// const env = process.env.NODE_ENV || 'development';
// const serviceAccountPath = path.join(__dirname, `../firebase/serviceAccountKey.${env}.json`);

// let serviceAccount;
// try {
//     serviceAccount = require(serviceAccountPath);
// } catch (err) {
//     console.error('Failed to load Firebase service account JSON:', serviceAccountPath, err.message);
//     serviceAccount = null;
// }

// if (!admin.apps.length) {
//     if (serviceAccount) {
//         admin.initializeApp({
//             credential: admin.credential.cert(serviceAccount),
//         });
//     } else {
//         // Initialize without explicit credentials (will use ADC if available)
//         admin.initializeApp();
//     }
// }

// module.exports = admin;



//New code 401 auth solved no local cache used from line 31

const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_PRIVATE_KEY) {
  // 🔥 Production (Render)
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
} else {
  // 🧪 Local fallback
  serviceAccount = require("../firebase/serviceAccountKey.dev.json");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;