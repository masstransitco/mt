// pages/api/processDocument.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createWorker } from 'tesseract.js';
import { Storage } from '@google-cloud/storage';

type Data = {
  success: boolean;
  extractedData?: {
    chineseName: string | null;
    englishName: string | null;
    hkid: string | null;
    expiryDate: string | null;
    refNumber: string | null;
    dateOfBirth: string | null;
    dateOfIssue: string | null;
  };
  error?: string;
};

// Helper function to extract the required fields from the OCR text.
function extractHKIDData(text: string) {
  // For Chinese name, assume label "姓名:" followed by Chinese characters.
  const chineseNameRegex = /姓名[:：]\s*([\u4e00-\u9fff\s]+)/;
  // For English name, assume label "Name:" followed by letters and spaces.
  const englishNameRegex = /Name[:：]\s*([A-Za-z\s]+)/;
  // HKID number: letter followed by 6 digits and a check digit in parentheses.
  const hkidRegex = /(?:HKID[:：]\s*)?([A-Z]\d{6}\(\d\))/i;
  // Driving License – Expiry date (e.g., "Expiry:" or "有效期:") in dd/mm/yyyy format.
  const expiryRegex = /(?:Expiry|有效期)[:：]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i;
  // Driving License – Reference number (e.g., "Ref:" or "參考號:").
  const refRegex = /(?:Ref|參考號)[:：]\s*([\w-]+)/i;
  // ID – Date of Birth (e.g., "DOB:" or "出生日期:").
  const dobRegex = /(?:DOB|出生日期)[:：]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i;
  // ID – Date of Issue (e.g., "Date of Issue:" or "發證日期:").
  const doiRegex = /(?:Date of Issue|發證日期)[:：]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i;
  
  const chineseNameMatch = text.match(chineseNameRegex);
  const englishNameMatch = text.match(englishNameRegex);
  const hkidMatch = text.match(hkidRegex);
  const expiryMatch = text.match(expiryRegex);
  const refMatch = text.match(refRegex);
  const dobMatch = text.match(dobRegex);
  const doiMatch = text.match(doiRegex);

  return {
    chineseName: chineseNameMatch ? chineseNameMatch[1].trim() : null,
    englishName: englishNameMatch ? englishNameMatch[1].trim() : null,
    hkid: hkidMatch ? hkidMatch[1].trim() : null,
    expiryDate: expiryMatch ? expiryMatch[1].trim() : null,
    refNumber: refMatch ? refMatch[1].trim() : null,
    dateOfBirth: dobMatch ? dobMatch[1].trim() : null,
    dateOfIssue: doiMatch ? doiMatch[1].trim() : null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Expect the request to include: imageData (base64 string), userId, and docType.
    const { imageData, userId, docType } = req.body;
    if (!imageData || !userId || !docType) {
      res.status(400).json({ success: false, error: 'Missing required parameters' });
      return;
    }

    // Initialize Tesseract worker and load both English and Traditional Chinese.
    const worker = createWorker();
    await worker.load();
    // Load both English and Chinese (Traditional) language data.
    await worker.loadLanguage('eng+chi_tra');
    await worker.initialize('eng+chi_tra');

    // Run OCR on the provided image.
    const { data: { text } } = await worker.recognize(imageData);
    // Extract fields using our custom extraction function.
    const extractedData = extractHKIDData(text);

    await worker.terminate();

    // Prepare JSON content containing OCR results.
    const jsonContent = JSON.stringify({
      docType,
      extractedData,
      timestamp: new Date().toISOString(),
    });

    // Set up Google Cloud Storage (make sure your service account credentials are set in env variables).
    const storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string),
    });
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error("FIREBASE_STORAGE_BUCKET env variable not set");
    }
    const bucket = storage.bucket(bucketName);

    // Define a file path to store the OCR JSON results.
    const fileName = `ocrResults/${userId}/${docType}.json`;
    const file = bucket.file(fileName);

    // Save the JSON file in Firebase Storage.
    await file.save(jsonContent, {
      metadata: { contentType: 'application/json' },
      public: false,
    });

    res.status(200).json({ success: true, extractedData });
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}
