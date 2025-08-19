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

interface CursorEdge {
	top: number;
	bottom: number;
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

	private lineAt(line: number): string {
		return this.lines[line];
	}

	cursorLines(): string[] {
		return this.edges
			.map((edge) => {
				if (edge.top == edge.bottom) {
					return edge.top;
				}
				return toSeq(edge.top, edge.bottom);
			})
			.flat()
			.sort((a, b) => a - b)
			.map((i) => {
				return this.lineAt(i);
			});
	}

	private rollup(): string[] {
		return this.lines.slice(0, this.edges[0].top).reverse();
	}

	lastPlainLine(): string | null {
		const lines = this.rollup();
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const c = line.trimStart().substring(0, 1);
			if (c && ["-", "+", "*"].indexOf(c) == -1) {
				return line;
			}
		}
		return null;
	}

	backToRoot(): string[] {
		const curLine = this.lineAt(this.edges[0].top);
		const depth = getIndent(curLine);
		return this.rollup()
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
}
