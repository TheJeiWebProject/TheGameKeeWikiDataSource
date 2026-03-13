import fs from 'fs-extra';
import path from 'path';

export async function parseMaterials(inputDir: string, outputDir: string): Promise<Map<string, string>> {
    const files = await fs.readdir(inputDir);
    const materialMap = new Map<string, string>();
    const targetDir = path.join(outputDir, 'materials');
    await fs.ensureDir(targetDir);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
            const content = await fs.readJson(path.join(inputDir, file));
            
            // Map logic
            if (content.title && content.thumb) {
                // thumb can be comma separated list, take first
                const thumbUrl = content.thumb.split(',')[0];
                const filename = path.basename(thumbUrl);
                materialMap.set(filename, content.title);
            }

            // Output logic
            const material = {
                id: content.content_id,
                sourceUrl: `https://www.gamekee.com/zmd/${content.content_id}.html`,
                name: content.title,
                icon: content.thumb?.split(',')[0] || '',
                description: content.summary || '',
                rarity: 3 // Default or extract if possible
            };
            
            await fs.outputJson(path.join(targetDir, `${content.content_id}.json`), material, { spaces: 2 });

        } catch (e) {
            console.error(`Failed to parse material ${file}`, e);
        }
    }
    
    console.log(`Parsed ${materialMap.size} materials from ${inputDir}.`);
    return materialMap;
}