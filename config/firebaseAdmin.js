const admin = require('firebase-admin');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const serviceAccountPath = path.join(__dirname, `../firebase/serviceAccountKey.${env}.json`);

let serviceAccount;
try {
    serviceAccount = require(serviceAccountPath);
} catch (err) {
    console.error('Failed to load Firebase service account JSON:', serviceAccountPath, err.message);
    serviceAccount = null;
}

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        // Initialize without explicit credentials (will use ADC if available)
        admin.initializeApp();
    }
}

module.exports = admin;