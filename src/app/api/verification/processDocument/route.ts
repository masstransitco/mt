// /src/app/api/verification/processDocument/route.ts

// @ts-expect-error no type defs
import tencentcloud from "tencentcloud-sdk-nodejs-intl-en";
import { Storage } from "@google-cloud/storage";
import { db } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

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
  WarnCardInfos?: number[];
}

// The shape of the data returned by our route
type ApiData = {
  success: boolean;
  hkidData?: HKIDCardOcrData;
  error?: string;
};

/** 
 * Next.js 13 "POST" route handler
 * Instead of export default, we do `export async function POST(request: Request)`
 */
export async function POST(request: Request) {
  try {
    // Parse JSON body from the request
    const { imageUrl, userId, docType } = await request.json() as {
      imageUrl?: string;
      userId?: string;
      docType?: string;
    };

    if (!imageUrl || !userId || !docType) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" } as ApiData,
        { status: 400 }
      );
    }

    // 1) Read credentials from env
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    if (!secretId || !secretKey) {
      throw new Error(
        "Missing Tencent Cloud API credentials. Check TENCENT_SECRET_ID / TENCENT_SECRET_KEY."
      );
    }

    // 2) Create an OCR client config with your credentials
    const clientConfig = {
      credential: {
        secretId,
        secretKey,
      },
      region: "", // typically empty string for HKID OCR
      profile: {
        httpProfile: {
          endpoint: "ocr.tencentcloudapi.com",
        },
      },
    };

    // 3) Instantiate the OCR client
    const client = new OcrClient(clientConfig);

    // 4) Build and call the HKIDCardOCR request with ImageUrl
    const reqParams = {
      ReturnHeadImage: false,
      ImageUrl: imageUrl, // must be publicly accessible
    };

    // Wrap OCR API call in a try/catch block for additional safety
    let ocrResponse;
    try {
      ocrResponse = await client.HKIDCardOCR(reqParams);
      
      // Validate that we have a proper response
      if (!ocrResponse || typeof ocrResponse !== 'object') {
        throw new Error("Invalid response format from OCR API");
      }
    } catch (ocrErr) {
      console.error("OCR API call error:", ocrErr);
      return NextResponse.json(
        { 
          success: false, 
          error: ocrErr instanceof Error ? ocrErr.message : "Failed to process document with OCR API" 
        } as ApiData,
        { status: 500 }
      );
    }

    // 5) Convert WarnCardInfos from (number|bigint)[] to number[] with robust validation
    let warnCardsAsNumbers: number[] = [];
    try {
      if (ocrResponse.WarnCardInfos && Array.isArray(ocrResponse.WarnCardInfos)) {
        warnCardsAsNumbers = ocrResponse.WarnCardInfos.map((val: any) => 
          typeof val === "bigint" ? Number(val) : Number(val)
        );
      }
    } catch (warnErr) {
      console.warn("Error processing WarnCardInfos:", warnErr);
      // Continue processing - this field is not critical
    }

    // 6) Extract relevant HKID fields with safe access
    const hkidData: HKIDCardOcrData = {
      CnName: ocrResponse.CnName || undefined,
      EnName: ocrResponse.EnName || undefined,
      IdNum: ocrResponse.IdNum || undefined,
      Birthday: ocrResponse.Birthday || undefined,
      Sex: ocrResponse.Sex || undefined,
      Permanent: typeof ocrResponse.Permanent === 'number' ? ocrResponse.Permanent : undefined,
      FirstIssueDate: ocrResponse.FirstIssueDate || undefined,
      CurrentIssueDate: ocrResponse.CurrentIssueDate || undefined,
      Symbol: ocrResponse.Symbol || undefined,
      TelexCode: ocrResponse.TelexCode || undefined,
      WarnCardInfos: warnCardsAsNumbers,
    };

    // 7) (Optional) Save JSON to Google Cloud Storage
    try {
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
    } catch (storageErr) {
      console.error("Error saving to Cloud Storage:", storageErr);
      // Continue processing - storage is not critical for the operation
    }

    // 8) (Optional) Store recognized OCR data in Firestore
    try {
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
          { merge: true },
        );
    } catch (firestoreErr) {
      console.error("Error saving to Firestore:", firestoreErr);
      // Continue processing - Firestore is important but we can still return OCR data
    }

    // 9) Return success
    const successResponse: ApiData = { success: true, hkidData };
    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("HKID OCR error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const errorResponse: ApiData = { success: false, error: msg };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
