const path = require("path");
const Service = require("node-windows").Service;

const svc = new Service({
  name: "PrinterService",
  script: path.join(__dirname, "index.js")
});

svc.on("uninstall", () => {
  console.log("Service uninstalled");
});

svc.uninstall();
