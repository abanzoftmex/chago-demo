import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    privateKey = privateKey.replace(/^"|"$/g, "");
    privateKey = privateKey.replace(/\\n/g, "\n");
}

if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin credentials in .env");
    process.exit(1);
}

try {
    initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: "chago-demo.firebasestorage.app",
    });
    console.log("Firebase Admin initialized.");
} catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    process.exit(1);
}

const bucket = getStorage().bucket();

const corsConfiguration = [
    {
        maxAgeSeconds: 3600,
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        origin: ['*'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
    },
];

async function setCors() {
    try {
        console.log("Setting CORS on bucket...");
        await bucket.setCorsConfiguration(corsConfiguration);
        console.log("CORS configuration applied successfully!");

        // Verify
        const [metadata] = await bucket.getMetadata();
        console.log("Current CORS:", JSON.stringify(metadata.cors, null, 2));
    } catch (error) {
        console.error("Failed to set CORS:", error);
    }
}

setCors();
