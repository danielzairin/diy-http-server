import { once } from "node:events";
import { spawn } from "node:child_process";
import { glob } from "glob";

async function runTests() {
    const paths = await glob("**/*.test.ts", { ignore: "node_modules/**" });
    const process = spawn("npx", ["tsx", "--test", ...paths], {
        detached: false,
        stdio: ["inherit", "inherit", "inherit"],
    });
    await once(process, "close");
}

runTests();
