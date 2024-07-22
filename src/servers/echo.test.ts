import test, { describe } from "node:test";
import { extractMessage } from "./echo";
import { createDynamicBuffer, dynBuf } from "../dynamic-buffer";
import assert from "node:assert";

describe("extract message from dynamic buffer", () => {
    test("incomplete message should return null", () => {
        const buf = createDynamicBuffer();
        const data = Buffer.from("incomplete");
        dynBuf.pushData(buf, data);
        const out = extractMessage(buf);
        assert(out === null);
    });
    test("valid message should be returned", () => {
        const buf = createDynamicBuffer();
        const data = Buffer.from("test\n");
        dynBuf.pushData(buf, data);
        const out = extractMessage(buf);
        assert(out !== null);
        assert(out.equals(data));
    });
    test("two messages should be read properly", () => {
        const buf = createDynamicBuffer();
        const message1 = Buffer.from("foo\n");
        const message2 = Buffer.from("bar\n");
        const data = Buffer.concat([message1, message2]);

        dynBuf.pushData(buf, data);
        let out = extractMessage(buf);
        assert(out !== null);
        assert(out.equals(message1));
        assert(Buffer.from(buf.data.subarray(0, buf.len)).equals(message2));

        dynBuf.pushData(buf, data);
        out = extractMessage(buf);
        assert(out !== null);
        assert(out.equals(message2));
    });
});
