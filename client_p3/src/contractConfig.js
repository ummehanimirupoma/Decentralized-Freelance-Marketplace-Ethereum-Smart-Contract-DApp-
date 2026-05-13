import FreelanceMarketplace from "./contracts/FreelanceMarketplace.json";

// 1. Export the ABI
export const CONTRACT_ABI = FreelanceMarketplace.abi;

// 2. Automatically find the network ID
// We look at the "networks" object in the JSON file.
// It looks like: { "1337": { ... }, "5777": { ... } }
const networks = FreelanceMarketplace.networks;

// Get the last network ID used (keys are IDs like "5777" or "1337")
const networkKeys = Object.keys(networks);
const latestNetworkId = networkKeys[networkKeys.length - 1];

// Get the address associated with that ID
const networkData = latestNetworkId ? networks[latestNetworkId] : null;

// 3. Export the Address
if (!networkData) {
  console.error("CRITICAL ERROR: Contract not found in FreelanceMarketplace.json. Did you run 'truffle migrate'?");
}

export const CONTRACT_ADDRESS = networkData ? networkData.address : "";

