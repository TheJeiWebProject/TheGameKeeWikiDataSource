
import fs from 'fs-extra';
import path from 'path';

async function analyzeComponents() {
    const rawDir = path.resolve('data/raw');
    const categories = ['怪物图鉴', '武器图鉴', '装备图鉴'];
    
    const componentTypes = new Set<string>();
    const samples: Record<string, any> = {};

    function scanComponents(list: any[], category: string) {
        if (!Array.isArray(list)) return;
        for (const comp of list) {
            const key = `${category}:${comp.type}`;
            componentTypes.add(key);
            
            if (!samples[key]) {
                // Simplified sample
                samples[key] = { type: comp.type, key: comp.key, title: comp.title, dataKeys: comp.data ? Object.keys(comp.data) : [] };
            }

            // Recursive search
            if (comp.data && Array.isArray(comp.data)) {
                scanComponents(comp.data, category);
            }
        }
    }

    for (const cat of categories) {
        const dir = path.join(rawDir, cat);
        if (!await fs.pathExists(dir)) continue;
        
        const files = await fs.readdir(dir);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const content = await fs.readJson(path.join(dir, file));
            
            if (content.content_json) {
                try {
                    const components = JSON.parse(content.content_json);
                    scanComponents(components, cat);
                } catch (e) {
                    console.error(`Error parsing ${file}`);
                }
            }
        }
    }

    console.log('Component Types Found:', Array.from(componentTypes));
    console.log('Samples:', JSON.stringify(samples, null, 2));
}

analyzeComponents();
