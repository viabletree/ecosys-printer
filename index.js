import express from "express";
import cors from "cors";
import helper from "./helper.js";
import dotenv from "dotenv";
import { finishedGoodsBrandPrint } from "./autoGenerate.js";

dotenv.config();

const {
  generatePDF,
  generateFinishedGoodsSticker,
  clearDirectory,
  getFullPrinterList,
} = helper;

const uploadDir = process.env.UPLOAD_DIR;

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/generate-barcodes", async (req, res) => {
  try {
    const body = req?.body;

    console.log("body -->>>", body);

    const { items, filePath, printer, isBarcode } = body;

    if (items?.length > 0) {
      for (let item of items) {
        await generatePDF(
          item.barcode,
          item.score,
          item.intCode,
          item.suppSubName,
          item.suppLocation,
          item.blWeight,
          item.value,
          item.order.orderSource.name,
          printer,
          filePath
        );
      }
    }

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});

app.post("/api/generate-finished-goods-sticker", async (req, res) => {
  try {
    const { stickerData, packingType, filePath, printer } = req?.body;

    console.log("body -->>>", stickerData);
    await generateFinishedGoodsSticker(filePath, stickerData, printer);

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});

app.post("/api/generate-finished-goods-brand", async (req, res) => {
  try {
    const item = req?.body;

    console.log("body -->>>", item);
    let copies = 1;
    if (item.numberOfCopies) {
      copies = item.numberOfCopies;
    }
    for (let i = 0; i < copies; i++) {
      const pdf = await finishedGoodsBrandPrint(
        item.templatePath,
        item.templateData
      );

      await getFullPrinterList(pdf);
    }
    await clearDirectory(uploadDir);

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () =>
  console.log("RUNNING ON PORT " + process.env.PORT)
);

/**
 
PRINTER_NAME="Zebra S4M (203 dpi) - ZPL"
FULL_PRINTER_NAME="HP LaserJet M14-M17"
PORT=8000
UPLOAD_DIR="uploads/"
ENDPOINT="http://localhost:8000"
BASE_URL=http://172.16.3.7:3000/api/
PO_ENDPOINT=admin/purchaseOrder/foo/

 */