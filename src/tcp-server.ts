import * as net from "node:net";
import { initTCPConn, TCPConn } from "./tcp-conn";
import { logger } from "./logger";

export function createServer({
    serveClient,
}: {
    serveClient: (conn: TCPConn) => Promise<void>;
}): net.Server {
    const server = net.createServer({
        pauseOnConnect: true,
    });

    server.on("connection", async (socket) => {
        logger.info(
            `new connection ${socket.remoteAddress}:${socket.remotePort}`
        );
        socket.on("close", () => {
            logger.info(
                `connection closed ${socket.remoteAddress}:${socket.remotePort}`
            );
        });
        try {
            await serveClient(initTCPConn(socket));
        } catch (caught) {
            if (caught instanceof Error) {
                logger.error(caught.stack || caught.message);
                return;
            }
            logger.error(`caught something: ${caught}`);
        } finally {
            socket.end();
        }
    });

    server.on("error", (err) => {
        logger.error(err.message);
    });

    server.on("listening", () => {
        logger.info("listening");
    });

    return server;
}
