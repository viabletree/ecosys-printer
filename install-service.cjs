const path = require("path");
const Service = require("node-windows").Service;

const svc = new Service({
  name: "PrinterService",
  description: "Ecosys Printer Service",
  script: path.join(__dirname, "index.js")
});

svc.on("install", () => {
  console.log("Service installed");
  svc.start();
});

svc.install();
