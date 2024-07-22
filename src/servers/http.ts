import { DynamicBuffer, dynBuf } from "../dynamic-buffer";
import { logger } from "../logger";
import { readTCPConn, tcp, TCPConn } from "../tcp-conn";
import { createServer } from "../tcp-server";
import assert from "node:assert";

type HTTPRequest = {
    method: string;
    headers: Buffer[];
    version: string;
    path: string;
};

type HTTPResponse = {
    code: number;
    headers: Buffer[];
    body: BodyReader;
};

type BodyReader = {
    len: number;
    read: () => Promise<Buffer>;
};

function parseHTTPReq(requestHead: Buffer): HTTPRequest {
    const lines = requestHead.toString("utf8").split("\r\n");

    // Parse the method, path and version
    const [method, path, version] = lines[0].split(" ");

    const headers: Buffer[] = [];
    for (let i = 1; i < lines.length - 2; i++) {
        const header = Buffer.from(lines[i]);
        // TODO: Validate header
        headers.push(header);
    }

    // Last two empty lines '\r\n\r\n'
    assert(lines[lines.length - 1].length === 0);
    assert(lines[lines.length - 2].length === 0);

    return {
        method,
        path,
        version,
        headers,
    };
}

async function handleRequest(
    req: HTTPRequest,
    reqBody: BodyReader
): Promise<HTTPResponse> {
    let body: BodyReader;

    logger.info({
        msg: "handling request",
        method: req.method,
        path: req.path,
    });
    switch (req.path) {
        case "/echo":
            body = reqBody;
            break;
        default:
            const message = Buffer.from("Hello world!\n");
            let done = false;
            body = {
                len: message.length,
                read: async () => {
                    if (!done) {
                        done = true;
                        return message;
                    }
                    return Buffer.from("");
                },
            };
    }

    return {
        code: 200,
        headers: [Buffer.from("Server: diy-http-server")],
        body,
    };
}

async function writeResponse(conn: TCPConn, res: HTTPResponse) {
    const delim = Buffer.from("\r\n");
    let data = Buffer.from(`HTTP/1.1 ${res.code} WOOT`);
    data = Buffer.concat([data, delim]);

    if (res.body.len >= 0) {
        res.headers.push(Buffer.from(`Content-Length: ${res.body.len}`));
    } else {
        res.headers.push(Buffer.from(`Transfer-Encoding: chunked`));
    }

    for (const header of res.headers) {
        data = Buffer.concat([data, header, delim]);
    }

    data = Buffer.concat([data, delim]);

    await tcp.writeTCPConn(conn, data);

    const crlf = Buffer.from("\r\n");
    while (true) {
        data = await res.body.read();
        if (data.length === 0) {
            // end
            break;
        }
        if (res.body.len < 0) {
            data = Buffer.concat([
                Buffer.from(data.length.toString(16)),
                crlf,
                data,
                crlf,
            ]);
        }
        await tcp.writeTCPConn(conn, data);
    }
}

function getHeaderValue(req: HTTPRequest, headerKey: string): string | null {
    for (const header of req.headers) {
        const [key, value] = header
            .toString()
            .split(":")
            .map((s) => s.trim());
        if (key.toLocaleLowerCase() === headerKey.toLocaleLowerCase()) {
            return value;
        }
    }
    return null;
}

function getRequestBody(
    conn: TCPConn,
    dynamicBuffer: DynamicBuffer,
    req: HTTPRequest
): BodyReader {
    let bodyLen = -1;

    const contentLen = getHeaderValue(req, "Content-Length");
    if (contentLen) {
        bodyLen = Number(contentLen);
        if (isNaN(bodyLen)) {
            throw Error("Invalid Content-Length");
        }
    }

    const isBodyAllowed = !(req.method === "GET" || req.method === "HEAD");
    const isChunked = getHeaderValue(req, "Transfer-Encoding") === "chunked";

    if (!isBodyAllowed && (isChunked || bodyLen > 0)) {
        throw Error("Body not allowed in GET/POST requests");
    }

    if (bodyLen >= 0) {
        return readerFromConnLength(conn, dynamicBuffer, bodyLen);
    }

    if (isChunked) {
        throw Error("TODO");
    }

    // Rest of the connection i.e. no content length, no chunked encoding
    throw Error("TODO");
}

function readerFromConnLength(
    conn: TCPConn,
    dynamicBuffer: DynamicBuffer,
    bodyLen: number
): BodyReader {
    let remaining = bodyLen;
    return {
        len: bodyLen,
        read: async () => {
            if (remaining === 0) {
                return Buffer.from("");
            }
            if (dynamicBuffer.len === 0) {
                // try to get some data if there is none
                const data = await readTCPConn(conn);
                dynBuf.pushData(dynamicBuffer, data);
                if (data.length === 0) {
                    // expect more data!
                    throw new Error("Unexpected EOF from HTTP body");
                }
            }
            const consume = Math.min(dynamicBuffer.len, remaining);
            remaining -= consume;
            return dynBuf.unshiftData(dynamicBuffer, consume);
        },
    };
}

function cutMessage(dynamicBuffer: DynamicBuffer): Buffer | null {
    const endOfHeadersIdx = dynamicBuffer.data
        .subarray(0, dynamicBuffer.len)
        .indexOf("\r\n\r\n");
    if (endOfHeadersIdx < 0) {
        return null;
    }

    return dynBuf.unshiftData(dynamicBuffer, endOfHeadersIdx + 4);
}

async function serveClient(conn: TCPConn) {
    const dynamicBuffer = dynBuf.createDynamicBuffer();

    while (true) {
        const data = await tcp.readTCPConn(conn);
        if (data.length === 0) {
            return;
        }
        dynBuf.pushData(dynamicBuffer, data);

        const message = cutMessage(dynamicBuffer);
        if (!message) {
            continue;
        }

        const req = parseHTTPReq(message);
        const reqBody = getRequestBody(conn, dynamicBuffer, req);
        const res = await handleRequest(req, reqBody);
        await writeResponse(conn, res);

        if (req.version === "HTTP/1.0") {
            return;
        }
    }
}

export const httpServer = createServer({
    serveClient,
});
