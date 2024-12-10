import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import ptp from "pdf-to-printer";
import helper from "./helper.js";
import dotenv from "dotenv";
import fs from "fs";
import { monitorPrintJob } from "./cleanDirectory.js";

dotenv.config();

const { generatePDF, generateFullBarcode, clearDirectory, getFullPrinterList } =
  helper;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + file.originalname);
  },
});
const upload = multer({ storage: storage });
const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/file-upload", upload.single("file"), async (req, res) => {
  try {
    const tmpFilePath = path.join(`./uploads/${req?.file?.filename}`);

    await ptp.print(tmpFilePath);
    await ptp.print(tmpFilePath);
    await ptp.print(tmpFilePath);

    res.status(200).json({ success: "file upload successful" });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

app.post("/api/generate-barcodes", async (req, res) => {
  try {
    const body = req?.body;

    console.log("body -->>>", body);

    const { items, isBarcode } = body;

    if (items?.length > 0) {
      for (let item of items) {
        await generatePDF(
          item.barCode,
          item.score,
          item.intCode,
          item.suppSubName,
          item.suppLocation,
          item.blWeight
        );
      }
    }

    return res.status(200).json({ success: "barcodes generated successfully" });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});
app.post("/api/generate-full-barcodes", async (req, res) => {
  try {
    const body = req?.body;
    const err = [];

    console.log("body -->>>", body);
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (!item.legacyCode) {
        err.push("legacyCode");
      }
      if (!item.productName) {
        err.push("productName");
      }
      if (!item.productCategory) {
        err.push("productCategory");
      }
    }
    if (err.length > 0) {
      // check which field is missing
      const msg = "Please provide the required fields";
      return res.status(400).json({
        data: [
          {
            message: msg,
            key: "product",
            data: {
              key: err.join(", "),
            },
          },
        ],
        message: msg,
        status: false,
        statusCode: 400,
      });
    }
    const resultPdf = [];
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      resultPdf.push(
        await generateFullBarcode(
          item.legacyCode,
          item.productName,
          item.productCategory
        )
      );
    }

    for(let i = 0; i < resultPdf.length; i++){
      console.log('Printing resultPdf[i][1] -->>', resultPdf[i][1]);
      await getFullPrinterList(resultPdf[i][1]);
    }
    console.log('----------- / Pringint complete -----------')
    

    monitorPrintJob(function(){
      console.log('Ready to delete all');
      for (let i = 0; i < resultPdf.length; i++) {
        console.log("Removing resultPdf[i][1] -->>", resultPdf[i][1]);
        fs.unlinkSync(resultPdf[i][0]);
        fs.unlinkSync(resultPdf[i][1]);
        fs.unlinkSync(resultPdf[i][2]);
      }
    } );
    // await clearDirectory();
    console.log("resultPdf -->>", resultPdf);
    return res.status(200).json({
      status: true,
      message: "Barcode printed successfully uploaded successfully",
    });
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    return res.status(500).json({ error: error });
  }
});
app.listen(process.env.PORT, () =>
  console.log("RUNNING ON PORT " + process.env.PORT)
);
