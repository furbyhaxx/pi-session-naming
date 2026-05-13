import assert from "node:assert/strict";
import { emitSessionTitleMessage, SESSION_TITLE_MESSAGE_TYPE } from "./title-message.js";

const sent: Array<{ message: unknown; options: unknown }> = [];
const pi = {
	sendMessage(message: unknown, options?: unknown) {
		sent.push({ message, options });
	},
};

let idle = false;
emitSessionTitleMessage(
	pi as never,
	{
		title: "feat(session): auto title",
		actor: "github-copilot/gpt-5.4-mini",
		source: "auto",
	},
	{
		ctx: { isIdle: () => idle },
		pollMs: 5,
		maxWaitMs: 200,
	},
);

assert.equal(sent.length, 0, "message must not steer while agent is busy");
idle = true;
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(sent.length, 1);
assert.equal(sent[0].options, undefined);
assert.equal((sent[0].message as { customType: string }).customType, SESSION_TITLE_MESSAGE_TYPE);

sent.length = 0;
idle = false;
emitSessionTitleMessage(
	pi as never,
	{
		title: "feat(session): delayed title",
		actor: "github-copilot/gpt-5.4-mini",
		source: "auto",
	},
	{
		ctx: { isIdle: () => idle },
		pollMs: 5,
		maxWaitMs: 10,
	},
);

await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].options, { deliverAs: "nextTurn" });

console.log("session title-message tests passed");
