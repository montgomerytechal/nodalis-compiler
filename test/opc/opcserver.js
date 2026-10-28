const { OPCUAServer, Variant, DataType, StatusCodes } = require("node-opcua");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { OPCUACertificateManager } =
    require("node-opcua-certificate-manager");

// Dedicated certificate directory for this test server
const pkiPath = path.join(__dirname, "opc-test-pki");

// Delete old certificates before initializing the server
if (fs.existsSync(pkiPath)) {
    fs.rmSync(pkiPath, { recursive: true, force: true });
    console.log("Deleted previous OPC UA certificates.");
}

// Create a new certificate manager
const certificateManager = new OPCUACertificateManager({
    rootFolder: pkiPath,
    automaticallyAcceptUnknownCertificate: true
});
let input1 = false;
let output1 = false;
let lastOutput1 = output1;
const APPLICATION_URI = "urn:192.168.9.151:NodeOPCUA-Server";

(async () => {
    const server = new OPCUAServer({
        hostname: "192.168.9.151",
        port: 4334,
        resourcePath: "/UA/nodalis",
        serverCertificateManager: certificateManager,
        serverInfo: {
            applicationUri: APPLICATION_URI,
            productUri: "urn:MTI:NodalisOPC",
            applicationName: {
                text: "Nodalis OPC UA Test Server"
            }
        },

        buildInfo: {
            productName: "NodalisOPC",
            buildNumber: "1",
            buildDate: new Date()
        }
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    const device = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "Nodalis"
    });

    // Define Input1 node
    namespace.addVariable({
        componentOf: device,
        browseName: "Input1",
        dataType: "Boolean",
        nodeId: "ns=1;s=Input1",
        value: {
            get: () => new Variant({ dataType: DataType.Boolean, value: input1 }),
            set: (variant) => {
            input1 = variant.value;
            return { statusCode: StatusCodes.Good };
            }
        }
    });

    const output1Node = namespace.addVariable({
        componentOf: device,
        browseName: "Output1",
        nodeId: "ns=1;s=Output1",
        dataType: "Boolean"
    });

    output1Node.bindVariable({
        get: () => new Variant({ dataType: DataType.Boolean, value: output1 }),
        set: (variant) => {
            output1 = variant.value;
            console.log("Output1 updated from client:", output1);
            return StatusCodes.Good;
        }
    });

    await server.start();
    console.log("Server running at", server.endpoints[0].endpointDescriptions()[0].endpointUrl);

    // Create input prompt loop
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function promptInput() {
        rl.question("Set Input1 (true/false): ", answer => {
            const val = answer.trim().toLowerCase();
            if (val === "true" || val === "false") {
                input1 = val === "true";
                console.log(`Input1 set to: ${input1}`);
            } else {
                console.log("Invalid input. Enter 'true' or 'false'.");
            }
            promptInput(); // loop again
        });
    }

    
    // Monitor Output1 for changes
    setInterval(() => {
        if (output1 !== lastOutput1) {
            console.log(`Output1 changed to: ${output1}`);
            lastOutput1 = output1;
        }
    }, 500); // check every 500ms
    promptInput();

})();

