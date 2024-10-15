import fs from "fs";
import path from "path";
import { PDFDocument, degrees } from "pdf-lib";

async function rotatePdf(inputPath, outputPath) {
  const existingPdfBytes = fs.readFileSync(inputPath);

  const pdfDoc = await PDFDocument.load(existingPdfBytes, {
    ignoreEncryption: true,
  });

  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const currentRotation = page.getRotation().angle;
    const newRotation = (currentRotation + 90) % 360;
    page.setRotation(degrees(newRotation));
  });

  const pdfBytes = await pdfDoc.save();

  fs.writeFileSync(path.resolve(outputPath), pdfBytes);

  console.log("Rotated PDF saved to", outputPath);
}

export { rotatePdf };
