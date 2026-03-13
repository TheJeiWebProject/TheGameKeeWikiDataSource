
import fs from 'fs-extra';
import path from 'path';
import { ComponentParser } from './utils.js';

export async function parseWeapons(inputDir: string, outputDir: string, materialMap: Map<string, string>) {
  const files = await fs.readdir(inputDir);
  const weapons = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await fs.readJson(path.join(inputDir, file));

    const parser = new ComponentParser(content);

    // Basic Info (character-profile)
    const profile = parser.findComponent('character-profile');
    if (!profile) continue;

    const name = ComponentParser.extractText(profile.data.name);
    const description = ComponentParser.extractText(profile.data.desc);

    // Attributes (Rarity, Type)
    let rarity = 5;
    let type = 'Unknown';

    if (profile.data.attrList) {
      for (const attr of profile.data.attrList) {
        const title = ComponentParser.extractText(attr.title);
        const val = ComponentParser.extractText(attr.content);
        if (title.includes('品质')) {
          rarity = parseInt(val) || 5;
        } else if (title.includes('类型')) {
          type = val;
        }
      }
    }

    const image = profile.data.imageList?.[0] || '';

    // Stats (skill-info with specific names or just parsing text)
    const stats: Record<string, string> = {};
    const passives = [];

    // Find all skill-info components recursively
    const skillComponents = parser.findAllComponents('skill-info');
    for (const comp of skillComponents) {
      if (comp.data.skillList) {
        for (const skill of comp.data.skillList) {
          const name = ComponentParser.extractText(skill.name);
          const desc = ComponentParser.extractText(skill.desc);

          if (name.includes('提升') || name.includes('攻击力') || name.includes('生命') || name.includes('防御') || name.includes('充能')) {
            stats[name] = desc;
          } else {
            passives.push({ name, description: desc });
          }
        }
      }
    }

    // Materials (Upgrade Info)
    const materials = [];
    const upgradeComponent = parser.findComponent('upgrade-info');
    if (upgradeComponent && upgradeComponent.data.upgradeList) {
      for (const upgrade of upgradeComponent.data.upgradeList) {
        const level = ComponentParser.extractText(upgrade.title);
        const items = [];

        // Check 'content' array for materials (image + count)
        if (upgrade.content && Array.isArray(upgrade.content)) {
          for (const item of upgrade.content) {
            if (item.avatar) {
              const filename = path.basename(item.avatar);
              const name = materialMap.get(filename) || 'Unknown Material';
              const count = item.name; // This is count!
              items.push({ name, count });
            }
          }
        }

        // Fallback to 'other' if content is empty (old logic)
        if (items.length === 0 && upgrade.other && Array.isArray(upgrade.other)) {
          for (const item of upgrade.other) {
            const text = ComponentParser.extractText(item);
            if (text) items.push({ name: text, count: '?' });
          }
        }

        if (items.length > 0) {
          materials.push({
            level,
            items
          });
        }
      }
    }

    // Upgrade Materials (Relation Info - New Format)
    const relationInfo = parser.findComponent('relation-info');
    if (relationInfo && relationInfo.data.list) {
      for (const group of relationInfo.data.list) {
        const title = ComponentParser.extractText(group.title); // e.g. "总计", "1~20级"
        const items = [];
        if (group.content) {
          for (const item of group.content) {
            if (item.avatar) {
              const filename = path.basename(item.avatar);
              const matName = materialMap.get(filename) || 'Unknown';
              items.push({
                name: matName,
                count: item.name,
                icon: item.avatar
              });
            }
          }
        }
        if (items.length > 0) {
          materials.push({
            level: title,
            items
          });
        }
      }
    }

    // Images (Tab Info)
    const tabInfo = parser.findComponent('tab-info');
    const images = [];
    if (tabInfo && tabInfo.data.tabList) {
      for (const tab of tabInfo.data.tabList) {
        if (tab.type === 'image' && tab.content) {
          images.push({
            title: tab.title,
            url: tab.content[0]
          });
        }
      }
    }

    const weapon = {
      id: content.content_id,
      sourceUrl: `https://www.gamekee.com/zmd/${content.content_id}.html`,
      name,
      description,
      rarity,
      type,
      image,
      images,
      stats,
      passives,
      materials
    };
    weapons.push(weapon);

    await fs.outputJson(path.join(outputDir, 'weapons', `${content.content_id}.json`), weapon, { spaces: 2 });
  }

  // await fs.outputJson(path.join(outputDir, 'weapons.json'), weapons, { spaces: 2 });
  console.log(`Parsed ${weapons.length} weapons.`);
}
