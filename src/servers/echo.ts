import { dynBuf, DynamicBuffer } from "../dynamic-buffer";
import { tcp, TCPConn } from "../tcp-conn";
import { createServer } from "../tcp-server";

const PREFIX = Buffer.from("Echo: ");
const QUIT_MESSAGE = Buffer.from("quit\n");
const QUIT_REPLY = Buffer.from("Bye.\n");

/**
 * Extracts a message from a DynamicBuffer. Returns null if message is
 * incomplete.
 */
export function extractMessage(dynamicBuffer: DynamicBuffer): Buffer | null {
    const idx = dynamicBuffer.data.subarray(0, dynamicBuffer.len).indexOf("\n");
    // Message is incomplete, return null
    if (idx < 0) {
        return null;
    }
    return dynBuf.unshiftData(dynamicBuffer, idx + 1);
}

export async function serveClient(conn: TCPConn): Promise<void> {
    const buf = dynBuf.createDynamicBuffer();

    while (true) {
        const chunk = await tcp.readTCPConn(conn);
        dynBuf.pushData(buf, chunk);
        const message = extractMessage(buf);
        if (!message) {
            // Message is incomplete, continue reading the TCP connection
            continue;
        }
        if (message.equals(QUIT_MESSAGE)) {
            await tcp.writeTCPConn(conn, QUIT_REPLY);
            return;
        }
        await tcp.writeTCPConn(conn, Buffer.concat([PREFIX, message]));
    }
}

export const echoServer = createServer({
    serveClient,
});
