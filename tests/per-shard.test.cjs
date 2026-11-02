"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextDecoder } = require("node:util");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const inlineScript = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(script => script.includes("const LOC ="));
assert.ok(inlineScript, "The page must contain its application script");
const eventBoundary = inlineScript.indexOf("/* ---------------- Events ---------------- */");
assert.ok(eventBoundary > 0, "The test harness must stop before browser event wiring");

function loadApp() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        innerHTML: "",
        textContent: "",
        checked: id === "onlymissing",
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
      });
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    TextDecoder,
    localStorage: { getItem() { return null; } },
    document: {
      documentElement: {},
      getElementById: element,
      querySelectorAll() { return []; },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "vendor", "crypto-js.min.js"), "utf8"), context);
  vm.runInContext(inlineScript.slice(0, eventBoundary) + `
    globalThis.testApp = {
      LOC, analyse, evaluate, emptyResult, render, renderStatic,
      setState(next) {
        if (next.results !== undefined) results = next.results;
        if (next.current !== undefined) current = next.current;
        if (next.chapterFilter !== undefined) chapterFilter = next.chapterFilter;
        if (next.lang !== undefined) lang = next.lang;
      },
    };
  `, context, { filename: "index.html" });
  return { ...context.testApp, element };
}

function allKeys(app) {
  return Array.from(app.LOC, location => Array.from(location[1])).flat();
}

function resultFor(app, collected = [], visited = allKeys(app).map(key => key[0])) {
  const got = new Map([...new Set(visited)].map(mapId => [mapId, new Set()]));
  for (const [mapId, uniqueId] of collected) {
    assert.ok(got.has(mapId), `Collected map ${mapId} must be visited`);
    got.get(mapId).add(uniqueId);
  }
  return { name: "Synthetic slot", got, playTime: 0, savedTicks: 0, empty: false };
}

function cell(markup, guideNo) {
  const match = markup.match(new RegExp(`<button\\b([^>]*\\bid="cell-${guideNo}"[^>]*)>`));
  assert.ok(match, `Grid cell #${guideNo} must exist`);
  const attributes = match[1];
  return {
    classes: new Set((attributes.match(/\bclass="([^"]*)"/)?.[1] || "").split(/\s+/)),
    title: attributes.match(/\btitle="([^"]*)"/)?.[1] || "",
  };
}

function listedGuides(markup) {
  return [...markup.matchAll(/<code>#(\d+)<\/code>/g)].map(match => Number(match[1]));
}

test("each of the 99 actor identities maps to exactly one guide entry", () => {
  const app = loadApp();
  const keys = allKeys(app);
  assert.equal(keys.length, 99);
  assert.ok(keys.every(key => key.length === 3 && key.every(Number.isInteger)),
    "Every key must explicitly include map ID, actor ID, and guide number");
  assert.equal(new Set(keys.map(([mapId, uniqueId]) => `${mapId}:${uniqueId}`)).size, 99);
  assert.deepEqual(keys.map(key => key[2]).sort((a, b) => a - b),
    Array.from({ length: 99 }, (_, index) => index + 1));
  for (const location of app.LOC) {
    assert.deepEqual(Array.from(location[1], key => key[2]).sort((a, b) => a - b),
      Array.from(location[4], guide => guide[0]).sort((a, b) => a - b));
  }
  const identity = guideNo => keys.find(key => key[2] === guideNo).slice(0, 2);
  assert.deepEqual(Array.from(identity(3)), [2040, 9], "Felicitas guide order differs from actor order");
  assert.deepEqual(Array.from(identity(78)), [3220, 36], "The shelves shard is actor 36");
  assert.deepEqual(Array.from(identity(79)), [3220, 35], "The high gantry shard is actor 35");
  assert.deepEqual(Array.from(identity(92)), [3271, 2], "The initial forest bend is actor 2");
  assert.deepEqual(Array.from(identity(93)), [3271, 1], "The later forest dead end is actor 1");
  for (const [guideNo, mapId, uniqueId] of [
    [40, 3110, 59], [41, 3110, 60], [42, 3110, 58],
    [54, 3150, 3], [55, 3150, 2], [70, 3212, 4], [75, 3211, 4],
  ]) {
    assert.deepEqual(Array.from(identity(guideNo)), [mapId, uniqueId],
      `Verified guide #${guideNo} must retain its actor identity`);
  }
});

test("runtime associations agree with the verified native actor inventory", () => {
  const app = loadApp();
  const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs", "shard-mapping.json"), "utf8"));
  assert.equal(inventory.shards.length, 99);
  const documented = inventory.shards.map(shard => {
    assert.match(shard.package, /^\/Game\/Map\/.+\.umap$/);
    assert.ok(shard.actor.startsWith("BP_MapGimmick_FieldItem_Medal_C_"));
    assert.equal(shard.worldPosition.length, 3);
    assert.ok(shard.worldPosition.every(Number.isFinite));
    assert.ok(shard.evidence.length > 0 && shard.evidence.every(value => typeof value === "string" && value.length > 0));
    assert.ok(shard.guideScreenshots.length > 0);
    return [shard.mapId, shard.uniqueId, shard.guideNo];
  });
  const byGuide = (a, b) => a[2] - b[2];
  assert.deepEqual(allKeys(app).map(key => Array.from(key)).sort(byGuide), documented.sort(byGuide));
});

test("every collected subset produces individual cell states and correct aggregates", () => {
  const app = loadApp();
  for (const [chapter, locationKeys] of app.LOC) {
    const keys = Array.from(locationKeys);
    for (let mask = 0; mask < 2 ** keys.length; mask++) {
      const collected = keys.filter((_, index) => mask & (1 << index));
      const analysis = app.analyse(resultFor(app, collected));
      const location = analysis.locs[analysis.cells[keys[0][2]].idx];
      const label = `chapter ${chapter}, guide #${keys[0][2]}, subset ${mask}`;
      assert.equal(analysis.total, collected.length, label);
      assert.equal(analysis.perCh[chapter][0], collected.length, label);
      assert.equal(location.n, collected.length, label);
      assert.equal(location.of, keys.length, label);
      assert.equal(location.state,
        collected.length === keys.length ? "ok" : collected.length ? "part" : "miss", label);
      keys.forEach((key, index) => {
        assert.equal(analysis.cells[key[2]].state, mask & (1 << index) ? "got" : "miss",
          `${label}, guide #${key[2]}`);
      });
    }
  }
});

test("none, all, and no visited maps have distinct states", () => {
  const app = loadApp();
  const keys = allKeys(app);
  const none = app.analyse(resultFor(app));
  const all = app.analyse(resultFor(app, keys));
  const unvisited = app.analyse(resultFor(app, [], []));
  assert.equal(none.total, 0);
  assert.ok(Object.values(none.cells).every(value => value.state === "miss"));
  assert.equal(all.total, 99);
  assert.ok(Object.values(all.cells).every(value => value.state === "got"));
  assert.ok(Array.from(all.locs).every(location => location.state === "ok"));
  assert.equal(unvisited.total, 0);
  assert.ok(Object.values(unvisited.cells).every(value => value.state === "idle"));
});

test("save evaluation respects closed records, actor IDs, and duplicate entries", () => {
  const app = loadApp();
  const record = (UniqueID, IsOpen, ID = -1) => ({ UniqueID, IsOpen, ID, IsUnlock: true });
  const result = app.evaluate({
    Map: { mapGimmick: [
      [3140, { treasureBox: { treasureBoxList: [
        record(10, false), record(10, true, 25004),
        record(11, true), record(11, true), record(9999, true), null,
      ] } }],
      [2120, { treasureBox: { treasureBoxList: [record(10, true), record(11, false)] } }],
      [2015, {}],
    ] },
    Player: { PlayTime: 1234, SavedDateTime: 5678 },
  });
  assert.deepEqual([...result.got.get(3140)].sort((a, b) => a - b), [11, 9999]);
  assert.deepEqual([...result.got.get(2120)], [10]);
  assert.equal(result.got.get(2015).size, 0, "An empty treasure list still marks a map visited");
  assert.equal(result.playTime, 1234);
  assert.equal(result.savedTicks, 5678);
  const analysis = app.analyse(result);
  assert.equal(analysis.total, 2, "Duplicate and unrelated records cannot inflate the shard total");
  for (const [mapId, uniqueId, guideNo] of allKeys(app)) {
    if (mapId === 3140 || mapId === 2120) {
      const collected = mapId === 3140 ? uniqueId === 11 : uniqueId === 10;
      assert.equal(analysis.cells[guideNo].state, collected ? "got" : "miss");
    }
  }
  assert.throws(() => app.evaluate({}), error => error.kind === "nomap");
});

test("Fina's Psyche tracks visibility separately for its three maps", () => {
  const app = loadApp();
  const location = Array.from(app.LOC).find(entry => entry[3] === "Fina's Psyche");
  assert.ok(location);
  const keys = Array.from(location[1]);
  assert.equal(new Set(keys.map(key => key[0])).size, 3);
  const first = keys.find(key => key[0] === 3211);
  const result = resultFor(app, [first], [3211]);
  const analysis = app.analyse(result);
  for (const key of keys) {
    assert.equal(analysis.cells[key[2]].state,
      key[0] !== 3211 ? "idle" : key[1] === first[1] ? "got" : "miss");
  }
  app.setState({ results: [result] });
  app.render();
  const visibleMissing = keys.filter(key => key[0] === 3211 && key[1] !== first[1]).map(key => key[2]);
  assert.deepEqual(listedGuides(app.element("list").innerHTML), visibleMissing);
  for (const key of keys) {
    assert.equal(cell(app.element("grid").innerHTML, key[2]).classes.has("secret"), key[0] !== 3211);
  }
  app.element("spoiler").checked = true;
  app.render();
  for (const key of keys) {
    const rendered = cell(app.element("grid").innerHTML, key[2]);
    assert.equal(rendered.classes.has("secret"), false);
    if (key[0] !== 3211) assert.ok(rendered.classes.has("idle"));
  }
  app.element("spoiler").checked = false;
  app.setState({ results: [resultFor(app, keys.filter(key => key[0] === 3211), [3211])] });
  app.render();
  assert.equal(listedGuides(app.element("list").innerHTML).length, 0);
  assert.match(app.element("list").innerHTML, /class="hint"/);
  assert.doesNotMatch(app.element("list").innerHTML, /Every shard.*collected/,
    "Unvisited maps must not produce an all-collected claim");
});

test("partial locations list only their missing descriptions in both languages", () => {
  const app = loadApp();
  const location = Array.from(app.LOC).find(entry => entry[3] === "Town of Felicitas");
  const collected = Array.from(location[1]).find(key => key[2] === 3);
  const result = resultFor(app, [collected], [2040]);
  for (const [lang, gotText, missingText] of [["en", "collected", "missing"], ["de", "gesammelt", "fehlt"]]) {
    app.setState({ results: [result], lang });
    app.renderStatic();
    app.render();
    assert.deepEqual(listedGuides(app.element("list").innerHTML), [4]);
    const collectedCell = cell(app.element("grid").innerHTML, 3);
    const missingCell = cell(app.element("grid").innerHTML, 4);
    assert.ok(collectedCell.classes.has("got"));
    assert.ok(missingCell.classes.has("miss"));
    assert.ok(collectedCell.title.endsWith(` · ${gotText}`));
    assert.ok(missingCell.title.endsWith(` · ${missingText}`));
    assert.doesNotMatch(app.element("list").innerHTML, /One of these|Einer dieser|only stores how many|nur die Anzahl/);
    assert.doesNotMatch(app.element("legend").innerHTML, /partly|teilweise/);
  }
});

test("location filters and save chips retain their counts while shard states change", () => {
  const app = loadApp();
  const keys = allKeys(app);
  const full = resultFor(app, keys);
  full.name = "Full <slot>";
  const partial = resultFor(app, keys.slice(0, 1));
  partial.name = "One shard";
  app.setState({ results: [full, partial], current: 0 });
  app.render();
  assert.match(app.element("files").innerHTML, /Full &lt;slot&gt; <small>99\/99<\/small>/);
  assert.match(app.element("files").innerHTML, /One shard <small>1\/99<\/small>/);
  assert.equal(listedGuides(app.element("list").innerHTML).length, 0);
  assert.doesNotMatch(app.element("list").innerHTML, /class="loc"/);
  app.element("onlymissing").checked = false;
  app.render();
  assert.match(app.element("list").innerHTML, /class="loc"/);
  assert.equal(listedGuides(app.element("list").innerHTML).length, 0);
  app.setState({ current: 1, chapterFilter: 6 });
  app.render();
  const chapterSixGuides = Array.from(app.LOC).filter(location => location[0] === 6)
    .flatMap(location => Array.from(location[1], key => key[2])).sort((a, b) => a - b);
  assert.deepEqual(listedGuides(app.element("list").innerHTML).sort((a, b) => a - b), chapterSixGuides);
  assert.match(app.element("count").innerHTML, /^1<small> \/ 99<\/small>$/);
});

test("an unvisited save stays hidden until spoiler mode is enabled", () => {
  const app = loadApp();
  app.setState({ results: [app.emptyResult()] });
  app.render();
  assert.equal(listedGuides(app.element("list").innerHTML).length, 0);
  assert.equal((app.element("grid").innerHTML.match(/\bsecret\b/g) || []).length, 99);
  app.element("spoiler").checked = true;
  app.render();
  assert.equal(listedGuides(app.element("list").innerHTML).length, 99);
  assert.doesNotMatch(app.element("grid").innerHTML, /\bsecret\b/);
});
