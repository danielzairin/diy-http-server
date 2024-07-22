import test from "node:test";
import { createDynamicBuffer, getCapacity, pushData } from "./dynamic-buffer";
import assert from "node:assert";

test("new dynamic buffers should have 32 bytes of capacity by default", () => {
    const dynamicBuffer = createDynamicBuffer();
    assert(dynamicBuffer.len === 0);
    assert(getCapacity(dynamicBuffer) === 32);
});

test("pushing over capacity should increase capacity", () => {
    const dynamicBuffer = createDynamicBuffer();
    const data = Buffer.from(
        "hello, world!!!! i hope this string is over 32 bytes, otherwise i'll look like a fool :("
    );
    const capacity = getCapacity(dynamicBuffer);
    assert(data.length > capacity);
    pushData(dynamicBuffer, data);
    assert(capacity < getCapacity(dynamicBuffer));
});
