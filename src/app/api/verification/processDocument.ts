// /src/app/api/verification/processDocument.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import tencentcloud from "tencentcloud-sdk-nodejs";
import { Storage } from "@google-cloud/storage";
import { db } from "@/lib/firebase-admin";

const OcrClient = tencentcloud.ocr.v20181119.Client;

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
  // We want strictly number[] after conversion:
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
    const { imageUrl, userId, docType } = req.body;
    if (!imageUrl || !userId || !docType) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    // ------------------------------------------------------------------------
    // 1) Read credentials from env
    // ------------------------------------------------------------------------
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    if (!secretId || !secretKey) {
      throw new Error('Missing Tencent Cloud API credentials. Check TENCENT_SECRET_ID / TENCENT_SECRET_KEY.');
    }

    // ------------------------------------------------------------------------
    // 2) Create an OCR client config with your credentials
    // ------------------------------------------------------------------------
    const clientConfig = {
      credential: {
        secretId,
        secretKey,
      },
      region: "", // typically an empty string for HKID OCR
      profile: {
        httpProfile: {
          endpoint: "ocr.tencentcloudapi.com",
        }
      }
    };

    // 3) Instantiate the OCR client
    const client = new OcrClient(clientConfig);

    // 4) Build and call the HKIDCardOCR request with ImageUrl
    const reqParams = {
      ReturnHeadImage: false,
      ImageUrl: imageUrl, // Must be publicly accessible
    };

    const ocrResponse = await client.HKIDCardOCR(reqParams);

    // ------------------------------------------------------------------------
    // Convert WarnCardInfos from (number|bigint)[] to number[]
    // ------------------------------------------------------------------------
    const rawWarnCards = ocrResponse.WarnCardInfos; // Possibly undefined or (number | bigint)[]
    const warnCardsAsNumbers = rawWarnCards?.map((val) =>
      typeof val === "bigint" ? Number(val) : val
    );

    // ------------------------------------------------------------------------
    // 5) Extract relevant HKID fields, using our converted array
    // ------------------------------------------------------------------------
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
      WarnCardInfos: warnCardsAsNumbers,
    };

    // ------------------------------------------------------------------------
    // 6) (Optional) Save JSON to Google Cloud Storage
    // ------------------------------------------------------------------------
    const storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string),
    });
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error("FIREBASE_STORAGE_BUCKET env variable not set");
    }
    const bucket = storage.bucket(bucketName);
    const fileName = `ocrResults/${userId}/${docType}-hkidocr.json`;
    const jsonContent = JSON.stringify({
      docType,
      hkidData,
      timestamp: new Date().toISOString(),
    });

    await bucket.file(fileName).save(jsonContent, {
      metadata: { contentType: "application/json" },
      public: false,
    });

    // ------------------------------------------------------------------------
    // 7) Store recognized OCR data in Firestore (optional)
    // ------------------------------------------------------------------------
    await db
      .collection("users")
      .doc(userId)
      .set(
        {
          documents: {
            [docType]: {
              ocrData: hkidData,
              updatedAt: Date.now(),
            },
          },
        },
        { merge: true }
      );

    // ------------------------------------------------------------------------
    // 8) Return success to the client
    // ------------------------------------------------------------------------
    return res.status(200).json({ success: true, hkidData });
    
  } catch (err) {
    console.error('HKID OCR error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ success: false, error: msg });
  }
}
