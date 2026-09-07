const mockAdapter = require("./mockAdapter");
const realAdapter = require("./realAdapter");

// Defaults to mock so the project runs out of the box with zero
// credentials. Set MOCK_CALL_E=false to require the real adapter.
function isMockMode() {
  const raw = (process.env.MOCK_CALL_E || "true").toLowerCase();
  return raw !== "false";
}

function getCallEStatus() {
  return {
    mockMode: isMockMode(),
    realAdapterConfigured: realAdapter.isConfigured(),
  };
}

module.exports = {
  mockAdapter,
  realAdapter,
  isMockMode,
  getCallEStatus,
};
