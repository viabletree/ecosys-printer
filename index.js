import express from "express";
import cors from "cors";
import helper from "./helper.js";
import dotenv from "dotenv";
import {
  finishedGoodsBrandPrint,
  getDocumentFile,
  generateDocument,
  downloadZipFile,
  applyDefaultValues,
} from "./autoGenerate.js";
import pkg from "pdf-to-printer";
const { getPrinters } = pkg;
// getPrinters().then(console.log);

dotenv.config();

const {
  generatePDF,
  generateFinishedGoodsSticker,
  generateGroupPackSticker,
  generateInventoryBarcodeSticker,
  clearDirectory,
  getFullPrinterList,
  extractZip,
  getAllFiles,
  getPrinterList,
} = helper;

const uploadDir = process.env.UPLOAD_DIR;

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/generate-barcodes", async (req, res) => {
  try {
    const body = req?.body;

    const { items, filePath, printer, isBarcode, assets } = body;

    const { barcodes, data } = assets;

    const manipulatedData = barcodes.map((item, index) => {
      return {
        ...data,
        ...applyDefaultValues(data),
        barcode: item,
        isLast: index === barcodes.length - 1 ? true : false,
      };
    });

    console.time("downloadDocFile");
    const filePathDoc = await getDocumentFile(filePath);
    console.timeEnd("downloadDocFile");

    console.time("generateDocument");
    const pdfPath = await generateDocument(filePathDoc, {
      data: manipulatedData,
    });
    console.timeEnd("generateDocument");

    console.time("printDocuments");
    // for (let i = 0; i < items; i++) {
    //   await getPrinterList(pdfPath, printer, (i + 1).toString());
    // }
    await getPrinterList(pdfPath, printer);
    console.timeEnd("printDocuments");

    await clearDirectory(uploadDir);

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});
app.get("/hello", (req, res) => {
  return res.status(200).json({ success: "barcodes generated successfully" });
});
app.post("/api/generate-group-pack-sticker", async (req, res) => {
  try {
    const { stickerData, packingType, filePath, printer } = req?.body;

    console.log("body -->>>", stickerData);
    await generateGroupPackSticker(filePath, stickerData, printer);

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});

app.post("/api/generate-inventory-barcode-sticker", async (req, res) => {
  try {
    const { stickerData, packingType, filePath, printer } = req?.body;

    console.log("body -->>>", stickerData);
    await generateInventoryBarcodeSticker(filePath, stickerData, printer);

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

    let copies = 1;
    if (item.numberOfCopies) {
      copies = item.numberOfCopies;
    }
    const pdf = await finishedGoodsBrandPrint(
      item.templatePath,
      item.templateData,
    );
    for (let i = 0; i < copies; i++) {
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
  console.log("RUNNING ON PORT " + process.env.PORT),
);
