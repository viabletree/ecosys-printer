import { exec }  from "child_process";

function monitorPrintJob(printerName, filePath) {
  const interval = setInterval(() => {
    checkPrintQueue(printerName, async (queueStatus) => {
      if (queueStatus === "empty") {
        // Proceed with file deletion after ensuring the print job is complete
        await deleteFile(filePath);
        clearInterval(interval); // Stop checking
      }
    });
  }, 5000); // Check every 5 seconds
}

function checkPrintQueue(callback) {
const isWin = process.platform === "win32";
let cmd = "lpstat -o"; // Linux/Mac
if(isWin){
    cmd = `powershell Get-PrintJob -PrinterName "${process.env.FULL_PRINTER_NAME}"`;
}
     exec(cmd, (err, stdout, stderr) => {
       if (err || stderr) {
         console.log("Error:", err || stderr);
       } else {
         console.log("Print Queue Status:", stdout);
         // If the queue is empty, proceed with file deletion
         if (!stdout) {
           console.log("No jobs in queue, safe to delete files.");
           callback();
         }
       }
     });
}

async function deleteFile() {
    const fs = require("fs");
    const path = require("path");
    const directory = process.env.UPLOAD_DIR; // Directory path
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

export { monitorPrintJob };
