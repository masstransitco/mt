// /src/app/api/verification/processDocument/route.ts

import tencentcloud from "tencentcloud-sdk-nodejs";
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

    const ocrResponse = await client.HKIDCardOCR(reqParams);

    // 5) Convert WarnCardInfos from (number|bigint)[] to number[]
    const rawWarnCards = ocrResponse.WarnCardInfos;
    const warnCardsAsNumbers = rawWarnCards?.map((val: number | bigint) =>
      typeof val === "bigint" ? Number(val) : val
    );

    // 6) Extract relevant HKID fields
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

    // 7) (Optional) Save JSON to Google Cloud Storage
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

    // 8) (Optional) Store recognized OCR data in Firestore
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
