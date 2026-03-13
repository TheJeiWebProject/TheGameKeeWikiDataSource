
import fs from 'fs-extra';
import path from 'path';
import { GridParser, ComponentParser } from './utils.js';

export async function parseOperators(inputDir: string, outputDir: string) {
    const files = await fs.readdir(inputDir);
    const targetDir = path.join(outputDir, 'operators');
    await fs.ensureDir(targetDir);
    const operators = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readJson(path.join(inputDir, file));

        let op: any = {};
        const opSourceUrl = `https://www.gamekee.com/zmd/${content.content_id}.html`;

        // Case 1: Structured Data (GridParser)
        if (content.entry_data_bind) {
            const parser = new GridParser(content);

            // Helper for materials
            const getMaterials = (prefix: string, max: number = 3) => {
                const materials = [];
                for (let i = 1; i <= max; i++) {
                    const name = parser.getValue(`${prefix}.hc${i}.name`);
                    const count = parser.getValue(`${prefix}.hc${i}.count`);
                    if (name) materials.push({ name, count });
                }
                return materials;
            };

            // Parse Voice
            const voices = [];
            for (let i = 1; i <= 100; i++) {
                const prefix = `base.voice.v${i}`;
                const title = parser.getValue(`${prefix}.cj`); // Scene/Trigger
                if (!title) break;
                voices.push({
                    title,
                    text: parser.getValue(`${prefix}.desc`),
                    audio: {
                        zh: parser.getValue(`${prefix}.lang.zh.mp3`),
                        jp: parser.getValue(`${prefix}.lang.jp.mp3`),
                        en: parser.getValue(`${prefix}.lang.en.mp3`)
                    }
                });
            }

            op = {
                id: content.content_id,
                sourceUrl: opSourceUrl,
                name: parser.getValue('base.role.name') || content.title,
                rarity: parseInt(parser.getValue('base.role.star') || '0') || 5,
                profession: parser.getValue('base.role.zy'),
                element: parser.getValue('base.role.attr'),
                weaponType: parser.getValue('base.role.weaponType'),
                description: parser.getValue('base.role.desc') || content.summary,
                tags: [
                    parser.getValue('base.role.tag1'),
                    parser.getValue('base.role.tag2'),
                    parser.getValue('base.role.tag3')
                ].filter(Boolean),

                // Images
                avatar: parser.getValue('base.role.avatar'),
                portrait: parser.getValue('base.role.avatar1'),
                splash: parser.getValue('base.role.avatar2'),

                // Stats
                stats: {
                    hp: {
                        min: parser.getValue('base.attr.smz.val.l01'),
                        max: parser.getValue('base.attr.smz.val.l90')
                    },
                    atk: {
                        min: parser.getValue('base.attr.gjl.val.l01'),
                        max: parser.getValue('base.attr.gjl.val.l90')
                    },
                    def: {
                        min: parser.getValue('base.attr.fyl.val.l01'),
                        max: parser.getValue('base.attr.fyl.val.l90')
                    }
                },

                // Skills
                skills: [
                    // Normal Attack / Chain Skill (lxj)
                    {
                        type: 'Normal',
                        name: parser.getValue('base.skill.lxj.name'),
                        description: parser.getValue('base.skill.lxj.desc'),
                        icon: parser.getValue('base.skill.lxj.icon'),
                        video: parser.getValue('base.skill.lxj.video'),
                        levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(lv => ({
                            level: lv,
                            value: parser.getValue(`base.skill.lxj.level.rank1.l${lv}.num`)
                        })).filter(l => l.value)
                    },
                    // Combat Skill (zj)
                    {
                        type: 'Skill',
                        name: parser.getValue('base.skill.zj.name'),
                        description: parser.getValue('base.skill.zj.desc'),
                        icon: parser.getValue('base.skill.zj.icon'),
                        video: parser.getValue('base.skill.zj.video'),
                        levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(lv => ({
                            level: lv,
                            value: parser.getValue(`base.skill.zj.level.rank1.l${lv}.num`)
                        })).filter(l => l.value)
                    },
                    // Ultimate (zjgj)
                    {
                        type: 'Ultimate',
                        name: parser.getValue('base.skill.zjgj.name'),
                        description: parser.getValue('base.skill.zjgj.desc'),
                        icon: parser.getValue('base.skill.zjgj.icon'),
                        video: parser.getValue('base.skill.zjgj.video'),
                        levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(lv => ({
                            level: lv,
                            value: parser.getValue(`base.skill.zjgj.level.rank1.l${lv}.num`)
                        })).filter(l => l.value)
                    }
                ].filter(s => s.name),

                // Talents (Passives)
                talents: [
                    ...[1, 2].map(i => {
                        const prefix = `base.talent.gytf.tf${i}`;
                        const name = parser.getValue(`${prefix}.name`);
                        if (!name) return null;

                        const upgrades = [1, 2, 3].map(lv => {
                            const upPrefix = `${prefix}.update.lv_${lv}`;
                            return {
                                level: lv,
                                description: parser.getValue(`${upPrefix}.desc`),
                                materials: getMaterials(`${upPrefix}.hc`, 2)
                            };
                        });

                        return {
                            name,
                            icon: parser.getValue(`${prefix}.icon`),
                            description: upgrades[upgrades.length - 1]?.description, // Max level desc
                            upgrades
                        };
                    }),
                    // Psychic Talent (xlts)
                    (() => {
                        const prefix = 'base.talent.xlts';
                        const title = parser.getValue(`${prefix}.title`);
                        if (!title) return null;
                        const upgrades = [1, 2, 3, 4].map(lv => {
                            const upPrefix = `${prefix}.update.lv_${lv}`;
                            return {
                                level: lv,
                                // desc is not directly there, maybe derived? Or just materials?
                                // JSON has nlz, xld.
                                nlz: parser.getValue(`${upPrefix}.nlz`),
                                xld: parser.getValue(`${upPrefix}.xld`),
                                materials: getMaterials(`${upPrefix}.hc`, 2)
                            };
                        });
                        return {
                            name: title,
                            icon: parser.getValue(`${prefix}.icon`),
                            upgrades
                        };
                    })()
                ].filter(Boolean),

                // Base Skills (Logistics)
                baseSkills: [
                    {
                        name: parser.getValue('base.talent.hqjl.skill1.lv_2.name'),
                        description: parser.getValue('base.talent.hqjl.skill1.lv_2.desc'),
                        icon: parser.getValue('base.talent.hqjl.skill1.lv_1.icon'),
                        materials: getMaterials('base.talent.hqjl.skill1.lv_2.hc', 2) // Unlock materials?
                    },
                    {
                        name: parser.getValue('base.talent.hqjl.skill2.lv_2.name'),
                        description: parser.getValue('base.talent.hqjl.skill2.lv_2.desc'),
                        icon: parser.getValue('base.talent.hqjl.skill2.lv_1.icon'),
                        materials: getMaterials('base.talent.hqjl.skill2.lv_2.hc', 2)
                    }
                ].filter(s => s.name),

                // Potential
                potential: [1, 2, 3, 4, 5].map(i => ({
                    rank: i,
                    name: parser.getValue(`base.potential.p${i}.name`),
                    description: parser.getValue(`base.potential.p${i}.desc`)
                })).filter(p => p.name),

                // Ascension (Elite)
                ascension: [1, 2, 3, 4].map(rank => {
                    const prefix = `base.elite.e${rank}.jy`;
                    const level = parser.getValue(`${prefix}.lv`);
                    const materials = getMaterials(`${prefix}.hc`, 3);

                    if (!level && materials.length === 0) return null;

                    return {
                        rank,
                        level,
                        materials
                    };
                }).filter(Boolean),

                // Archive (Files)
                archive: {
                    base: parser.getValue('base.archive.base'),
                    personnel: parser.getValue('base.archive.personnel'),
                    docs: [1, 2, 3, 4].map(i => parser.getValue(`base.archive.doc${i}`)).filter(Boolean)
                },

                // News (Profile)
                profile: {
                    expertise: [1, 2].map(i => ({
                        name: parser.getValue(`base.news.expertise.e${i}.name`),
                        desc: parser.getValue(`base.news.expertise.e${i}.desc`),
                        type: parser.getValue(`base.news.expertise.e${i}.type`)
                    })).filter(x => x.name),
                    hobbies: [1, 2].map(i => ({
                        name: parser.getValue(`base.news.hobby.h${i}.name`),
                        desc: parser.getValue(`base.news.hobby.h${i}.desc`),
                        type: parser.getValue(`base.news.hobby.h${i}.type`)
                    })).filter(x => x.name),
                    gifts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i =>
                        parser.getValue(`base.news.gift.g${i}.name`)
                    ).filter(Boolean)
                },

                // Weapon Break Materials
                weaponBreakMaterials: {
                    normal: [2, 3, 4, 5, 6, 7, 8, 9].map(rank => ({
                        rank,
                        materials: [1, 2, 3].map(l => ({
                            name: parser.getValue(`base.breakMaterial.normal.rank${rank}.l${l}.name`),
                            count: parser.getValue(`base.breakMaterial.normal.rank${rank}.l${l}.count`)
                        })).filter(m => m.name)
                    })).filter(r => r.materials.length > 0),
                    end: [2, 3, 4, 5, 6, 7, 8, 9].map(rank => ({
                        rank,
                        materials: [1, 2, 3].map(l => ({
                            name: parser.getValue(`base.breakMaterial.end.rank${rank}.l${l}.name`),
                            count: parser.getValue(`base.breakMaterial.end.rank${rank}.l${l}.count`)
                        })).filter(m => m.name)
                    })).filter(r => r.materials.length > 0),
                    skillMaterials: ['normal', 'end'].reduce((acc, type) => {
                        acc[type] = [1, 2, 3].map(skillIdx => ({
                            skillId: skillIdx,
                            levels: [1, 2, 3, 4, 5].map(lv => ({
                                level: lv,
                                materials: ({
                                    name: parser.getValue(`base.breakMaterial.${type}.zj${skillIdx}.l${lv}.name`),
                                    count: parser.getValue(`base.breakMaterial.${type}.zj${skillIdx}.l${lv}.count`)
                                })
                            })).filter(l => l.materials.name)
                        }));
                        return acc;
                    }, {} as any)
                },

                voices
            };
        }
        // Case 2: Unstructured Data (ComponentParser) - Fallback for "Loxi" etc.
        else {
            const parser = new ComponentParser(content);
            const profile = parser.findComponent('character-profile');

            // Basic Info
            const name = ComponentParser.extractText(profile?.data?.name) || content.title;
            const desc = ComponentParser.extractText(profile?.data?.desc) || content.summary;
            const attrList = profile?.data?.attrList || [];

            const getAttr = (key: string) => {
                const item = attrList.find((a: any) => ComponentParser.extractText(a.title) === key);
                return item ? ComponentParser.extractText(item.content) : undefined;
            };

            const rarityStr = getAttr('品质'); // e.g. "6★"
            const rarity = rarityStr ? parseInt(rarityStr) : 5;

            // Images
            const images = [];
            const tabInfo = parser.findComponent('tab-info');
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

            // Skills & Talents
            const skills = [];
            const talents = [];
            const skillComponents = parser.findAllComponents('skill-info');

            for (const comp of skillComponents) {
                const title = comp.data.title; // "战斗技能" or "干员天赋"
                const list = comp.data.skillList || [];

                for (const item of list) {
                    const skillName = ComponentParser.extractText(item.name);
                    const skillDesc = ComponentParser.extractText(item.desc);
                    const skillIcon = item.icon;

                    if (title?.includes('天赋')) {
                        talents.push({
                            name: skillName,
                            description: skillDesc,
                            icon: skillIcon
                        });
                    } else {
                        skills.push({
                            name: skillName,
                            description: skillDesc,
                            icon: skillIcon
                        });
                    }
                }
            }

            op = {
                id: content.content_id,
                sourceUrl: opSourceUrl,
                name,
                rarity,
                profession: getAttr('职业'),
                element: getAttr('属性'),
                faction: getAttr('阵营'),
                race: getAttr('种族'),
                cv: {
                    zh: getAttr('中文CV'),
                    jp: getAttr('日文CV')
                },
                description: desc,
                tags: getAttr('定位')?.split('、'), // "破防、击飞..."
                avatar: profile?.data?.imageList?.[0], // First image as avatar
                images,
                skills,
                talents,
                stats: null // Stats missing in this format
            };
        }

        operators.push(op);
        await fs.outputJson(path.join(targetDir, `${op.id}.json`), op, { spaces: 2 });
    }

    console.log(`Parsed ${operators.length} operators.`);
}
