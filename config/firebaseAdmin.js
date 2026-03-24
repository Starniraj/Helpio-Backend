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

// const admin = require("firebase-admin");

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//     }),
//   });
// }

// module.exports = admin;

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;