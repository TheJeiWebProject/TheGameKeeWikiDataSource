
import fs from 'fs-extra';
import path from 'path';
import { ComponentParser } from './utils.js';

export async function parseEquipment(inputDir: string, outputDir: string, materialMap: Map<string, string>) {
  const files = await fs.readdir(inputDir);
  const equipment = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await fs.readJson(path.join(inputDir, file));

    const parser = new ComponentParser(content);
    const profile = parser.findComponent('character-profile');

    if (!profile) continue;

    const name = ComponentParser.extractText(profile.data.name);
    const description = ComponentParser.extractText(profile.data.desc);

    let rarity = '';
    let type = '';
    let manufacturer = '';

    if (profile.data.attrList) {
      for (const attr of profile.data.attrList) {
        const title = ComponentParser.extractText(attr.title);
        const value = ComponentParser.extractText(attr.content);

        if (title === '品质') {
          rarity = value;
        } else if (title === '类型') {
          type = value;
        } else if (title === '制造方') {
          manufacturer = value;
        }
      }
    }

    const image = profile.data.imageList && profile.data.imageList.length > 0 ? profile.data.imageList[0] : '';

    // Stats
    const stats: Record<string, string> = {};
    const statsComponent = parser.findComponent('skill-info', (data) => data.title === '装备词条');
    if (statsComponent && statsComponent.data.skillList) {
      for (const stat of statsComponent.data.skillList) {
        const name = ComponentParser.extractText(stat.name);
        const value = ComponentParser.extractText(stat.desc);
        if (name && value) {
          stats[name] = value;
        }
      }
    }

    // Set Effect
    const setEffect = [];
    const setComponent = parser.findComponent('skill-info', (data) => data.title === '套装效果');
    if (setComponent && setComponent.data.skillList) {
      for (const effect of setComponent.data.skillList) {
        setEffect.push({
          name: ComponentParser.extractText(effect.name),
          description: ComponentParser.extractText(effect.desc),
        });
      }
    }

    // Stats (Fight Info)
    const fightInfo = parser.findAllComponents('fight-info');
    const statsList = [];
    for (const info of fightInfo) {
      if (info.data.levelList) {
        for (const levelData of info.data.levelList) {
          const level = levelData.level;
          const attributes = [];
          if (levelData.levelInfoList) {
            for (const attr of levelData.levelInfoList) {
              attributes.push({
                name: ComponentParser.extractText(attr.title),
                value: ComponentParser.extractText(attr.content)
              });
            }
          }
          statsList.push({
            title: info.data.title, // e.g. "精锻1阶"
            level,
            attributes
          });
        }
      }
    }

    // Crafting Materials (upgrade-info)
    const craftingMaterials = [];
    const upgradeComponent = parser.findComponent('upgrade-info');
    if (upgradeComponent && upgradeComponent.data.upgradeList) {
      for (const upgrade of upgradeComponent.data.upgradeList) {
        const title = ComponentParser.extractText(upgrade.title);
        const items: any[] = [];
        const images: string[] = [];
        const texts: string[] = [];

        // 1. Collect structured items and images
        if (upgrade.content && Array.isArray(upgrade.content)) {
          for (const contentItem of upgrade.content) {
            if (contentItem.avatar) {
              // Structured format
              const filename = path.basename(contentItem.avatar);
              const name = materialMap.get(filename) || 'Unknown';
              items.push({ name, count: contentItem.name, icon: contentItem.avatar });
            } else if (contentItem.type === 'simpleEditor') {
              // Image inside editor
              const imgs = ComponentParser.extractImages(contentItem);
              images.push(...imgs);
            }
          }
        }

        // 2. Collect text descriptions
        if (upgrade.other && Array.isArray(upgrade.other)) {
          for (const otherItem of upgrade.other) {
            const text = ComponentParser.extractText(otherItem);
            if (text) texts.push(text);
          }
        }

        // 3. Merge images and texts if items is empty
        if (items.length === 0) {
          // Assume 1-to-1 mapping if lengths match
          const maxLength = Math.max(images.length, texts.length);
          for (let i = 0; i < maxLength; i++) {
            const img = images[i];
            const text = texts[i];

            let name = 'Unknown';
            let count = '?';

            if (text) {
              const match = text.match(/^(.*)[x×](\d+)$/); // Support x or ×
              if (match) {
                name = match[1]!.trim();
                count = match[2]!;
              } else {
                name = text;
              }
            }

            if (!name || name === 'Unknown') {
              if (img) {
                const filename = path.basename(img);
                name = materialMap.get(filename) || 'Unknown';
              }
            }

            if (name !== 'Unknown' || img) {
              items.push({ name, count, icon: img || '' });
            }
          }
        }

        if (items.length > 0) {
          craftingMaterials.push({ title, items });
        }
      }
    }

    const eq = {
      id: content.content_id,
      sourceUrl: `https://www.gamekee.com/zmd/${content.content_id}.html`,
      name,
      description,
      rarity,
      type,
      manufacturer,
      stats,
      statsList,
      setEffect,
      craftingMaterials,
      image
    };
    equipment.push(eq);

    await fs.outputJson(path.join(outputDir, 'equipment', `${content.content_id}.json`), eq, { spaces: 2 });
  }

  // await fs.outputJson(path.join(outputDir, 'equipment.json'), equipment, { spaces: 2 });
  console.log(`Parsed ${equipment.length} equipment.`);
}
