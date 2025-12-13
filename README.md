# Obsidian Weekly Note

## Commands

- `Weekly-Note: 1年分のノートを作る` Makes weekly notes for specified year.
- `Weekly-Note: 今週のノートを開く` Opens weekly note for current week.
- `Weekly-Note: 前のノートを開く` Opens previous weekly note.
- `Weekly-Note: 次のノートを開く` Opens next weekly note.
- `Weekly-Note: 次のノートに送る` Sends selected lines to next weekly note.
- `Weekly-Note: ノートにジャンプ` Opens modal to jump to weekly note containing specific date.
- `Weekly-Note: カーソルまでスクロール` Scrolls to reveal cusor.
- `Weekly-Note: 次の未完了リスト項目までジャンプ` Moves cursor down to next unfinished list item.
- `Weekly-Note: 前の未完了リスト項目までジャンプ` Moves cursor up to last unfinished list item.
- `Weekly-Note: 次の非リスト行までジャンプ` Moves cursot to next non-list-line.
- `Weekly-Note: 前の非リスト行までジャンプ` Moves cursot to last non-list-line.
- `Weekly-Note: 未来のノートから検索` Search for notes that are in the future from the point of command execution.
- `Weekly-Note: 全ノートをバックアップ` Copies all note to specified directory.


## Install

Run [install.ps1](install.ps1) with vault folder path as an argument.

管理対象のフォルダパスを引数にして [install.ps1](install.ps1) を実行する。

```
# Example
.\install.ps1 C:\Users\awtnb\Schedule
```

### Manual install

Copy over `main.js`, `styles.css`, `manifest.json` to `(VaultFolder)/.obsidian/plugins/obsidian-weekly-note/` .

`main.js` ・ `styles.css` ・ `manifest.json` をそれぞれ `（Vaultフォルダ）/.obsidian/plugins/obsidian-weekly-note/` にコピーしてもインストール可能。

## Develop / Debug

Run below command in Vault root directory.

```PowerShell
$n="obsidian-weekly-note";$repo="https://github.com/AWtnb/$n.git";$p=".obsidian"|Join-Path -ChildPath "plugins";if (-not(Test-Path $p -PathType Container)){New-Item -Path $p -ItemType Directory}Push-Location $p;git clone $repo; cd $n;if (Get-Command code -ErrorAction SilentlyContinue){code .};Pop-Location
```

Afterwords, run `npm i` and `npm run dev`.

Then on Obsidian, run `Reload app without saving` command. `Weekly-Note` should appear in `Community plugins` setting.


---

- Generated from [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [API Documentation](https://github.com/obsidianmd/obsidian-api)
- [Mobile development](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)

    ```JavaScript
    this.app.emulateMobile(!this.app.isMobile);
    ```
