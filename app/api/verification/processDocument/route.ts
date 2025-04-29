// /src/app/api/verification/processDocument/route.ts

// @ts-ignore no type defs
import tencentcloud from "tencentcloud-sdk-nodejs-intl-en";
import { Storage } from "@google-cloud/storage";
import { db } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

const OcrClient = tencentcloud.ocr.v20181119.Client;

/** 
 * HKIDCardOCR Response fields as documented in Tencent Cloud API
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
  HeadImage?: string;
  WarnCardInfos?: number[];
  RequestId?: string;
}

// The shape of the data returned by our route
type ApiData = {
  success: boolean;
  hkidData?: HKIDCardOcrData;
  error?: string;
  debugInfo?: any; // For including debug info in development
};

/** 
 * Next.js 13 "POST" route handler
 */
export async function POST(request: Request) {
  try {
    // Parse JSON body from the request
    const { imageUrl, userId, docType } = await request.json() as {
      imageUrl?: string;
      userId?: string;
      docType?: string;
    };

    console.log(`OCR request received for user ${userId}, docType ${docType}`);
    
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
      console.log("Calling Tencent OCR API...");
      ocrResponse = await client.HKIDCardOCR(reqParams);
      
      // Store a copy of the raw response for logging
      const responseStr = JSON.stringify(ocrResponse, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      );
      
      console.log("OCR API raw response:", responseStr);
      
      // Validate response existence
      if (!ocrResponse) {
        throw new Error("Empty response from OCR API");
      }
    } catch (ocrErr) {
      console.error("OCR API call error:", ocrErr);
      const errorDetails = {
        message: ocrErr instanceof Error ? ocrErr.message : "Unknown OCR error",
        name: ocrErr instanceof Error ? ocrErr.name : "Unknown",
        stack: ocrErr instanceof Error ? ocrErr.stack : undefined
      };
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorDetails.message,
          debugInfo: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        } as ApiData,
        { status: 500 }
      );
    }

    // 5) Extract all response fields according to the API documentation
    // Create a safe HKIDCardOcrData object from the response
    const hkidData: HKIDCardOcrData = {};
    
    // Safely extract all fields
    if (typeof ocrResponse.CnName === 'string') hkidData.CnName = ocrResponse.CnName;
    if (typeof ocrResponse.EnName === 'string') hkidData.EnName = ocrResponse.EnName;
    if (typeof ocrResponse.IdNum === 'string') hkidData.IdNum = ocrResponse.IdNum;
    if (typeof ocrResponse.Birthday === 'string') hkidData.Birthday = ocrResponse.Birthday;
    if (typeof ocrResponse.Sex === 'string') hkidData.Sex = ocrResponse.Sex;
    if (typeof ocrResponse.FirstIssueDate === 'string') hkidData.FirstIssueDate = ocrResponse.FirstIssueDate;
    if (typeof ocrResponse.CurrentIssueDate === 'string') hkidData.CurrentIssueDate = ocrResponse.CurrentIssueDate;
    if (typeof ocrResponse.Symbol === 'string') hkidData.Symbol = ocrResponse.Symbol;
    if (typeof ocrResponse.TelexCode === 'string') hkidData.TelexCode = ocrResponse.TelexCode;
    if (typeof ocrResponse.Permanent === 'number') hkidData.Permanent = ocrResponse.Permanent;
    if (typeof ocrResponse.RequestId === 'string') hkidData.RequestId = ocrResponse.RequestId;
    
    // Handle HeadImage if ReturnHeadImage was set to true
    if (typeof ocrResponse.HeadImage === 'string') hkidData.HeadImage = ocrResponse.HeadImage;
    
    // Handle WarnCardInfos array with extra safety
    if (ocrResponse.WarnCardInfos) {
      // Check if it's an array
      if (Array.isArray(ocrResponse.WarnCardInfos)) {
        // Convert any BigInts to Numbers
        hkidData.WarnCardInfos = ocrResponse.WarnCardInfos.map((val: any) => 
          typeof val === 'bigint' ? Number(val) : 
          typeof val === 'number' ? val : 
          typeof val === 'string' ? parseInt(val, 10) : 
          -9999 // Default value for unexpected types
        ).filter((val: any) => !isNaN(val)); // Filter out any NaN values
      } else {
        // If it's not an array, convert to array with single value if possible
        const val = ocrResponse.WarnCardInfos;
        if (typeof val === 'bigint' || typeof val === 'number' || typeof val === 'string') {
          const numVal = typeof val === 'bigint' ? Number(val) :
                        typeof val === 'number' ? val :
                        parseInt(val, 10);
                        
          if (!isNaN(numVal)) {
            hkidData.WarnCardInfos = [numVal];
          } else {
            hkidData.WarnCardInfos = [];
          }
        } else {
          hkidData.WarnCardInfos = [];
        }
      }
    } else {
      hkidData.WarnCardInfos = [];
    }

    console.log("Extracted HKID data:", JSON.stringify(hkidData));

    // 7) (Optional) Save JSON to Google Cloud Storage
    try {
      const storage = new Storage({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        credentials: JSON.parse(process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_KEY as string),
      });
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error("FIREBASE_STORAGE_BUCKET env variable not set");
      }
      const bucket = storage.bucket(bucketName);
      
      // Changed filename to avoid conflict with Tesseract OCR
      const fileName = `ocrResults/${userId}/${docType}-tencent.json`;
      const jsonContent = JSON.stringify({
        docType,
        hkidData,
        timestamp: new Date().toISOString(),
      });
      
      console.log(`Saving OCR results to ${fileName}`);
      await bucket.file(fileName).save(jsonContent, {
        metadata: { contentType: "application/json" },
        public: false,
      });
      console.log("OCR results saved to Storage successfully");
    } catch (storageErr) {
      console.error("Error saving to Cloud Storage:", storageErr);
      // Continue processing - storage is not critical for the operation
    }

    // 8) (Optional) Store recognized OCR data in Firestore
    try {
      console.log("Updating Firestore with OCR data");
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
      console.log("Firestore updated successfully");
    } catch (firestoreErr) {
      console.error("Error saving to Firestore:", firestoreErr);
      // Continue processing - Firestore is important but we can still return OCR data
    }

    // 9) Return success
    console.log("OCR process completed successfully, returning response");
    const successResponse: ApiData = { success: true, hkidData };
    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("HKID OCR error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const errorResponse: ApiData = { success: false, error: msg };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
