import { handleAccess } from "../lib/handler.js";
import { blobProvider } from "../lib/provider.js";
const handler = { fetch(request: Request) { return handleAccess(request, process.env, blobProvider); } };
export default handler;
