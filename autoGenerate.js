import fs from "fs";
import fsPromise from "fs/promises";
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
import PQueue from "p-queue";
import https from "https";
import { spawn } from "child_process";

const uploadDir = "./uploads";
const isWin = process.platform === "win32";

function sanitizeFileName(fileName) {
  return fileName
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace special characters with underscores
    .replace(/_{2,}/g, "_") // Replace multiple underscores with a single underscore
    .replace(/^_|_$/g, "") // Remove leading and trailing underscores
    .toLowerCase(); // Convert to lower case (optional)
}

export const libreQueue = new PQueue({
  concurrency: 1, // 🔴 1 ya max 2
  intervalCap: 2,
  interval: 1000,
});

const templateFileCache = new Map();
const barcodeImageCache = new Map();
const templateMetadataCache = new Map();
const qrImageCache = new Map();

export function convertDocxToPdfLibreOffice(docxPath, outputDir) {
  return libreQueue.add(() => {
    return new Promise((resolve, reject) => {
      const sofficePath = isWin
        ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
        : "libreoffice";

      const args = [
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        "--norestore",
        "--convert-to",
        "pdf",
        docxPath,
        "--outdir",
        outputDir,
      ];

      const process = spawn(sofficePath, args, {
        stdio: "ignore", // ⚡ fastest
      });

      process.on("error", reject);

      process.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`LibreOffice exited with code ${code}`));
        }

        const pdfPath = path.join(
          outputDir,
          path.basename(docxPath, ".docx") + ".pdf",
        );

        resolve(pdfPath);
      });
    });
  });
}

let libreProcess = null;

const sofficePath =
  process.platform === "win32"
    ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe"
    : "libreoffice";

const libreProfile =
  process.platform === "win32"
    ? "file:///C:/temp/libreoffice-profile"
    : "file:///tmp/libreoffice-profile";


let isStarting = false;

export async function startLibreOfficeServer() {
  if (
    libreProcess &&
    !libreProcess.killed &&
    libreProcess.exitCode === null
  ) {
    return;
  }

  if (isStarting) return;

  isStarting = true;

  const args = [
    "--headless",
    "--invisible",
    "--nologo",
    "--nodefault",
    "--nofirststartwizard",
    "--norestore",
    "--nolockcheck",
    "--accept=socket,host=127.0.0.1,port=2002;urp;",
    `-env:UserInstallation=${libreProfile}`,
  ];

  libreProcess = spawn(sofficePath, args, {
    stdio: "ignore",
    windowsHide: true,
  });

  libreProcess.on("spawn", () => {
    console.log("LibreOffice started");
  });

  libreProcess.on("exit", (code) => {
    console.warn("LibreOffice stopped", code);
    libreProcess = null;

    // auto restart
    setTimeout(() => {
      startLibreOfficeServer().catch(console.error);
    }, 1000);
  });

  libreProcess.on("error", (err) => {
    console.error("LibreOffice error:", err);
    libreProcess = null;
  });

  await new Promise((r) => setTimeout(r, 2000));

  isStarting = false;
}

async function clearOldFiles2(
  dir,
  olderThanMinutes = 30,
) {
  const files = await fsPromise.readdir(dir);

  const now = Date.now();

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file);

      const stat =
        await fsPromise.stat(filePath);

      const ageMinutes =
        (now - stat.mtimeMs) /
        1000 /
        60;

      if (
        ageMinutes >
        olderThanMinutes
      ) {
        await fsPromise.unlink(
          filePath
        );
      }
    }),
  );
}

export async function convertNewDocxToPdfLibreOffice(
  docxPath,
  outputDir
) {
  return libreQueue.add(async () => {
    console.log(
      "Libre process alive:",
      libreProcess?.pid,
      libreProcess?.exitCode
    );
    await startLibreOfficeServer();

    return new Promise((resolve, reject) => {
      const args = [
        "--headless",
        "--invisible",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        "--norestore",
        "--nolockcheck",

        "--convert-to",
        "pdf:writer_pdf_Export",

        "--outdir",
        outputDir,

        docxPath,

        `-env:UserInstallation=${libreProfile}`,
      ];

      const cmd = spawn(sofficePath, args, {
        windowsHide: true,
        stdio: "ignore",
      });

      cmd.on("error", reject);

      cmd.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(
              `LibreOffice conversion failed (${code})`
            )
          );
        }

        const pdfPath = path.join(
          outputDir,
          path.basename(docxPath, ".docx") + ".pdf"
        );

        resolve(pdfPath);
      });
    });
  });
}

function getFormattedDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = now.getFullYear();

  return `${day}${month}${year}`;
}
export function applyDefaultValues(data) {
  const ret = {
    barcode: data.barcode ?? "-",
    code: data.code ?? "-",
    weight: data.weightValue ?? "-",
    intCode: data.intCode ?? "-",
    score: data.score ?? "",
    location: data.sourceName ?? "-",
    suppSubName: data.suppSubName ?? "-",
    date: getFormattedDate(),
  };
  if (!data?.customer?.code) {
    ret["customer"] = {
      code: "-",
    };
  }
  return ret;
}

const templateCache = new Map();

async function getTemplate(filePath) {
  if (!templateCache.has(filePath)) {
    const buffer = await fsPromise.readFile(filePath);
    templateCache.set(filePath, buffer);
  }
  return templateCache.get(filePath);
}

async function generateDocument(filePath, data) {
  try {
    // 1️⃣ Load template from cache
    const template = await getTemplate(filePath);

    // const mergedData = { ...data, ...applyDefaultValues(data) };
    // Process docx variables
    console.time("processDocxVariables");
    const updatedData = await processDocxVariables(filePath, data);
    console.timeEnd("processDocxVariables");
    // Generate DOCX buffer
    const buffer = await createReport({
      template,
      cmdDelimiter: ["{{", "}}"],
      data: updatedData,
      failFast: false,
      additionalJsContext: {
        barcodeImage: async (
          _code,
          rotation = 90,
          height = 5,
          width = 1.5,
        ) => ({
          width,
          height,
          data: await generateBarcode(_code, rotation),
          extension: ".png",
        }),

        qrcodeImage: async (val, width = 1, height = 1) => ({
          width,
          height,
          data: await generateQRCode(val),
          extension: ".png",
        }),
      },
    });

    // Build unique file names
    const baseName = sanitizeFileName(
      `${crypto.randomUUID()}-${path.basename(filePath)}`,
    );
    const docxPath = path.join(uploadDir, `${baseName}.docx`);
    const pdfPath = path.join(uploadDir, `${baseName}.pdf`);

    // Save DOCX
    await fsPromise.writeFile(docxPath, buffer);

    // Convert DOCX → PDF
    await convertNewDocxToPdfLibreOffice(docxPath, uploadDir);

    // Remove DOCX (optional)
    // await fsPromise.unlink(docxPath);

    return pdfPath;
  } catch (err) {
    console.error("generateDocument ERROR:", err);
    throw new Error(err.message || "Document generation failed");
  }
}

async function preloadBarcodeImages2(
  data
) {
  const uniqueBarcodes =
    new Set();

  function walk(obj) {
    if (!obj) return;

    if (
      Array.isArray(obj)
    ) {
      obj.forEach(walk);
      return;
    }

    if (
      typeof obj ===
      "object"
    ) {
      if (obj.barcode) {
        uniqueBarcodes.add(
          obj.barcode
        );
      }

      Object.values(obj)
        .forEach(walk);
    }
  }

  walk(data);

  await Promise.all(
    [...uniqueBarcodes].map(
      (barcode) =>
        generateBarcodeCached2(
          barcode
        )
    )
  );
}

async function generateDocument2(
  filePath,
  data
) {
  try {
    console.time("generateDocument2");

    // ========================================
    // Load template from cache
    // ========================================
    console.time("getTemplate");

    const template =
      await getTemplate(filePath);

    console.timeEnd("getTemplate");

    // ========================================
    // Cached variable extraction
    // ========================================
    console.time("processDocxVariables2");

    const updatedData =
      await processDocxVariables2(
        filePath,
        data
      );

    console.timeEnd(
      "processDocxVariables2"
    );

    // ========================================
    // Pre-generate unique barcodes
    // ========================================
    console.time(
      "preloadBarcodeImages2"
    );

    await preloadBarcodeImages2(
      updatedData
    );

    console.timeEnd(
      "preloadBarcodeImages2"
    );

    // ========================================
    // Generate DOCX
    // ========================================
    console.time("createReport");

    const buffer =
      await createReport({
        template,

        cmdDelimiter: [
          "{{",
          "}}",
        ],

        data: updatedData,

        failFast: false,

        additionalJsContext: {
          barcodeImage: async (
            code,
            rotation = 90,
            height = 5,
            width = 1.5
          ) => ({
            width,
            height,

            data:
              await generateBarcodeCached2(
                code,
                rotation
              ),

            extension:
              ".png",
          }),

          qrcodeImage: async (
            val,
            width = 1,
            height = 1
          ) => ({
            width,
            height,

            data:
              await generateQRCodeCached2(
                val
              ),

            extension:
              ".png",
          }),
        },
      });

    console.timeEnd(
      "createReport"
    );

    // ========================================
    // Paths
    // ========================================
    const baseName =
      sanitizeFileName(
        `${crypto.randomUUID()}-${path.basename(
          filePath
        )}`
      );

    const docxPath =
      path.join(
        uploadDir,
        `${baseName}.docx`
      );

    const pdfPath =
      path.join(
        uploadDir,
        `${baseName}.pdf`
      );

    // ========================================
    // Save DOCX
    // ========================================
    console.time(
      "writeDocx"
    );

    await fsPromise.writeFile(
      docxPath,
      buffer
    );

    console.timeEnd(
      "writeDocx"
    );

    // ========================================
    // DOCX -> PDF
    // ========================================
    console.time(
      "convertToPdf"
    );

    await convertNewDocxToPdfLibreOffice(
      docxPath,
      uploadDir
    );

    console.timeEnd(
      "convertToPdf"
    );

    // ========================================
    // Delete temporary DOCX
    // ========================================
    fsPromise
      .unlink(docxPath)
      .catch(() => { });

    console.timeEnd(
      "generateDocument2"
    );

    return pdfPath;
  } catch (err) {
    console.error(
      "generateDocument2 ERROR:",
      err
    );

    throw new Error(
      err.message ||
      "Document generation failed"
    );
  }
}

async function getDocumentFile2(fileUrl) {
  if (!fileUrl.endsWith(".docx") && !fileUrl.endsWith(".doc")) {
    throw new Error("File must be a .docx or .doc file");
  }

  if (templateFileCache.has(fileUrl)) {
    return templateFileCache.get(fileUrl);
  }

  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  const response = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    httpsAgent: agent,
  });

  if (response.status !== 200) {
    throw new Error("Failed to download template");
  }

  const downloadedFileName = `${crypto.randomUUID()}-${fileUrl
    .split("/")
    .pop()}`;

  const filePath = path.join(
    uploadDir,
    `${sanitizeFileName(downloadedFileName)}.docx`,
  );

  await fsPromise.writeFile(filePath, response.data);

  templateFileCache.set(fileUrl, filePath);

  return filePath;
}

async function getDocumentFile(fileUrl) {
  // Validate fileUrl
  if (!fileUrl.endsWith(".docx") && !fileUrl.endsWith(".doc")) {
    throw new Error("File must be a .docx or .doc file");
  }
  const agent = new https.Agent({ rejectUnauthorized: false });

  // Download the file from the provided URL
  const response = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    httpsAgent: agent,
  });
  if (response.status !== 200) {
    throw new Error("Failed to download the file");
  }

  const downloadedFileName = `${crypto.randomUUID()}-${fileUrl
    .split("/")
    .pop()}`;
  const filePath = `${uploadDir}/${sanitizeFileName(downloadedFileName)}.docx`;
  fs.writeFileSync(filePath, response.data);
  return filePath;
}

async function downloadZipFile(fileUrl) {
  const agent = new https.Agent({ rejectUnauthorized: false });
  // Download the file from the provided URL
  const response = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    httpsAgent: agent,
  });
  if (response.status !== 200) {
    throw new Error("Failed to download the file");
  }
  const downloadedFileName = `all`;
  const filePath = `${uploadDir}/${sanitizeFileName(downloadedFileName)}.zip`;
  fs.writeFileSync(filePath, response.data);
  return filePath;
}

function applyFGBrandDefaultValue(data) {
  const ret = {
    barcode: data.barcode ?? "-",
    qty: data.qty ?? "-",
    qtyUOM: data.qtyUOM ?? "-",
  };
  if (!data?.customer?.code) {
    ret["customer"] = {
      code: "-",
    };
  }
  if (!data?.product?.alias) {
    ret["product"] = {
      ...data?.product,
      alias: "-",
    };
  }
  return ret;
}
async function finishedGoodsBrandPrint(fileUrl, data) {
  try {
    const filePath = await getDocumentFile(fileUrl);
    const _data = { ...data, ...applyFGBrandDefaultValue(data) };
    return await generateDocument(filePath, _data);
  } catch (error) {
    console.error({ error });
    throw new Error(error.message);
  }
}
async function finishedGoodsBrandPrint2(fileUrl, data) {
  try {
    console.log("finishedGoodsBrandPrint2");
    const filePath = await getDocumentFile2(fileUrl);
    const _data = { ...data, ...applyFGBrandDefaultValue(data) };
    return await generateDocument2(filePath, _data);
  } catch (error) {
    console.error({ error });
    throw new Error(error.message);
  }
}
async function groupPackPrint(fileUrl, data) {
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
      variable.startsWith("END-FOR") ||
      variable.startsWith("$idx") ||
      variable.startsWith("$length") ||
      variable.startsWith("IF") ||
      variable.startsWith("ELSE") ||
      variable.startsWith("IMAGE") ||
      variable.startsWith("=") ||
      variable.startsWith("INS") ||
      variable.startsWith("ENDIF") ||
      variable.startsWith("END-IF") ||
      variable.startsWith("PAGE-BREAK")
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
        // loopData.forEach((item) => {
        //   if (!_.has(item, normalizedVariable)) {
        //     missingVariables.push(variable); // Add missing variable if not found in loop item
        //   }
        // });
        const isMissing = loopData.some(
          (item) => !_.has(item, normalizedVariable)
        );

        if (isMissing) {
          missingVariables.push(variable);
        }
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
  ${missingVariables?.join(", ")} ${missingVariables.length === 1 ? "is" : "are"
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
async function processDocxVariables2(
  filePath,
  data
) {
  let docVariables =
    templateMetadataCache.get(filePath);

  if (!docVariables) {
    docVariables =
      await extractDocVariables(filePath);

    templateMetadataCache.set(
      filePath,
      docVariables
    );
  }

  checkVariablesInData(
    docVariables,
    data
  );

  return mapVariablesToData(
    docVariables,
    data
  );
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

// async function generateBarcode(code, rotation = 0) {
//   return new Promise((resolve, reject) => {
//     bwipjs.toBuffer(
//       {
//         bcid: "code128", // Barcode type
//         text: code,
//         scale: 1,
//         includetext: true, // Include the text under the barcode
//       },
//       async (err, png) => {
//         if (err) {
//           console.error("Error generating barcode:", err.message);
//           reject(err);
//         } else {
//           // resolve(png.toString("base64")); // Embed as base64
//           // resolve(`data:image/png;base64,${png.toString("base64")}`); // Embed as base64
//           try {
//             // Rotate barcode image using sharp
//             const rotatedBuffer = await sharp(png).rotate(rotation).toBuffer();
//             resolve(rotatedBuffer.toString("base64")); // Return rotated barcode as base64
//           } catch (rotationError) {
//             console.error("Error rotating barcode:", rotationError.message);
//             reject(rotationError);
//           }
//         }
//       }
//     );
//   });
// }

// async function generateQRCode(code) {
//   const pngBuffer = qrcode.imageSync(code, {
//     type: "png",
//     size: 10,
//     margin: 0,
//   });
//   return pngBuffer.toString("base64"); // Embed as base64
//   // return `data:image/png;base64,${pngBuffer.toString("base64")}`; // Embed as base64
// }

async function generateBarcodeCached2(
  code,
  rotation = 0
) {
  const key = `${code}_${rotation}`;

  if (barcodeImageCache.has(key)) {
    return barcodeImageCache.get(key);
  }

  const result =
    await generateBarcode(
      code,
      rotation
    );

  barcodeImageCache.set(
    key,
    result
  );

  return result;
}

async function generateBarcode(code, rotation = 0) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: code,
        scale: 2,
        includetext: true,
        textxalign: "justify",
        textsize: 14,
        // textsize: 18,
        textyoffset: 10,
        // textfont: "Helvetica-Bold", // optional
      },
      async (err, pngBuffer) => {
        if (err) return reject(err);

        try {
          const rotated = await sharp(pngBuffer)
            .rotate(rotation)
            .resize({ width: 300 }) // ensure fixed width
            .png() // force PNG output
            .toBuffer();

          resolve(rotated.toString("base64"));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

// async function generateQRCode(code) {
//   try {
//     const png = await bwipjs.toBuffer({
//       bcid: "qrcode", // Barcode type
//       text: code,
//     });
//     return png.toString("base64");
//   } catch (error) {
//     console.error("Error generating barcode:", error);
//     throw error;
//   }
// }

async function generateQRCodeCached2(
  text
) {
  if (qrImageCache.has(text)) {
    return qrImageCache.get(text);
  }

  const result =
    await generateQRCode(text);

  qrImageCache.set(
    text,
    result
  );

  return result;
}

async function generateQRCode(text) {
  return new Promise(async (resolve, reject) => {
    try {
      const pngBuffer = await bwipjs.toBuffer({
        bcid: "qrcode",
        text,
        scale: 3,
        includetext: false,
      });

      const final = await sharp(pngBuffer)
        .png() // ensure PNG output
        .toBuffer();

      resolve(final.toString("base64"));
    } catch (error) {
      console.error("QR Code generation failed:", error);
      reject(error);
    }
  });
}

async function generateBarcodeSVG(code, rotation = 0) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: code,
        scale: 3, // not pixels but improves SVG viewBox sizing
        height: 20,
        includetext: false, // set true if you need human-readable text
        paddingwidth: 8,
        paddingheight: 4,
        xml: true, // <-- important: request SVG output
      },
      (err, svgBuf) => {
        if (err) return reject(err);

        let svg = svgBuf.toString("utf8");

        // Optional: rotate SVG by adding transform if rotation != 0
        if (rotation && rotation % 360 !== 0) {
          // Wrap SVG content in an outer SVG with transform to rotate
          // This is a safe way to rotate without rasterizing
          const wrapped = `
          <svg xmlns="http://www.w3.org/2000/svg">
            <g transform="rotate(${rotation} 0 0)">
              ${svg}
            </g>
          </svg>
        `;
          svg = wrapped;
        }

        // Return raw SVG string (docx-template accepts string for .svg)
        resolve(svg);
      },
    );
  });
}

async function generateQRCodeSVG(code) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "qrcode",
        text: code,
        scale: 3,
        paddingwidth: 2,
        paddingheight: 2,
        xml: true,
      },
      (err, svgBuf) => {
        if (err) return reject(err);
        resolve(svgBuf.toString("utf8"));
      },
    );
  });
}

export {
  finishedGoodsBrandPrint,
  finishedGoodsBrandPrint2,
  clearOldFiles2,
  groupPackPrint,
  generateDocument,
  getDocumentFile,
  downloadZipFile,
  // applyDefaultValues,
  applyFGBrandDefaultValue,
};
