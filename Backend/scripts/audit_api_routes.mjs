import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Backend uses the native TS compiler, which does not expose the compiler AST API.
// Use the frontend's compiler API for this repository-wide tooling task.
import ts from "../../Frontend/node_modules/typescript/lib/typescript.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routes = [];
function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) { scan(filename); continue; }
        if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
        const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node) {
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
                const method = node.expression.name.text.toLowerCase();
                const first = node.arguments[0];
                if (["get", "post", "put", "patch", "delete", "options", "head", "all"].includes(method) && first && ts.isStringLiteral(first) && first.text.startsWith("/")) {
                    const middleware = node.arguments.slice(1).filter(ts.isIdentifier).map((arg) => arg.text);
                    let awaits = 0, fetches = 0, queries = 0;
                    function inspect(child) {
                        if (ts.isAwaitExpression(child)) awaits++;
                        if (ts.isCallExpression(child)) {
                            const name = child.expression.getText(source);
                            if (name === "fetch") fetches++;
                            if (name === "query" || name.endsWith(".query")) queries++;
                        }
                        ts.forEachChild(child, inspect);
                    }
                    node.arguments.slice(1).forEach(inspect);
                    routes.push({ method: method.toUpperCase(), router: node.expression.expression.getText(source), route: first.text,
                        file: path.relative(root, filename), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                        middleware, awaits, fetches, queries });
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
}
scan(path.join(root, "Backend/src"));
routes.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const output = [
    "# API route audit inventory", "",
    `${routes.length} literal route registrations scanned from every Backend/src TypeScript module.`, "",
    "Paths are relative to each router mount; aliases are registered in Backend/src/index.ts. Counts cover inline handlers only; imported service calls require tracing. Middleware lists show direct identifiers, not inherited guards. This is a static inventory, not measured latency or proof of authorization.", "",
    "Every mounted API request now has completion timing. Enable API_PERFORMANCE_LOG_ALL=true for a representative window to compute p50/p95/p99 by namespace, method, and route template. No request body, query string, token, email or user ID is logged. Query timing covers the shared query() wrapper, including pool acquisition, and can overlap when queries run in parallel. Direct pool.query()/transaction clients are not counted.", "",
    "| Method | Router | Relative path | Source | Direct middleware | Inline awaits / SQL / fetch |",
    "| --- | --- | --- | --- | --- | --- |",
    ...routes.map((r) => `| ${r.method} | ${r.router} | ${r.route.replaceAll("|", "\\|")} | ${r.file}:${r.line} | ${r.middleware.join(", ") || "—"} | ${r.awaits} / ${r.queries} / ${r.fetches} |`), "",
].join("\n");
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/api-route-audit.md"), output);
console.log(`Scanned ${routes.length} route registrations; wrote docs/api-route-audit.md`);
