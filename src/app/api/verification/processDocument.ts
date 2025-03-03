// /src/app/api/verification/processDocument.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { OcrClient, ClientProfile, HttpProfile, Credential } from 'tencentcloud-sdk-nodejs/ocr/v20181119';
import { Storage } from '@google-cloud/storage';

// 1) IMPORT Firestore Admin from your firebase-admin helper
import { db } from "@/lib/firebase-admin";

/** 
 * HKIDCardOCR Response fields 
 */
interface HKIDCardOcrData {
  CnName?: string;        
  EnName?: string;        
  IdNum?: string;         
  Birthday?: string;      
  Sex?: string;           
  Permanent?: number;     
  FirstIssueDate?: string;
  CurrentIssueDate?: string;
  Symbol?: string;        
  TelexCode?: string;
  WarnCardInfos?: number[];
}

type Data = {
  success: boolean;
  hkidData?: HKIDCardOcrData;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // We expect { userId, docType, imageUrl }
    const { imageUrl, userId, docType } = req.body;
    if (!imageUrl || !userId || !docType) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    // ------------------------------------------------------------------------
    // 1) Initialize Tencent Cloud Credential
    // ------------------------------------------------------------------------
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    if (!secretId || !secretKey) {
      throw new Error('Missing Tencent Cloud API credentials. Check TENCENT_SECRET_ID / TENCENT_SECRET_KEY.');
    }

    const credential = new Credential(secretId, secretKey);
    const httpProfile = new HttpProfile();
    httpProfile.endpoint = 'ocr.tencentcloudapi.com';

    const clientProfile = new ClientProfile();
    clientProfile.httpProfile = httpProfile;

    // 2) Create OCR client
    const client = new OcrClient(credential, '', clientProfile);

    // 3) Build OCR request using ImageUrl
    const reqParams = {
      ReturnHeadImage: false,
      ImageUrl: imageUrl, // Must be publicly accessible or accessible to Tencent
    };

    // 4) Call the OCR operation
    const ocrResponse = await client.HKIDCardOCR(reqParams);

    // 5) Extract relevant HKID fields
    const hkidData: HKIDCardOcrData = {
      CnName: ocrResponse.CnName,
      EnName: ocrResponse.EnName,
      IdNum: ocrResponse.IdNum,
      Birthday: ocrResponse.Birthday,
      Sex: ocrResponse.Sex,
      Permanent: ocrResponse.Permanent,
      FirstIssueDate: ocrResponse.FirstIssueDate,
      CurrentIssueDate: ocrResponse.CurrentIssueDate,
      Symbol: ocrResponse.Symbol,
      TelexCode: ocrResponse.TelexCode,
      WarnCardInfos: ocrResponse.WarnCardInfos,
    };

    // ------------------------------------------------------------------------
    // 6) (Optional) Save JSON in Google Cloud Storage
    // ------------------------------------------------------------------------
    const jsonContent = JSON.stringify({
      docType,
      hkidData,
      timestamp: new Date().toISOString(),
    });

    const storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string),
    });
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('FIREBASE_STORAGE_BUCKET env variable not set');
    }
    const bucket = storage.bucket(bucketName);
    const fileName = `ocrResults/${userId}/${docType}-hkidocr.json`;
    const file = bucket.file(fileName);
    await file.save(jsonContent, {
      metadata: { contentType: 'application/json' },
      public: false,
    });

    // ------------------------------------------------------------------------
    // 7) NEW: Store the recognized OCR data in Firestore under the user
    // ------------------------------------------------------------------------
    // We'll do a merge to avoid overwriting other fields. 
    // This sets documents.<docType>.ocrData and a timestamp.
    await db
      .collection("users")
      .doc(userId)
      .set({
        documents: {
          [docType]: {
            ocrData: hkidData,
            updatedAt: Date.now(),
          }
        }
      }, { merge: true });

    // 8) Return the recognized HKID data
    return res.status(200).json({ success: true, hkidData });
    
  } catch (err) {
    console.error('HKID OCR error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ success: false, error: msg });
  }
}
