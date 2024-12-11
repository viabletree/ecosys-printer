
const uploadDir = './uploads';
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
  const cmd = isWin ? '"C:\\Program Files\\LibreOffice\\program\\soffice.exe" ': 'libreoffice ';
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

async function fetchProduct(fileName, data) {
    // console.log({ response: data });
    try{
    if (!data) {
      return  "Data not found";
    }
    if (!fileName.endsWith(".docx") && !fileName.endsWith(".doc")) {
      // if file exists return empty with message
      // file must be doc or docx file checck if docx file
      return "File must be a docx file";
    }
    const filePath = `${uploadDir}/${fileName}`;
    if (!fs.existsSync(filePath)) {
      return  "File not found";
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
    console.log('Creating docx file from template and variables');
    fs.writeFileSync(outputPath, buffer);
  
    console.log('Converting docx to pdf');
    await convertDocxToPdfLibreOffice(outputPath, `${uploadDir}`);
    console.log('removing docx file from server');
    // fs.unlinkSync(outputPath);
    return  newPdfName;
  } catch (error) {
    console.log({ error });
  }
};


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
        }else{
          console.log('key not found', key);
          console.log('keys not found', keys);
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
  const docVariables =  await extractDocVariables(filePath);

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



export { fetchProduct };