
import fs from 'fs-extra';
import path from 'path';
import { parseOperators } from './operator.js';
import { parseWeapons } from './weapon.js';
import { parseMonsters } from './monster.js';
import { parseEquipment } from './equipment.js';
import { parseMaterials } from './material.js';

export async function runParser() {
  const inputDir = path.resolve('data/raw');
  const outputDir = path.resolve('data/parsed');

  await fs.ensureDir(outputDir);

  const operatorDir = path.join(inputDir, '干员图鉴');
  const weaponDir = path.join(inputDir, '武器图鉴');
  const monsterDir = path.join(inputDir, '怪物图鉴');
  const equipmentDir = path.join(inputDir, '装备图鉴');
  // const materialDir = path.join(inputDir, '材料图鉴'); // Handled in loop

  const materialMap = new Map<string, string>();
  const materialSources = ['材料图鉴', '可用道具图鉴', '设备图鉴'];

  for (const src of materialSources) {
    const dir = path.join(inputDir, src);
    if (await fs.pathExists(dir)) {
      const map = await parseMaterials(dir, outputDir);
      for (const [k, v] of map) {
        materialMap.set(k, v);
      }
    }
  }

  if (await fs.pathExists(operatorDir)) {
    await parseOperators(operatorDir, outputDir);
  }

  if (await fs.pathExists(weaponDir)) {
    await parseWeapons(weaponDir, outputDir, materialMap);
  }

  if (await fs.pathExists(monsterDir)) {
    await parseMonsters(monsterDir, outputDir);
  }

  if (await fs.pathExists(equipmentDir)) {
    await parseEquipment(equipmentDir, outputDir, materialMap);
  }
}
