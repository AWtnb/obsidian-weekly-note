import { getIndent } from "./NoteEditor";

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

interface MergedLine {
	offset: number;
	text: string;
}

const mergedLine = (offset: number, text: string): MergedLine => {
	return { offset: offset, text: text };
};

export const findMergedLine = (
	baseLines: string[],
	breadcrumb: string[]
): MergedLine | null => {
	const bcString = breadcrumb.join("\n");
	if (breadcrumb.length < 1) {
		return null;
	}

	const bcRoot = breadcrumb[0];
	const bcPath = breadcrumb.slice(1);
	const bcIndent = getIndent(bcRoot);

	for (let i = 0; i < baseLines.length; i++) {
		const line = baseLines[i];
		if (line == bcRoot) {
			if (bcPath.length < 1) {
				return null;
			}
			const result = findMergedLine(baseLines.slice(i + 1), bcPath);
			if (result) {
				return mergedLine(i + 1 + result.offset, result.text);
			}
			return null;
		}
		if (getIndent(line) < bcIndent) {
			return mergedLine(i, bcString);
		}
	}
	return mergedLine(baseLines.length, bcString);
};
