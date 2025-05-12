import fs from "fs";
import path from "path";
import axios from "axios";
import mammoth from "mammoth";
import crypto from "crypto";
import { createReport } from "docx-templates";
import qrcode from "qr-image";
import bwipjs from "bwip-js";
import sharp from "sharp";

import { exec } from "child_process";
import _ from "lodash";

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
function applyDefaultValues(data) {
  return {
    barcode: data.barcode ?? '-',
    blWeight: data.blWeight ?? '-',
    intCode: data.intCode ?? '-',
    score: data.score ?? '-',
    suppLocation: data.suppLocation ?? '-',
    suppSubName: data.suppSubName ?? '-',
  };
}
async function generateDocument(filePath, data) {
  try {
    // Read the downloaded file
    const template = fs.readFileSync(filePath);

    // Process variables and create updated data
    const updatedData = await processDocxVariables(filePath, applyDefaultValues(data));

    // Generate the report
    const buffer = await createReport({
      template,
      cmdDelimiter: ["{{", "}}"],
      data: updatedData,
      additionalJsContext: {
        barcodeImage: async (_data, rotation = 0) => {
          return {
            width: 6,
            height: 6,
            data: await generateBarcode(_data, rotation),
            extension: ".gif",
          };
        },
        qrcodeImage: async (data) => {
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

    const downloadedFileName = `${crypto.randomUUID()}-${filePath
      .split("/")
      .pop()}`;
    // Write the generated file to disk
    const newFileName = sanitizeFileName(
      `${crypto.randomUUID()}-${downloadedFileName}`
    );
    const newPdfName = `${newFileName}.pdf`;
    const outputPath = `${uploadDir}/${newFileName}.docx`;
    console.log("Creating docx file from template and variables");
    fs.writeFileSync(outputPath, buffer);

    // Convert to PDF
    console.log("Converting docx to pdf");
    await convertDocxToPdfLibreOffice(outputPath, `${uploadDir}`);
    console.log("Removing docx file from server");
    // fs.unlinkSync(outputPath);

    return `${uploadDir}/${newPdfName}`;
  } catch (e) {
    throw new Error(e.message);
  }
}

async function getDocumentFile(fileUrl) {
  console.log('calling getDocumentFile', fileUrl);
  // Validate fileUrl
  if (!fileUrl.endsWith(".docx") && !fileUrl.endsWith(".doc")) {
    throw new Error("File must be a .docx or .doc file");
  }

  // Download the file from the provided URL
  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  if (response.status !== 200) {
    throw new Error("Failed to download the file");
  }

  const downloadedFileName = `${crypto.randomUUID()}-${fileUrl
    .split("/")
    .pop()}`;
  const filePath = `${uploadDir}/${sanitizeFileName(downloadedFileName)}.docx`;
  fs.writeFileSync(filePath, response.data);
  console.log(`File downloaded to ${filePath}`);
  return filePath;
}
async function finishedGoodsBrandPrint(fileUrl, data) {
  try {
    const filePath = await getDocumentFile(fileUrl);
    return await generateDocument(filePath, data);
  } catch (error) {
    console.error({ error });
    throw new Error(error.message);
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
function checkVariablesInData(documentVariables, data) {
  const missingVariables = [];
  const stack = [];

  // Process documentVariables
  for (let i = 0; i < documentVariables.length; i++) {
    const variable = documentVariables[i];

    if (
      variable.startsWith("EXEC") ||
      variable.startsWith("End-FOR") ||
      variable.startsWith("$idx") ||
      variable.startsWith("IMAGE")
    ) {
      // Skip EXEC and End-FOR commands
      continue;
    }

    if (variable.startsWith("FOR ")) {
      // Handle FOR loop
      const loopVariable = variable.match(/FOR (\w+) IN (.+)/); // Extract loop variable and array path
      if (loopVariable) {
        const loopItem = loopVariable[1]; // e.g., "product"
        const loopPath = loopVariable[2]; // e.g., "order[0].orderProducts"

        // Use Lodash to get the loop data
        const loopData = _.get(data, loopPath);

        if (_.isArray(loopData)) {
          stack.push({ loopItem, loopData }); // Push loop context onto stack
        } else {
          missingVariables.push(loopPath); // If loop path doesn't exist, add to missingVariables
        }
      }
      continue;
    }

    if (variable.startsWith("$")) {
      // Handle loop variables (e.g., $product.product.name)
      const loopContext = stack[stack.length - 1]; // Get the current loop context
      if (loopContext) {
        const loopItem = loopContext.loopItem; // e.g., "product"
        const loopData = loopContext.loopData; // e.g., array of orderProducts

        const normalizedVariable = variable.replace(`$${loopItem}.`, ""); // Remove the loop variable prefix
        loopData.forEach((item) => {
          if (!_.has(item, normalizedVariable)) {
            missingVariables.push(variable); // Add missing variable if not found in loop item
          }
        });
      }
      continue;
    }

    // Normal variables
    const normalizedVariable = variable.replace(/\s/g, ""); // Remove whitespace
    if (!_.has(data, normalizedVariable)) {
      missingVariables.push(variable);
    }
  }

  if (missingVariables.length > 0) {
    console.error("Missing variables in data:", missingVariables);
    // return missing variables in error response
    throw {
      message: `Data is not complete.
  ${missingVariables?.join(", ")} ${
        missingVariables.length === 1 ? "is" : "are"
      } missing in the data.`,
    };
  }
  return missingVariables;
}
// Main function
async function processDocxVariables(filePath, data) {
  // const text = await extractTextFromDocx(filePath);
  const docVariables = await extractDocVariables(filePath);
  checkVariablesInData(docVariables, data);

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

async function generateBarcode(code, rotation = 0) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: code,
        scale: 3,
        height: 30,
        includetext: true, // Include the text under the barcode
      },
      async (err, png) => {
        if (err) {
          console.error("Error generating barcode:", err.message);
          reject(err);
        } else {
          // resolve(png.toString("base64")); // Embed as base64
          // resolve(`data:image/png;base64,${png.toString("base64")}`); // Embed as base64
          try {
            // Rotate barcode image using sharp
            const rotatedBuffer = await sharp(png).rotate(rotation).toBuffer();
            resolve(rotatedBuffer.toString("base64")); // Return rotated barcode as base64
          } catch (rotationError) {
            console.error("Error rotating barcode:", rotationError.message);
            reject(rotationError);
          }
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
export { finishedGoodsBrandPrint, generateDocument, getDocumentFile };
