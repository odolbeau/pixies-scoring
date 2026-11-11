import { writeFileSync } from "node:fs";
import { ALL_CARDS } from "../../src/data/cards.ts";
writeFileSync("ml/photos/catalogue.json", JSON.stringify(ALL_CARDS, null, 1));
console.log(ALL_CARDS.length);
