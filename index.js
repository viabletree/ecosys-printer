import express from "express";
import cors from "cors";
import helper from "./helper.js";
import dotenv from "dotenv";
import {
  finishedGoodsBrandPrint,
  getDocumentFile,
  downloadZipFile,
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

    console.log("body -->>>", body);

    const { items, filePath, printer, isBarcode } = body;

    // const csv = items.map((item) => item).join(",");

    // const fileUrl = `${process.env.FILE_BASE_URL}/download/zip/${csv}`;

    // const zip = await downloadZipFile(fileUrl);

    // console.log("downloaded zip file -->>", zip);
    // // 2️⃣ Extract ZIP
    // const extractedDir = await extractZip(zip);
    // console.log("Extracted to:", extractedDir);
    // // 3️⃣ Collect all file paths
    // const files = await getAllFiles(extractedDir);
    // console.log("Files inside zip:", files);

    // // 4️⃣ (Optional) Print files
    // for (const file of files) {
    //   await getPrinterList(file, printer);
    // }

    // await clearDirectory(uploadDir);

    // Now Extract zip and collect path of all files inside extracted folder

    const barcodes = [];
    let data;
    if (items?.length > 0) {
      for (let item of items) {
        const { barcode, ...rest } = item;
        barcodes.push(barcode);
        data = rest;
      }
      console.time("generatePDF");
      await generatePDF(
        printer,
        filePath,
        data,
        barcodes
        // item?.barcode,
        // item?.score,
        // item?.intCode,
        // item?.suppSubName,
        // item?.suppLocation,
        // item?.blWeight,
        // item?.value,
        // item?.order?.orderSource?.name,
        // item?.code,
        // item?.inventoryDate,
        // item?.warehouse,
        // item?.order?.orderSource,
        // item?.order?.orderSupplier,
        // item?.sailingDate,
        // item?.product,
      );
      console.timeEnd("generatePDF");
    }

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
