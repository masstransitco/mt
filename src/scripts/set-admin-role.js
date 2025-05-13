// Run this script to set admin role for a specified email
// Usage: node src/scripts/set-admin-role.js user@example.com

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Get email from command line argument
const email = process.argv[2] || 'joseph@air.city';

if (!email) {
  console.error('Please provide an email address as an argument');
  process.exit(1);
}

// Initialize Firebase Admin - using the exact same pattern as in src/lib/firebase-admin.ts
if (!admin.apps.length) {
  // Option A: Single JSON string in process.env.SERVICE_ACCOUNT_KEY
  if (process.env.SERVICE_ACCOUNT_KEY) {
    console.log(process.env.SERVICE_ACCOUNT_KEY);
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Option B: Use separate env variables for projectId, privateKey, clientEmail
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
}

async function setAdminRole(email) {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true,
      role: 'admin'
    });
    
    // Verify the claims were set
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    console.log(`Successfully set admin role for ${email}`);
    console.log('User custom claims:', updatedUser.customClaims);
    
    return true;
  } catch (error) {
    console.error(`Error setting admin role for ${email}:`, error);
    return false;
  }
}

setAdminRole(email)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
