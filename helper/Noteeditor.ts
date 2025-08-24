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
}

export const asMdList = (line: string): MdList => {
	const head = line.substring(0, 2);
	if (["- ", "+ ", "* "].includes(head)) {
		return { symbol: head, text: line.substring(2) };
	}
	return { symbol: "", text: line };
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

	private linesToTop(): string[] {
		return this.lines.slice(0, this.edges[0].top).reverse();
	}

	lastPlainLine(): string | null {
		const lines = this.linesToTop();
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (0 < line.length && asMdList(line).symbol.length < 1) {
				return line;
			}
		}
		return null;
	}

	breadcrumbs(): string[] {
		const curLine = this.lines[this.edges[0].top];
		const depth = getIndent(curLine);
		return this.linesToTop()
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
