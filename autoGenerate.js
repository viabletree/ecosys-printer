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
    //  const url = `${process.env.BASE_URL}${process.env.ENDPOINT}${id}`;
    //  console.log(url);
    //  const response = await axios.get(url);
    const data = JSON.parse(`{
            "id": "cm3it5z3y0058ptshnvsua6mv",
            "name": "Laptops",
            "shortName": "Tarik Velez",
            "code": "3",
            "legacyCode": "Dolorem dolor in adi",
            "odooCode": "Facere sed sequi sus",
            "isActive": true,
            "isPurchaseable": false,
            "isBy": false,
            "isConsumable": true,
            "pausePurchase": true,
            "pauseProduction": false,
            "pauseSell": true,
            "baserateValue": 11,
            "unitLBS": 12,
            "productDefaultPlanning": [],
            "templateProduct": [],
            "currency": {
                "id": "cm3inmlkc00my3ud75dhcz2ng",
                "name": "Australian Dollar",
                "shortName": "AUD",
                "symbol": "AU$"
            },
            "productType": {
                "name": "Licensed Granite Shirt",
                "shortName": "spero",
                "id": "cm3inmlho00li3ud7eh47p9cj"
            },
            "productCategory": {
                "name": "Electronic Soft Shirt",
                "shortName": "tener",
                "id": "cm3inmlhx00lm3ud7jmiq8feb"
            },
            "productSeason": {
                "name": "Incredible Concrete Computer",
                "shortName": "debitis",
                "id": "cm3inmlih00lw3ud7ot521ix6"
            },
            "productGrade": {
                "name": "Bespoke Concrete Towels",
                "shortName": "cumque",
                "id": "cm3inmlip00m03ud7thwscb2v"
            },
            "unitOfMeasure": {
                "name": "Kilogram",
                "shortName": "kg",
                "id": "cm3ioa6ip003wk6t1zdotatm1"
            },
            "productHSCode": {
                "name": "Used Clothes Mix Rags",
                "shortName": "used-rags",
                "code": "1001",
                "id": "cm3ioawga003yk6t12zj0nuz5",
                "assessedRateHSCodeCurrency": {
                    "id": "cm3inmlkc00ms3ud7ysqeawlj",
                    "name": "US Dollar",
                    "shortName": "USD",
                    "symbol": "$"
                },
                "assessedRateHSCodeUOM": {
                    "id": "cm3ioa6ip003wk6t1zdotatm1",
                    "name": "Kilogram",
                    "shortName": "kg"
                },
                "assessedRateValue": 10
            },
            "business": {
                "name": "Used Clothing",
                "shortName": "UC",
                "id": "cm3inmkob001a3ud7ghzgkgp1"
            },
            "slug": "laptops",
            "alias": [
                "laptops"
            ],
            "tags": [
                "aaa"
            ],
            "families": [],
            "groups": [
                {
                    "id": "cm3inmlid00lu3ud7qmw77d1l",
                    "name": "Intelligent Wooden Chips",
                    "shortName": "alienus"
                }
            ]
        }`);
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
export { fetchProduct };
