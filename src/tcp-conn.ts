import assert from "node:assert";
import * as net from "node:net";

export type TCPConn = {
    socket: net.Socket;
    //  the callbacks of the promise of the current read
    reader: null | {
        resolve: (value: Buffer) => void;
        reject: (reason: Error) => void;
    };

    err: null | Error;
    ended: boolean;
};

export function readTCPConn(conn: TCPConn): Promise<Buffer> {
    assert(!conn.reader);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }

        if (conn.ended) {
            resolve(Buffer.from(""));
            return;
        }

        conn.reader = { resolve, reject };
        conn.socket.resume();
    });
}

export function writeTCPConn(conn: TCPConn, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }

        conn.socket.write(data, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

export function initTCPConn(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket,
        reader: null,
        err: null,
        ended: false,
    };

    conn.socket.on("data", (data) => {
        assert(conn.reader);
        conn.socket.pause();
        conn.reader.resolve(data);
        conn.reader = null;
    });

    conn.socket.on("error", (err) => {
        conn.err = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });

    socket.on("end", () => {
        // this also fulfills the current read.
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(""));
            conn.reader = null;
        }
    });

    return conn;
}

export * as tcp from "./tcp-conn";
