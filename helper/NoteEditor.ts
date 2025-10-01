import { Editor, EditorSelection } from "obsidian";

export const getIndent = (s: string): number => {
	return s.length - s.trimStart().length;
};

const toSeq = (start: number, end: number): number[] => {
	const arr = [];
	for (let i = start; i <= end; i++) {
		arr.push(i);
	}
	return arr;
};

class MdListLine {
	private readonly symbol: string;
	private readonly text: string;
	constructor(s: string) {
		const head = s.substring(0, 2);
		if ("-+*".indexOf(head.trim()) != -1) {
			this.symbol = head;
			this.text = s.substring(2);
		} else {
			this.symbol = "";
			this.text = s;
		}
	}
	isList(): boolean {
		return 0 < this.symbol.length;
	}
	isUnFinished(): boolean {
		return this.isList() && this.text.startsWith("[ ]");
	}
	private get strike(): string {
		return "~~";
	}
	isDeleted(): boolean {
		return (
			this.text.startsWith(this.strike) && this.text.endsWith(this.strike)
		);
	}
	getDeletedLine(): string {
		if (this.isDeleted()) {
			return this.symbol + this.text;
		}
		return this.symbol + this.strike + this.text + this.strike;
	}
}

export const asMdListLine = (line: string): MdListLine => {
	return new MdListLine(line);
};

const strikeThrough = (s: string): string => {
	const reg = new RegExp("(^\\s*)(.+)", "g");
	return s.replace(
		reg,
		(raw: string, indent: string, content: string): string => {
			const line = content.trimEnd();
			const ml = asMdListLine(line);
			return indent + ml.getDeletedLine();
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
		const ml = asMdListLine(l);
		return ml.isUnFinished();
	}
	return false;
};

export const nonListLine: LineChecker = (line: string): boolean => {
	const l = line.trim();
	return !asMdListLine(l).isList();
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
			.reduce((acc: number[], n: number) => {
				if (acc.indexOf(n) == -1) {
					acc.push(n);
				}
				return acc;
			}, [])
			.sort((a, b) => a - b);
	}

	sentLineIndexes(): number[] {
		const idxs = new Set<number>();
		const curLineIdxs = this.cursorLineIndexes();
		for (const idx of curLineIdxs) {
			const curLine = this.lines[idx];
			if (!curLine || curLine.trim().length < 1) continue;
			const ml = asMdListLine(curLine);
			if (ml.isDeleted()) continue;
			idxs.add(idx);
			const baseIndent = getIndent(curLine);
			let i = idx + 1;
			if (curLineIdxs.indexOf(i) !== -1) {
				continue;
			}
			while (i <= this.maxLineIndex) {
				const line = this.lines[i];
				if (!line || line.trim().length < 1) break;
				if (asMdListLine(line).isDeleted()) {
					i++;
					continue;
				}
				const indent = getIndent(line);
				if (indent <= baseIndent) {
					if (indent == baseIndent && !ml.isList()) {
						idxs.add(i);
					}
					break;
				}
				idxs.add(i);
				i++;
			}
		}

		return Array.from(idxs).sort((a, b) => a - b);
	}

	byIndex(indexes: number[]): string[] {
		return indexes.map((i) => {
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

	breadcrumb(): string[] {
		const stack: string[] = [];
		const depth = getIndent(this.lines[this.topEdge]);
		if (depth == 0) {
			return stack;
		}
		const indentHistory = new Set<number>();

		for (let i = this.topEdge - 1; 0 <= i; i--) {
			const line = this.lines[i];
			if (line.trim().length == 0) {
				continue;
			}

			const indent = getIndent(line);
			if (depth <= indent) {
				continue;
			}
			if (indentHistory.has(indent)) {
				continue;
			}

			stack.push(line);
			indentHistory.add(indent);

			if (indent == 0) {
				break;
			}
		}

		return stack.reverse();
	}

	private replaceLines(indexes: number[], replacer: LineReplacer): NewLine[] {
		return indexes.map((i) => {
			return {
				index: i,
				text: replacer(this.lines[i]),
			};
		});
	}

	strikeThroughSentLines(indexes: number[]) {
		this.replaceLines(indexes, strikeThrough).forEach((newLine) => {
			this.editor.setLine(newLine.index, newLine.text);
		});
	}
}

export const getLinesBlock = (lines: string[], start: number): string[] => {
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim().length < 1) {
			return lines.slice(start, i);
		}
	}
	return lines.slice(start);
};
