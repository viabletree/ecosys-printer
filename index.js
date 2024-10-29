import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import ptp from "pdf-to-printer";
import helper from "./helper.js";

const { generatePDF, generatePDFQrCode } = helper;

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
    // const array = [
    //   {
    //     barCode: "bbbbbbbbbb",
    //     score: "50",
    //     intCode: "232313",
    //     suppSubName: "2323232w",
    //     suppLocation: "232232",
    //     blWeight: "3432323",
    //   },

    //   {
    //     barCode: "aaaaaaaaaa",
    //     score: "30",
    //     intCode: "sds",
    //     suppSubName: "dsfds",
    //     suppLocation: "232232",
    //     blWeight: "3432323",
    //   },

    //   {
    //     barCode: "sidjsjd2323",
    //     score: "30",
    //     intCode: "232313",
    //     suppSubName: "2323232w",
    //     suppLocation: "232232",
    //     blWeight: "23232",
    //   },
    // ];

    console.log("body -->>>", body);

    const { items, isBarcode } = body;

    if (items?.length > 0) {
      for (let item of items) {
        if (isBarcode)
          await generatePDF(
            item.barCode,
            item.score,
            item.intCode,
            item.suppSubName,
            item.suppLocation,
            item.blWeight
          );
        else
          await generatePDFQrCode(
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
app.listen(8000, () => console.log("RUNNING ON PORT 8000"));
