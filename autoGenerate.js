import fs from "fs";
import path from "path";
import axios from "axios";
import mammoth from "mammoth";
import crypto from "crypto";
import { createReport } from "docx-templates";
import qrcode from "qr-image";
import bwipjs from "bwip-js";

import { exec } from "child_process";

const uploadDir = "./uploads";
const isWin = process.platform === "win32";

function sanitizeFileName(fileName) {
  return fileName
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace special characters with underscores
    .replace(/_{2,}/g, "_") // Replace multiple underscores with a single underscore
    .replace(/^_|_$/g, "") // Remove leading and trailing underscores
    .toLowerCase(); // Convert to lower case (optional)
}

async function convertDocxToPdfLibreOffice(docxPath, outputDir) {
  // Returns a promise that resolves or rejects based on the execution result
  const cmd = isWin
    ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe" '
    : "libreoffice ";
  const command = `${cmd} --headless --convert-to pdf "${docxPath}" --outdir "${outputDir}"`;
  // console.log("command", command);
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error converting DOCX to PDF: ${stderr}`);
        return reject(new Error(stderr));
      }
      console.log(
        `PDF generated at: ${path.join(
          outputDir,
          path.basename(docxPath, ".docx") + ".pdf"
        )}`
      );
      resolve();
    });
  });
}

async function fetchProduct(fileName, id) {
  // console.log({ response: data });
  try {
     const url = `${process.env.BASE_URL}${process.env.ENDPOINT}${id}`;
     console.log(url);
     const response = await axios.get(url);
    if (!data) {
      return "Data not found";
    }
    if (!fileName.endsWith(".docx") && !fileName.endsWith(".doc")) {
      // if file exists return empty with message
      // file must be doc or docx file checck if docx file
      return "File must be a docx file";
    }
    const filePath = `${uploadDir}/${fileName}`;
    if (!fs.existsSync(filePath)) {
      return "File not found";
    }
    const template = fs.readFileSync(filePath);

    const updatedData = await processDocxVariables(filePath, data);

    const buffer = await createReport({
      template,
      cmdDelimiter: ["{{", "}}"],
      data: updatedData,
      additionalJsContext: {
        barcode: async (data) => {
          return {
            width: 6,
            height: 6,
            data: await generateBarcode(data),
            extension: ".gif",
          };
        },
        qrcode: async (data) => {
          return {
            width: 6,
            height: 6,
            data: await generateQRCode(data),
            extension: ".gif",
          };
        },
      },
      failFast: false,
    });
    // Write the report to a file
    const newFileName = sanitizeFileName(`${crypto.randomUUID()}-${fileName}`);
    const newPdfName = `${newFileName}.pdf`;
    const outputPath = `${uploadDir}/${newFileName}`;
    console.log("Creating docx file from template and variables");
    fs.writeFileSync(outputPath, buffer);

    console.log("Converting docx to pdf");
    await convertDocxToPdfLibreOffice(outputPath, `${uploadDir}`);
    console.log("removing docx file from server");
    // fs.unlinkSync(outputPath);
    return newPdfName;
  } catch (error) {
    console.log({ error });
  }
}


async function finishedGoodsBrandPrint(fileUrl, data) {
  try {
    // Validate fileUrl
    if (!fileUrl.endsWith(".docx") && !fileUrl.endsWith(".doc")) {
      return "File must be a .docx or .doc file";
    }


    if (!data) {
      return "Data not found";
    }

    // Download the file from the provided URL
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    if (response.status !== 200) {
      return "Failed to download the file";
    }

    const downloadedFileName = `${crypto.randomUUID()}-${fileUrl
      .split("/")
      .pop()}`;
    const filePath = `${uploadDir}/${sanitizeFileName(downloadedFileName)}`;
    fs.writeFileSync(filePath, response.data);
    console.log(`File downloaded to ${filePath}`);

    // Read the downloaded file
    const template = fs.readFileSync(filePath);

    // Process variables and create updated data
    const updatedData = await processDocxVariables(filePath, data);

    // Generate the report
    const buffer = await createReport({
      template,
      cmdDelimiter: ["{{", "}}"],
      data: updatedData,
      additionalJsContext: {
        barcode: async (data) => {
          return {
            width: 6,
            height: 6,
            data: await generateBarcode(data),
            extension: ".gif",
          };
        },
        qrcode: async (data) => {
          return {
            width: 6,
            height: 6,
            data: await generateQRCode(data),
            extension: ".gif",
          };
        },
      },
      failFast: false,
    });

    // Write the generated file to disk
    const newFileName = sanitizeFileName(
      `${crypto.randomUUID()}-${downloadedFileName}`
    );
    const newPdfName = `${newFileName}.pdf`;
    const outputPath = `${uploadDir}/${newFileName}`;
    console.log("Creating docx file from template and variables");
    fs.writeFileSync(outputPath, buffer);

    // Convert to PDF
    console.log("Converting docx to pdf");
    await convertDocxToPdfLibreOffice(outputPath, `${uploadDir}`);
    console.log("Removing docx file from server");
    // fs.unlinkSync(outputPath);

    return `${uploadDir}/${newPdfName}`;
  } catch (error) {
    console.error({ error });
    throw new Error("An error occurred while processing the document");
  }
}




















function getRandomKeys(inputObject, count = 2) {
  const keys = Object.keys(inputObject);
  const selectedKeys = [];

  while (selectedKeys.length < count) {
    const randomIndex = Math.floor(Math.random() * keys.length);
    const key = keys[randomIndex];
    if (!selectedKeys.includes(key)) {
      selectedKeys.push(key);
    }
  }

  return selectedKeys;
}
// // Function to map the variables to the data object and add missing ones
function mapVariablesToData(docVariables, data) {
  docVariables.forEach((variable) => {
    const keys = variable.split(".");
    let current = data;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      if (i === keys.length - 1) {
        // If it's the last key, check if it exists or assign null
        if (!(key in current)) {
          current[key] = `{{${key}}}`;
        } 
      } else {
        // If the key doesn't exist, create an empty object
        if (!(key in current)) {
          current[key] = {};
        }
        current = current[key]; // Move deeper into the object
      }
    }
  });
  return data;
}

// Main function
async function processDocxVariables(filePath, data) {
  // const text = await extractTextFromDocx(filePath);
  const docVariables = await extractDocVariables(filePath);

  const updatedData = mapVariablesToData(docVariables, data);
  return updatedData;
}
// Function to extract variables from text
function findVariables(text) {
  const variableRegex = /{{(.*?)}}/g;
  let match;
  const docVariables = [];

  while ((match = variableRegex.exec(text)) !== null) {
    docVariables.push(match[1].trim()); // Extract variable name
  }

  return docVariables;
}

// Function to extract text from DOCX and find variables
async function extractDocVariables(docxPath) {
  try {
    // Use mammoth to extract raw text from the DOCX file
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value; // Extracted text from DOCX

    // Find variables within the extracted text
    const variables = findVariables(text);
    return variables;
  } catch (error) {
    console.error("Error reading DOCX file:", error);
    return [];
  }
}


async function generateBarcode(code) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: code,
        scale: 3,
        height: 30,
        includetext: true, // Include the text under the barcode
      },
      (err, png) => {
        if (err) {
          console.error("Error generating barcode:", err.message);
          reject(err);
        } else {
          resolve(png.toString("base64")); // Embed as base64
          // resolve(`data:image/png;base64,${png.toString("base64")}`); // Embed as base64
        }
      }
    );
  });
}

async function generateQRCode(code) {
  const pngBuffer = qrcode.imageSync(code, {
    type: "png",
    size: 10,
    margin: 0,
  });
  return pngBuffer.toString("base64"); // Embed as base64
  // return `data:image/png;base64,${pngBuffer.toString("base64")}`; // Embed as base64
}
export { fetchProduct, finishedGoodsBrandPrint };
