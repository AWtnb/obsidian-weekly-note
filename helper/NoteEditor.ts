import { Editor, EditorSelection } from "obsidian";

const getIndent = (s: string): number => {
	return s.length - s.trimStart().length;
};

const toSeq = (start: number, end: number): number[] => {
	const arr = [];
	for (let i = start; i <= end; i++) {
		arr.push(i);
	}
	return arr;
};

interface MdList {
	symbol: string;
	text: string;
	finished: boolean;
}

const checkFilledMdTask = (s: string): boolean => {
	return s.substring(0, 3) === "[x]";
};

export const asMdList = (line: string): MdList => {
	const head = line.substring(0, 2);
	if (["- ", "+ ", "* "].includes(head)) {
		const t = line.substring(2);
		return { symbol: head, text: t, finished: checkFilledMdTask(t) };
	}
	return { symbol: "", text: line, finished: checkFilledMdTask(line) };
};

const strikeThrough = (s: string): string => {
	const strike = "~~";
	const reg = new RegExp("(^\\s*)(.+)", "g");
	return s.replace(
		reg,
		(_: string, indent: string, content: string): string => {
			const line = content.trimEnd();
			const mdLine = asMdList(line);
			return indent + mdLine.symbol + strike + mdLine.text + strike;
		}
	);
};

interface CursorEdge {
	top: number;
	bottom: number;
}

interface LineReplacer {
	(line: string): string;
}

interface NewLine {
	index: number;
	text: string;
}

interface LineChecker {
	(line: string): boolean;
}

export const unFinishedListRoot: LineChecker = (line: string): boolean => {
	const l = line.trim();
	if (0 < l.length) {
		const ml = asMdList(l);
		return 0 < ml.symbol.length && !ml.finished;
	}
	return false;
};

export const nonListLine: LineChecker = (line: string): boolean => {
	const l = line.trim();
	return 0 < l.length && asMdList(l).symbol.length < 1;
};

const toEdge = (sel: EditorSelection): CursorEdge => {
	const a = sel.anchor.line;
	const h = sel.head.line;
	return { top: Math.min(a, h), bottom: Math.max(a, h) };
};

export class NoteEditor {
	private readonly lines: string[];
	private readonly edges: CursorEdge[];
	private readonly editor: Editor;
	constructor(editor: Editor) {
		this.lines = editor.getValue().split("\n");
		this.edges = editor.listSelections().map((sel) => toEdge(sel));
		this.editor = editor;
	}

	get maxLineIndex(): number {
		return this.lines.length - 1;
	}

	private cursorLineIndexes(): number[] {
		return this.edges
			.map((edge) => {
				if (edge.top == edge.bottom) {
					return edge.top;
				}
				return toSeq(edge.top, edge.bottom);
			})
			.flat()
			.sort((a, b) => a - b);
	}

	cursorLines(): string[] {
		return this.cursorLineIndexes().map((i) => {
			return this.lines[i];
		});
	}

	private get topEdge(): number {
		return this.edges[0].top;
	}

	private get bottomEdge(): number {
		return this.edges[this.edges.length - 1].bottom;
	}

	private linesBeforeCursor(): string[] {
		return this.lines.slice(0, this.topEdge);
	}

	private linesAfterCursor(): string[] {
		return this.lines.slice(this.bottomEdge + 1);
	}

	getNextLineIndex(checker: LineChecker): number | null {
		const lines = this.linesAfterCursor();
		for (let i = 0; i < lines.length; i++) {
			if (checker(lines[i])) {
				return this.bottomEdge + 1 + i;
			}
		}
		return null;
	}

	getLastLineIndex(checker: LineChecker): number | null {
		const lines = this.linesBeforeCursor().reverse();
		for (let i = 0; i < lines.length; i++) {
			if (checker(lines[i])) {
				return this.topEdge - 1 - i;
			}
		}
		return null;
	}

	breadcrumbs(): string[] {
		const depth = getIndent(this.lines[this.topEdge]);
		return this.linesBeforeCursor()
			.reverse()
			.filter((line) => {
				return getIndent(line) < depth;
			})
			.reduce((acc: string[], s: string) => {
				const last = acc.at(-1);
				if (!last || getIndent(last) != 0) {
					acc.push(s);
				}
				return acc;
			}, [])
			.reduce((acc: string[], s: string) => {
				const last = acc.at(-1);
				if (last && getIndent(last) == getIndent(s)) {
					acc.pop();
				}
				acc.push(s);
				return acc;
			}, [])
			.reverse();
	}

	private replaceCursorLines(replacer: LineReplacer): NewLine[] {
		return this.cursorLineIndexes().map((i) => {
			return {
				index: i,
				text: replacer(this.lines[i]),
			};
		});
	}

	strikeThroughCursorLines() {
		this.replaceCursorLines(strikeThrough).forEach((newLine) => {
			this.editor.setLine(newLine.index, newLine.text);
		});
	}
}
