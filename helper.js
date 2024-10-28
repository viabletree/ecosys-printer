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

const getPrinterList = async (barCode) => {
  // const printersName = await getPrinters()
  // console.log(printersName.length)
  // for (let i = 0; i < printersName.length; i++) {
  //     console.log(printersName[i].name)
  // }

  sleep(10000);

  const options = {
    printer: "Zebra S4M (203 dpi) - ZPL",
    pages: "1",
    // scale: "fit",
  };

  try {
    return print(`rotated_output_${barCode}.pdf`, options).then(() => {
      console.log("doc printed");

      const rotatedOutputPath = `rotated_output_${barCode}.pdf`;

      const outputPath = `output_${barCode}.pdf`;

      fs.unlinkSync(rotatedOutputPath);
      fs.unlinkSync(outputPath);
    });
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
          // Write the PNG image to disk
          fs.writeFileSync("generated-barcode.png", png);

          // Create a PDF and add the barcode image
          const doc = new PDFDocument({
            size: [270, 180],
            layout: "portrait",
          });
          doc.pipe(fs.createWriteStream(`output_${barCode}.pdf`));
          doc.image("generated-barcode.png", 10, 20, {
            width: 155,
            height: 40,
          });
          doc.fontSize(30).text(score, 175, 40, { height: 70, width: 50 });

          doc.fontSize(9).text(intCode, 10, 70, { height: 20, width: 30 });
          doc.fontSize(9).text(suppSubName, 75, 70, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(suppLocation, 145, 70, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(Math.round(blWeight).toLocaleString("en-US"), 215, 55, {
              height: 20,
            });

          doc.image("generated-barcode.png", 10, 95, {
            width: 155,
            height: 40,
          });
          doc.fontSize(30).text(score, 175, 110, { height: 70, width: 50 });

          doc.fontSize(9).text(intCode, 10, 140, { height: 20, width: 50 });
          doc.fontSize(9).text(suppSubName, 75, 140, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(suppLocation, 145, 140, { height: 20, width: 50 });
          doc
            .fontSize(9)
            .text(Math.round(blWeight).toLocaleString("en-US"), 215, 140, {
              height: 20,
            });

          // Finalize the PDF
          doc.end();

          doc.on("end", async () => {
            // Rotate the PDF and print
            setTimeout(async () => {
              console.log("Waiting for 10 seconds");
              await rotatePdf(
                `output_${barCode}.pdf`,
                `rotated_output_${barCode}.pdf`
              );

              setTimeout(async () => {
                console.log("Waiting for 10 seconds");
                await getPrinterList(barCode);
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

export default { generatePDF, getPrinterList };
