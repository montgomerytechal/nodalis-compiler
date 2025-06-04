// --- Simulated enums ---
export const IECLanguage = Object.freeze({
  LADDER_DIAGRAM: 'LD',
  STRUCTURED_TEXT: 'ST',
  FUNCTION_BLOCK_DIAGRAM: 'FBD',
  INSTRUCTION_LIST: 'IL',
  SEQUENTIAL_FUNCTION_CHART: 'SFC'
});

export const OutputType = Object.freeze({
  EXECUTABLE: 'executable',
  NODE_APP: 'node',
  SOURCE_CODE: 'code'
});

export const CommunicationProtocol = Object.freeze({
  MODBUS: 'Modbus',
  BACNET: 'BACnet',
  ETHERNET_IP: 'Ethernet/IP',
  PROFINET: 'Profinet',
  OPC_UA: 'OPC UA',
  CUSTOM: 'Custom'
});

/**
 * @typedef {Object} CompilerOptions
 * @property {string} source - Source file or folder path
 * @property {string} destination - Output destination folder path
 * @property {string} language - One of IECLanguage values
 * @property {string} outputType - One of OutputType values
 */

/**
 * Abstract base class for all compilers.
 */
export class Compiler {
  /**
   * @param {CompilerOptions} options 
   */
  constructor(options) {
    if (new.target === Compiler) {
      throw new Error('Cannot instantiate abstract class Compiler directly.');
    }

    this.options = options;
  }

  /** @returns {string[]} */
  get supportedLanguages() {
    throw new Error('supportedLanguages must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedOutputTypes() {
    throw new Error('supportedOutputTypes must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedTargetDevices() {
    throw new Error('supportedTargetDevices must be implemented by subclass.');
  }

  /** @returns {string[]} */
  get supportedProtocols() {
    throw new Error('supportedProtocols must be implemented by subclass.');
  }

  // Optional compiler-specific metadata

  /** @returns {string|undefined} */
  get compilerVersion() {
    return undefined;
  }

  /** @returns {string|undefined} */
  get targetPlatform() {
    return undefined;
  }

  /** @returns {string|undefined} */
  get optimizationLevel() {
    return undefined;
  }

  /**
   * Perform the compilation.
   * @returns {Promise<void>}
   */
  async compile() {
    throw new Error('compile() must be implemented by subclass.');
  }
}

