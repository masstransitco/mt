const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Initialize Firebase Admin with your service account
const serviceAccount = process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_KEY)
  : {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminRole(uid) {
  try {
    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, { 
      admin: true,
      role: 'admin'
    });
    
    console.log(`Successfully set admin role for user: ${uid}`);
    
    // Verify the claims were set
    const user = await admin.auth().getUser(uid);
    console.log('User custom claims:', user.customClaims);
    
    return true;
  } catch (error) {
    console.error('Error setting admin role:', error);
    return false;
  }
}

// Replace with the Firebase UID of the user you want to make admin
const userIdToMakeAdmin = process.argv[2];

if (!userIdToMakeAdmin) {
  console.error('Please provide a user ID as a command line argument');
  process.exit(1);
}

setAdminRole(userIdToMakeAdmin)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
