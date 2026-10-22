import dns from "node:dns";
import mongoose from "mongoose";

const RETRY_MS = 15_000;
let retryTimer = null;
let publicDnsApplied = false;

// mongodb+srv URIs need a DNS SRV lookup. Some home routers intermittently refuse those
// (querySrv EREFUSED) even though normal browsing works, so fall back to public resolvers.
function srvLookupFailed(uri, error) {
  return uri.startsWith("mongodb+srv://") && /querySrv|EREFUSED|ESERVFAIL|ETIMEOUT/.test(error.message);
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/cinnamon_dashboard";
  clearTimeout(retryTimer);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.error(`MongoDB unavailable: ${error.message}`);
    if (!publicDnsApplied && srvLookupFailed(uri, error)) {
      const servers = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map(s => s.trim()).filter(Boolean);
      dns.setServers(servers);
      publicDnsApplied = true;
      console.log(`Retrying the MongoDB lookup with DNS servers ${servers.join(", ")}`);
      return connectDatabase();
    }
    // The initial connection is not retried by Mongoose itself; keep trying in the background.
    retryTimer = setTimeout(() => connectDatabase(), RETRY_MS);
    retryTimer.unref();
    console.log(`Retrying MongoDB in ${RETRY_MS / 1000} s`);
    return false;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
