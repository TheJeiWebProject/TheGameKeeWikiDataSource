
import fs from 'fs-extra';
import path from 'path';

async function analyzeFightInfo() {
    const rawDir = path.resolve('data/raw/怪物图鉴');
    const files = await fs.readdir(rawDir);
    
    for (const file of files.slice(0, 5)) { // Check first 5 files
        if (!file.endsWith('.json')) continue;
        const content = await fs.readJson(path.join(rawDir, file));
        
        if (content.content_json) {
            try {
                const components = JSON.parse(content.content_json);
                const fightInfo = findComponent(components, 'fight-info');
                if (fightInfo) {
                    console.log(`\n--- ${content.title} (${file}) ---`);
                    console.log(JSON.stringify(fightInfo, null, 2));
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    function findComponent(list: any[], type: string): any {
        for (const comp of list) {
            if (comp.type === type) return comp;
            if (comp.data && Array.isArray(comp.data)) {
                const found = findComponent(comp.data, type);
                if (found) return found;
            }
        }
    }
}

analyzeFightInfo();
