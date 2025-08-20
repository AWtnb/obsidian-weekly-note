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

export const strikeThrough = (s: string): string => {
	const symbol = "~~";
	const reg = new RegExp("(^\\s*)(.+)", "g");
	return s.replace(reg, (_: string, p1: string, p2: string): string => {
		const line = p2.trimEnd();
		const head = line.substring(0, 2);
		if (["- ", "+ ", "* "].includes(head)) {
			return p1 + head + symbol + line.substring(2) + symbol;
		}
		return p1 + symbol + line + symbol;
	});
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
	constructor(editor: Editor) {
		this.lines = editor.getValue().split("\n");
		this.edges = editor.listSelections().map((sel) => toEdge(sel));
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
			const line = lines[i];
			const c = line.trimStart().substring(0, 1);
			if (c && ["-", "+", "*"].indexOf(c) == -1) {
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

	replaceCursorLines(replacer: LineReplacer): NewLine[] {
		return this.cursorLineIndexes().map((i) => {
			return {
				index: i,
				text: replacer(this.lines[i]),
			};
		});
	}
}
