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
.\install.ps1 C:\Users\awtnb\Documents\schedule
```

### Manual install

Copy over `main.js`, `styles.css`, `manifest.json` to `(VaultFolder)/.obsidian/plugins/obsidian-weekly-note/` .

`main.js` ・ `styles.css` ・ `manifest.json` をそれぞれ `（Vaultフォルダ）/.obsidian/plugins/obsidian-weekly-note/` にコピーしてもインストール可能。

## Develop / Debug

1. Create test vault and open from Obsidian.
1. `mkdir (VaultFolder)\.obsidian\plugins`
1. `cd (VaultFolder)\.obsidian\plugins`
1. `git clone https://github.com/AWtnb/obsidian-weekly-note.git`
1. `npm install`
1. `npm run dev`
1. From Obsidian, run `Reload app without saving` command. Then, `Weekly-Note` should appear in `Community plugins` setting.


---

- Generated from [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [API Documentation](https://github.com/obsidianmd/obsidian-api)
- [Mobile development](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)

    ```JavaScript
    this.app.emulateMobile(!this.app.isMobile);
    ```
