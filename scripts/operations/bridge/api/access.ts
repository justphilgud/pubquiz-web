import { handleAccess } from "../lib/handler";
import { blobProvider } from "../lib/provider";
const handler = { fetch(request: Request) { return handleAccess(request, process.env, blobProvider); } };
export default handler;
