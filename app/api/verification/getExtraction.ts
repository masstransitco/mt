// src/app/api/verification/getExtraction.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Storage } from '@google-cloud/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Expect query parameters: userId and docType (e.g., "id-document" or "driving-license")
  const { userId, docType } = req.query;
  if (!userId || !docType) {
    res.status(400).json({ error: "Missing required query parameters: userId and docType" });
    return;
  }
  
  try {
    // Initialize Google Cloud Storage using your service account credentials
    const storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string),
    });
  
    // Ensure your bucket name is set in your environment variables
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      res.status(500).json({ error: "FIREBASE_STORAGE_BUCKET env variable not set" });
      return;
    }
  
    const bucket = storage.bucket(bucketName);
    const fileName = `ocrResults/${userId}/${docType}.json`;
    const file = bucket.file(fileName);
  
    // Download the file contents as a buffer and parse as JSON
    const [contents] = await file.download();
    const jsonData = JSON.parse(contents.toString());
  
    res.status(200).json(jsonData);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).json({ error: "Error retrieving file" });
  }
}
