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

	lastPlainLine(): string | null {
		const l = this.edges[0].top - 1;
		for (let i = l; 0 <= i; i--) {
			const line = this.lineAt(i);
			const c = line.trimStart().substring(0, 1);
			if (["-", "+", "*"].indexOf(c) == -1) {
				return line;
			}
		}
		return null;
	}

	rollup(): string[] {
		const lines: string[] = [];
		const t = this.edges[0].top;
		const depth = getIndent(this.lineAt(t));
		for (let i = t - 1; 0 <= i; i--) {
			const line = this.lineAt(i);
			const d = getIndent(line);
			if (d < depth) {
				lines.push(line);
				if (d < 1) {
					break;
				}
			}
		}
		return lines
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
