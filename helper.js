import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import { rotatePdf } from "./rotatePDF.js";
import pkg from "pdf-to-printer";
import AdmZip from "adm-zip";
const fsPromise = fs.promises;
import path from "path";
import qrcode from "qr-image";
import dotenv from "dotenv";
import slugify from "slugify";
import { generateDocument, getDocumentFile } from "./autoGenerate.js";

dotenv.config();

const { print, getPrinters } = pkg;

const uploadDir = process.env.UPLOAD_DIR;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getPrinterList = async (pdf, printer, pages = "1") => {
  // sleep(10000);
  console.log("Calling getPrinterList");
  const printerFor = printer;
  // const printerFor = "Zebra S4M (203 dpi) - ZPL (Copy 1)";
  const options = {
    // printer: printer,
    printer: printerFor,
    scale: "noscale",
    pages: pages,
    win32: ["-print-to", printerFor, "-silent"],
  };

  try {
    return print(pdf, options).then(() => {
      console.log("doc printed");
    });
  } catch (error) {
    console.log(error);
  }
};

const getFullPrinterList = async (filePath) => {
  sleep(10000);

  const options = {
    printer: process.env.FULL_PRINTER_NAME,
    pages: "1",
    // scale: "fit",
  };

  try {
    return print(filePath, options).then(() => {
      console.log("doc printed");
    });
  } catch (error) {
    console.log(error);
  }
};

// 2.4 W
// 3.5 H
async function createBarcode(barCode) {
  return new Promise(function (resolve, reject) {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: barCode,
        scale: 3,
        height: 10,
        includetext: true,
      },
      async function (err, png) {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(png);
        }
      }
    );
  });
}

async function extractZip(zipPath) {
  const extractDir = path.join(
    path.dirname(zipPath),
    path.basename(zipPath, ".zip")
  );

  // ensure folder exists
  await fsPromise.mkdir(extractDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);

  return extractDir;
}

async function getAllFiles(dir) {
  let files = [];

  const entries = await fsPromise.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const generatePDF = async (printer, document, data, barcodes) => {
  const doc = await getDocumentFile(document);
  // const BATCH_SIZE = Math.ceil(barcodes.length * 0.1); // 10%
  // OR fixed size:
  const BATCH_SIZE = 10;

  for (let i = 0; i < barcodes.length; i += BATCH_SIZE) {
    const batch = barcodes.slice(i, i + BATCH_SIZE);

    // 1️⃣ Generate PDFs in parallel (batch level)
    const pdfs = await Promise.all(
      batch.map((bCode) =>
        generateDocument(doc, {
          barcode: bCode,
          ...data,
        })
      )
    );

    // 2️⃣ Print sequentially (printer safe)
    for (const pdf of pdfs) {
      await getPrinterList(pdf, printer);
    }

    console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }

  // await getPrinterList(pdf, printer);

  // const rotatedPdf = `${uploadDir}output_${barcode}.pdf`; // `${uploadDir}rotated_output_${barcode}.pdf`;
  // await rotatePdf(pdf, rotatedPdf);

  // remove all files inside uploads directory
  await clearDirectory(uploadDir);
};

const generateFinishedGoodsSticker = async (filePath, item, printer) => {
  const file = await getDocumentFile(filePath);
  const pdf = await generateDocument(file, item);
  // const rotatedPdf = `${uploadDir}rotated_output_${item.barcode}.pdf`;
  // await rotatePdf(pdf, rotatedPdf);

  await getPrinterList(pdf, printer);
  // remove all files inside uploads directory
  await clearDirectory(uploadDir);
};
const generateGroupPackSticker = async (filePath, item, printer) => {
  const file = await getDocumentFile(filePath);
  const pdf = await generateDocument(file, item);
  // const rotatedPdf = `${uploadDir}rotated_output_${item.barcode}.pdf`;
  // await rotatePdf(pdf, rotatedPdf);

  await getPrinterList(pdf, printer, "");
  // remove all files inside uploads directory
  await clearDirectory(uploadDir);
};

const generateInventoryBarcodeSticker = async (filePath, item, printer) => {
  const file = await getDocumentFile(filePath);
  const pdf = await generateDocument(file, item);
  // const rotatedPdf = `${uploadDir}rotated_output_${item.barcode}.pdf`;
  // await rotatePdf(pdf, rotatedPdf);

  await getPrinterList(pdf, printer, "");
  // remove all files inside uploads directory
  await clearDirectory(uploadDir);
};

/**
 * Deletes all files in the specified directory asynchronously using `await`.
 * @param {string} directory - The path to the directory.
 */

async function clearDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.error(`Directory does not exist: ${directory}`);
    return;
  }

  try {
    const entries = await fsPromise.readdir(directory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name === ".gitignore") continue;

      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // ✅ delete folder recursively
        await fsPromise.rm(fullPath, {
          recursive: true,
          force: true,
        });
        console.log(`Deleted folder: ${fullPath}`);
      } else {
        // ✅ delete file
        await fsPromise.unlink(fullPath);
        console.log(`Deleted file: ${fullPath}`);
      }
    }

    console.log(`Directory cleared: ${directory}`);
  } catch (err) {
    console.error(`Error clearing directory '${directory}':`, err);
  }
}

export default {
  generatePDF,
  clearDirectory,
  getPrinterList,
  getFullPrinterList,
  generateFinishedGoodsSticker,
  generateGroupPackSticker,
  generateInventoryBarcodeSticker,
  extractZip,
  getAllFiles,
};
