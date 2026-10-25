# Tablet Shard Finder

Find out which of the 99 **Tablet Shards** in *Final Fantasy Resonance* you are still missing.
Drop in your save file and the page shows every location with missing shards, including where to look.

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/heydave)

## How to use

1. Open the page.
2. Pick your save file. On Steam (Windows) the saves are stored in
   `%LOCALAPPDATA%\FFRS\Steam\<your Steam ID>\`, one file per slot: `GameSaveData0.sav`, `GameSaveData1.sav`, `GameSaveData2.sav`.
3. See your progress per chapter and the list of missing shards.

Spoiler mode is off by default, so chapters and areas you haven't reached yet stay hidden.
The page is available in English and German.

## Privacy

Your save file never leaves your browser. It is decrypted and read locally, and nothing is uploaded or stored.
The page loads no scripts or fonts from third-party servers.

## How it works

- Save files start with an `SVHD` header, followed by an AES-256-ECB encrypted Unreal Engine save (GVAS).
  The key ships with the game in `DefaultSaveGameUtility.ini`.
- In the game data each shard is a `BP_MapGimmick_FieldItem_Medal` actor (item 25004) with a fixed ID per map.
  The positions of all 99 were taken from the game's level files.
- A collected shard appears in the save under `Map.mapGimmick[<map>].treasureBox.treasureBoxList`
  as an entry with `ID = -1`, the actor's `UniqueID` and `IsOpen = true`.
- For locations with several shards the game only records which IDs you have. Which ID belongs to which
  guide number is unknown, so the page lists every candidate there.

## Credits

- Shard numbering and spot descriptions follow the [PowerPyx guide](https://www.powerpyx.com/final-fantasy-resonance-all-tablet-shard-locations/).
- Location names come from the game's localization.
- [crypto-js](https://github.com/brix/crypto-js) (MIT), fonts Cinzel, Source Sans 3 and JetBrains Mono (SIL OFL 1.1).

## License

[MIT](LICENSE)
