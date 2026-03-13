
import fs from 'fs-extra';
import path from 'path';
import { ComponentParser } from './utils.js';

export async function parseMonsters(inputDir: string, outputDir: string) {
  const files = await fs.readdir(inputDir);
  const monsters = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await fs.readJson(path.join(inputDir, file));

    const parser = new ComponentParser(content);
    const profile = parser.findComponent('character-profile');

    if (!profile) continue;

    const name = ComponentParser.extractText(profile.data.name);
    const description = ComponentParser.extractText(profile.data.desc);

    let type = '';
    let faction = '';
    let distribution = '';
    let drops: string[] = [];

    if (profile.data.attrList) {
      for (const attr of profile.data.attrList) {
        const title = ComponentParser.extractText(attr.title);
        const value = ComponentParser.extractText(attr.content);

        if (title === '类型') {
          type = value;
        } else if (title === '阵营') {
          faction = value;
        } else if (title === '分布区域') {
          distribution = value;
        } else if (title === '掉落物品') {
          drops = value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        }
      }
    }

    const image = profile.data.imageList && profile.data.imageList.length > 0 ? profile.data.imageList[0] : '';

    // Parse Resistances (fight-info)
    const resistances: Record<string, string> = {};
    const fightInfo = parser.findComponent('fight-info', (data) => data.title === '敌人抗性');

    if (fightInfo && fightInfo.data.levelList && fightInfo.data.levelList.length > 0) {
      // Usually take the first level available or specific level if needed
      // Here we just take the first entry in levelList which seems to represent max level or standard
      const levelData = fightInfo.data.levelList[0];
      if (levelData && levelData.levelInfoList) {
        for (const info of levelData.levelInfoList) {
          const key = ComponentParser.extractText(info.title);
          const val = ComponentParser.extractText(info.content);
          if (key && val) {
            resistances[key] = val;
          }
        }
      }
    }

    // Parse Skills (skill-info)
    const skills = [];
    const skillComponents = parser.findAllComponents('skill-info');
    for (const comp of skillComponents) {
      if (comp.data.skillList) {
        for (const skill of comp.data.skillList) {
          skills.push({
            category: comp.data.title, // e.g. "特殊能力"
            name: ComponentParser.extractText(skill.name),
            description: ComponentParser.extractText(skill.desc),
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

    const monster = {
      id: content.content_id,
      sourceUrl: `https://www.gamekee.com/zmd/${content.content_id}.html`,
      name,
      description,
      type,
      faction,
      distribution,
      drops,
      image,
      images,
      resistances,
      skills
    };
    monsters.push(monster);

    await fs.outputJson(path.join(outputDir, 'monsters', `${content.content_id}.json`), monster, { spaces: 2 });
  }

  // await fs.outputJson(path.join(outputDir, 'monsters.json'), monsters, { spaces: 2 });
  console.log(`Parsed ${monsters.length} monsters.`);
}
