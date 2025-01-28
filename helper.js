import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import { rotatePdf } from "./rotatePDF.js";
import pkg from "pdf-to-printer";
import path from "path";
import qrcode from "qr-image";
import dotenv from "dotenv";
import slugify from "slugify";
import { fetchProduct } from "./autoGenerate.js";

dotenv.config();

const { print, getPrinters } = pkg;

const uploadDir = process.env.UPLOAD_DIR;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getPrinterList = async (barCode) => {
  sleep(10000);

  const options = {
    printer: process.env.PRINTER_NAME,
    pages: "1",
    // scale: "fit",
  };

  try {
    return print(`${uploadDir}rotated_output_${barCode}.pdf`, options).then(
      () => {
        console.log("doc printed");
      }
    );
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
const generateFullBarcode = async (outputPdf, data) => {
  try {
    await fetchProduct(`product.docx`, data);
  } catch (error) {
    console.error("generate barcodes error -->>", error);
    reject(error);
  }
};

const generatePDF = async (
  barCode,
  score,
  intCode,
  suppSubName,
  suppLocation,
  blWeight
) => {
  return new Promise((resolve, reject) => {
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
          const barcodeWidth = 100;
          const barcodeHeight = 40;
          const qrCodeWidth = 40;
          const qrCodeHeight = 40;
          // Write the PNG image to disk
          fs.writeFileSync(uploadDir + "generated-barcode.png", png);
          const image = qrcode.imageSync(barCode, {
            type: "png",
            size: 40,
            margin: 0,
          });

          // Create a PDF and add the barcode image
          const doc = new PDFDocument({
            size: [270, 180],
            layout: "portrait",
          });
          doc.pipe(fs.createWriteStream(`${uploadDir}output_${barCode}.pdf`));
          //  Append Barcode

          doc.image(uploadDir + "generated-barcode.png", 60, 30, {
            width: barcodeWidth,
            height: barcodeHeight,
          });
          // Append QR Code
          doc.image(image, 10, 30, {
            width: qrCodeWidth,
            height: qrCodeHeight,
          });
          doc.fontSize(30).text(score, 175, 40, { height: 70, width: 50 });

          doc.fontSize(9).text(intCode, 10, 80, { height: 20, width: 50 });
          doc.fontSize(9).text(suppSubName, 55, 80, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(suppLocation, 110, 80, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(Math.round(blWeight).toLocaleString("en-US"), 160, 80, {
              height: 20,
            });

          // Append Barcode
          doc.image(uploadDir + "generated-barcode.png", 60, 105, {
            width: barcodeWidth,
            height: barcodeHeight,
          });
          // Append QR Code
          doc.image(image, 10, 105, {
            width: qrCodeWidth,
            height: qrCodeHeight,
          });
          doc.fontSize(30).text(score, 175, 125, { height: 70, width: 50 });

          doc.fontSize(9).text(intCode, 10, 150, { height: 20, width: 50 });
          doc.fontSize(9).text(suppSubName, 55, 150, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(suppLocation, 110, 150, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(Math.round(blWeight).toLocaleString("en-US"), 160, 150, {
              height: 20,
            });

          // Finalize the PDF
          doc.end();

          doc.on("end", async () => {
            // Rotate the PDF and print
            setTimeout(async () => {
              console.log("Waiting for 10 seconds");
              await rotatePdf(
                `${uploadDir}output_${barCode}.pdf`,
                `${uploadDir}rotated_output_${barCode}.pdf`
              );

              setTimeout(async () => {
                console.log("Waiting for 10 seconds");
                await getPrinterList(barCode);
                // remove all files inside uploads directory
                await clearDirectory(uploadDir);
              }, 1000);
            }, 1000);
            resolve();
          });
        }
        console.log("PDF with generated barcode created.");
      }
    );
  });
};

const generateFinishedGoodsSticker = async (item) => {
  return new Promise((resolve, reject) => {
    const { barcode, groupCode, alias, suggestedUnit, productWeight, customerCode } = item;
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: barcode,
        scale: 3,
        height: 10,
        includetext: true,
      },
      async function (err, png) {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          const barcodeWidth = 100;
          const barcodeHeight = 40;
          const qrCodeWidth = 40;
          const qrCodeHeight = 40;
          // Write the PNG image to disk
          fs.writeFileSync(uploadDir + "generated-barcode.png", png);
          const image = qrcode.imageSync(barcode, {
            type: "png",
            size: 40,
            margin: 0,
          });

          // Create a PDF and add the barcode image
          const doc = new PDFDocument({
            size: [270, 180],
            layout: "portrait",
          });
          doc.pipe(fs.createWriteStream(`${uploadDir}output_${barcode}.pdf`));
          //  Append Barcode

          doc.image(uploadDir + "generated-barcode.png", 70, 30, {
            width: barcodeWidth,
            height: barcodeHeight,
          });
          // Append QR Code
          doc.image(image, 25, 30, {
            width: qrCodeWidth,
            height: qrCodeHeight,
          });
          // doc.fontSize(30).text(alias, 175, 40, { height: 70, width: 50 });

          doc
            .fontSize(9)
            .text("Wt : " + productWeight, 25, 80, { height: 20, width: 50 });
          doc.fontSize(9).text(customerCode, 60, 80, { height: 20, width: 50 });

          doc.fontSize(9).text(alias, 90, 80, { height: 20, width: 50 });
          doc.fontSize(9).text(groupCode, 150, 80, { height: 20, width: 50 });
          // doc
          //   .fontSize(9)
          //   .text(suggestedUnit, 110, 50, { height: 20, width: 50 });

          // Append Barcode
          doc.image(uploadDir + "generated-barcode.png", 70, 105, {
            width: barcodeWidth,
            height: barcodeHeight,
          });
          // Append QR Code
          doc.image(image, 25, 105, {
            width: qrCodeWidth,
            height: qrCodeHeight,
          });
          // doc.fontSize(30).text(alias, 175, 125, { height: 70, width: 50 });

          doc
            .fontSize(9)
            .text("Wt : " + productWeight, 25, 150, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(customerCode, 60, 150, { height: 20, width: 50 });

          doc.fontSize(9).text(alias, 90, 150, { height: 20, width: 50 });
          doc.fontSize(9).text(groupCode, 150, 150, { height: 20, width: 50 });
          // doc
          //   .fontSize(9)
          //   .text(suggestedUnit, 110, 150, { height: 20, width: 50 });

          doc
            .fontSize(9)
            .save() // Save the current state
            .rotate(90, { origin: [10, 10] }) // Rotate around the top-left corner (0, 0)
            .text(customerCode, 40, 0, { width: 50 }) // Place the text near the top-left
            .restore(); // Restore the state after the transformation

          doc
            .fontSize(9)
            .save() // Save the current state
            .rotate(90, { origin: [10, 10] }) // Rotate around the top-left corner (0, 0)
            .text(customerCode, 120, 0, { width: 50 }) // Place the text near the top-left
            .restore(); // Restore the state after the transformation

          // Finalize the PDF
          doc.end();

          doc.on("end", async () => {
            // Rotate the PDF and print
            setTimeout(async () => {
              console.log("Waiting for 10 seconds");
              await rotatePdf(
                `${uploadDir}output_${barcode}.pdf`,
                `${uploadDir}rotated_output_${barcode}.pdf`
              );

              setTimeout(async () => {
                console.log("Waiting for 10 seconds");
                await getPrinterList(barcode);
                // remove all files inside uploads directory
                await clearDirectory(uploadDir);
              }, 1000);
            }, 1000);
            resolve();
          });
        }
        console.log("PDF with generated barcode created.");
      }
    );
  });
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
      const filePath = path.join(directory, file);
      await fs.promises.unlink(filePath); // Asynchronously delete each file
      console.log(`Deleted file: ${filePath}`);
    }
    console.log(`All files in '${directory}' have been deleted.`);
  } catch (err) {
    console.error(`Error while clearing directory '${directory}':`, err);
  }
}

const generatePDFQrCode = async (
  barCode,
  score,
  intCode,
  suppSubName,
  suppLocation,
  blWeight
) => {
  return new Promise(async (resolve, reject) => {
    // Write the PNG image to disk
    const image = qrcode.imageSync(barCode, {
      type: "png",
      size: 40,
      margin: 0,
    });
    // .pipe(fs.createWriteStream(`generated_qrcode.png`));

    // fs.writeFileSync(uploadDir+"generated-barcode.png", png);

    // Create a PDF and add the barcode image
    const doc = new PDFDocument({
      size: [270, 180],
      layout: "portrait",
    });
    doc.pipe(fs.createWriteStream(`${uploadDir}output_${barCode}.pdf`));
    doc.image(image, 10, 20, {
      width: 60,
      height: 60,
    });
    doc.fontSize(30).text(score, 175, 40, { height: 70, width: 50 });

    doc.fontSize(9).text(intCode, 90, 20, { height: 20, width: 30 });
    doc.fontSize(9).text(suppSubName, 90, 35, { height: 20, width: 50 });
    doc.fontSize(9).text(suppLocation, 90, 50, { height: 20, width: 50 });

    doc.fontSize(9).text(Math.round(blWeight).toLocaleString("en-US"), 90, 65, {
      height: 20,
    });

    doc.image(image, 10, 95, {
      width: 55,
      height: 55,
    });
    doc.fontSize(30).text(score, 175, 110, { height: 70, width: 50 });

    doc.fontSize(9).text(intCode, 90, 95, { height: 20, width: 50 });
    doc.fontSize(9).text(suppSubName, 90, 110, { height: 20, width: 50 });
    doc.fontSize(9).text(suppLocation, 90, 125, { height: 20, width: 50 });
    doc
      .fontSize(9)
      .text(Math.round(blWeight).toLocaleString("en-US"), 90, 140, {
        height: 20,
      });

    // Finalize the PDF
    doc.end();

    doc.on("end", async () => {
      // Rotate the PDF and print
      setTimeout(async () => {
        console.log("Waiting for 10 seconds");
        await rotatePdf(
          `${uploadDir}output_${barCode}.pdf`,
          `${uploadDir}rotated_output_${barCode}.pdf`
        );

        setTimeout(async () => {
          console.log("Waiting for 10 seconds");
          await getPrinterList(barCode);
          // fs.unlinkSync(`generated_qrcode.png`);
        }, 1000);
      }, 1000);
      resolve();
    });
  });
};

export default {
  generatePDF,
  clearDirectory,
  getPrinterList,
  getFullPrinterList,
  generateFinishedGoodsSticker,
  generatePDFQrCode,
  generateFullBarcode,
};
