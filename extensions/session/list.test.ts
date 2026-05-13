import assert from "node:assert/strict";
import { parseListSessionsArgs } from "./list.js";

assert.deepEqual(parseListSessionsArgs(["--list-sessions"]), {
	enabled: true,
	json: false,
});
assert.deepEqual(parseListSessionsArgs(["--list-sessions", "auth"]), {
	enabled: true,
	filter: "auth",
	json: false,
});
assert.deepEqual(parseListSessionsArgs(["--list-sessions=auth", "--json"]), {
	enabled: true,
	filter: "auth",
	json: true,
});
assert.deepEqual(parseListSessionsArgs(["--json"]), {
	enabled: false,
	json: true,
});
assert.deepEqual(
	parseListSessionsArgs(["--list-sessions", "--session-dir", "/tmp/sessions"]),
	{
		enabled: true,
		json: false,
		sessionDir: "/tmp/sessions",
	},
);
assert.deepEqual(parseListSessionsArgs(["--old-sessions", "auth"]), {
	enabled: false,
	json: false,
});

console.log("session list tests passed");
