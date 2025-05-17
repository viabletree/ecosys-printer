import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import { rotatePdf } from "./rotatePDF.js";
import pkg from "pdf-to-printer";
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

const getPrinterList = async (pdf, printer) => {
  sleep(10000);

  const options = {
    printer: printer,
    pages: "1",
    scale: "noscale",
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

const generatePDF = async (
  barcode,
  score,
  intCode,
  suppSubName,
  suppLocation,
  blWeight,
  weightValue,
  sourceName,
  code,
  printer,
  document
) => {
  const doc = await getDocumentFile(document);
  const pdf = await generateDocument(doc, {
    barcode,
    score,
    intCode,
    suppSubName,
    suppLocation,
    blWeight,
    weightValue,
    code,
    sourceName,
  });

  // const rotatedPdf = `${uploadDir}output_${barcode}.pdf`; // `${uploadDir}rotated_output_${barcode}.pdf`;
  // await rotatePdf(pdf, rotatedPdf);

  await getPrinterList(pdf, printer);
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

  await getPrinterList(pdf, printer);
  // remove all files inside uploads directory
  await clearDirectory(uploadDir);
};

/**
 * Deletes all files in the specified directory asynchronously using `await`.
 * @param {string} directory - The path to the directory.
 */
async function clearDirectory() {
  const directory = uploadDir;
  if (!fs.existsSync(directory)) {
    console.error(`Directory does not exist: ${directory}`);
    return;
  }

  try {
    const files = await fs.promises.readdir(directory); // Read directory contents
    for (const file of files) {
      if (file === ".gitignore") continue; // Skip the .gitignore file
      const filePath = path.join(directory, file);
      await fs.promises.unlink(filePath); // Asynchronously delete each file
      console.log(`Deleted file: ${filePath}`);
    }
    console.log(`All files in '${directory}' have been deleted.`);
  } catch (err) {
    console.error(`Error while clearing directory '${directory}':`, err);
  }
}

export default {
  generatePDF,
  clearDirectory,
  getPrinterList,
  getFullPrinterList,
  generateFinishedGoodsSticker,
  generateGroupPackSticker
};
