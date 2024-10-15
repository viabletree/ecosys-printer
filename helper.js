import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import { rotatePdf } from "./rotatePDF.js";
import pkg from "pdf-to-printer";
import path from "path";
const { print, getPrinters } = pkg;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const sendToPrint = async () => {
  sleep(5000);
  const options = {
    printer: "Zebra S4M (203 dpi) - ZPL",
    pages: "1",
  };
  try {
    print(path.resolve("output.pdf"), options).then(console.log);
  } catch (error) {
    console.log(error);
  }
};
// 2.4 W
// 3.5 H
const generatePDF = async (
  barCode,
  score,
  intCode,
  suppSubName,
  suppLocation,
  blWeight
) => {
  await bwipjs.toBuffer(
    {
      bcid: "code128",
      text: barCode,
      scale: 3,
      height: 10,
      includetext: true,
    },
    function (err, png) {
      if (err) {
        console.error(err);
      } else {
        // Write the PNG image to disk
        fs.writeFileSync(path.resolve("generated-barcode.png"), png);
        // Create a PDF and add the barcode image
        const doc = new PDFDocument({
          size: [270, 180],
          layout: "portrait",
        });
        doc.pipe(fs.createWriteStream(path.resolve("output.pdf")));
        doc.image("generated-barcode.png", 10, 10, {
          width: 210,
          height: 40,
        });
        doc.fontSize(30).text(score, 225, 15, { height: 70, width: 50 });
        doc.fontSize(9).text(intCode, 10, 55, { height: 20, width: 30 });
        doc.fontSize(9).text(suppSubName, 75, 55, { height: 20, width: 50 });
        doc.fontSize(9).text(suppLocation, 145, 55, { height: 20, width: 50 });
        doc
          .fontSize(9)
          .text(Math.round(blWeight).toLocaleString("en-US"), 215, 55, {
            height: 20,
          });
        doc.image("generated-barcode.png", 10, 90, {
          width: 210,
          height: 40,
        });
        doc.fontSize(30).text(score, 225, 95, { height: 70, width: 50 });
        doc.fontSize(9).text(intCode, 10, 140, { height: 20, width: 50 });
        doc.fontSize(9).text(suppSubName, 75, 140, { height: 20, width: 50 });
        doc.fontSize(9).text(suppLocation, 145, 140, { height: 20, width: 50 });
        doc
          .fontSize(9)
          .text(Math.round(blWeight).toLocaleString("en-US"), 215, 140, {
            height: 20,
          });
        doc.end();
        doc.rotate(90);
        console.log("PDF with generated barcode created.");

        doc.on("end", async () => {
          console.log("PDF created successfully");
          //   await rotatePdf("output.pdf", "getPrinterList.pdf");
          console.log("PDF rotated successfully");
          await sendToPrint();
        });
      }
    }
  );
};

export { generatePDF, getPrinters as getPrinterList };
