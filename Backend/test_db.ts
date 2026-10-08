import { query } from "./src/database/client.js";
async function test() {
    try {
        const res = await query("SELECT * FROM users LIMIT 1;");
        console.log(res.rows);
    } catch(e) { console.log(e); }
    process.exit(0);
}
test();
