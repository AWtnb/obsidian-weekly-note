import { App, Notice, TFile, Editor, MarkdownView } from "obsidian";
import {
	getIndent,
	getLinesBlock,
	isMdList,
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

interface Task {
	heading: string;
	breadcrumb: string[];
	lines: string[];
}

export class SentTask implements Task {
	heading: string = "";
	breadcrumb: string[] = [];
	lines: string[] = [];
}

const appendToFile = async (
	app: App,
	path: string,
	task: SentTask
): Promise<void> => {
	const file = app.vault.getFileByPath(path);
	if (!(file instanceof TFile)) {
		new Notice(`ERROR: Failed to append to "${path}" (file not found)`, 0);
		return;
	}
	const existingLines = (await app.vault.read(file)).split("\n");
	const found = existingLines.lastIndexOf(task.heading);
	if (found != -1) {
		const tree = task.breadcrumb.concat(task.lines);
		const baseListStart = found + 1;
		const baseListLines = getLinesBlock(existingLines, baseListStart);
		const insertion = findLineInsertion(baseListLines, tree);
		if (!insertion) {
			return;
		}
		const newLines = [
			existingLines.slice(0, baseListStart + insertion.start),
			insertion.content,
			existingLines.slice(baseListStart + insertion.start),
		].flat();
		await app.vault.modify(file, newLines.join("\n") + "\n");
	} else {
		const newLines = [task.heading, task.breadcrumb, task.lines]
			.flat()
			.filter((line) => 0 < line.trim().length);
		await app.vault.append(file, "\n\n" + newLines.join("\n") + "\n");
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

	const sent = new SentTask();
	const breadcrumb = ed.breadcrumb();
	if (0 < breadcrumb.length) {
		const bcRoot = breadcrumb[0];
		if (isMdList(bcRoot)) {
			const lastPlain = ed.getLastLineIndex(nonListLine);
			if (lastPlain === null) {
				sent.heading = bcRoot;
				sent.breadcrumb = breadcrumb.slice(1);
			} else {
				sent.heading = editor.getLine(lastPlain);
				sent.breadcrumb = breadcrumb;
			}
		} else {
			sent.heading = bcRoot;
			sent.breadcrumb = breadcrumb.slice(1);
		}
		sent.lines = sentLines;
	} else {
		const topLine = sentLines[0];
		if (isMdList(topLine)) {
			const lastPlain = ed.getLastLineIndex(nonListLine);
			if (lastPlain === null) {
				sent.heading = topLine;
				sent.lines = sentLines.slice(1);
			} else {
				sent.heading = editor.getLine(lastPlain);
				sent.lines = sentLines;
			}
		} else {
			sent.heading = topLine;
			sent.lines = sentLines.slice(1);
		}
	}

	const nextPath = note.increment().path;
	appendToFile(app, nextPath, sent);

	ed.strikeThroughSentLines(targetIdxs);
};
