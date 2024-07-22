import { logger } from "./logger";

export type DynamicBuffer = {
    data: Buffer;
    len: number;
};

const MIN_CAPACITY = 32; // bytes

export function createDynamicBuffer(
    capacity: number = MIN_CAPACITY
): DynamicBuffer {
    return {
        data: Buffer.alloc(capacity),
        len: 0,
    };
}

export function getCapacity(dynamicBuffer: DynamicBuffer) {
    return dynamicBuffer.data.length;
}

/**
 * @returns {number} the new capacity
 */
function increaseCapacity(
    dynamicBuffer: DynamicBuffer,
    atLeast: number
): number {
    let capacity = Math.max(dynamicBuffer.data.length, MIN_CAPACITY);
    while (capacity < atLeast) {
        capacity *= 2;
    }
    const grown = Buffer.alloc(capacity);
    dynamicBuffer.data.copy(grown, 0, 0);
    dynamicBuffer.data = grown;
    return capacity;
}

export function pushData(dynamicBuffer: DynamicBuffer, newData: Buffer) {
    const newLen = dynamicBuffer.len + newData.length;
    if (newLen > getCapacity(dynamicBuffer)) {
        increaseCapacity(dynamicBuffer, newLen);
    }
    newData.copy(dynamicBuffer.data, dynamicBuffer.len, 0);
    dynamicBuffer.len = newLen;
}

export function unshiftData(dynamicBuffer: DynamicBuffer, len: number): Buffer {
    if (len > dynamicBuffer.len) {
        throw Error("Unshifting more than the amount of data available");
    }
    const unshifted = Buffer.alloc(len);
    dynamicBuffer.data.copy(unshifted, 0, 0, len);
    dynamicBuffer.data.copyWithin(0, len);
    dynamicBuffer.len -= len;
    return unshifted;
}

export * as dynBuf from "./dynamic-buffer";
