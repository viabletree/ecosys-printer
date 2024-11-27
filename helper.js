import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import { rotatePdf } from "./rotatePDF.js";
import pkg from "pdf-to-printer";
import path from "path";
import qrcode from "qr-image";
import dotenv from "dotenv";
dotenv.config();

const { print, getPrinters } = pkg;

const uploadDir = "uploads/";

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

const getFullPrinterList = async (barCode) => {
  sleep(10000);

  const options = {
    printer: process.env.FULL_PRINTER_NAME,
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

// 2.4 W
// 3.5 H

const generateFullBarcode = async (barCode, productName, productCategory) => {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: barCode,
        scale: 3,
        height: 30,
        includetext: true,
      },
      async function (err, png) {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          // Write the PNG image to disk
          fs.writeFileSync(uploadDir + "generated-barcode.png", png);

          // Create a PDF and add the barcode image
          const barcodeWidth = 350; // Adjusted barcode width
          const barcodeHeight = 150; // Adjusted barcode height
           const image = qrcode.imageSync(barCode, {
             type: "png",
             size: 40,
             margin: 0,
           });


          const doc = new PDFDocument({
            size: "A4",
            layout: "portrait",
          });

          
const pageWidth = doc.page.width; // Get the page width
const qrCodeWidth = 100; // Set the width of the QR code image
const qrCodeHeight = 100; // Set the height of the QR code image

// Calculate the x coordinate to center the image
const x = (pageWidth - qrCodeWidth) / 2;
const y = 150; // Set the y coordinate for ver

          doc.pipe(fs.createWriteStream(`${uploadDir}output_${barCode}.pdf`));

          // Add Barcode Number at the Top
          doc
            .font("Helvetica")
            .fontSize(12)
            .text(barCode, { align: "center", lineGap: 10 });

          // Add Product Name in the Center
          doc.moveDown().fontSize(25).text(productName, { align: "center" });

              doc.image(image, x, y, {
                width: qrCodeWidth,
                height: qrCodeHeight,
              });

          // Append Barcode Image in the Middle
          doc.image(uploadDir + "generated-barcode.png", 120, 300, {
            width: barcodeWidth,
            height: barcodeHeight,
            align: "center",
          });

          // Add Barcode Number Below the Barcode
          // doc
          //   .font("Helvetica-Bold")
          //   .moveDown(4)
          //   .fontSize(15)
          //   .text(`* ${barCode} *`, { align: "center", lineGap: 10 });

          // Add Product Category at the Bottom
          doc
            .moveDown(12)
            .fontSize(20)
            .text(productCategory, { align: "center" });

          // Add Smaller Barcode Below the Product Category
          doc.image(uploadDir + "generated-barcode.png", 250, 520, {
            width: 100,
            height: 30,
            align: "center",
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
                // await getFullPrinterList(barCode);
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
                // await getPrinterList(barCode);
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
async function clearDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.error(`Directory does not exist: ${directory}`);
    return;
  }

  // try {
  //   const files = await fs.promises.readdir(directory); // Read directory contents
  //   for (const file of files) {
  //     const filePath = path.join(directory, file);
  //     await fs.promises.unlink(filePath); // Asynchronously delete each file
  //     console.log(`Deleted file: ${filePath}`);
  //   }
  //   console.log(`All files in '${directory}' have been deleted.`);
  // } catch (err) {
  //   console.error(`Error while clearing directory '${directory}':`, err);
  // }
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
  getPrinterList,
  generatePDFQrCode,
  generateFullBarcode,
};
