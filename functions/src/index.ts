import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createWorker } from 'tesseract.js';
import path from 'path';

admin.initializeApp();

// Helper: Extract required fields from OCR text.
function extractHKIDData(text: string) {
  // Adjust these regex patterns to match your document format.
  const chineseNameRegex = /姓名[:：]\s*([\u4e00-\u9fff\s]+)/;
  const englishNameRegex = /Name[:：]\s*([A-Za-z\s]+)/;
  const hkidRegex = /(?:HKID[:：]\s*)?([A-Z]\d{6}\(\d\))/i;
  const expiryRegex = /(?:Expiry|有效期)[:：]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i;
  const refRegex = /(?:Ref|參考號)[:：]\s*([\w-]+)/i;
  const dobRegex = /(?:DOB|出生日期)[:：]\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i;
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

// Cloud Function triggered when a new document image is uploaded.
// Change the path pattern as needed.
export const processDocumentOnUpload = functions.storage.object().onFinalize(async (object) => {
  try {
    // Check if the file path matches our expected folder, e.g., users/{userId}/{docType}/...
    if (!object.name) {
      console.log("No file name provided.");
      return;
    }

    // Only process JPEG images (or adjust as needed)
    if (!object.contentType || !object.contentType.startsWith('image/')) {
      console.log("File is not an image.");
      return;
    }
    
    // Example: file path "users/{userId}/{docType}/{timestamp}.jpg"
    const pathParts = object.name.split('/');
    if (pathParts.length < 3) {
      console.log("Unexpected file path structure:", object.name);
      return;
    }
    
    const userId = pathParts[1];
    const docType = pathParts[2]; // e.g., "id-document" or "driving-license"

    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(object.name);
    // Download the file contents into a buffer.
    const [fileBuffer] = await file.download();

    // Convert the file buffer to a base64 string.
    const imageData = `data:${object.contentType};base64,${fileBuffer.toString('base64')}`;

    // Initialize Tesseract.js worker (await createWorker() since it returns a Promise)
    const worker = await createWorker();
    await worker.load();
    // Load both English and Traditional Chinese language data.
    await worker.loadLanguage('eng+chi_tra');
    await worker.initialize('eng+chi_tra');

    // Run OCR on the image.
    const { data: { text } } = await worker.recognize(imageData);
    console.log("OCR text:", text);
    const extractedData = extractHKIDData(text);
    
    await worker.terminate();

    // Prepare JSON content
    const jsonContent = JSON.stringify({
      docType,
      extractedData,
      timestamp: new Date().toISOString(),
    });

    // Save the JSON file to Firebase Storage in an ocrResults folder.
    const jsonFileName = `ocrResults/${userId}/${docType}.json`;
    const jsonFile = bucket.file(jsonFileName);
    await jsonFile.save(jsonContent, {
      metadata: { contentType: 'application/json' },
      public: false,
    });

    console.log(`OCR results saved to ${jsonFileName}`);
  } catch (error) {
    console.error("Error in processDocumentOnUpload:", error);
  }
});
