# Obsidian Weekly Note

## Commands

- `Weekly-Note: 1年分のノートを作る` Makes weekly notes for specified year.
- `Weekly-Note: 今週のノートを開く` Opens weekly note for current week.
- `Weekly-Note: 次のノートを開く` Opens next weekly note.
- `Weekly-Note: 次のノートに送る` Sends selected lines to next weekly note.
- `Weekly-Note: リスト以下を選択` Selects list (and sub list).


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

Run below command after creating test vault from Obsidian.

```PowerShell
# on test valult directory:
$n="obsidian-weekly-note";$repo="https://github.com/AWtnb/$n.git";$p=".obsidian"|Join-Path -ChildPath "plugins";if (-not(Test-Path $p -PathType Container)){New-Item -Path $p -ItemType Directory}Push-Location $p;git clone $repo; cd $n;npm install;code .;Pop-Location
```

Afterwords, run `npm run dev`.

Then on Obsidian, run `Reload app without saving` command. `Weekly-Note` should appear in `Community plugins` setting.


---

- Generated from [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [API Documentation](https://github.com/obsidianmd/obsidian-api)
- [Mobile development](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)

    ```JavaScript
    this.app.emulateMobile(!this.app.isMobile);
    ```
