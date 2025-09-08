import express, { Request, Response } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

// create an instance of lookup service (not the factory itself)
import CathaysLookupServiceFactory from "./overlays/energy/cardiff/cathays/lookup-services/CathaysLookupServiceFactory";

const PORT = Number(process.env.PORT || 8080);
const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo:27017";
const MONGO_DB = process.env.MONGO_DB || "overlay";

// map of service instances we expose via /lookup
type LookupService = { lookup: (query: any) => Promise<any> };
type ServiceMap = Record<string, LookupService>;

function logHeaders(h: any) {
  try {
    console.log(Object.assign(Object.create(null), h));
  } catch {
    console.log(h);
  }
}

function logMaybeBig(label: string, body: unknown, limit = 40000) {
  try {
    const s = JSON.stringify(body);
    if (s.length > limit) {
      console.log(`${label} (Response body too long to display, length: ${s.length} characters)`);
    } else {
      console.log(s);
    }
  } catch {
    console.log(`${label}: [Unserializable]`);
  }
}

async function main() {
  console.log("LARS constructed 🎉");
  console.log(`🌐 Server port set to ${PORT}`);
  console.log("📝 Verbose request logging enabled.");

  // mongo
  console.log(`🍃 Connecting to MongoDB at ${MONGO_URL} ...`);
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const db = mongo.db(MONGO_DB);
  console.log("🍃 MongoDB successfully configured and connected.");

  // build service instances
  const services: ServiceMap = {
    ls_cathays: CathaysLookupServiceFactory(db),
    // add more here if/when you need them
  };

  // express
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: false,
      exposedHeaders: "*",
    })
  );

  // match headers the ui expects
  app.use((_, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    next();
  });

  // parse json with a conservative limit
  app.use(express.json({ limit: "2mb" }));

  // preflight
  app.options("/lookup", (_req, res) => {
    console.log("📥 Incoming Request: OPTIONS /lookup");
    res.status(200).type("text/plain").send("OK");
    console.log("📤 Outgoing Response: OPTIONS /lookup - Status: 200 - Duration: ~1ms");
  });

  // simple, explicit /lookup endpoint (no overlay engine in the middle)
  app.post("/lookup", async (req: Request, res: Response) => {
    const t0 = Date.now();
    console.log("📥 Incoming Request: POST /lookup");
    console.log("Headers:");
    logHeaders(req.headers);
    console.log("Request Body:");
    console.log(JSON.stringify(req.body, null, 2));

    try {
      const { service, query } = req.body || {};
      if (!service || typeof service !== "string") {
        throw new Error("missing 'service' (e.g. 'ls_cathays')");
      }
      const svc = services[service];
      if (!svc || typeof svc.lookup !== "function") {
        throw new Error(`unknown service '${service}' or service has no lookup()`);
      }

      // try to be backward compatible with callers that forgot 'kind'
      const q = query && typeof query === "object" ? query : {};
      const result = await svc.lookup(q);

      res.status(200).json(result ?? {});
      const elapsed = Date.now() - t0;
      console.log(`📤 Outgoing Response: POST /lookup - Status: 200 - Duration: ${elapsed}ms`);
      console.log("Response Headers:");
      logHeaders(res.getHeaders());
      logMaybeBig("Response Body", result);
    } catch (err: any) {
      const msg = `lookup failed: ${err?.message || "unknown error"}`;
      const elapsed = Date.now() - (req as any)._startTime || 0;
      console.error(`❌ Error in /lookup: ${err?.stack || err}`);
      res.status(400).json({ status: "error", message: msg });
      console.log(`📤 Outgoing Response: POST /lookup - Status: 400 - Duration: ${elapsed}ms`);
      console.log("Response Headers:");
      logHeaders(res.getHeaders());
      logMaybeBig("Response Body", { status: "error", message: msg });
    }
  });

  // start server
  app.listen(PORT, () => {
    console.log("🎧 LARS is ready and listening on local port", PORT);
  });

  // graceful shutdown
  const shutdown = async () => {
    try {
      await mongo.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("Fatal startup error:", e);
  process.exit(1);
});
