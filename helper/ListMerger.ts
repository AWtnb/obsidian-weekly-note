import { App, Notice, TFile, Editor, MarkdownView } from "obsidian";
import {
	asMdListLine,
	getIndent,
	getLinesBlock,
	nonListLine,
	NoteEditor,
} from "./NoteEditor";
import { fromPath } from "./Weeklynote";

/*
With markdown list as below,

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1
		- aaa-2-2
- bbb
	- bbb-1
	- bbb-2
- ccc
```

and breadcrumb as below,

```
- aaa
	- aaa-2
		- aaa-2-1
			- INSERTED
```

`\t\t\t- INSERTED` will be inserted between `slice(0, 7)` and `slice(7)` and resulting in the format as below:

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1
			- INSERTED
		- aaa-2-2
- bbb
	- bbb-1
	- bbb-2
- ccc
```

---

Above markdown list and breadcrumb as below,

```
- bbb
	- INSERTED
```

`\t- INSERTED` will be inserted between `slice(0, 11)` and `slice(11)` and resulting in the format as below:

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1
		- aaa-2-2
- bbb # 💡
	- bbb-1
	- bbb-2
	- INSERTED
- ccc
```

---

Above markdown list and breadcrumb as below,

```
- aaa
	- aaa-2
		- INSERTED
```

`\t\t- INSERTED` will be inserted between `slice(0, 8)` and `slice(8)` and resulting in the format as below:

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1 # 💡
		- aaa-2-2
		- INSERTED
- bbb
	- bbb-1
	- bbb-2
- ccc
```

---

Above markdown list and breadcrumb as below,

```
- INSERTED
```

`- INSERTED` will be inserted between `slice(0, 12)` and `slice(12)` and resulting in the format as below:

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1
		- aaa-2-2
- bbb
	- bbb-1
	- bbb-2
- ccc
- INSERTED
```

---

Above markdown list and breadcrumb as below,

```
- bbb
	- INSERTED-1
	- INSERTED-2
```

`\t- INSERTED-1\n\t- INSERTED-2` will be inserted between `slice(0, 11)` and `slice(11)` and resulting in the format as below:

```
- aaa
	- aaa-1
		- aaa-1-1
		- aaa-1-2
	- aaa-2
		- aaa-2-1
			- aaa-2-1-1
		- aaa-2-2
- bbb
	- bbb-1
	- bbb-2
	- INSERTED-1
	- INSERTED-2 # 💡
- ccc
```

---

Above markdown list and breadcrumb as below,

```
- aaa
	- aaa-2
		- aaa-2-1
```

do nothing because all path of breadcrumb exist in original list.

*/

interface LineInsertion {
	start: number;
	content: string;
}

const lineInsertion = (start: number, content: string): LineInsertion => {
	return { start: start, content: content };
};

const findLineInsertion = (
	baseLines: string[],
	tree: string[]
): LineInsertion | null => {
	if (tree.length < 1) {
		return null;
	}

	const trRoot = tree[0];
	const trPath = tree.slice(1);
	const trIndent = getIndent(trRoot);
	const trString = tree.join("\n");

	for (let i = 0; i < baseLines.length; i++) {
		const line = baseLines[i];
		if (line == trRoot) {
			if (trPath.length < 1) {
				return null;
			}
			const result = findLineInsertion(baseLines.slice(i + 1), trPath);
			if (result) {
				return lineInsertion(i + 1 + result.start, result.content);
			}
			return null;
		}
		if (getIndent(line) < trIndent) {
			return lineInsertion(i, trString);
		}
	}
	return lineInsertion(baseLines.length, trString);
};

const limitConsecutiveBlankLine = (arr: string[], limit: number): string[] => {
	const accum = arr.reduce<{ result: string[]; emptyCount: number }>(
		(acc, item) => {
			if (item === "") {
				if (acc.emptyCount < limit) {
					acc.result.push(item);
				}
				acc.emptyCount++;
			} else {
				acc.result.push(item);
				acc.emptyCount = 0;
			}
			return acc;
		},
		{ result: [], emptyCount: 0 }
	);

	return accum.result;
};

class Context {
	heading: string = "";
	breadcrumb: string[] = [];
}

class Task {
	context: Context;
	lines: string[] = [];
	constructor() {
		this.context = new Context();
	}
	get tree(): string[] {
		return this.context.breadcrumb.concat(this.lines);
	}
}

const appendToFile = async (
	app: App,
	path: string,
	task: Task
): Promise<void> => {
	const file = app.vault.getFileByPath(path);
	if (!(file instanceof TFile)) {
		new Notice(`ERROR: Failed to append to "${path}" (file not found)`, 0);
		return;
	}
	const existingLines = (await app.vault.read(file)).split("\n");
	const found = existingLines.lastIndexOf(task.context.heading);
	if (found != -1) {
		const baseListStart = found + 1;
		const baseListLines = getLinesBlock(existingLines, baseListStart);
		const insertion = findLineInsertion(baseListLines, task.tree);
		if (!insertion) {
			return;
		}
		const newLines = [
			existingLines.slice(0, baseListStart + insertion.start),
			insertion.content,
			existingLines.slice(baseListStart + insertion.start),
			"",
		].flat();
		await app.vault.modify(
			file,
			limitConsecutiveBlankLine(newLines, 1).join("\n")
		);
	} else {
		const newLines = [
			existingLines,
			"",
			task.context.heading,
			task.tree,
			"",
		].flat();
		await app.vault.modify(
			file,
			limitConsecutiveBlankLine(newLines, 1).join("\n")
		);
	}
	new Notice(`Appended to: ${path}`);
};

export const sendTask = (
	app: App,
	editor: Editor,
	view: MarkdownView
): void => {
	const file = view.file;
	if (!file) return;
	const note = fromPath(file.path);
	if (!note) return;

	const ed = new NoteEditor(editor);
	const targetIdxs = ed.sentLineIndexes();
	const sentLines = ed.byIndex(targetIdxs);
	if (sentLines.length < 1) {
		return;
	}

	const sent = new Task();
	const breadcrumb = ed.breadcrumb();
	if (0 < breadcrumb.length) {
		const bcRoot = breadcrumb[0];
		if (asMdListLine(bcRoot).isList()) {
			const lastPlain = ed.getLastLineIndex(nonListLine);
			if (lastPlain === null) {
				sent.context.heading = bcRoot;
				sent.context.breadcrumb = breadcrumb.slice(1);
			} else {
				sent.context.heading = editor.getLine(lastPlain);
				sent.context.breadcrumb = breadcrumb;
			}
		} else {
			sent.context.heading = bcRoot;
			sent.context.breadcrumb = breadcrumb.slice(1);
		}
		sent.lines = sentLines;
	} else {
		const topLine = sentLines[0];
		if (asMdListLine(topLine).isList()) {
			const lastPlain = ed.getLastLineIndex(nonListLine);
			if (lastPlain === null) {
				sent.context.heading = topLine;
				sent.lines = sentLines.slice(1);
			} else {
				sent.context.heading = editor.getLine(lastPlain);
				sent.lines = sentLines;
			}
		} else {
			sent.context.heading = topLine;
			sent.lines = sentLines.slice(1);
		}
	}

	const nextPath = note.increment().path;
	appendToFile(app, nextPath, sent);

	ed.strikeThroughSentLines(targetIdxs);
};
